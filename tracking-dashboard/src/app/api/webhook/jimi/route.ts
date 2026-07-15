import { NextResponse } from 'next/server'
import { insertAlarm } from '@/lib/db/database'

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get('content-type') || ''
    let payloadStr = ''
    
    if (contentType.includes('application/json')) {
      const json = await req.json()
      payloadStr = JSON.stringify(json)
    } else {
      const formData = await req.formData()
      // Sometimes JIMI sends a 'message' field containing the JSON payload
      payloadStr = formData.get('message') as string || formData.get('data') as string
      if (!payloadStr) {
        // Fallback to storing everything as JSON
        const obj: any = {}
        formData.forEach((value, key) => { obj[key] = value })
        payloadStr = JSON.stringify(obj)
      }
    }

    if (!payloadStr) {
      return NextResponse.json({ code: 400, message: 'Empty payload' }, { status: 400 })
    }

    // Try to parse payloadStr as JSON if it's a stringified JSON (like what might come in 'message')
    let alarmData: any = {}
    try {
      alarmData = typeof payloadStr === 'string' ? JSON.parse(payloadStr) : payloadStr
    } catch {
      alarmData = {}
    }

    // Typical JIMI push schema parsing
    const imei = alarmData.imei || alarmData.mac || 'UNKNOWN'
    const alarmType = alarmData.alarmType?.toString() || alarmData.type?.toString() || '0'
    const alarmName = alarmData.alarmName || 'Unknown Alarm'
    const alarmTime = alarmData.gpsTime || alarmData.time || new Date().toISOString()
    const speed = alarmData.speed?.toString() || '0'
    const lat = Number(alarmData.lat) || 0
    const lng = Number(alarmData.lng) || 0

    insertAlarm({
      imei,
      alarm_type: alarmType,
      alarm_name: alarmName,
      alarm_time: alarmTime,
      speed,
      lat,
      lng,
      raw_data: typeof payloadStr === 'string' ? payloadStr : JSON.stringify(payloadStr),
    })

    // JIMI expects a 200 response to stop retrying. Usually returning {"code": 0} or simply "success"
    return NextResponse.json({ code: 0, message: 'success' })
  } catch (error: any) {
    console.error('Webhook Error:', error)
    return NextResponse.json({ code: 500, message: error.message }, { status: 500 })
  }
}
