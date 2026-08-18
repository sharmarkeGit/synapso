import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'

type ReviewItem =
  | { type: 'card'; id: string; question: string; answer: string; topicTitle: string }
  | { type: 'feynman'; moduleId: string; moduleTitle: string; moduleContent: string; topicTitle: string }

export async function GET(req: NextRequest) {
  const { isAuthenticated, userId: clerkId } = await auth()

  if (!isAuthenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { clerkId: clerkId! },
  })

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const { searchParams } = new URL(req.url)
  const topicId = searchParams.get('topicId')
  const countOnly = searchParams.get('countOnly') === 'true'

  const now = new Date()

  const topicFilter = topicId
    ? { id: topicId, userId: user.id }
    : { userId: user.id }

  const cards = await prisma.card.findMany({
    where: {
      module: {
        topic: topicFilter,
      },
    },
    include: {
      module: { include: { topic: true } },
      reviews: {
        where: { userId: user.id },
        orderBy: { reviewedAt: 'desc' },
        take: 1,
      },
    },
  })

  const dueCardItems: ReviewItem[] = cards
    .filter((card) => {
      const lastReview = card.reviews[0]
      if (!lastReview) return true
      return lastReview.nextReviewAt <= now
    })
    .map((card) => ({
      type: 'card',
      id: card.id,
      question: card.question,
      answer: card.answer,
      topicTitle: card.module.topic.title,
    }))

  const modules = await prisma.module.findMany({
    where: {
      topic: topicFilter,
    },
    include: {
      topic: true,
      feynmanChecks: {
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  })

  const dueFeynmanItems: ReviewItem[] = modules
    .filter((module) => {
      const lastCheck = module.feynmanChecks[0]
      if (!lastCheck) return true
      return lastCheck.nextReviewAt <= now
    })
    .map((module) => ({
      type: 'feynman',
      moduleId: module.id,
      moduleTitle: module.title,
      moduleContent: module.content,
      topicTitle: module.topic.title,
    }))

  const combined = [...dueCardItems, ...dueFeynmanItems]

if (countOnly) {
  return NextResponse.json(combined)
}

const shuffled = combined.sort(() => Math.random() - 0.5)
const SESSION_LIMIT = 20
const sessionItems = shuffled.slice(0, SESSION_LIMIT)

return NextResponse.json(sessionItems)
}