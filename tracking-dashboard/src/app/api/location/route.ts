import { NextRequest, NextResponse } from 'next/server'
import { getAllDeviceLocations, getDeviceLocation, getChildAccounts } from '@/lib/api/tracksolid'
import { getDeviceLabels } from '@/lib/db/database'

export async function POST(req: NextRequest) {
  try {
    const { accessToken, target, imeis, contextAccount } = await req.json()
    if (!accessToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (imeis) {
      const result = await getDeviceLocation(accessToken, imeis)
      return NextResponse.json({ success: true, data: (result as any).result })
    } else {
      let allLocations: any[] = []
      
      // 1. Fetch locations from the main account
      try {
        const mainRes = await getAllDeviceLocations(accessToken, target)
        if (mainRes && Array.isArray((mainRes as any).result)) {
          allLocations = [...(mainRes as any).result]
        }
      } catch (e) {
        console.error("Main account location fetch failed:", e)
      }

      // 2. Fetch locations from child accounts
      try {
        const childRes = await getChildAccounts(accessToken, target)
        const children = (childRes as any).result
        if (Array.isArray(children)) {
          const promises = children.map(async (child: any) => {
            try {
              const locRes = await getAllDeviceLocations(accessToken, child.account)
              if (locRes && Array.isArray((locRes as any).result)) {
                return (locRes as any).result
              }
            } catch (e) {
              console.error(`Failed fetching locations for child ${child.account}:`, e)
            }
            return []
          })
          const childLocationsLists = await Promise.all(promises)
          childLocationsLists.forEach(list => {
            allLocations = allLocations.concat(list)
          })
        }
      } catch (e) {
        console.error("Child accounts location fetch failed:", e)
      }

      // 3. Map custom labels and filter by context
      try {
        const dbLabels = getDeviceLabels() as any[]
        const labelMap = new Map<string, any>()
        dbLabels.forEach(row => labelMap.set(row.imei, row))

        // Assign DB values to the locations
        allLocations = allLocations.map(loc => {
          const custom = labelMap.get(loc.imei)
          if (custom) {
            return {
              ...loc,
              deviceName: custom.custom_name || loc.deviceName,
              assignedTo: custom.assigned_to_account || null,
              customColor: custom.color_override || null,
            }
          }
          return loc
        })

        // Filter by context if a specific sub-account is selected (and it's not the parent itself)
        if (contextAccount && contextAccount !== target) {
          allLocations = allLocations.filter(loc => loc.assignedTo === contextAccount)
        }

      } catch (e) {
        console.error("Failed to map local DB labels:", e)
      }

      return NextResponse.json({ success: true, data: allLocations })
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

