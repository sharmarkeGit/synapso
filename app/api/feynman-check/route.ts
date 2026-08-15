import { NextRequest } from 'next/server'
import { streamText, Output, createTextStreamResponse, toTextStream } from 'ai'
import { openai } from '@ai-sdk/openai'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { feynmanCheckSchema, feynmanEvaluationSchema } from '@/lib/validations'

export async function POST(req: NextRequest) {
  const { isAuthenticated, userId: clerkId } = await auth()

  if (!isAuthenticated) {
    return new Response('Unauthorized', { status: 401 })
  }

  const body = await req.json()
  const parsed = feynmanCheckSchema.safeParse(body)

  if (!parsed.success) {
    return new Response('Invalid input', { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where: { clerkId: clerkId! },
  })

  if (!user) {
    return new Response('User not found', { status: 404 })
  }

  const courseModule = await prisma.module.findUnique({
    where: { id: parsed.data.moduleId },
  })

  if (!courseModule) {
    return new Response('Module not found', { status: 404 })
  }

  const result = streamText({
    model: openai('gpt-5-mini'),
    output: Output.object({
      schema: feynmanEvaluationSchema,
    }),
    prompt: `You are an expert tutor applying the Feynman Technique to evaluate a student's understanding.

Here is the reference content for the concept being tested:
"""
${courseModule.content}
"""

Here is the student's explanation, in their own words:
"""
${parsed.data.userExplanation}
"""

Evaluate the student's explanation:
- List specific things they understood well (be precise, cite what they got right)
- List specific gaps, inaccuracies, or missing pieces compared to the reference content
- Write a short clarification (2-4 sentences) that fills the most important gap in plain language
- Assign a masteryScore from 0 to 100 reflecting how complete and accurate their understanding is

Be encouraging but honest. Do not inflate the score if there are real gaps.`,
  })

  // Fire-and-forget: persist the check once the full evaluation is ready
  void Promise.resolve(result.output)
    .then(async (evaluation) => {
      await prisma.feynmanCheck.create({
        data: {
          moduleId: parsed.data.moduleId,
          userId: user.id,
          userExplanation: parsed.data.userExplanation,
          understoodWell: evaluation.understoodWell,
          gaps: evaluation.gaps,
          clarification: evaluation.clarification,
          masteryScore: Math.round(evaluation.masteryScore),
        },
      })
    })
    .catch((err) => {
      console.error('Failed to save Feynman check:', err)
    })

  return createTextStreamResponse({
    stream: toTextStream({ stream: result.stream }),
  })
}