import { NextRequest, NextResponse } from 'next/server'
import { generateText, Output } from 'ai'
import { openai } from '@ai-sdk/openai'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { curriculumSchema, generateCurriculumSchema } from '@/lib/validations'
import { redis } from '@/lib/redis'

export async function POST(req: NextRequest) {
  const { isAuthenticated, userId: clerkId } = await auth()

  if (!isAuthenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const parsed = generateCurriculumSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where: { clerkId: clerkId! },
  })

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  if (user.plan === 'free') {
    const topicCount = await prisma.topic.count({
      where: { userId: user.id },
    })

    if (topicCount >= 3) {
      return NextResponse.json(
        {
          error: 'Free plan limit reached. Upgrade to Pro for unlimited topics.',
          code: 'PLAN_LIMIT_REACHED',
        },
        { status: 403 }
      )
    }
  }

  const cacheKey = `curriculum:${parsed.data.topicTitle.trim().toLowerCase()}`

  const cached = await redis.get<{
    modules: { title: string; content: string; cards: { question: string; answer: string }[] }[]
  }>(cacheKey)

  const curriculum =
    cached ??
    (
      await generateText({
        model: openai('gpt-5-mini'),
        output: Output.object({ schema: curriculumSchema }),
        prompt: `You are an expert curriculum designer applying evidence-based learning science (retrieval practice, spaced repetition, interleaving).

Create a structured learning curriculum for the topic: "${parsed.data.topicTitle}"

Generate 3 to 5 modules that build on each other logically. Each module must include:
- A clear, specific title
- A concise content summary (2-3 paragraphs) explaining the core concept
- 3 to 5 active recall flashcards (question + answer) that test understanding, not just memorization

Avoid trivial yes/no questions. Favor "why" and "how" questions that force genuine recall.`,
      })
    ).output

  // Cache miss only: store this fresh generation for future requests
  if (!cached) {
    await redis.set(cacheKey, curriculum, { ex: 60 * 60 * 24 * 7 })
  }

  // Persist this user's own Topic and get back the real DB IDs
  const topic = await prisma.topic.create({
    data: {
      userId: user.id,
      title: parsed.data.topicTitle,
      status: 'active',
      modules: {
        create: curriculum.modules.map((module, index) => ({
          title: module.title,
          content: module.content,
          orderIndex: index,
          cards: {
            create: module.cards.map((card) => ({
              question: card.question,
              answer: card.answer,
            })),
          },
        })),
      },
    },
    include: {
      modules: {
        orderBy: { orderIndex: 'asc' },
        include: { cards: true },
      },
    },
  })

  return NextResponse.json({ modules: topic.modules })
}