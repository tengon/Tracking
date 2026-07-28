import fs from 'fs'
import path from 'path'

// Load env files for local development.
function loadEnvFile(filename: string) {
  const envPath = path.join(process.cwd(), filename)
  if (!fs.existsSync(envPath)) return
  const content = fs.readFileSync(envPath, 'utf8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx < 1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim()
    if (key && !(key in process.env)) {
      process.env[key] = val
    }
  }
}

// Load local & default environment variables
loadEnvFile('.env.local')
loadEnvFile('.env')

// Configuration parameters
const MQTT_BROKER = process.env.MQTT_BROKER_URL || 'mqtt://36.92.47.218:14583'
const POLLING_INTERVAL_MS = 10000 // 10 seconds
const TOKEN_RENEW_INTERVAL_MS = 6000 * 1000 // 6000 seconds (100 minutes)

let accessToken: string | null = null
let activeImeis: string[] = []

const STATE_FILE = path.join(process.cwd(), 'logs', 'mqtt-state.json')
function isWorkerActive(): boolean {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))
      return !!data.active
    }
  } catch {}
  return false
}

async function main() {
  let mqtt: any
  try {
    mqtt = eval("require('mqtt')")
  } catch {
    console.error('[MQTT Service] ERROR: "mqtt" package is not installed in node_modules.')
    console.error('Please run "npm install mqtt" or run via Docker compose.')
    process.exit(1)
  }

  const { getToken, getDeviceList, getDeviceLocation, getAllDeviceLocations, getChildAccounts } = await import('../src/lib/api/tracksolid')
  const { upsertAccount } = await import('../src/lib/db/postgres')

  const primaryAccount = process.env.JIMI_ACCOUNT || '754269'
  const passwordMd5 = process.env.JIMI_PASSWORD_MD5 || ''

  if (!passwordMd5) {
    console.error('[MQTT Service] ERROR: JIMI_PASSWORD_MD5 is not configured in environment variables.')
    process.exit(1)
  }

  console.log(`[MQTT Service] Configured MQTT broker: ${MQTT_BROKER}`)
  const client = mqtt.connect(MQTT_BROKER, {
    reconnectPeriod: 5000,
    connectTimeout: 10000,
    manualConnect: true, // We will connect manually when active
  })

  // Start disconnected if not active
  if (isWorkerActive()) {
    client.connect()
  }

  client.on('connect', () => {
    console.log(`[MQTT Service] Successfully connected to MQTT Broker: ${MQTT_BROKER}`)
  })

  client.on('error', (err: any) => {
    console.error('[MQTT Service] MQTT Client Error:', err?.message || err)
  })

  client.on('reconnect', () => {
    console.log('[MQTT Service] Reconnecting to MQTT Broker...')
  })

  // ─── Token Renewal Function (Resets every 6000s) ───────────────────────────
  async function renewToken() {
    const candidates = Array.from(new Set([
      process.env.JIMI_USER_ID,
      process.env.JIMI_USERNAME,
      'tengon',
      primaryAccount,
    ])).filter(Boolean) as string[]

    for (const userId of candidates) {
      console.log(`[MQTT Service] Renewing Jimi OAuth token for user: "${userId}"...`)
      try {
        const res = await getToken(userId, passwordMd5, 7200)
        if ((res as any)?.result?.accessToken) {
          accessToken = (res as any).result.accessToken
          console.log(`[MQTT Service] Access token successfully obtained for "${userId}". Token: ${accessToken?.slice(0, 10)}... (Renews in 6000s)`)
          return
        }
      } catch (err: any) {
        console.warn(`[MQTT Service] Token retrieval failed for user "${userId}":`, err?.message || err)
      }
    }

    console.error('[MQTT Service] CRITICAL: Unable to renew access token with any credential candidate.')
  }

  // Initial token retrieval
  await renewToken()

  // Schedule token renewal every 6000 seconds
  setInterval(renewToken, TOKEN_RENEW_INTERVAL_MS)

  // ─── Fetch IMEIs associated with Jimi Root Account & Sub-accounts ───────────
  async function refreshDeviceList() {
    if (!accessToken || !isWorkerActive()) return
    const allImeis: string[] = []
    const rootAccounts = Array.from(new Set(['tengon', primaryAccount]))

    for (const rootAcc of rootAccounts) {
      // 1. Query jimi.user.device.location.list (returns all device locations under root & sub-accounts)
      try {
        const locListRes = await getAllDeviceLocations(accessToken, rootAcc)
        const list = (locListRes as any)?.result || []
        const imeis = (Array.isArray(list) ? list : []).map((dev: any) => dev.imei || dev.deviceId).filter(Boolean)
        allImeis.push(...imeis)
      } catch (err: any) {
        console.warn(`[MQTT Service] Location list search for account "${rootAcc}":`, err?.message || err)
      }

      // 2. Query jimi.user.child.list to discover sub-accounts and fetch their device lists
      try {
        const childRes = await getChildAccounts(accessToken, rootAcc)
        const children = (childRes as any)?.result || []
        const childAccs = (Array.isArray(children) ? children : []).map((c: any) => c.account).filter(Boolean)

        // Sync discovered sub-accounts to the local database
        if (Array.isArray(children)) {
          for (const child of children) {
            if (!child.account) continue
            try {
              await upsertAccount({
                account: child.account,
                parent_account: rootAcc,
                name: child.name,
                company_name: child.companyName,
                email: child.email,
                phone: child.phone,
                type: child.type,
                display_flag: child.displayFlag,
                address: child.address,
                birth: child.birth,
                language: child.language,
                sex: child.sex,
                enabled_flag: child.enabledFlag,
                remark: child.remark,
                user_id: child.userId,
                parent_id: child.parentId,
                raw_detail: child,
              })
            } catch (err: any) {
              console.warn(`[MQTT Service] DB sync failed for account "${child.account}":`, err?.message || err)
            }
          }
        }

        for (const childAcc of [rootAcc, ...childAccs]) {
          try {
            const devRes = await getDeviceList(accessToken, childAcc)
            const devList = (devRes as any)?.result || []
            const imeis = (Array.isArray(devList) ? devList : []).map((dev: any) => dev.imei || dev.deviceId).filter(Boolean)
            allImeis.push(...imeis)
          } catch {
            // Ignore single sub-account fetch error
          }
        }
      } catch (err: any) {
        console.warn(`[MQTT Service] Sub-account search for "${rootAcc}":`, err?.message || err)
      }
    }

    const uniqueImeis = Array.from(new Set(allImeis))
    if (uniqueImeis.length > 0) {
      activeImeis = uniqueImeis
      console.log(`[MQTT Service] Discovered ${activeImeis.length} total device(s) across root & sub-accounts to stream:`, activeImeis)
    }
  }

  // Initial device list fetch & refresh every 5 minutes
  await refreshDeviceList()
  setInterval(refreshDeviceList, 5 * 60 * 1000)

  // ─── 10-Second Location Polling & MQTT Publishing ───────────────────────────
  let wasActive = isWorkerActive()

  async function pollAndPublishLocations() {
    const active = isWorkerActive()
    
    // Handle state transitions
    if (active && !wasActive) {
      console.log('[MQTT Service] Worker activated by UI. Connecting to MQTT and fetching devices...')
      client.connect()
      await refreshDeviceList()
    } else if (!active && wasActive) {
      console.log('[MQTT Service] Worker deactivated by UI. Disconnecting MQTT and stopping polling.')
      client.end(true)
    }
    wasActive = active

    if (!active) return

    if (!accessToken) {
      console.warn('[MQTT Service] Skipping poll: Access token not available.')
      return
    }

    if (activeImeis.length === 0) {
      await refreshDeviceList()
      if (activeImeis.length === 0) {
        console.warn('[MQTT Service] No active IMEIs registered to stream.')
        return
      }
    }

    try {
      // Call jimi.device.location.get
      const locRes = await getDeviceLocation(accessToken, activeImeis)
      const results = Array.isArray((locRes as any)?.result)
        ? (locRes as any).result
        : (locRes as any)?.result ? [(locRes as any).result] : []

      let publishedCount = 0

      for (const item of results) {
        const imei = item.imei || item.deviceId
        if (!imei) continue

        const topic = `fleet/${imei}`
        const payload = JSON.stringify(item)

        if (client.connected) {
          client.publish(topic, payload, { qos: 0 }, (err: any) => {
            if (err) {
              console.error(`[MQTT Service] Error publishing to topic "${topic}":`, err?.message || err)
            }
          })
          publishedCount++
        }
      }

      // Sync to Indonesia time (WIB / UTC+7)
      const now = new Date()
      const wib = new Date(now.getTime() + 7 * 3600000)
      const pad = (n: number) => String(n).padStart(2, '0')
      const wibString = `${wib.getUTCFullYear()}-${pad(wib.getUTCMonth()+1)}-${pad(wib.getUTCDate())} ` +
                        `${pad(wib.getUTCHours())}:${pad(wib.getUTCMinutes())}:${pad(wib.getUTCSeconds())} WIB`

      console.log(`[MQTT Service] [${wibString}] Published ${publishedCount} device location payload(s) to topic "fleet/(imei)"`)
    } catch (err: any) {
      console.error('[MQTT Service] Error querying jimi.device.location.get:', err?.message || err)
    }
  }

  // Initial poll & 10-second interval timer
  pollAndPublishLocations()
  setInterval(pollAndPublishLocations, POLLING_INTERVAL_MS)
}

main().catch(err => {
  console.error('[MQTT Service] Fatal execution error:', err)
  process.exit(1)
})
