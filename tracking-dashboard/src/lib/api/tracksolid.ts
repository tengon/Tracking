import CryptoJS from 'crypto-js'
import https from 'https'
import querystring from 'querystring'
import { logApiActivity } from '@/lib/logger'

// ─── Signature Generator ─────────────────────────────────────────────────────
export function generateSign(params: Record<string, string>): string {
  const appSecret = process.env.JIMI_APP_SECRET || ''
  const sorted = Object.keys(params)
    .filter(k => k !== 'sign' && params[k] != null && params[k] !== '')
    .sort()

  let str = appSecret
  sorted.forEach(key => { str += key + params[key] })
  str += appSecret

  return CryptoJS.MD5(str).toString().toUpperCase()
}

// Persistent HTTPS Agent to prevent connection timeouts on Windows
const httpsAgent = new https.Agent({ keepAlive: true, family: 4 })

// ─── UTC Timestamp ────────────────────────────────────────────────────────────
function utcTimestamp(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getUTCFullYear()}-${pad(now.getUTCMonth()+1)}-${pad(now.getUTCDate())} ` +
    `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())}`
}

// ─── Core Request Builder ─────────────────────────────────────────────────────
export async function jimiRequest<T>(
  method: string,
  privateParams: Record<string, string> = {}
): Promise<T> {
  const startTime = Date.now()
  const appKey = process.env.JIMI_APP_KEY || ''
  const baseUrl = process.env.JIMI_BASE_URL || 'https://hk-open.tracksolidpro.com/route/rest'

  const common: Record<string, string> = {
    method,
    timestamp: utcTimestamp(),
    app_key: appKey,
    sign_method: 'md5',
    v: '1.0',
    format: 'json',
  }

  const allParams = { ...common, ...privateParams }
  allParams.sign = generateSign(allParams)

  const postData = querystring.stringify(allParams)

  return new Promise((resolve, reject) => {
    const req = https.request(baseUrl, {
      method: 'POST',
      agent: httpsAgent,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
      },
    }, res => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => {
        const durationMs = Date.now() - startTime
        const statusCode = res.statusCode || 200
        try {
          const json = JSON.parse(data)

          // Record API POST activity to log file
          logApiActivity({
            method: 'POST',
            endpoint: method,
            status: Number(json.code) === 0 ? statusCode : (json.code || statusCode),
            durationMs,
            request: allParams,
            response: json,
            ...(Number(json.code) !== 0 ? { error: `JIMI Error ${json.code}: ${json.message}` } : {}),
          })

          if (Number(json.code) !== 0) {
            console.error('JIMI RAW ERROR RESPONSE:', data)
            return reject(new Error(`JIMI API Error ${json.code}: ${json.message || JSON.stringify(json)}`))
          }
          resolve(json)
        } catch (e: any) {
          logApiActivity({
            method: 'POST',
            endpoint: method,
            status: 500,
            durationMs,
            request: allParams,
            response: data,
            error: `Invalid JSON response: ${e.message}`,
          })
          console.error('JIMI NON-JSON RESPONSE:', data)
          reject(new Error(`Invalid JSON response: ${data}`))
        }
      })
    })

    req.on('error', err => {
      const durationMs = Date.now() - startTime
      logApiActivity({
        method: 'POST',
        endpoint: method,
        status: 500,
        durationMs,
        request: allParams,
        response: null,
        error: err.message,
      })
      reject(err)
    })

    req.write(postData)
    req.end()
  })
}

// ─── Token Management & Caching ──────────────────────────────────────────────
const tokenCache = new Map<string, { data: any; expiresAt: number }>()

export async function getToken(userId: string, passwordMd5: string, expiresIn = 7200) {
  const cacheKey = `token_${userId}`
  const cached = tokenCache.get(cacheKey)
  const now = Date.now()

  // Return cached token if still valid (reserve 5 minutes safety buffer)
  if (cached && cached.expiresAt > now + 300000) {
    return cached.data
  }

  const res = await jimiRequest<{ result: { accessToken: string; refreshToken: string; expiresIn: number; account: string; appKey: string; time: string } }>(
    'jimi.oauth.token.get',
    { user_id: userId, user_pwd_md5: passwordMd5, expires_in: String(expiresIn) }
  )

  if ((res as any)?.code === 0 && (res as any)?.result?.accessToken) {
    const expiresMs = (res.result.expiresIn || expiresIn || 7200) * 1000
    tokenCache.set(cacheKey, { data: res, expiresAt: now + expiresMs })
  }

  return res
}

export async function refreshToken(accessToken: string, refreshTok: string, expiresIn = 7200) {
  return jimiRequest('jimi.oauth.token.refresh', {
    access_token: accessToken,
    refresh_token: refreshTok,
    expires_in: String(expiresIn),
  })
}

// ─── Global Caching to prevent Error 1006 Rate Limit ───────────────────────
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes
const apiCache = new Map<string, { data: any, time: number }>()

// ─── Account / Sub-accounts ──────────────────────────────────────────────────
export async function getChildAccounts(accessToken: string, target: string) {
  const key = `child_${target}`
  const cached = apiCache.get(key)
  if (cached && Date.now() - cached.time < CACHE_TTL) return cached.data

  const res = await jimiRequest<{ result: SubAccount[] }>('jimi.user.child.list', { access_token: accessToken, target })
  if ((res as any).code === 0) apiCache.set(key, { data: res, time: Date.now() })
  return res
}

/** Same as getChildAccounts but BYPASSES the in-memory cache — used for full sync operations */
export async function getChildAccountsDirect(accessToken: string, target: string) {
  return jimiRequest<{ result: SubAccount[] }>('jimi.user.child.list', { access_token: accessToken, target })
}

export async function createChildAccount(accessToken: string, params: CreateAccountParams) {
  return jimiRequest('jimi.user.child.create', {
    access_token: accessToken,
    child_account:   params.account,
    child_user_name: params.name,
    child_user_pwd:  params.passwordMd5,
    child_email:     params.email     ?? '',
    child_phone:     params.phone     ?? '',
    company_name:    params.companyName ?? '',
  })
}

export async function updateChildAccount(accessToken: string, params: UpdateAccountParams) {
  return jimiRequest('jimi.user.child.update', {
    access_token: accessToken,
    child_account:   params.account,
    child_user_name: params.name        ?? '',
    child_email:     params.email       ?? '',
    child_phone:     params.phone       ?? '',
    company_name:    params.companyName ?? '',
  })
}

export async function deleteChildAccount(accessToken: string, childAccount: string) {
  return jimiRequest('jimi.user.child.del', {
    access_token:  accessToken,
    child_account: childAccount,
  })
}

export async function moveChildAccount(
  accessToken: string, childAccount: string, newParent: string
) {
  return jimiRequest('jimi.user.child.move', {
    access_token:   accessToken,
    child_account:  childAccount,
    target_account: newParent,
  })
}

// ─── Types ─────────────────────────────────────────────────────────────────
export interface SubAccount {
  account: string
  name: string
  type: number
  email: string
  phone: string
  companyName: string
  language: string
  enabledFlag: number
  address: string | null
  birth: string | null
  sex: number
  remark: string | null
  displayFlag: number
}

export interface CreateAccountParams {
  account:     string
  name:        string
  passwordMd5: string
  email?:      string
  phone?:      string
  companyName?: string
}

export interface UpdateAccountParams {
  account:     string
  name?:       string
  email?:      string
  phone?:      string
  companyName?: string
}


// ─── Device Management ────────────────────────────────────────────────────────
export async function getDeviceList(accessToken: string, target: string) {
  const key = `devlist_${target}`
  const cached = apiCache.get(key)
  if (cached && Date.now() - cached.time < CACHE_TTL) return cached.data

  const res = await jimiRequest('jimi.user.device.list', { access_token: accessToken, target })
  if ((res as any).code === 0) apiCache.set(key, { data: res, time: Date.now() })
  return res
}

export async function getDeviceDetail(accessToken: string, imei: string) {
  return jimiRequest('jimi.track.device.detail', { access_token: accessToken, imei })
}

export async function getDeviceGroups(accessToken: string, account: string) {
  return jimiRequest('jimi.device.group.list', { access_token: accessToken, account })
}

// ─── Tracking ─────────────────────────────────────────────────────────────────
export async function getAllDeviceLocations(
  accessToken: string, target: string, mapType = 'GOOGLE'
) {
  return jimiRequest('jimi.user.device.location.list', {
    access_token: accessToken,
    target,
    map_type: mapType,
  })
}

export async function getDeviceLocation(
  accessToken: string, imeis: string, mapType = 'GOOGLE'
) {
  return jimiRequest('jimi.device.location.get', {
    access_token: accessToken,
    imeis,
    map_type: mapType,
  })
}

export async function getTrackList(
  accessToken: string, imei: string, beginTime: string, endTime: string
) {
  return jimiRequest('jimi.device.track.list', {
    access_token: accessToken,
    imei,
    begin_time: beginTime,
    end_time: endTime,
    map_type: 'GOOGLE',
  })
}

/**
 * 7.17 Get the mileage data of devices
 * Method: jimi.device.track.mileage
 * Params: imeis (comma-separated, max 100), begin_time, end_time
 * Format: yyyy-MM-dd HH:mm:ss
 */
export async function getMileageData(
  accessToken: string, imeis: string, beginTime: string, endTime: string
) {
  return jimiRequest('jimi.device.track.mileage', {
    access_token: accessToken,
    imeis,
    begin_time: beginTime,
    end_time: endTime,
  })
}

/**
 * 7.51 Get the trips report data of devices
 * Method: jimi.open.platform.report.trips
 * Params: account, imeis, start_time, end_time, start_row (>=0), page_size (1-100)
 * Response: data.dayList[] or data.datDatas[]
 *   dayList[].tripsData[].dayData[] contains: imei, startTime, endTime,
 *   startLat, startLng, endLat, endLng, totalMileage, travelTime,
 *   averageSpeed, maxSpeed, oilWear, fuel, startMileage, endMileage
 */
export async function getTripsReport(
  accessToken: string, account: string, imeis: string,
  startTime: string, endTime: string, startRow = '0', pageSize = '100'
) {
  return jimiRequest('jimi.open.platform.report.trips', {
    access_token: accessToken,
    account,
    imeis,
    start_time: startTime,
    end_time: endTime,
    start_row: startRow,
    page_size: pageSize,
  })
}

/**
 * 7.40 Get parking/idling data of devices
 * Method: jimi.open.platform.report.parking
 * Params: account, imeis, start_time, end_time, acc_type ('on'=idling/'off'=parking),
 *         start_row (>=0), page_size (1-100)
 * Response: data.rows[] — imei, deviceName, startTime, endTime,
 *   durSecond, acc, lat, lng, addr
 */
export async function getParkingData(
  accessToken: string, account: string, imeis: string,
  startTime: string, endTime: string, accType: 'on' | 'off' = 'off',
  startRow = '0', pageSize = '100'
) {
  return jimiRequest('jimi.open.platform.report.parking', {
    access_token: accessToken,
    account,
    imeis,
    start_time: startTime,
    end_time: endTime,
    start_row: startRow,
    page_size: pageSize,
    acc_type: accType,
  })
}

// ─── Geofencing ───────────────────────────────────────────────────────────────
export async function getGeofenceList(
  accessToken: string, account: string, pageNo = 0, pageSize = 20
) {
  return jimiRequest('jimi.open.platform.fence.list', {
    access_token: accessToken,
    account,
    page_no: String(pageNo),
    page_size: String(pageSize),
  })
}

/**
 * 7.52 Get entry and exit fence data of devices
 * Method: jimi.open.platform.fence.duration
 * Params: account, imeis, start_time, end_time, start_row, page_size
 *         fence_id (optional — filter by specific fence)
 * Response: data.rows[] — imei, deviceName, fenceName, enterTime, exitTime, duration (seconds)
 */
export async function getFenceDurationReport(
  accessToken: string, account: string, imeis: string,
  startTime: string, endTime: string, fenceId = '', startRow = '0', pageSize = '100'
) {
  const params: Record<string, string> = {
    access_token: accessToken,
    account,
    imeis,
    start_time: startTime,
    end_time: endTime,
    start_row: startRow,
    page_size: pageSize,
  }
  // Only include fence_id if specified (empty string causes API error on some regions)
  if (fenceId) params.fence_id = fenceId
  return jimiRequest('jimi.open.platform.fence.duration', params)
}

export async function createPlatformFence(
  accessToken: string,
  params: { fence_name: string; fence_type: string; coordinates: string; radius?: string; alert_type: string }
) {
  return jimiRequest('jimi.open.platform.fence.create', {
    access_token: accessToken,
    ...params,
    radius: params.radius ?? '',
  })
}

export async function deletePlatformFence(accessToken: string, fenceId: string) {
  return jimiRequest('jimi.open.platform.fence.delete', {
    access_token: accessToken,
    fence_id: fenceId,
  })
}

export async function bindFenceToDevice(accessToken: string, fenceId: string, imeis: string) {
  return jimiRequest('jimi.open.platform.fence.bind', {
    access_token: accessToken,
    fence_id: fenceId,
    imeis,
  })
}

// ─── Alarms ───────────────────────────────────────────────────────────────────
/**
 * 7.32 Get device alarm list
 * Method: jimi.device.alarm.list
 * Params: imei (SINGLE imei only), begin_time, end_time
 *         page_no (>=1, default 1), page_size (1-100, default 10)
 * Response: result.result[] — imei, alarmTime, alarmType, alertTypeId,
 *   lat, lng, speed, address, deviceName
 * Note: alertTypeId is the numeric/text alarm code. See Appendix 8.1 for full list.
 */
export async function getAlarmList(
  accessToken: string, imei: string, beginTime: string, endTime: string,
  pageNo = '1', pageSize = '100'
) {
  return jimiRequest('jimi.device.alarm.list', {
    access_token: accessToken,
    imei,
    begin_time: beginTime,
    end_time: endTime,
    page_no: pageNo,
    page_size: pageSize,
  })
}

// ─── OBD ──────────────────────────────────────────────────────────────────────
/**
 * 7.53 Get the OBD data of devices
 * Method: jimi.device.obd.list
 * Params: account, imeis (comma-separated, max 100), start_time, end_time
 *         page_no (>=1, default 1), page_size (1-100, default 10)
 * Response: data.result[] — imei, dataReportTime, odometerReading,
 *   deviceAccumulatedMileage, remainingFuel, remainingFuelPercentage,
 *   coolantTemperature, vehicleBatterVoltage, currentRPM, currentSpeed, vin
 */
export async function getOBDData(
  accessToken: string, imeis: string, startTime: string, endTime: string,
  account = '', pageNo = '1', pageSize = '100'
) {
  const params: Record<string, string> = {
    access_token: accessToken,
    imeis,           // spec uses 'imeis' (comma-separated), NOT 'imei'
    start_time: startTime,
    end_time: endTime,
    page_no: pageNo,
    page_size: pageSize,
  }
  if (account) params.account = account
  return jimiRequest('jimi.device.obd.list', params)
}

// ─── Media ────────────────────────────────────────────────────────────────────
export async function getLiveStreamUrl(accessToken: string, imei: string, channel: string, appId: string) {
  return jimiRequest('jimi.device.media.live.stream', {
    access_token: accessToken,
    imei,
    channel,
    appId,
  })
}

export async function getMediaEventList(
  accessToken: string, imeis: string, mediaType: string, startTime: string, endTime: string,
  pageNo = 0, pageSize = 20
) {
  return jimiRequest('jimi.device.media.event.URL', {
    access_token: accessToken,
    imeis,
    media_type: mediaType,
    start_time: startTime,
    end_time: endTime,
    page_no: String(pageNo),
    page_size: String(pageSize),
  })
}
