import { mockDevices } from './mockData'

export interface MileageReportItem {
  imei: string
  deviceName: string
  date: string
  totalMileage: number // in km
  runTime: number // in minutes
  idleTime: number // in minutes
  maxSpeed: number // km/h
  avgSpeed: number // km/h
  fuelConsumed: number // liters
}

export interface TripReportItem {
  tripId: string
  imei: string
  deviceName: string
  startTime: string
  endTime: string
  startAddress: string
  endAddress: string
  startLat: number
  startLng: number
  endLat: number
  endLng: number
  distance: number // in km
  duration: number // in minutes
  avgSpeed: number // km/h
  maxSpeed: number // km/h
}

export interface ParkingReportItem {
  parkingId: string
  imei: string
  deviceName: string
  startTime: string
  endTime: string
  durationMinutes: number
  address: string
  lat: number
  lng: number
  accStatus: 'ON' | 'OFF'
}

export interface AlarmReportItem {
  alarmId: string
  imei: string
  deviceName: string
  alarmType: string
  alarmCode: string
  alarmTime: string
  severity: 'Critical' | 'Warning' | 'Info'
  address: string
  lat: number
  lng: number
  speed: number
}

export interface GeofenceReportItem {
  durationId: string
  fenceId: string
  fenceName: string
  imei: string
  deviceName: string
  enterTime: string
  exitTime: string
  dwellMinutes: number
  alertType: 'ENTER' | 'EXIT' | 'BOTH'
}

export interface OBDReportItem {
  obdId: string
  imei: string
  deviceName: string
  timestamp: string
  odometer: number // km
  fuelLevel: number // %
  coolantTemp: number // °C
  batteryVoltage: number // V
  rpm: number
  speed: number // km/h
  dtcCount: number
}

// ─── Generators ─────────────────────────────────────────────────────────────

export function getMockMileageReport(imeis?: string[]): MileageReportItem[] {
  const devices = imeis?.length
    ? mockDevices.filter(d => imeis.includes(d.imei))
    : mockDevices

  const result: MileageReportItem[] = []
  const today = new Date()

  devices.forEach(dev => {
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().split('T')[0]
      const distance = Math.round((Math.random() * 120 + 35) * 10) / 10
      const runTime = Math.round(distance * 1.8 + Math.random() * 20)
      const idleTime = Math.round(Math.random() * 45 + 10)
      const maxSpeed = Math.round(80 + Math.random() * 35)
      const avgSpeed = Math.round(distance / (runTime / 60))

      result.push({
        imei: dev.imei,
        deviceName: dev.deviceName,
        date: dateStr,
        totalMileage: distance,
        runTime,
        idleTime,
        maxSpeed,
        avgSpeed: isNaN(avgSpeed) ? 42 : avgSpeed,
        fuelConsumed: Math.round((distance * 0.09) * 10) / 10,
      })
    }
  })

  return result
}

export function getMockTripReport(imeis?: string[]): TripReportItem[] {
  const devices = imeis?.length
    ? mockDevices.filter(d => imeis.includes(d.imei))
    : mockDevices

  const locations = [
    { name: 'Soekarno-Hatta Airport (CGK)', lat: -6.1256, lng: 106.6559 },
    { name: 'Tanjung Priok Port, Jakarta', lat: -6.1039, lng: 106.8812 },
    { name: 'Central Park Mall, Grogol', lat: -6.1774, lng: 106.7907 },
    { name: 'SCBD Sudirman, Jakarta Pusat', lat: -6.2253, lng: 106.8098 },
    { name: 'BSD City Industrial Park, Tangerang', lat: -6.3016, lng: 106.6534 },
    { name: 'Bekasi Barat Logistics Hub', lat: -6.2423, lng: 106.9924 },
  ]

  const result: TripReportItem[] = []
  let idCounter = 101

  devices.forEach(dev => {
    for (let i = 0; i < 4; i++) {
      const locStart = locations[i % locations.length]
      const locEnd = locations[(i + 2) % locations.length]
      const date = new Date()
      date.setHours(8 + i * 3, Math.floor(Math.random() * 30), 0)

      const duration = Math.round(35 + Math.random() * 50)
      const endDate = new Date(date.getTime() + duration * 60000)

      const distance = Math.round((duration * 0.65 + Math.random() * 15) * 10) / 10
      const avgSpeed = Math.round((distance / (duration / 60)) * 10) / 10
      const maxSpeed = Math.round(avgSpeed + 25 + Math.random() * 20)

      result.push({
        tripId: `TRIP-${idCounter++}`,
        imei: dev.imei,
        deviceName: dev.deviceName,
        startTime: date.toISOString().replace('T', ' ').slice(0, 19),
        endTime: endDate.toISOString().replace('T', ' ').slice(0, 19),
        startAddress: locStart.name,
        endAddress: locEnd.name,
        startLat: locStart.lat,
        startLng: locStart.lng,
        endLat: locEnd.lat,
        endLng: locEnd.lng,
        distance,
        duration,
        avgSpeed,
        maxSpeed,
      })
    }
  })

  return result
}

export function getMockParkingReport(imeis?: string[]): ParkingReportItem[] {
  const devices = imeis?.length
    ? mockDevices.filter(d => imeis.includes(d.imei))
    : mockDevices

  const parkLocs = [
    { addr: 'Rest Area KM 19 Tol Jakarta-Cikampek', lat: -6.2571, lng: 107.0123 },
    { addr: 'Warehouse B3 - Marunda Logistics Zone', lat: -6.1102, lng: 106.9589 },
    { addr: 'Grand Indonesia Underground Parking B2', lat: -6.1951, lng: 106.8231 },
    { addr: 'Depot Kontainer MM2100 Cikarang', lat: -6.3245, lng: 107.0987 },
  ]

  const result: ParkingReportItem[] = []
  let idCounter = 201

  devices.forEach(dev => {
    for (let i = 0; i < 3; i++) {
      const loc = parkLocs[i % parkLocs.length]
      const startTime = new Date()
      startTime.setHours(7 + i * 5, 15, 0)
      const duration = Math.round(25 + Math.random() * 180)
      const endTime = new Date(startTime.getTime() + duration * 60000)

      result.push({
        parkingId: `PRK-${idCounter++}`,
        imei: dev.imei,
        deviceName: dev.deviceName,
        startTime: startTime.toISOString().replace('T', ' ').slice(0, 19),
        endTime: endTime.toISOString().replace('T', ' ').slice(0, 19),
        durationMinutes: duration,
        address: loc.addr,
        lat: loc.lat,
        lng: loc.lng,
        accStatus: i % 2 === 0 ? 'OFF' : 'ON',
      })
    }
  })

  return result
}

export function getMockAlarmReport(imeis?: string[]): AlarmReportItem[] {
  const devices = imeis?.length
    ? mockDevices.filter(d => imeis.includes(d.imei))
    : mockDevices

  const alarmTypes = [
    { type: 'Overspeed Alarm', code: 'OVERSPEED', severity: 'Warning' as const },
    { type: 'SOS Emergency Button', code: 'SOS', severity: 'Critical' as const },
    { type: 'Geofence Exit Alert', code: 'FENCE_OUT', severity: 'Info' as const },
    { type: 'Main Power Cut', code: 'POWER_CUT', severity: 'Critical' as const },
    { type: 'Vibration / Shock', code: 'VIBRATION', severity: 'Warning' as const },
    { type: 'Harsh Braking Event', code: 'HARSH_BRAKE', severity: 'Warning' as const },
    { type: 'Fatigue Driving Warning', code: 'FATIGUE', severity: 'Critical' as const },
  ]

  const result: AlarmReportItem[] = []
  let idCounter = 301

  devices.forEach(dev => {
    for (let i = 0; i < 3; i++) {
      const alm = alarmTypes[(i + idCounter) % alarmTypes.length]
      const time = new Date()
      time.setHours(9 + i * 4, Math.floor(Math.random() * 59), 0)

      result.push({
        alarmId: `ALM-${idCounter++}`,
        imei: dev.imei,
        deviceName: dev.deviceName,
        alarmType: alm.type,
        alarmCode: alm.code,
        alarmTime: time.toISOString().replace('T', ' ').slice(0, 19),
        severity: alm.severity,
        address: 'Jl. Jend. Sudirman Km 14, Jakarta Pusat',
        lat: -6.2088 + (Math.random() - 0.5) * 0.05,
        lng: 106.8456 + (Math.random() - 0.5) * 0.05,
        speed: alm.code === 'OVERSPEED' ? 98 : Math.round(Math.random() * 40),
      })
    }
  })

  return result
}

export function getMockGeofenceReport(imeis?: string[]): GeofenceReportItem[] {
  const devices = imeis?.length
    ? mockDevices.filter(d => imeis.includes(d.imei))
    : mockDevices

  const fences = [
    { id: 'FENCE-01', name: 'Jakarta HQ Warehouse Zone' },
    { id: 'FENCE-02', name: 'Singapore Transit Hub' },
    { id: 'FENCE-03', name: 'Tanjung Priok Container Terminal' },
    { id: 'FENCE-04', name: 'Bandung Logistics Facility' },
  ]

  const result: GeofenceReportItem[] = []
  let idCounter = 401

  devices.forEach(dev => {
    for (let i = 0; i < 3; i++) {
      const fence = fences[i % fences.length]
      const enter = new Date()
      enter.setHours(6 + i * 5, 20, 0)
      const dwell = Math.round(45 + Math.random() * 150)
      const exit = new Date(enter.getTime() + dwell * 60000)

      result.push({
        durationId: `GF-${idCounter++}`,
        fenceId: fence.id,
        fenceName: fence.name,
        imei: dev.imei,
        deviceName: dev.deviceName,
        enterTime: enter.toISOString().replace('T', ' ').slice(0, 19),
        exitTime: exit.toISOString().replace('T', ' ').slice(0, 19),
        dwellMinutes: dwell,
        alertType: 'BOTH',
      })
    }
  })

  return result
}

export function getMockOBDReport(imeis?: string[]): OBDReportItem[] {
  const devices = imeis?.length
    ? mockDevices.filter(d => imeis.includes(d.imei))
    : mockDevices

  const result: OBDReportItem[] = []
  let idCounter = 501

  devices.forEach(dev => {
    const baseOdo = Math.round(15000 + Math.random() * 50000)
    for (let i = 0; i < 5; i++) {
      const time = new Date()
      time.setHours(8 + i * 2, Math.floor(Math.random() * 50), 0)

      result.push({
        obdId: `OBD-${idCounter++}`,
        imei: dev.imei,
        deviceName: dev.deviceName,
        timestamp: time.toISOString().replace('T', ' ').slice(0, 19),
        odometer: baseOdo + i * 45,
        fuelLevel: Math.round(85 - i * 4.5),
        coolantTemp: Math.round(86 + Math.random() * 8),
        batteryVoltage: Math.round((13.6 + Math.random() * 0.6) * 10) / 10,
        rpm: Math.round(1500 + Math.random() * 1200),
        speed: Math.round(45 + Math.random() * 35),
        dtcCount: i === 4 ? 1 : 0,
      })
    }
  })

  return result
}
