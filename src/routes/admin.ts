import { Router, Request, Response } from 'express'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export const adminRouter = Router()

// GET /api/admin/stats — Dashboard summary
adminRouter.get('/stats', async (_: Request, res: Response) => {
  const [missions, photographers, alerts, payouts] = await Promise.all([
    supabase.from('missions').select('status', { count: 'exact' }),
    supabase.from('profiles').select('id', { count: 'exact' }).eq('role', 'photographer'),
    supabase.from('optic_alerts').select('id', { count: 'exact' }),
    supabase.from('payout_requests').select('id', { count: 'exact' }).eq('status', 'pending'),
  ])

  res.json({
    missions: { count: missions.count },
    photographers: { count: photographers.count },
    alerts: { count: alerts.count },
    pending_payouts: { count: payouts.count },
    ts: new Date().toISOString(),
  })
})

// GET /api/admin/payouts — List pending payouts
adminRouter.get('/payouts', async (_: Request, res: Response) => {
  const { data, error } = await supabase
    .from('payout_requests')
    .select('*, profiles(display_name, email)')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  if (error) return res.status(500).json({ error: error.message })
  res.json({ payouts: data })
})

// POST /api/admin/payouts/approve/:id
adminRouter.post('/payouts/approve/:id', async (req: Request, res: Response) => {
  const { data, error } = await supabase
    .from('payout_requests')
    .update({
      status: 'approved',
      processed_at: new Date().toISOString(),
    })
    .eq('id', req.params.id)
    .eq('status', 'pending')
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  if (!data) return res.status(404).json({ error: 'Payout not found or already processed' })
  res.json({ payout: data })
})

// POST /api/admin/payouts/reject/:id
adminRouter.post('/payouts/reject/:id', async (req: Request, res: Response) => {
  const { reason } = req.body
  const { data, error } = await supabase
    .from('payout_requests')
    .update({
      status: 'rejected',
      rejection_reason: reason || null,
      processed_at: new Date().toISOString(),
    })
    .eq('id', req.params.id)
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  if (!data) return res.status(404).json({ error: 'Payout not found' })
  res.json({ payout: data })
})

// GET /api/admin/photographers — List all photographers
adminRouter.get('/photographers', async (_: Request, res: Response) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'photographer')
    .order('created_at', { ascending: false })

  if (error) return res.status(500).json({ error: error.message })
  res.json({ photographers: data })
})

// PATCH /api/admin/photographers/:id — Update photographer status
adminRouter.patch('/photographers/:id', async (req: Request, res: Response) => {
  const { verified, suspended } = req.body
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (verified !== undefined) updates.verified = verified
  if (suspended !== undefined) updates.suspended = suspended

  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.json({ photographer: data })
})
