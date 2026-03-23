import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export interface NotificationPayload {
  title: string
  body: string
  data?: Record<string, string>
}

export async function sendPushToNearbyPhotographers(
  missionId: string,
  lat: number,
  lng: number,
  radiusKm: number,
  payload: NotificationPayload
) {
  // Bounding box-beräkning (1 grad lat ≈ 111km)
  const latDelta = radiusKm / 111
  const lngDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180))

  // Hämta aktiva push tokens för fotografer inom bounding box
  const { data: tokens, error } = await supabase
    .from('push_tokens')
    .select('token, photographer_id, photographer_lat, photographer_lng')
    .eq('active', true)
    .gte('photographer_lat', lat - latDelta)
    .lte('photographer_lat', lat + latDelta)
    .gte('photographer_lng', lng - lngDelta)
    .lte('photographer_lng', lng + lngDelta)

  if (error) {
    console.error('Error fetching push tokens:', error.message)
    return { sent: 0, error: error.message }
  }

  if (!tokens?.length) {
    console.log(`No nearby photographers found for mission ${missionId}`)
    return { sent: 0 }
  }

  console.log(`Sending push to ${tokens.length} nearby photographers for mission ${missionId}`)

  // TODO: Integrera med Expo Push API för faktisk push-leverans
  // import Expo from 'expo-server-sdk'
  // const expo = new Expo()
  // const messages = tokens.map(t => ({
  //   to: t.token,
  //   sound: 'default',
  //   title: payload.title,
  //   body: payload.body,
  //   data: payload.data,
  // }))
  // const chunks = expo.chunkPushNotifications(messages)
  // for (const chunk of chunks) await expo.sendPushNotificationsAsync(chunk)

  return {
    sent: tokens.length,
    missionId,
    payload,
    recipients: tokens.map((t) => t.photographer_id),
  }
}

export async function sendPushToPhotographer(
  photographerId: string,
  payload: NotificationPayload
) {
  const { data: tokenRow, error } = await supabase
    .from('push_tokens')
    .select('token')
    .eq('photographer_id', photographerId)
    .eq('active', true)
    .single()

  if (error || !tokenRow) {
    console.log(`No active push token for photographer ${photographerId}`)
    return { sent: 0 }
  }

  console.log(`Push to photographer ${photographerId}: ${payload.title}`)

  // TODO: Skicka via Expo/FCM/APNs
  // await sendSinglePush(tokenRow.token, payload)

  return { sent: 1, token: tokenRow.token, payload }
}
