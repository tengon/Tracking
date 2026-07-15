import { NextRequest, NextResponse } from 'next/server'
import { getOBDData } from '@/lib/api/tracksolid'

export async function POST(req: NextRequest) {
  try {
    const { accessToken, imei, beginTime, endTime } = await req.json()
    if (!accessToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const result = await getOBDData(accessToken, imei, beginTime, endTime)
    return NextResponse.json({ success: true, data: (result as any).data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
