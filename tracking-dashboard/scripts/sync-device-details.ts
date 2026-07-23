import fs from 'fs'
import path from 'path'

// Load env files for local development.
// In Docker, env vars are injected by docker-compose — Docker env takes precedence.
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
    // Only set if not already defined (Docker env takes precedence)
    if (key && !(key in process.env)) {
      process.env[key] = val
    }
  }
}

// Try .env.local first (local dev), then .env (shared/Docker fallback)
loadEnvFile('.env.local')
loadEnvFile('.env')

import CryptoJS from 'crypto-js'

async function syncAll() {
  const { getToken, getDeviceList, getDeviceDetail } = await import('../src/lib/api/tracksolid')
  const { getDescendants, upsertDevice, upsertDeviceDetail } = await import('../src/lib/db/postgres')

  const tokenRes = await getToken('tengon', process.env.JIMI_PASSWORD_MD5!)
  const token = (tokenRes as any).result.accessToken
  console.log('Obtained fresh AccessToken:', token)

  const descendants = await getDescendants('tengon')
  console.log('Found descendant accounts in PG:', descendants.length)

  let totalCount = 0

  for (const { account } of descendants) {
    try {
      const res = await getDeviceList(token, account)
      const devices = (res as any).result || []
      console.log(`Account ${account}: ${devices.length} devices`)

      for (const dev of devices) {
        const imei = dev.imei || dev.deviceId
        if (!imei) continue

        let detail: any = null
        try {
          const detailRes = await getDeviceDetail(token, imei)
          detail = (detailRes as any).result ?? null
        } catch (e) {
          console.warn(`Detail error for IMEI ${imei}:`, e)
        }

        if (detail) {
          await upsertDeviceDetail(detail)
        }

        await upsertDevice({
          imei,
          account,
          device_name: detail?.deviceName ?? dev.deviceName ?? dev.name ?? null,
          device_type: detail?.deviceType ?? dev.deviceType ?? null,
          model: detail?.model ?? dev.model ?? null,
          sim_card: detail?.sim ?? detail?.simCard ?? dev.simCard ?? null,
          license_plate: detail?.licensePlatNo ?? detail?.carNumber ?? dev.carNumber ?? null,
          vin: detail?.vin ?? detail?.carFrame ?? detail?.frameNumber ?? dev.frameNumber ?? null,
          brand: detail?.vehicleBrand ?? detail?.carBrand ?? dev.carBrand ?? null,
          color: detail?.carColor ?? dev.carColor ?? null,
          install_date: detail?.installDate ?? dev.installDate ?? null,
          expiry_date: detail?.expiration ?? detail?.expireTime ?? dev.expireTime ?? null,
          activate_date: detail?.activationTime ?? detail?.activateTime ?? dev.activateTime ?? null,
          mileage: detail?.currentMileage ? Number(detail.currentMileage) : null,
          mc_type: detail?.mcType ?? null,
          mc_type_use_scope: detail?.mcTypeUseScope ?? null,
          iccid: detail?.iccid ?? null,
          imsi: detail?.imsi ?? null,
          status: detail?.status ? String(detail.status) : null,
          customer_name: detail?.customerName ?? null,
          device_group: detail?.deviceGroup ?? null,
          device_group_id: detail?.deviceGroupId ?? null,
          vehicle_brand: detail?.vehicleBrand ?? null,
          vehicle_models: detail?.vehicleModels ?? null,
          vehicle_icon: detail?.vehicleIcon ?? null,
          engine_number: detail?.engineNumber ?? null,
          driver_name: detail?.driverName ?? null,
          driver_phone: detail?.driverPhone ?? null,
          import_time: detail?.importTime ?? null,
          current_mileage: detail?.currentMileage ? Number(detail.currentMileage) : null,
          raw_detail: detail ?? dev,
        })

        totalCount++
      }
    } catch (err) {
      console.error(`Error for account ${account}:`, err)
    }
  }

  console.log(`SYNC COMPLETED: ${totalCount} devices synced to PostgreSQL!`)
  process.exit(0)
}

syncAll().catch(err => {
  console.error('FATAL ERROR:', err)
  process.exit(1)
})
