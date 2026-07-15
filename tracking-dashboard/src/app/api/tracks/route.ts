import { NextRequest, NextResponse } from 'next/server'
import { getTrackList, getMileageData } from '@/lib/api/tracksolid'

export async function POST(req: NextRequest) {
  try {
    const { accessToken, imei, imeis, beginTime, endTime, action } = await req.json()
    if (!accessToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    let result
    if (action === 'mileage') {
      result = await getMileageData(accessToken, imeis || imei, beginTime, endTime)
      return NextResponse.json({ success: true, data: result })
    } else {
      result = await getTrackList(accessToken, imei, beginTime, endTime)
      return NextResponse.json({ success: true, data: result })
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
