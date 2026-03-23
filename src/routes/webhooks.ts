import { Router, Request, Response } from 'express'
import express from 'express'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export const webhooksRouter = Router()

// POST /webhooks/stripe
// NOTE: Must use raw body — do NOT apply express.json() before this route
webhooksRouter.post(
  '/stripe',
  express.raw({ type: 'application/json' }),
  async (req: Request, res: Response) => {
    const sig = req.headers['stripe-signature'] as string
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

    if (!webhookSecret) {
      console.error('STRIPE_WEBHOOK_SECRET not set')
      return res.status(500).json({ error: 'Webhook secret not configured' })
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' })

    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      console.error('Stripe signature verification failed:', message)
      return res.status(400).json({ error: `Webhook Error: ${message}` })
    }

    console.log(`Stripe event received: ${event.type}`)

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        // Activate subscription or credit balance for the user
        if (session.customer && session.metadata?.user_id) {
          await supabase
            .from('profiles')
            .update({
              stripe_customer_id: session.customer as string,
              subscription_status: 'active',
              updated_at: new Date().toISOString(),
            })
            .eq('id', session.metadata.user_id)
        }
        break
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice
        console.log(`Invoice paid: ${invoice.id}`)
        // Record payment in billing_events table
        await supabase.from('billing_events').insert({
          stripe_invoice_id: invoice.id,
          customer_id: invoice.customer as string,
          amount: invoice.amount_paid,
          currency: invoice.currency,
          status: 'paid',
          created_at: new Date().toISOString(),
        })
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        // Downgrade user to free tier
        await supabase
          .from('profiles')
          .update({
            subscription_status: 'cancelled',
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_customer_id', subscription.customer as string)
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        await supabase
          .from('profiles')
          .update({
            subscription_status: subscription.status,
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_customer_id', subscription.customer as string)
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    res.json({ received: true })
  }
)
