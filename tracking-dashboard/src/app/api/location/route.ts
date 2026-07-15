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
      // Helper to fetch locations recursively with depth to determine the most specific account
      async function fetchAllLocationsRecursive(token: string, tgt: string, depth: number = 0): Promise<any[]> {
        let locs: any[] = []
        try {
          const res = await getAllDeviceLocations(token, tgt)
          if (res && Array.isArray((res as any).result)) {
            const mappedLocs = (res as any).result.map((d: any) => ({ ...d, _jimiAccount: tgt, _depth: depth }))
            locs = locs.concat(mappedLocs)
          }
        } catch (e) {
          console.error(`Failed to fetch locations for ${tgt}:`, e)
        }

        try {
          const childRes = await getChildAccounts(token, tgt)
          let children = (childRes as any).result || []
          
          // Prevent infinite recursion if API returns parent in child list
          children = children.filter((c: any) => c.account !== tgt)
          
          const promises = children.map((c: any) => fetchAllLocationsRecursive(token, c.account, depth + 1))
          const childLocs = await Promise.all(promises)
          childLocs.forEach(cl => locs = locs.concat(cl))
        } catch (e) {
          console.error(`Failed to fetch children for ${tgt}:`, e)
        }
        return locs
      }

      let allLocations: any[] = await fetchAllLocationsRecursive(accessToken, target, 0)

      // Deduplicate by IMEI (keep the one with highest depth to ensure the most specific sub-account wins)
      const uniqueLocs = new Map<string, any>()
      allLocations.forEach(loc => {
        if (loc && loc.imei) {
          const existing = uniqueLocs.get(loc.imei)
          if (!existing || loc._depth > existing._depth) {
            uniqueLocs.set(loc.imei, loc)
          }
        }
      })
      allLocations = Array.from(uniqueLocs.values())

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

