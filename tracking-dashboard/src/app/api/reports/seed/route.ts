import { NextRequest, NextResponse } from 'next/server'
import { getToken, getDeviceList, getMileageData, getTripsReport, getParkingData, getAlarmList, getFenceDurationReport, getOBDData } from '@/lib/api/tracksolid'
import {
  upsertMileageReport,
  upsertTripsReport,
  upsertParkingReport,
  upsertAlarmReport,
  upsertGeofenceDuration,
  upsertOBDReport,
} from '@/lib/db/postgres'

// ─── Credentials dari account.txt (tengon) ─────────────────────────────────
// account: 754269 | password (md5): 8d20684c3e199af4fca3278206f214d1
// appKey: 8FB345B8693CCD00023DAE386436CBD0 | appSecret: a23b396ab23343baa97a09208853fe61

const TENGON_ACCOUNT = process.env.JIMI_ACCOUNT       || '754269'
const TENGON_PWD_MD5 = process.env.JIMI_PASSWORD_MD5  || '8d20684c3e199af4fca3278206f214d1'

// Helper — UTC date string "YYYY-MM-DD HH:MM:SS" offset from now
function utcDateStr(offsetDays = 0, endOfDay = false): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + offsetDays)
  const pad = (n: number) => String(n).padStart(2, '0')
  const date = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
  return `${date} ${endOfDay ? '23:59:59' : '00:00:00'}`
}

// Helper — sleep to avoid rate-limit 1006
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// Helper — extract result array from any Jimi response shape
function extractList(res: any): any[] {
  const data = res?.result?.result ?? res?.result ?? res?.data?.result ?? res?.data ?? []
  return Array.isArray(data) ? data : []
}

// ─── Main seeder function ──────────────────────────────────────────────────
async function runSeed(opts: {
  accessToken: string
  account: string
  imeis: string[]
  deviceNames: Record<string, string>
  beginTime: string
  endTime: string
  reports: string[]
}): Promise<Record<string, { fetched: number; saved: number; error?: string }>> {
  const { accessToken, account, imeis, deviceNames, beginTime, endTime, reports } = opts
  const summary: Record<string, { fetched: number; saved: number; error?: string }> = {}

  const imeiStr = imeis.join(',')

  // 1. Mileage ─────────────────────────────────────────────────────────────
  if (reports.includes('mileage')) {
    try {
      await sleep(400)
      const res = await getMileageData(accessToken, imeiStr, beginTime, endTime)
      const list = extractList(res)
      const rows = list.map((r: any) => ({
        account,
        imei: r.imei || imeiStr,
        deviceName: deviceNames[r.imei] ?? r.deviceName ?? r.device_name,
        date: (r.startTime || r.date || beginTime).slice(0, 10),
        totalMileage: r.distance != null ? r.distance / 1000 : r.totalMileage,
        runTime: r.elapsed != null ? Math.round(r.elapsed / 60) : r.runTime,
        idleTime: r.idleTime ?? null,
        maxSpeed: r.maxSpeed ?? null,
        avgSpeed: r.avgSpeed ?? null,
        fuelConsumed: r.fuelConsumed ?? null,
        raw: r,
      }))
      const result = await upsertMileageReport(rows)
      summary.mileage = { fetched: list.length, saved: result.count }
    } catch (e: any) {
      summary.mileage = { fetched: 0, saved: 0, error: e.message }
    }
  }

  // 2. Trips ────────────────────────────────────────────────────────────────
  if (reports.includes('trips')) {
    try {
      await sleep(400)
      const res = await getTripsReport(accessToken, account, imeiStr, beginTime, endTime)
      const list = extractList(res)
      const rows = list.map((r: any) => ({
        account,
        imei: r.imei || imeiStr,
        deviceName: deviceNames[r.imei] ?? r.deviceName,
        tripId: r.tripId ?? r.trip_id,
        startTime: r.startTime || r.start_time,
        endTime: r.endTime || r.end_time,
        startLat: r.startLat ?? r.start_lat,
        startLng: r.startLng ?? r.start_lng,
        startAddress: r.startAddress ?? r.startAddr,
        endLat: r.endLat ?? r.end_lat,
        endLng: r.endLng ?? r.end_lng,
        endAddress: r.endAddress ?? r.endAddr,
        distanceKm: r.distance != null ? r.distance / 1000 : r.distanceKm,
        durationMin: r.elapsed != null ? Math.round(r.elapsed / 60) : (r.duration ?? r.durationMin),
        avgSpeed: r.avgSpeed ?? r.avg_speed,
        maxSpeed: r.maxSpeed ?? r.max_speed,
        raw: r,
      }))
      const result = await upsertTripsReport(rows)
      summary.trips = { fetched: list.length, saved: result.count }
    } catch (e: any) {
      summary.trips = { fetched: 0, saved: 0, error: e.message }
    }
  }

  // 3. Parking ──────────────────────────────────────────────────────────────
  if (reports.includes('parking')) {
    try {
      await sleep(400)
      const res = await getParkingData(accessToken, account, imeiStr, beginTime, endTime, 'off')
      const list = extractList(res)
      const rows = list.map((r: any) => ({
        account,
        imei: r.imei || imeiStr,
        deviceName: deviceNames[r.imei] ?? r.deviceName ?? r.device_name,
        startTime: r.startTime || r.start_time,
        endTime: r.endTime || r.end_time,
        durationMin: r.durSecond != null ? Math.round(Number(r.durSecond) / 60) : (r.durationMinutes ?? r.duration_min),
        accStatus: r.acc ?? r.accStatus ?? 'OFF',
        lat: r.lat,
        lng: r.lng,
        address: r.addr ?? r.address,
        raw: r,
      }))
      const result = await upsertParkingReport(rows)
      summary.parking = { fetched: list.length, saved: result.count }
    } catch (e: any) {
      summary.parking = { fetched: 0, saved: 0, error: e.message }
    }
  }

  // 4. Alarms — per IMEI (API only accepts single imei) ────────────────────
  if (reports.includes('alarm')) {
    let totalFetched = 0, totalSaved = 0
    const errors: string[] = []
    for (const imei of imeis) {
      try {
        await sleep(500)
        const res = await getAlarmList(accessToken, imei, beginTime, endTime)
        const list = extractList(res)
        const rows = list.map((r: any) => ({
          account,
          imei,
          deviceName: deviceNames[imei] ?? r.deviceName,
          alarmId: r.alarmId ?? r.alarm_id,
          alarmType: r.alarmType ?? r.alarm_type,
          alarmCode: r.alertTypeId ?? r.alarmCode ?? r.alarm_type ?? 'UNKNOWN',
          alarmTime: r.alarmTime ?? r.alarm_time,
          severity: r.severity ?? 'Warning',
          lat: r.lat,
          lng: r.lng,
          address: r.address ?? r.addr,
          speed: r.speed != null ? Number(r.speed) : null,
          raw: r,
        }))
        const result = await upsertAlarmReport(rows)
        totalFetched += list.length
        totalSaved += result.count
      } catch (e: any) {
        errors.push(`${imei}: ${e.message}`)
      }
    }
    summary.alarm = {
      fetched: totalFetched,
      saved: totalSaved,
      ...(errors.length ? { error: errors.join(' | ') } : {}),
    }
  }

  // 5. Geofence Duration ────────────────────────────────────────────────────
  if (reports.includes('geofence')) {
    try {
      await sleep(400)
      const res = await getFenceDurationReport(accessToken, account, imeiStr, beginTime, endTime, '')
      const list = extractList(res)
      const rows = list.map((r: any) => ({
        account,
        imei: r.imei || imeiStr,
        deviceName: deviceNames[r.imei] ?? r.deviceName,
        fenceId: r.fenceId ?? r.fence_id ?? 'unknown',
        fenceName: r.fenceName ?? r.fence_name,
        enterTime: r.enterTime ?? r.enter_time,
        exitTime: r.exitTime ?? r.exit_time,
        dwellMin: r.durationSecond != null ? Math.round(Number(r.durationSecond) / 60) : (r.dwellMinutes ?? r.dwell_min),
        alertType: r.alertType ?? r.alert_type,
        raw: r,
      }))
      const result = await upsertGeofenceDuration(rows)
      summary.geofence = { fetched: list.length, saved: result.count }
    } catch (e: any) {
      summary.geofence = { fetched: 0, saved: 0, error: e.message }
    }
  }

  // 6. OBD ──────────────────────────────────────────────────────────────────
  if (reports.includes('obd')) {
    try {
      await sleep(400)
      const res = await getOBDData(accessToken, imeiStr, beginTime, endTime, account)
      const list = extractList(res)
      const rows = list.map((r: any) => ({
        account,
        imei: r.imei || imeiStr,
        deviceName: deviceNames[r.imei] ?? r.deviceName,
        reportTime: r.dataReportTime ?? r.reportTime ?? r.report_time,
        odometer: r.odometerReading != null ? Number(r.odometerReading) : (r.deviceAccumulatedMileage != null ? Number(r.deviceAccumulatedMileage) : r.odometer),
        fuelLevel: r.remainingFuelPercentage != null ? Number(r.remainingFuelPercentage) : r.fuelLevel,
        coolantTemp: r.coolantTemperature != null ? Number(r.coolantTemperature) : r.coolantTemp,
        batteryVoltage: r.vehicleBatterVoltage != null ? Number(r.vehicleBatterVoltage) : r.batteryVoltage,
        rpm: r.currentRPM != null ? Number(r.currentRPM) : r.rpm,
        speed: r.currentSpeed != null ? Number(r.currentSpeed) : r.speed,
        dtcCount: r.dtcCount ?? 0,
        raw: r,
      }))
      const result = await upsertOBDReport(rows)
      summary.obd = { fetched: list.length, saved: result.count }
    } catch (e: any) {
      summary.obd = { fetched: 0, saved: 0, error: e.message }
    }
  }

  return summary
}

// ─── POST /api/reports/seed ───────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))

    // Allow override from request body, fall back to env / hardcoded tengon creds
    const userId = body.account ?? TENGON_ACCOUNT
    const pwdMd5 = body.passwordMd5 ?? TENGON_PWD_MD5
    const daysBack = Number(body.daysBack ?? 7)
    const reports: string[] = body.reports ?? ['mileage', 'trips', 'parking', 'alarm', 'geofence', 'obd']

    console.log(`[seed] Authenticating account ${userId}...`)

    // Step 1 — Get access token
    const authRes = await getToken(userId, pwdMd5, 7200)
    const tokenData = (authRes as any).result
    if (!tokenData?.accessToken) {
      return NextResponse.json({ success: false, error: 'Authentication failed — no accessToken returned' }, { status: 401 })
    }
    const accessToken: string = tokenData.accessToken
    const account: string = tokenData.account ?? userId

    console.log(`[seed] Token OK for account: ${account}`)

    // Step 2 — Get device list
    await sleep(500)
    const devRes = await getDeviceList(accessToken, account)
    const devices: any[] = extractList(devRes)

    if (devices.length === 0) {
      return NextResponse.json({
        success: false,
        error: `No devices found for account ${account}. Ensure account is synced.`,
        tip: 'Try calling POST /api/sync/devices first',
      }, { status: 404 })
    }

    const imeis: string[] = devices.map((d: any) => d.imei || d.deviceId).filter(Boolean)
    const deviceNames: Record<string, string> = {}
    devices.forEach((d: any) => {
      const imei = d.imei || d.deviceId
      if (imei) deviceNames[imei] = d.deviceName || d.name || imei
    })

    console.log(`[seed] Found ${imeis.length} devices: ${imeis.slice(0, 5).join(', ')}...`)

    // Step 3 — Build date range (UTC)
    const beginTime = utcDateStr(-daysBack, false)
    const endTime = utcDateStr(0, true)

    console.log(`[seed] Date range: ${beginTime} → ${endTime}`)
    console.log(`[seed] Running reports: ${reports.join(', ')}`)

    // Step 4 — Run all requested reports and save to DB
    const summary = await runSeed({
      accessToken,
      account,
      imeis,
      deviceNames,
      beginTime,
      endTime,
      reports,
    })

    // Totals
    const totalFetched = Object.values(summary).reduce((s, r) => s + r.fetched, 0)
    const totalSaved   = Object.values(summary).reduce((s, r) => s + r.saved, 0)
    const errors       = Object.entries(summary)
      .filter(([, v]) => v.error)
      .map(([k, v]) => `${k}: ${v.error}`)

    return NextResponse.json({
      success: true,
      account,
      devices: imeis.length,
      imeis: imeis.slice(0, 10),
      dateRange: { beginTime, endTime, daysBack },
      reportsRun: reports,
      totalFetched,
      totalSaved,
      summary,
      ...(errors.length ? { warnings: errors } : {}),
    })

  } catch (err: any) {
    console.error('[seed] Fatal error:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

// ─── GET /api/reports/seed — status check (dry-run, no DB write) ─────────────
export async function GET() {
  return NextResponse.json({
    endpoint: 'POST /api/reports/seed',
    description: 'Auto-login with tengon credentials, fetch all 6 Jimi IoT reports, save to PostgreSQL',
    account: TENGON_ACCOUNT,
    usage: {
      minimal: '{}',
      custom: JSON.stringify({
        account: '754269',
        passwordMd5: '8d20684c3e199af4fca3278206f214d1',
        daysBack: 7,
        reports: ['mileage', 'trips', 'parking', 'alarm', 'geofence', 'obd'],
      }),
    },
    tables: ['rpt_mileage', 'rpt_trips', 'rpt_parking', 'rpt_alarms', 'rpt_geofence_duration', 'rpt_obd'],
  })
}
