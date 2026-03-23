import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { missionsRouter } from './routes/missions'
import { webhooksRouter } from './routes/webhooks'
import { adminRouter } from './routes/admin'
import { healthRouter } from './routes/health'
import { billingRouter } from './routes/billing'
import { notificationsRouter } from './routes/notifications'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') || '*' }))
app.use(express.json())

app.use('/health', healthRouter)
app.use('/api/missions', missionsRouter)
app.use('/api/admin', adminRouter)
app.use('/api/billing', billingRouter)
app.use('/api/notifications', notificationsRouter)
app.use('/webhooks', webhooksRouter)

app.listen(PORT, () => console.log(`quiXzoom API running on :${PORT}`))

export default app
