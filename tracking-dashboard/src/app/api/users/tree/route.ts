import { NextRequest, NextResponse } from 'next/server'
import { buildAccountTree, hasAccountData } from '@/lib/db/postgres'
import { getChildAccounts } from '@/lib/api/tracksolid'

// ─── Fallback: fetch from JIMI API if PG has no data yet ─────────────────────
async function fetchTreeFromJimi(accessToken: string, target: string): Promise<any> {
  try {
    const res = await getChildAccounts(accessToken, target)
    let children = (res as any).result || []
    children = children.filter((c: any) => c.account !== target)

    const promises = children.map(async (child: any) => {
      const grandchildren = await fetchTreeFromJimi(accessToken, child.account)
      return { ...child, customerName: child.companyName || child.name, children: grandchildren }
    })
    let nested = await Promise.all(promises)

    // Deduplicate: remove sub-sub-accounts from top level
    const getAllDesc = (nodes: any[]): string[] => {
      let accs: string[] = []
      for (const n of nodes) {
        accs.push(n.account)
        if (n.children) accs = accs.concat(getAllDesc(n.children))
      }
      return accs
    }
    const descMap = new Set<string>()
    for (const child of nested) {
      if (child.children) getAllDesc(child.children).forEach(a => descMap.add(a))
    }
    nested = nested.filter(c => !descMap.has(c.account))
    return nested
  } catch (e) {
    console.error(`JIMI fetch children failed for ${target}:`, e)
    return []
  }
}

// ─── In-memory cache (backup) ─────────────────────────────────────────────────
const treeCache = new Map<string, { data: any; time: number }>()
const CACHE_TTL = 5 * 60 * 1000

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const accessToken = searchParams.get('accessToken')
    const target = searchParams.get('target')

    if (!accessToken || !target) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

    // ── 1. Try PostgreSQL first ──────────────────────────────────────────────
    const hasPgData = await hasAccountData(target)
    if (hasPgData) {
      // Check in-memory cache to avoid hitting PG on every interval call
      const cached = treeCache.get(`pg_${target}`)
      if (cached && Date.now() - cached.time < CACHE_TTL) {
        return NextResponse.json({ success: true, source: 'pg_cache', data: cached.data })
      }

      const root = await buildAccountTree(target)
      const tree = root ? root.children : []
      treeCache.set(`pg_${target}`, { data: tree, time: Date.now() })
      return NextResponse.json({ success: true, source: 'postgres', data: tree })
    }

    // ── 2. Fallback: JIMI API with in-memory cache ───────────────────────────
    console.warn(`[tree] No PG data for ${target}. Fetching from JIMI API. Run POST /api/sync/accounts to sync.`)
    const cached = treeCache.get(target)
    if (cached && Date.now() - cached.time < CACHE_TTL) {
      return NextResponse.json({ success: true, source: 'jimi_cache', data: cached.data })
    }

    const tree = await fetchTreeFromJimi(accessToken, target)
    treeCache.set(target, { data: tree, time: Date.now() })
    return NextResponse.json({ success: true, source: 'jimi', data: tree })

  } catch (e: any) {
    console.error('Tree API Error:', e)
    return NextResponse.json({ error: e.message || 'Internal Error' }, { status: 500 })
  }
}
