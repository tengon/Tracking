import { NextRequest, NextResponse } from 'next/server'
import { getRecentLogs, logApiActivity, getAvailableLogFiles, getRawDailyLog } from '@/lib/logger'

// GET /api/logs — Get recent GET, POST, PUSH API logs or log file content
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type') // 'recent' | 'files' | 'raw'
    const limit = Number(searchParams.get('limit') || 100)
    const date = searchParams.get('date') || undefined

    if (type === 'files') {
      const files = getAvailableLogFiles()
      return NextResponse.json({ success: true, files })
    }

    if (type === 'raw') {
      const rawText = getRawDailyLog(date)
      return new NextResponse(rawText, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': `inline; filename="api-${date || 'today'}.log"`,
        },
      })
    }

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
