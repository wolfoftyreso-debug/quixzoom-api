import { Router } from 'express'
import { createClient } from '@supabase/supabase-js'

const startTime = Date.now()

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || ''
)

export const healthRouter = Router()

healthRouter.get('/', async (_, res) => {
  const uptime = Math.floor((Date.now() - startTime) / 1000)

  let supabaseStatus = 'unknown'
  try {
    const { error } = await supabase.from('missions').select('id').limit(1)
    supabaseStatus = error ? 'error' : 'connected'
  } catch {
    supabaseStatus = 'disconnected'
  }

  res.json({
    status: 'ok',
    version: '1.0.0',
    uptime: `${uptime}s`,
    supabase: supabaseStatus,
    timestamp: new Date().toISOString()
  })
})
