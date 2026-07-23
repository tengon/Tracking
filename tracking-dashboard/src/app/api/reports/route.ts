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
  getReportFromDB,
  upsertMileageReport,
  upsertTripsReport,
  upsertParkingReport,
  upsertAlarmReport,
  upsertGeofenceDuration,
  upsertOBDReport,
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
      startTime,
      stopTime,
      accType = 'off',
      fenceId = '',
    } = body

    const targetImeis: string[] = imeis?.length ? imeis : imei ? [imei] : []
    const imeiStr = targetImeis.join(',')
    const fromTime = beginTime || startTime || ''
    const toTime = endTime || stopTime || ''

    // ── Layer 1: Live Jimi API ────────────────────────────────────────────────
    let liveRecords: any[] | null = null

    if (accessToken) {
      try {
        let apiResult: any = null
        switch (reportType as ReportType) {
          case 'mileage':
            apiResult = await getMileageData(accessToken, imeiStr, fromTime, toTime)
            break
          case 'trips':
            apiResult = await getTripsReport(accessToken, account, imeiStr, fromTime, toTime)
            break
          case 'parking':
            apiResult = await getParkingData(accessToken, account, imeiStr, fromTime, toTime, accType)
            break
          case 'alarm':
            apiResult = await getAlarmList(accessToken, imeiStr || targetImeis[0] || '', fromTime, toTime)
            break
          case 'geofence':
            apiResult = await getFenceDurationReport(accessToken, account, imeiStr, fromTime, toTime, fenceId)
            break
          case 'obd':
            apiResult = await getOBDData(accessToken, imeiStr, fromTime, toTime, account)
            break
          default:
            return NextResponse.json({ success: false, error: `Invalid report type: ${reportType}` }, { status: 400 })
        }

        const rawList: any[] = apiResult?.result?.result ?? apiResult?.result ?? apiResult?.data?.result ?? []
        if (Array.isArray(rawList) && rawList.length > 0) {
          liveRecords = rawList
          // Auto-save live data to PostgreSQL in background
          saveToDb(reportType as ReportType, rawList, account, imeiStr).catch(err =>
            console.warn('[reports] Auto-save to DB failed:', err?.message)
          )
        }
      } catch (err: any) {
        console.warn(`[reports] Jimi API ${reportType} warn:`, err?.message)
      }
    }

    if (liveRecords && liveRecords.length > 0) {
      return NextResponse.json({
        success: true,
        source: 'live',
        apiMethod: getApiMethodName(reportType),
        fetched: liveRecords.length,
        message: `Ditemukan ${liveRecords.length} record dari server Jimi IoT (tersimpan ke PostgreSQL).`,
        data: liveRecords,
      })
    }

    // ── Layer 2: PostgreSQL Cache Fallback ────────────────────────────────────
    try {
      const dbRows = await getReportFromDB(reportType as ReportType, {
        account,
        imei: imeiStr || undefined,
        fromTime: fromTime || undefined,
        toTime: toTime || undefined,
      })
      if (dbRows.length > 0) {
        return NextResponse.json({
          success: true,
          source: 'db',
          apiMethod: getApiMethodName(reportType),
          fetched: dbRows.length,
          message: `Menampilkan ${dbRows.length} record dari cache database PostgreSQL (Tidak terdapat data baru pada Server).`,
          data: dbRows,
        })
      }
    } catch (dbErr: any) {
      console.warn('[reports] DB query warn:', dbErr?.message)
    }

    // ── Layer 3: Zero records found anywhere ──────────────────────────────────
    return NextResponse.json({
      success: true,
      source: 'empty',
      apiMethod: getApiMethodName(reportType),
      fetched: 0,
      message: 'Tidak ada record data ditemukan di server Jimi IoT maupun database untuk periode dan filter ini.',
      data: [],
    })

  } catch (error: any) {
    console.error('[reports] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function saveToDb(type: ReportType, records: any[], account: string, imeiStr: string) {
  switch (type) {
    case 'mileage':
      await upsertMileageReport(records.map(r => ({
        account,
        imei: r.imei || imeiStr,
        deviceName: r.deviceName || r.device_name,
        date: r.startTime?.slice(0, 10) || r.date || new Date().toISOString().slice(0, 10),
        totalMileage: r.distance != null ? r.distance / 1000 : r.totalMileage,
        runTime: r.elapsed != null ? Math.round(r.elapsed / 60) : r.runTime,
        idleTime: r.idleTime,
        maxSpeed: r.maxSpeed,
        avgSpeed: r.avgSpeed,
        fuelConsumed: r.fuelConsumed,
        raw: r,
      })))
      break

    case 'trips':
      await upsertTripsReport(records.map(r => ({
        account,
        imei: r.imei || imeiStr,
        deviceName: r.deviceName || r.device_name,
        tripId: r.tripId || r.trip_id,
        startTime: r.startTime || r.start_time,
        endTime: r.endTime || r.end_time,
        startLat: r.startLat ?? r.start_lat,
        startLng: r.startLng ?? r.start_lng,
        startAddress: r.startAddress || r.startAddr,
        endLat: r.endLat ?? r.end_lat,
        endLng: r.endLng ?? r.end_lng,
        endAddress: r.endAddress || r.endAddr,
        distanceKm: r.distance != null ? r.distance / 1000 : r.distanceKm,
        durationMin: r.elapsed != null ? Math.round(r.elapsed / 60) : (r.duration || r.durationMin),
        avgSpeed: r.avgSpeed ?? r.avg_speed,
        maxSpeed: r.maxSpeed ?? r.max_speed,
        raw: r,
      })))
      break

    case 'parking':
      await upsertParkingReport(records.map(r => ({
        account,
        imei: r.imei || imeiStr,
        deviceName: r.deviceName || r.device_name,
        startTime: r.startTime || r.start_time,
        endTime: r.endTime || r.end_time,
        durationMin: r.durSecond != null ? Math.round(Number(r.durSecond) / 60) : (r.durationMinutes || r.duration_min),
        accStatus: r.acc || r.accStatus,
        lat: r.lat,
        lng: r.lng,
        address: r.addr || r.address,
        raw: r,
      })))
      break

    case 'alarm':
      await upsertAlarmReport(records.map(r => ({
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
      })))
      break

    case 'geofence':
      await upsertGeofenceDuration(records.map(r => ({
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
      })))
      break

    case 'obd':
      await upsertOBDReport(records.map(r => ({
        account,
        imei: r.imei || imeiStr,
        deviceName: r.deviceName || r.device_name,
        reportTime: r.dataReportTime || r.reportTime,
        odometer: r.odometerReading != null ? Number(r.odometerReading) : r.odometer,
        fuelLevel: r.remainingFuelPercentage != null ? Number(r.remainingFuelPercentage) : r.fuelLevel,
        coolantTemp: r.coolantTemperature != null ? Number(r.coolantTemperature) : r.coolantTemp,
        batteryVoltage: r.vehicleBatterVoltage != null ? Number(r.vehicleBatterVoltage) : r.batteryVoltage,
        rpm: r.currentRPM != null ? Number(r.currentRPM) : r.rpm,
        speed: r.currentSpeed != null ? Number(r.currentSpeed) : r.speed,
        dtcCount: r.dtcCount ?? 0,
        raw: r,
      })))
      break
  }
}

function getApiMethodName(type: string) {
  const map: Record<string, string> = {
    mileage: 'jimi.device.track.mileage',
    trips: 'jimi.open.platform.report.trips',
    parking: 'jimi.open.platform.report.parking',
    alarm: 'jimi.device.alarm.list',
    geofence: 'jimi.open.platform.fence.duration',
    obd: 'jimi.device.obd.list',
  }
  return map[type] ?? 'jimi.unknown'
}
