import CryptoJS from 'crypto-js'
import https from 'https'
import querystring from 'querystring'

const APP_KEY = process.env.JIMI_APP_KEY!
const APP_SECRET = process.env.JIMI_APP_SECRET!
const BASE_URL = process.env.JIMI_BASE_URL || 'https://hk-open.tracksolidpro.com/route/rest'

// Persistent HTTPS Agent to prevent connection timeouts on Windows
const httpsAgent = new https.Agent({ keepAlive: true, family: 4 })

// ─── Signature Generator ─────────────────────────────────────────────────────
export function generateSign(params: Record<string, string>): string {
  const sorted = Object.keys(params)
    .filter(k => k !== 'sign' && params[k] != null && params[k] !== '')
    .sort()

  let str = APP_SECRET
  sorted.forEach(key => { str += key + params[key] })
  str += APP_SECRET

  return CryptoJS.MD5(str).toString().toUpperCase()
}

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
  const common: Record<string, string> = {
    method,
    timestamp: utcTimestamp(),
    app_key: APP_KEY,
    sign_method: 'md5',
    v: '1.0',
    format: 'json',
  }

  const allParams = { ...common, ...privateParams }
  allParams.sign = generateSign(allParams)

  const postData = querystring.stringify(allParams)

  return new Promise((resolve, reject) => {
    const req = https.request(BASE_URL, {
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
        try {
          const json = JSON.parse(data)
          if (Number(json.code) !== 0) {
            console.error('JIMI RAW ERROR RESPONSE:', data)
            return reject(new Error(`JIMI API Error ${json.code}: ${json.message || JSON.stringify(json)}`))
          }
          resolve(json)
        } catch (e) {
          console.error('JIMI NON-JSON RESPONSE:', data)
          reject(new Error(`Invalid JSON response: ${data}`))
        }
      })
    })

    req.on('error', err => reject(err))
    req.write(postData)
    req.end()
  })
}

// ─── Token Management ─────────────────────────────────────────────────────────
export async function getToken(userId: string, passwordMd5: string, expiresIn = 7200) {
  return jimiRequest<{ result: { accessToken: string; refreshToken: string; expiresIn: number; account: string; appKey: string; time: string } }>(
    'jimi.oauth.token.get',
    { user_id: userId, user_pwd_md5: passwordMd5, expires_in: String(expiresIn) }
  )
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

export async function getParkingData(
  accessToken: string, account: string, imeis: string,
  startTime: string, endTime: string, accType: 'on' | 'off' = 'off'
) {
  return jimiRequest('jimi.open.platform.report.parking', {
    access_token: accessToken,
    account,
    imeis,
    start_time: startTime,
    end_time: endTime,
    start_row: '0',
    page_size: '50',
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
export async function getAlarmList(
  accessToken: string, imei: string, beginTime: string, endTime: string
) {
  return jimiRequest('jimi.device.alarm.list', {
    access_token: accessToken,
    imei,
    begin_time: beginTime,
    end_time: endTime,
    start_row: '0',
    page_size: '50',
  })
}

// ─── OBD ──────────────────────────────────────────────────────────────────────
export async function getOBDData(
  accessToken: string, imei: string, beginTime: string, endTime: string
) {
  return jimiRequest('jimi.device.obd.list', {
    access_token: accessToken,
    imei,
    begin_time: beginTime,
    end_time: endTime,
    page_no: '0',
    page_size: '20',
  })
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
