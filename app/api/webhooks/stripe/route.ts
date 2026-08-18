import { headers } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = (await headers()).get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.error('Stripe webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;

      if (!userId) break;

      await prisma.subscription.upsert({
        where: { userId },
        update: {
          stripeCustomerId: session.customer as string,
          stripeSubId: session.subscription as string,
          status: 'active',
        },
        create: {
          userId,
          stripeCustomerId: session.customer as string,
          stripeSubId: session.subscription as string,
          status: 'active',
        },
      });

      await prisma.user.update({
        where: { id: userId },
        data: { plan: 'pro' },
      });

      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      const stripeSubId = subscription.id;

      const existing = await prisma.subscription.findFirst({
        where: { stripeSubId },
      });

      if (!existing) break;

      await prisma.subscription.update({
        where: { userId: existing.userId },
        data: { status: 'cancelled' },
      });

      await prisma.user.update({
        where: { id: existing.userId },
        data: { plan: 'free' },
      });

      break;
    }

    default:
      console.log(`Unhandled Stripe event type: ${event.type}`);
  }

  return NextResponse.json({ received: true });
}
