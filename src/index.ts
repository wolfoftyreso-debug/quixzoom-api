import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import dotenv from 'dotenv'
import { missionsRouter } from './routes/missions'
import { webhooksRouter } from './routes/webhooks'
import { adminRouter } from './routes/admin'
import { healthRouter } from './routes/health'
import { billingRouter } from './routes/billing'
import { notificationsRouter } from './routes/notifications'
import { authMiddleware } from './middleware/auth'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
  'https://app.quixzoom.com',
  'https://quixzoom.com',
  'https://wavult-os.pages.dev',
  'https://os.wavult.com',
]

app.use(helmet())
app.disable('x-powered-by')
app.use(cors({ origin: allowedOrigins }))
app.use(express.json())

app.use('/health', healthRouter)
app.use('/api/missions', authMiddleware, missionsRouter)
app.use('/api/admin', authMiddleware, adminRouter)
app.use('/api/billing', billingRouter)
app.use('/api/notifications', notificationsRouter)
app.use('/webhooks', webhooksRouter)

app.listen(PORT, () => console.log(`quiXzoom API running on :${PORT}`))

export default app
