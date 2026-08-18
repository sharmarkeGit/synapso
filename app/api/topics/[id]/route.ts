// app/api/topics/[id]/route.ts
//
// No `onDelete: Cascade` is set in the schema, so deleting a Topic directly
// would fail with a foreign key constraint violation as long as any Card,
// FeynmanCheck, or Review still references it. This deletes children in
// dependency order inside a single transaction:
//   Review (references Card) -> FeynmanCheck (references Module)
//   -> Card (references Module) -> Module (references Topic) -> Topic

import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Topic.userId stores your internal User.id, not the Clerk id directly,
  // so resolve the User row first (adjust if you already have this pattern
  // centralized in a helper elsewhere in your API routes).
  const user = await prisma.user.findUnique({ where: { clerkId } });

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const topic = await prisma.topic.findUnique({ where: { id } });

  if (!topic || topic.userId !== user.id) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
  }

  await prisma.$transaction([
    prisma.review.deleteMany({ where: { card: { module: { topicId: id } } } }),
    prisma.feynmanCheck.deleteMany({ where: { module: { topicId: id } } }),
    prisma.card.deleteMany({ where: { module: { topicId: id } } }),
    prisma.module.deleteMany({ where: { topicId: id } }),
    prisma.topic.delete({ where: { id } }),
  ]);

  return NextResponse.json({ success: true });
}
