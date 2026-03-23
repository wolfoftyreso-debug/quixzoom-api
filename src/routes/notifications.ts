import { Router, Request, Response } from 'express'
import {
  sendPushToNearbyPhotographers,
  sendPushToPhotographer,
} from '../services/notifications.service'

export const notificationsRouter = Router()

// POST /api/notifications/mission-available
// Kallas av webhook/trigger när nytt uppdrag publiceras
notificationsRouter.post('/mission-available', async (req: Request, res: Response) => {
  const { missionId, lat, lng, radiusKm = 10, title, reward } = req.body

  if (!missionId || lat == null || lng == null) {
    return res.status(400).json({ error: 'missionId, lat, lng required' })
  }

  const result = await sendPushToNearbyPhotographers(
    missionId,
    Number(lat),
    Number(lng),
    Number(radiusKm),
    {
      title: '📍 Nytt uppdrag i närheten',
      body: title ? `${title}${reward ? ` — €${reward}` : ''}` : 'Kolla kartan!',
      data: { missionId: String(missionId), type: 'new_mission' },
    }
  )

  res.json(result)
})

// POST /api/notifications/submission-reviewed
// Kallas när klient godkänner/avvisar ett foto
notificationsRouter.post('/submission-reviewed', async (req: Request, res: Response) => {
  const { photographerId, missionTitle, status, reward } = req.body

  if (!photographerId || !status) {
    return res.status(400).json({ error: 'photographerId, status required' })
  }

  const payload =
    status === 'approved'
      ? {
          title: '✅ Inlämning godkänd!',
          body: missionTitle
            ? `${missionTitle}${reward ? ` — €${reward} betalas ut` : ''}`
            : 'Din inlämning godkändes',
          data: { type: 'submission_approved' },
        }
      : {
          title: '❌ Inlämning avvisad',
          body: missionTitle
            ? `${missionTitle} — kontakta support`
            : 'Din inlämning avvisades — kontakta support',
          data: { type: 'submission_rejected' },
        }

  const result = await sendPushToPhotographer(photographerId, payload)
  res.json(result)
})
