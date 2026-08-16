import { NextRequest, NextResponse } from 'next/server'
import { streamText, Output, createTextStreamResponse, toTextStream } from 'ai'
import { openai } from '@ai-sdk/openai'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { curriculumSchema, generateCurriculumSchema } from '@/lib/validations'

export async function POST(req: NextRequest) {
  const { isAuthenticated, userId: clerkId } = await auth()

  if (!isAuthenticated) {
    return new Response('Unauthorized', { status: 401 })
  }

  const body = await req.json()
  const parsed = generateCurriculumSchema.safeParse(body)

  if (!parsed.success) {
    return new Response('Invalid input', { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where: { clerkId: clerkId! },
  })

  if (!user) {
    return new Response('User not found', { status: 404 })
  }

  // Enforce the Free plan limit: max 3 topics
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

  const result = streamText({
    model: openai('gpt-5-mini'),
    output: Output.object({
      schema: curriculumSchema,
    }),
    prompt: `You are an expert curriculum designer applying evidence-based learning science (retrieval practice, spaced repetition, interleaving).

Create a structured learning curriculum for the topic: "${parsed.data.topicTitle}"

Generate 3 to 5 modules that build on each other logically. Each module must include:
- A clear, specific title
- A concise content summary (2-3 paragraphs) explaining the core concept
- 3 to 5 active recall flashcards (question + answer) that test understanding, not just memorization

Avoid trivial yes/no questions. Favor "why" and "how" questions that force genuine recall.`,
  })

  // Fire-and-forget: save to DB once the full object is ready,
  // without blocking the streamed response below.
  void Promise.resolve(result.output)
    .then(async (curriculum) => {
      await prisma.topic.create({
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
      })
    })
    .catch((err) => {
      console.error('Failed to save generated curriculum:', err)
    })

  return createTextStreamResponse({
    stream: toTextStream({ stream: result.stream }),
  })
}