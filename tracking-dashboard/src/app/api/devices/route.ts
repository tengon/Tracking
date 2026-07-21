import { NextRequest, NextResponse } from 'next/server'
import { getDeviceList, getDeviceDetail, getDeviceGroups, getChildAccounts } from '@/lib/api/tracksolid'
import { getDevicesForTree, getDeviceByImei, hasDeviceData } from '@/lib/db/postgres'

export async function POST(req: NextRequest) {
  try {
    const { accessToken, action, target, imei } = await req.json()
    if (!accessToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (action === 'detail' && imei) {
      // 1. Check PostgreSQL first
      const localDev = await getDeviceByImei(imei)
      if (localDev && localDev.raw_detail) {
        return NextResponse.json({ success: true, source: 'postgres', data: localDev.raw_detail })
      }
      // Fallback to JIMI
      const result = await getDeviceDetail(accessToken, imei)
      return NextResponse.json({ success: true, source: 'jimi', data: (result as any).result })
    } else if (action === 'groups') {
      const result = await getDeviceGroups(accessToken, target)
      return NextResponse.json({ success: true, data: (result as any).result })
    } else {
      const targetAccount = target || 'tengon'

      // Check PostgreSQL first
      const hasData = await hasDeviceData(targetAccount)
      if (hasData) {
        const pgDevices = await getDevicesForTree(targetAccount)
        // Format PG rows to match JIMI response shape
        const formatted = pgDevices.map(d => ({
          imei: d.imei,
          deviceName: d.device_name || d.imei,
          deviceType: d.device_type,
          mcType: d.mc_type || d.device_type || d.model,
          mcTypeUseScope: d.mc_type_use_scope,
          model: d.model,
          simCard: d.sim_card,
          sim: d.sim_card,
          iccid: d.iccid,
          imsi: d.imsi,
          status: d.status || '1',
          enabledFlag: d.status === '0' ? 0 : 1,
          carNumber: d.license_plate,
          licensePlatNo: d.license_plate,
          frameNumber: d.vin,
          vin: d.vin,
          carBrand: d.brand || d.vehicle_brand,
          vehicleBrand: d.vehicle_brand || d.brand,
          vehicleModels: d.vehicle_models,
          vehicleIcon: d.vehicle_icon || 'automobile',
          carColor: d.color,
          installDate: d.install_date,
          expireTime: d.expiry_date,
          expiration: d.expiry_date,
          activateTime: d.activate_date,
          activationTime: d.activate_date,
          currentMileage: d.current_mileage || d.mileage,
          mileage: d.current_mileage || d.mileage,
          deviceGroup: d.device_group || 'Default group',
          deviceGroupId: d.device_group_id,
          customerName: d.customer_name || d.account,
          driverName: d.driver_name,
          driverPhone: d.driver_phone,
          account: d.account,
          ...(d.raw_detail || {})
        }))
        return NextResponse.json({ success: true, source: 'postgres', data: formatted })
      }

      // Fallback to JIMI API
      let allDevices: any[] = []
      try {
        const mainRes = await getDeviceList(accessToken, targetAccount)
        if (mainRes && Array.isArray((mainRes as any).result)) {
          allDevices = [...(mainRes as any).result]
        }
      } catch (e) {
        console.error("Main account device fetch failed:", e)
      }

      try {
        const childRes = await getChildAccounts(accessToken, targetAccount)
        const children = (childRes as any).result
        if (Array.isArray(children)) {
          const promises = children.map(async (child: any) => {
            try {
              const devRes = await getDeviceList(accessToken, child.account)
              if (devRes && Array.isArray((devRes as any).result)) {
                return (devRes as any).result
              }
            } catch (e) {
              console.error(`Failed fetching devices for child ${child.account}:`, e)
            }
            return []
          })
          const childDevicesLists = await Promise.all(promises)
          childDevicesLists.forEach(list => {
            allDevices = allDevices.concat(list)
          })
        }
      } catch (e) {
        console.error("Child accounts fetch failed:", e)
      }

      return NextResponse.json({ success: true, source: 'jimi', data: allDevices })
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

