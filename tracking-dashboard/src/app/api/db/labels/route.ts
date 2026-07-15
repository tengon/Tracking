import { NextRequest, NextResponse } from 'next/server'
import { getDeviceLabels, upsertDeviceLabel, getDeviceLabelByImei } from '@/lib/db/database'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const imei = searchParams.get('imei')

  try {
    if (imei) {
      const data = getDeviceLabelByImei(imei)
      return NextResponse.json({ success: true, data })
    }
    const data = getDeviceLabels()
    return NextResponse.json({ success: true, data })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    if (!body.imei) {
      return NextResponse.json({ success: false, error: 'Missing imei' }, { status: 400 })
    }
    upsertDeviceLabel(body)
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}
