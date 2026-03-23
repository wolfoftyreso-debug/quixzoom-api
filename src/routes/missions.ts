import { Router, Request, Response } from 'express'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export const missionsRouter = Router()

// GET /api/missions?lat=&lng=&radius_km=&status=
missionsRouter.get('/', async (req: Request, res: Response) => {
  const { lat, lng, radius_km = 50, status } = req.query
  let query = supabase.from('missions').select('*').eq('status', status || 'open')

  if (lat && lng) {
    // Bounding box filter (simplified geo — 1 degree lat ≈ 111 km)
    const r = Number(radius_km) / 111
    query = query
      .gte('location_lat', Number(lat) - r)
      .lte('location_lat', Number(lat) + r)
      .gte('location_lng', Number(lng) - r)
      .lte('location_lng', Number(lng) + r)
  }

  const { data, error } = await query.limit(100)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ missions: data })
})

// POST /api/missions/:id/assign
missionsRouter.post('/:id/assign', async (req: Request, res: Response) => {
  const { photographer_id } = req.body
  if (!photographer_id) return res.status(400).json({ error: 'photographer_id required' })

  const { data, error } = await supabase
    .from('missions')
    .update({
      photographer_id,
      status: 'assigned',
      updated_at: new Date().toISOString(),
    })
    .eq('id', req.params.id)
    .eq('status', 'open')
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  if (!data) return res.status(404).json({ error: 'Mission not found or already assigned' })
  res.json({ mission: data })
})

// POST /api/missions/:id/complete
missionsRouter.post('/:id/complete', async (req: Request, res: Response) => {
  const { image_urls, notes } = req.body

  const { data, error } = await supabase
    .from('missions')
    .update({
      status: 'completed',
      image_urls: image_urls || [],
      notes: notes || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', req.params.id)
    .eq('status', 'assigned')
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  if (!data) return res.status(404).json({ error: 'Mission not found or not in assigned state' })
  res.json({ mission: data })
})

// POST /api/missions — Create new mission
missionsRouter.post('/', async (req: Request, res: Response) => {
  const { title, description, location_lat, location_lng, client_id, reward_amount, deadline } = req.body

  if (!title || location_lat == null || location_lng == null) {
    return res.status(400).json({ error: 'title, location_lat, location_lng required' })
  }

  const { data, error } = await supabase
    .from('missions')
    .insert({
      title,
      description,
      location_lat,
      location_lng,
      client_id,
      reward_amount,
      deadline,
      status: 'open',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.status(201).json({ mission: data })
})

// DELETE /api/missions/:id — Cancel mission
missionsRouter.delete('/:id', async (req: Request, res: Response) => {
  const { data, error } = await supabase
    .from('missions')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  if (!data) return res.status(404).json({ error: 'Mission not found' })
  res.json({ mission: data })
})
