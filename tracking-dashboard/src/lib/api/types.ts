// TrackSolid API TypeScript Types
// Source: https://tracksolidprodocs.jimicloud.com/

// ─── Common ──────────────────────────────────────────────
export interface ApiResponse<T = unknown> {
  code: number
  message: string
  result?: T
  data?: T
}

// ─── Auth ────────────────────────────────────────────────
export interface TokenResult {
  accessToken: string
  expiresIn: number
  refreshToken: string
  account: string
  appKey: string
  time: string
}

// ─── Device ──────────────────────────────────────────────
export interface Device {
  imei: string
  deviceName: string
  mcType: string
  mcTypeUseScope: string // automobile | electromobile | personal | pet | plane | others
  sim: string
  expiration: string
  activationTime: string
  reMark: string
  vehicleName: string | null
  vehicleIcon: string
  vehicleNumber: string
  vehicleModels: string | null
  carFrame: string
  driverName: string
  driverPhone: string
  enabledFlag: number // 1=available, 0=not available
  engineNumber: string
  deviceGroupId: string
  deviceGroup: string
  iccid?: string
  vin?: string
  vehicleBrand?: string
  fuel_100km?: string
  currentMileage?: string
  status?: string // 0=disable, 1=enable
}

export interface DeviceGroup {
  group_id: string
  group_name: string
}

// ─── Location ────────────────────────────────────────────
export interface DeviceLocation {
  imei: string
  deviceName: string
  mcType?: string
  icon: string
  status: string // "0"=offline, "1"=online
  lat: number
  lng: number
  expireFlag: string // "1"=not expired, "0"=expired
  activationFlag: string // "1"=active, "0"=not active
  posType: string // GPS | LBS | WIFI | BEACON
  locDesc: string | null
  gpsTime: string
  hbTime: string
  speed: string // km/h
  accStatus: string // "0"=off, "1"=on
  batteryPowerVal: string | null // 0-100
  powerValue: string | null // external voltage 0-100
  distance: string
  temperature: string | null
  trackerOil: string | null
  gpsSignal: string // 0-4
  gpsNum: string
  direction: string // 0-360, -1=unknown
  currentMileage: string
  electQuantity: string
  confidence: number | null
  account?: string
  customerName?: string
  iccid?: string
  chargeStatus?: string | null
  shutdown?: string | null
  assignedTo?: string | null
  customColor?: string | null
  _jimiAccount?: string | null
}

// ─── Track ───────────────────────────────────────────────
export interface TrackPoint {
  lat: number
  lng: number
  gpsTime: string
  direction: number
  gpsSpeed: number
  posType: number // 1=GPS, 2=LBS, 3=WIFI
  satellite: number
  ignition: string // ON | OFF
  accStatus: string // ON | OFF
  gpsMode: number // 0=realtime, 1=retransmit
  confidence: number | null
}

export interface MileageTrip {
  imei: string
  startTime: string
  endTime: string
  startLat: number
  startLng: number
  endLat: number
  endLng: number
  elapsed: number // seconds
  distance: number // meters
  avgSpeed: number // km/h
}

export interface MileageSummary {
  imei: string
  totalMileage: number
}

// ─── Parking / Idling ────────────────────────────────────
export interface ParkingRecord {
  imei: string
  startTime: string
  endTime: string
  durSecond: string
  lng: number
  lat: number
  addr: string
  deviceName: string
  mcType: string
  acc: string
  stopSecond: string
}

// ─── Geofence ────────────────────────────────────────────
export interface Geofence {
  fence_id: string
  fence_name: string
  fence_type: 'circle' | 'polygon'
  fence_color: string
  coordinates: string // "lat,lng" for circle | "lat1,lng1;lat2,lng2" for polygon
  radius?: string // meters, for circle
  description?: string
  imeis: string // comma-separated
  alert_type: 'in' | 'out' | 'both'
  stay_time_out?: string | null
  stay_time_in?: string | null
  account: string
}

// ─── Alarm ───────────────────────────────────────────────
export interface Alarm {
  imei: string
  alarmType: string
  alertTypeId?: string
  lat?: number
  lng?: number
  alarmTime: string
  deviceName?: string
  address?: string
  speed?: string
}

// ─── OBD ─────────────────────────────────────────────────
export interface OBDRecord {
  imei: string
  dataReportTime: string
  odometerReading: string
  deviceAccumulatedMileage: string
  remainingFuel: string | null
  remainingFuelPercentage: string
  coolantTemperature: string
  vehicleBatterVoltage: string
  currentRPM: string
  currentSpeed: string
  vin: string
}

// ─── Media ───────────────────────────────────────────────
export interface MediaFile {
  thumb_URL: string
  file_URL: string
  mime_type: string
  create_time: number // Unix timestamp
  alarm_time: number
  media_type: number // 1=photo, 2=video
  camera: number // 0=front, 1=inward
  file_size: string
}

export interface MediaEvent {
  imei: string
  event_type_id: string
  event_type: string
  lat: string
  lng: string
  alarm_time: number
  create_time: number
  assignedTo?: string | null
  customColor?: string | null
  fileList: {
    media_type: number
    mime_type: string
    thumb_URL: string
    file_URL: string
    camera: number
    file_size: string
  }[]
}

// ─── Command ─────────────────────────────────────────────
export interface DeviceCommand {
  id: number
  orderName: string
  orderContent: string
  orderExplain: string
  orderMsg: string
  isOffLine: string
}

// ─── Store ───────────────────────────────────────────────
export interface AuthStore {
  accessToken: string | null
  refreshToken: string | null
  expiresAt: number | null
  account: string | null
  contextAccount: string | null
  isAdmin: boolean
  isAuthenticated: boolean
  setContextAccount: (account: string | null) => void
  setAuth: (token: TokenResult) => void
  clearAuth: () => void
}
