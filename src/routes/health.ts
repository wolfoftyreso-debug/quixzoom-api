import { Router } from 'express'

export const healthRouter = Router()

healthRouter.get('/', (_, res) => {
  res.json({ status: 'ok', version: '1.0.0', ts: new Date().toISOString() })
})
