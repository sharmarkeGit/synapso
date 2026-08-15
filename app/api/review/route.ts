import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { submitReviewSchema } from '@/lib/validations'
import { calculateSM2 } from '@/lib/sm2'

export async function POST(req: NextRequest) {
  const { isAuthenticated, userId: clerkId } = await auth()

  if (!isAuthenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const parsed = submitReviewSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where: { clerkId: clerkId! },
  })

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // Find the most recent review for this card by this user, if any
  const previousReview = await prisma.review.findFirst({
    where: { cardId: parsed.data.cardId, userId: user.id },
    orderBy: { reviewedAt: 'desc' },
  })

  const { easeFactor, intervalDays, nextReviewAt } = calculateSM2({
    quality: parsed.data.quality,
    previousEaseFactor: previousReview?.easeFactor ?? 2.5,
    previousIntervalDays: previousReview?.intervalDays ?? 0,
  })

  const review = await prisma.review.create({
    data: {
      cardId: parsed.data.cardId,
      userId: user.id,
      quality: parsed.data.quality,
      easeFactor,
      intervalDays,
      nextReviewAt,
    },
  })

  return NextResponse.json(review, { status: 201 })
}