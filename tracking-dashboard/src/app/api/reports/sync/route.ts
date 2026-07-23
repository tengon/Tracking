import { NextRequest, NextResponse } from 'next/server'
import {
  getMileageData,
  getTripsReport,
  getParkingData,
  getAlarmList,
  getFenceDurationReport,
  getOBDData,
} from '@/lib/api/tracksolid'
import {
  upsertMileageReport,
  upsertTripsReport,
  upsertParkingReport,
  upsertAlarmReport,
  upsertGeofenceDuration,
  upsertOBDReport,
  getLastSyncedAt,
} from '@/lib/db/postgres'

type ReportType = 'mileage' | 'trips' | 'parking' | 'alarm' | 'geofence' | 'obd'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      accessToken,
      account = 'bitauto',
      reportType,
      imei,
      imeis,
      beginTime,
      endTime,
      accType = 'off',
      fenceId = '',
    }: {
      accessToken: string
      account?: string
      reportType: ReportType
      imei?: string
      imeis?: string[]
      beginTime: string
      endTime: string
      accType?: 'on' | 'off'
      fenceId?: string
    } = body

    if (!accessToken) {
      return NextResponse.json({ success: false, error: 'Unauthorized: no access token' }, { status: 401 })
    }
    if (!reportType) {
      return NextResponse.json({ success: false, error: 'reportType is required' }, { status: 400 })
    }
    if (!beginTime || !endTime) {
      return NextResponse.json({ success: false, error: 'beginTime and endTime are required' }, { status: 400 })
    }

    const targetImeis: string[] = imeis?.length ? imeis : imei ? [imei] : []
    const imeiStr = targetImeis.join(',')

    // ── 1. Fetch from Jimi API ────────────────────────────────────────────────
    let apiResult: any = null
    let apiError: string | null = null

    try {
      switch (reportType) {
        case 'mileage':
          apiResult = await getMileageData(accessToken, imeiStr, beginTime, endTime)
          break
        case 'trips':
          apiResult = await getTripsReport(accessToken, account, imeiStr, beginTime, endTime)
          break
        case 'parking':
          apiResult = await getParkingData(accessToken, account, imeiStr, beginTime, endTime, accType)
          break
        case 'alarm':
          apiResult = await getAlarmList(accessToken, imeiStr || targetImeis[0] || '', beginTime, endTime)
          break
        case 'geofence':
          apiResult = await getFenceDurationReport(accessToken, account, imeiStr, beginTime, endTime, fenceId)
          break
        case 'obd':
          apiResult = await getOBDData(accessToken, imeiStr, beginTime, endTime, account)
          break
      }
    } catch (err: any) {
      apiError = err?.message || String(err)
      console.warn(`[Sync] Jimi API error for ${reportType}:`, apiError)
    }

    // ── 2. Normalize and save to PostgreSQL ───────────────────────────────────
    const rawList: any[] = apiResult?.result?.result ?? apiResult?.result ?? apiResult?.data?.result ?? []
    const records = Array.isArray(rawList) ? rawList : []

    let savedCount = 0

    if (records.length > 0) {
      switch (reportType) {
        case 'mileage': {
          const rows = records.map((r: any) => ({
            account,
            imei: r.imei || imeiStr,
            deviceName: r.deviceName || r.device_name,
            date: r.startTime?.slice(0, 10) || r.date || beginTime.slice(0, 10),
            totalMileage: r.distance != null ? r.distance / 1000 : r.totalMileage,
            runTime: r.elapsed != null ? Math.round(r.elapsed / 60) : r.runTime,
            idleTime: r.idleTime,
            maxSpeed: r.maxSpeed,
            avgSpeed: r.avgSpeed,
            fuelConsumed: r.fuelConsumed,
            raw: r,
          }))
          const res = await upsertMileageReport(rows)
          savedCount = res.count
          break
        }

        case 'trips': {
          const rows = records.map((r: any) => ({
            account,
            imei: r.imei || imeiStr,
            deviceName: r.deviceName || r.device_name,
            tripId: r.tripId || r.trip_id,
            startTime: r.startTime || r.start_time,
            endTime: r.endTime || r.end_time,
            startLat: r.startLat ?? r.start_lat,
            startLng: r.startLng ?? r.start_lng,
            startAddress: r.startAddress || r.start_address || r.startAddr,
            endLat: r.endLat ?? r.end_lat,
            endLng: r.endLng ?? r.end_lng,
            endAddress: r.endAddress || r.end_address || r.endAddr,
            distanceKm: r.distance != null ? r.distance / 1000 : r.distanceKm,
            durationMin: r.elapsed != null ? Math.round(r.elapsed / 60) : (r.duration || r.durationMin),
            avgSpeed: r.avgSpeed ?? r.avg_speed,
            maxSpeed: r.maxSpeed ?? r.max_speed,
            raw: r,
          }))
          const res = await upsertTripsReport(rows)
          savedCount = res.count
          break
        }

        case 'parking': {
          const rows = records.map((r: any) => ({
            account,
            imei: r.imei || imeiStr,
            deviceName: r.deviceName || r.device_name,
            startTime: r.startTime || r.start_time,
            endTime: r.endTime || r.end_time,
            durationMin: r.durSecond != null ? Math.round(Number(r.durSecond) / 60) : (r.durationMinutes || r.duration_min),
            accStatus: r.acc || r.accStatus || r.acc_status,
            lat: r.lat,
            lng: r.lng,
            address: r.addr || r.address,
            raw: r,
          }))
          const res = await upsertParkingReport(rows)
          savedCount = res.count
          break
        }

        case 'alarm': {
          const rows = records.map((r: any) => ({
            account,
            imei: r.imei || imeiStr,
            deviceName: r.deviceName || r.device_name,
            alarmId: r.alarmId || r.alarm_id,
            alarmType: r.alarmType || r.alarm_type,
            alarmCode: r.alertTypeId || r.alarmCode || r.alarm_type || 'UNKNOWN',
            alarmTime: r.alarmTime || r.alarm_time,
            severity: r.severity || 'Warning',
            lat: r.lat,
            lng: r.lng,
            address: r.address || r.addr,
            speed: r.speed != null ? Number(r.speed) : null,
            raw: r,
          }))
          const res = await upsertAlarmReport(rows)
          savedCount = res.count
          break
        }

        case 'geofence': {
          const rows = records.map((r: any) => ({
            account,
            imei: r.imei || imeiStr,
            deviceName: r.deviceName || r.device_name,
            fenceId: r.fenceId || r.fence_id,
            fenceName: r.fenceName || r.fence_name,
            enterTime: r.enterTime || r.enter_time,
            exitTime: r.exitTime || r.exit_time,
            dwellMin: r.durationSecond != null ? Math.round(Number(r.durationSecond) / 60) : (r.dwellMinutes || r.dwell_min),
            alertType: r.alertType || r.alert_type,
            raw: r,
          }))
          const res = await upsertGeofenceDuration(rows)
          savedCount = res.count
          break
        }

        case 'obd': {
          const rows = records.map((r: any) => ({
            account,
            imei: r.imei || imeiStr,
            deviceName: r.deviceName || r.device_name,
            reportTime: r.dataReportTime || r.reportTime || r.report_time,
            odometer: r.odometerReading != null ? Number(r.odometerReading) : (r.deviceAccumulatedMileage != null ? Number(r.deviceAccumulatedMileage) : r.odometer),
            fuelLevel: r.remainingFuelPercentage != null ? Number(r.remainingFuelPercentage) : r.fuelLevel,
            coolantTemp: r.coolantTemperature != null ? Number(r.coolantTemperature) : r.coolantTemp,
            batteryVoltage: r.vehicleBatterVoltage != null ? Number(r.vehicleBatterVoltage) : r.batteryVoltage,
            rpm: r.currentRPM != null ? Number(r.currentRPM) : r.rpm,
            speed: r.currentSpeed != null ? Number(r.currentSpeed) : r.speed,
            dtcCount: r.dtcCount ?? 0,
            raw: r,
          }))
          const res = await upsertOBDReport(rows)
          savedCount = res.count
          break
        }
      }
    }

    // ── 3. Get last sync metadata ─────────────────────────────────────────────
    const lastSynced = await getLastSyncedAt(reportType, targetImeis[0] || undefined, account)

    return NextResponse.json({
      success: true,
      reportType,
      apiMethod: getApiMethodName(reportType),
      fetched: records.length,
      saved: savedCount,
      lastSynced: lastSynced?.toISOString() ?? null,
      apiError: apiError ?? undefined,
    })

  } catch (error: any) {
    console.error('[reports/sync] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

function getApiMethodName(type: ReportType) {
  const map: Record<ReportType, string> = {
    mileage: 'jimi.device.track.mileage',
    trips: 'jimi.open.platform.report.trips',
    parking: 'jimi.open.platform.report.parking',
    alarm: 'jimi.device.alarm.list',
    geofence: 'jimi.open.platform.fence.duration',
    obd: 'jimi.device.obd.list',
  }
  return map[type]
}
