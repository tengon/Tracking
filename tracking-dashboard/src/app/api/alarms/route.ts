import { NextResponse } from 'next/server'
import { getAlarms } from '@/lib/db/database'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const limit = Number(searchParams.get('limit')) || 100

    const alarms = getAlarms(limit)
    return NextResponse.json({ success: true, data: alarms })
  } catch (error: any) {
    console.error('Failed to get alarms:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
