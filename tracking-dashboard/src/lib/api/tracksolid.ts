import CryptoJS from 'crypto-js'

const APP_KEY = process.env.JIMI_APP_KEY!
const APP_SECRET = process.env.JIMI_APP_SECRET!
const BASE_URL = process.env.JIMI_BASE_URL || 'https://hk-open.tracksolidpro.com/route/rest'

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

  const body = new URLSearchParams(allParams)

  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`)
  }

  const json = await res.json()

  if (json.code !== 0) {
    throw new Error(`JIMI API Error ${json.code}: ${json.message}`)
  }

  return json
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

// ─── Account / Sub-accounts ──────────────────────────────────────────────────
export async function getChildAccounts(accessToken: string, target: string) {
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
  return jimiRequest('jimi.user.device.list', { access_token: accessToken, target })
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
