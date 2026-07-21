import { NextRequest, NextResponse } from 'next/server'
import { getAllDeviceLocations, getDeviceLocation, getChildAccounts } from '@/lib/api/tracksolid'
import { getDeviceLabels } from '@/lib/db/database'
import { getDescendants, hasAccountData } from '@/lib/db/postgres'

// In-memory cache for JIMI-based fallback
interface CachedAccount { account: string; depth: number }
interface CacheEntry { data: CachedAccount[]; time: number }
const accountTreeCache = new Map<string, CacheEntry>()
const TREE_CACHE_TTL = 5 * 60 * 1000

export async function POST(req: NextRequest) {
  try {
    const { accessToken, target, imeis, contextAccount } = await req.json()
    if (!accessToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (imeis) {
      const result = await getDeviceLocation(accessToken, imeis)
      return NextResponse.json({ success: true, data: (result as any).result })
    } else {
      let tree: CachedAccount[]

      // ── 1. Try PostgreSQL ─────────────────────────────────────────────────
      const hasPgData = await hasAccountData(target)
      if (hasPgData) {
        const cached = accountTreeCache.get(`pg_${target}`)
        if (cached && Date.now() - cached.time < TREE_CACHE_TTL) {
          tree = cached.data
        } else {
          const rows = await getDescendants(target)
          tree = rows
          accountTreeCache.set(`pg_${target}`, { data: tree, time: Date.now() })
        }
      } else {
        // ── 2. Fallback: JIMI API with in-memory cache ──────────────────────
        async function buildFromJimi(token: string, tgt: string, depth = 0): Promise<CachedAccount[]> {
          let list: CachedAccount[] = [{ account: tgt, depth }]
          try {
            const childRes = await getChildAccounts(token, tgt)
            let children = (childRes as any).result || []
            children = children.filter((c: any) => c.account !== tgt)
            for (const c of children) {
              const sub = await buildFromJimi(token, c.account, depth + 1)
              list = list.concat(sub)
            }
          } catch (e) {
            console.error(`Failed to fetch children for ${tgt}:`, e)
          }
          return list
        }

        let cached = accountTreeCache.get(target)
        if (!cached || Date.now() - cached.time > TREE_CACHE_TTL) {
          const data = await buildFromJimi(accessToken, target, 0)
          accountTreeCache.set(target, { data, time: Date.now() })
          cached = accountTreeCache.get(target)
        }
        tree = cached!.data
      }


      // 2. Fetch locations for all cached accounts
      let allLocations: any[] = []
      const promises = tree.map(async (acc) => {
        try {
          const res = await getAllDeviceLocations(accessToken, acc.account)
          if (res && Array.isArray((res as any).result)) {
            const mappedLocs = (res as any).result.map((d: any) => ({ ...d, _jimiAccount: acc.account, _depth: acc.depth }))
            return mappedLocs
          }
        } catch (e) {
          console.error(`Failed to fetch locations for ${acc.account}:`, e)
        }
        return []
      })
      
      const results = await Promise.all(promises)
      results.forEach(locs => allLocations = allLocations.concat(locs))

      // 3. Deduplicate by IMEI (keep the one with highest depth to ensure the most specific sub-account wins)
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

