import { NextRequest, NextResponse } from 'next/server'
import { getLiveStreamUrl, getMediaEventList } from '@/lib/api/tracksolid'

export async function POST(req: NextRequest) {
  try {
    const { accessToken, imei, imeis, channel, appId, action, mediaType, startTime, endTime } = await req.json()
    if (!accessToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (action === 'livestream') {
      const result = await getLiveStreamUrl(accessToken, imei, channel, appId)
      return NextResponse.json({ success: true, data: (result as any).result })
    } else {
      const result = await getMediaEventList(accessToken, imeis || imei, mediaType || '2', startTime, endTime)
      return NextResponse.json({ success: true, data: result })
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
