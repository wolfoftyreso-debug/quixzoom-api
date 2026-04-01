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

// GET /api/admin/submissions — List submissions with status filter
adminRouter.get('/submissions', async (req: Request, res: Response) => {
  const { status = 'pending', mission_id } = req.query

  let query = supabase
    .from('mission_submissions')
    .select('*, missions(title, reward_amount, reward_currency), profiles!mission_submissions_photographer_id_fkey(full_name, email, push_token)')
    .order('submitted_at', { ascending: false })

  if (status && status !== 'all') {
    query = query.eq('status', status as string)
  }
  if (mission_id) {
    query = query.eq('mission_id', mission_id as string)
  }

  const { data, error } = await query.limit(100)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ submissions: data })
})

// POST /api/admin/submissions/:id/approve — Approve submission + credit wallet
adminRouter.post('/submissions/:id/approve', async (req: Request, res: Response) => {
  const { id } = req.params
  const { payout_amount } = req.body

  // Use service-role admin id (system approval)
  // For real admin tracking, pass admin user_id from auth header; here we use a sentinel
  const admin_id = req.headers['x-admin-id'] as string | undefined

  if (!admin_id) {
    return res.status(400).json({ error: 'x-admin-id header required' })
  }

  const { data, error } = await supabase.rpc('approve_submission', {
    p_submission_id: id,
    p_admin_id: admin_id,
    p_payout_amount: payout_amount != null ? Number(payout_amount) : null,
  })

  if (error) return res.status(500).json({ error: error.message })
  return res.json(data)
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
