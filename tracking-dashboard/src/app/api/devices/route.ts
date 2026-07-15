import { NextRequest, NextResponse } from 'next/server'
import { getDeviceList, getDeviceDetail, getDeviceGroups, getChildAccounts } from '@/lib/api/tracksolid'

export async function POST(req: NextRequest) {
  try {
    const { accessToken, action, target, imei } = await req.json()
    if (!accessToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (action === 'detail' && imei) {
      const result = await getDeviceDetail(accessToken, imei)
      return NextResponse.json({ success: true, data: (result as any).result })
    } else if (action === 'groups') {
      const result = await getDeviceGroups(accessToken, target)
      return NextResponse.json({ success: true, data: (result as any).result })
    } else {
      // 1. Fetch devices from the main account
      let allDevices: any[] = []
      try {
        const mainRes = await getDeviceList(accessToken, target)
        if (mainRes && Array.isArray((mainRes as any).result)) {
          allDevices = [...(mainRes as any).result]
        }
      } catch (e) {
        console.error("Main account device fetch failed:", e)
      }

      // 2. Fetch devices from child accounts
      try {
        const childRes = await getChildAccounts(accessToken, target)
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

      return NextResponse.json({ success: true, data: allDevices })
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
