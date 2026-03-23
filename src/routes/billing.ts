/**
 * billing.ts
 * Stripe billing routes — checkout session, customer portal
 * quiXzoom API
 */

import { Router, Request, Response } from 'express'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
})

export const billingRouter = Router()

// POST /api/billing/checkout
// Creates a Stripe Checkout session for a subscription plan
billingRouter.post('/checkout', async (req: Request, res: Response) => {
  try {
    const { priceId, userId } = req.body as { priceId: string; userId: string }

    if (!priceId) {
      return res.status(400).json({ error: 'priceId is required' })
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.APP_URL || 'http://localhost:5173'}/billing?success=true`,
      cancel_url: `${process.env.APP_URL || 'http://localhost:5173'}/billing`,
      metadata: { userId: userId ?? '' },
    })

    return res.json({ sessionId: session.id })
  } catch (err) {
    console.error('[billing/checkout]', err)
    return res.status(500).json({ error: (err as Error).message })
  }
})

// POST /api/billing/portal
// Creates a Stripe Customer Portal session for managing subscriptions/invoices
billingRouter.post('/portal', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.body as { customerId: string }

    if (!customerId) {
      return res.status(400).json({ error: 'customerId is required' })
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.APP_URL || 'http://localhost:5173'}/billing`,
    })

    return res.json({ url: session.url })
  } catch (err) {
    console.error('[billing/portal]', err)
    return res.status(500).json({ error: (err as Error).message })
  }
})
