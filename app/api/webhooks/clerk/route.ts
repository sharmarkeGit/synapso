import { verifyWebhook } from '@clerk/nextjs/webhooks'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const evt = await verifyWebhook(req)

    if (evt.type === 'user.created') {
      const { id, email_addresses, first_name, last_name } = evt.data

      await prisma.user.upsert({
        where: { clerkId: id },
        update: {},
        create: {
          clerkId: id,
          email: email_addresses[0].email_address,
          name: [first_name, last_name].filter(Boolean).join(' ') || null,
        },
      })
    }

    if (evt.type === 'user.deleted') {
      const { id } = evt.data
      if (id) {
        await prisma.user.deleteMany({
          where: { clerkId: id },
        })
      }
    }

    return new Response('OK', { status: 200 })
  } catch (err) {
    console.error('Webhook verification failed:', err)
    return new Response('Signature invalide', { status: 400 })
  }
}