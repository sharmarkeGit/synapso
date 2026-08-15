import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { createTopicSchema } from '@/lib/validations'

export async function POST(req: NextRequest) {
  const { isAuthenticated, userId: clerkId } = await auth()

  if (!isAuthenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const parsed = createTopicSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const user = await prisma.user.findUnique({
    where: { clerkId: clerkId! },
  })

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const topic = await prisma.topic.create({
    data: {
      userId: user.id,
      title: parsed.data.title,
      description: parsed.data.description,
    },
  })

  return NextResponse.json(topic, { status: 201 })
}

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

  const topics = await prisma.topic.findMany({
  where: { userId: user.id },
  include: {
    modules: {
      orderBy: { orderIndex: 'asc' },
    },
  },
  orderBy: { createdAt: 'desc' },
})

  return NextResponse.json(topics)
}