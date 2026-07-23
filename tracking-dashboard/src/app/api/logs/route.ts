import { NextRequest, NextResponse } from 'next/server'
import { getRecentLogs, logApiActivity } from '@/lib/logger'

// GET /api/logs — Get recent GET, POST, PUSH API logs
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const limit = Number(searchParams.get('limit') || 100)

    const logs = getRecentLogs(limit)
    return NextResponse.json({
      success: true,
      total: logs.length,
      data: logs,
    })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

// POST /api/logs — Manual log entry / Push notification logging
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { method = 'POST', endpoint, request, response, error, status, durationMs } = body

    if (!endpoint) {
      return NextResponse.json({ success: false, error: 'endpoint is required' }, { status: 400 })
    }

    logApiActivity({
      method,
      endpoint,
      status: status || 200,
      durationMs: durationMs || 0,
      request: request || {},
      response: response || {},
      error,
    })

    return NextResponse.json({ success: true, message: 'Log entry saved successfully' })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
