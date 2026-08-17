import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
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

  // Get every card belonging to this user, along with its most recent review
  const cards = await prisma.card.findMany({
    where: {
      module: {
        topic: {
          userId: user.id,
        },
      },
    },
    include: {
      reviews: {
        where: { userId: user.id },
        orderBy: { reviewedAt: 'desc' },
        take: 1,
      },
    },
  })

  const now = new Date()

  const dueCards = cards.filter((card) => {
    const lastReview = card.reviews[0]
    if (!lastReview) return true // never reviewed = due now
    return lastReview.nextReviewAt <= now
  })

  const SESSION_LIMIT = 20
  const sessionCards = dueCards.slice(0, SESSION_LIMIT)

  return NextResponse.json(sessionCards)
}