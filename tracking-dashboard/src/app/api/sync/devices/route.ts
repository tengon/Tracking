import { NextRequest, NextResponse } from 'next/server'
import { getDeviceList, getDeviceDetail } from '@/lib/api/tracksolid'
import { getDescendants, upsertDevice, upsertDeviceDetail, getAllDevices, hasDeviceData } from '@/lib/db/postgres'

/**
 * Sync all devices for a given root account:
 * 1. Get all descendant accounts from PostgreSQL (instant, no JIMI call)
 * 2. Call jimi.user.device.list for each account → get IMEI list + basic info
 * 3. Call jimi.track.device.detail for each IMEI → get full detail
 * 4. Upsert everything into devices and device_details tables
 */
async function syncDevices(
  accessToken: string,
  rootAccount: string,
  withDetail = false
): Promise<{ total: number; byAccount: Record<string, number> }> {
  // Get all descendant accounts from PG
  const descendants = await getDescendants(rootAccount)
  if (descendants.length === 0) {
    throw new Error(`No accounts found in PostgreSQL for ${rootAccount}. Run /api/sync/accounts first.`)
  }

  const byAccount: Record<string, number> = {}
  let total = 0

  for (const { account } of descendants) {
    let devices: any[] = []

    try {
      const res = await getDeviceList(accessToken, account)
      devices = (res as any).result || []
    } catch (e) {
      console.error(`device.list failed for ${account}:`, e)
      continue
    }

    let count = 0
    for (const dev of devices) {
      const imei = dev.imei || dev.deviceId
      if (!imei) continue

      let detail: any = null
      if (withDetail) {
        try {
          const detailRes = await getDeviceDetail(accessToken, imei)
          detail = (detailRes as any).result ?? null
        } catch (e) {
          console.warn(`device.detail failed for IMEI ${imei}:`, e)
        }
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
        mileage: detail?.currentMileage ? Number(detail.currentMileage) : (dev.mileage ? Number(dev.mileage) : null),
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
      count++
    }

    byAccount[account] = count
    total += count
  }

  return { total, byAccount }
}

export async function POST(req: NextRequest) {
  try {
    const { accessToken, target, force, withDetail } = await req.json()
    if (!accessToken || !target) {
      return NextResponse.json({ error: 'Missing accessToken or target' }, { status: 400 })
    }

    if (!force) {
      const hasData = await hasDeviceData(target)
      if (hasData) {
        return NextResponse.json({
          success: true,
          message: 'Devices already synced. Use force=true to re-sync.',
        })
      }
    }

    const result = await syncDevices(accessToken, target, withDetail ?? false)
    return NextResponse.json({ success: true, ...result })
  } catch (e: any) {
    console.error('Device sync error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const account = searchParams.get('account')

    let devices
    if (account) {
      const { getDevicesForTree } = await import('@/lib/db/postgres')
      devices = await getDevicesForTree(account)
    } else {
      devices = await getAllDevices()
    }

    return NextResponse.json({ success: true, total: devices.length, data: devices })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
