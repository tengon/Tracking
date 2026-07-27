import { NextRequest, NextResponse } from 'next/server'
import { buildAccountTree, hasAccountData } from '@/lib/db/postgres'
import { getChildAccounts } from '@/lib/api/tracksolid'

// ─── Build Tree from flat Jimi API array ─────────────────────────────────────
function buildTreeFromFlatList(allChildren: any[], rootAccount: string): any[] {
  if (!allChildren || allChildren.length === 0) return []

  const userIdToNode = new Map<string, any>()
  const accountToNode = new Map<string, any>()
  const nodes: any[] = []

  for (const c of allChildren) {
    if (c.account === rootAccount) continue

    const node = {
      account: c.account,
      name: c.name || c.account,
      companyName: c.companyName || c.company_name || c.name || c.account,
      customerName: c.companyName || c.company_name || c.name || c.account,
      type: c.type ?? 0,
      userId: c.userId ? String(c.userId) : (c.user_id ? String(c.user_id) : null),
      parentId: c.parentId ? String(c.parentId) : (c.parent_id ? String(c.parent_id) : null),
      parentAccount: c.parent_account || null,
      children: [],
    }

    if (node.userId) userIdToNode.set(node.userId, node)
    accountToNode.set(node.account, node)
    nodes.push(node)
  }

  const topLevel: any[] = []

  for (const node of nodes) {
    let parentNode: any = null

    // 1. Try parentId lookup
    if (node.parentId && userIdToNode.has(node.parentId)) {
      parentNode = userIdToNode.get(node.parentId)
    }
    // 2. Fallback to parentAccount lookup
    else if (node.parentAccount && accountToNode.has(node.parentAccount)) {
      parentNode = accountToNode.get(node.parentAccount)
    }

    if (parentNode && parentNode !== node) {
      parentNode.children.push(node)
    } else {
      topLevel.push(node)
    }
  }

  return topLevel
}

async function fetchTreeFromJimi(accessToken: string, target: string): Promise<any[]> {
  try {
    const res = await getChildAccounts(accessToken, target)
    const allChildren = (res as any).result || []
    return buildTreeFromFlatList(allChildren, target)
  } catch (e) {
    console.error(`JIMI fetch children failed for ${target}:`, e)
    return []
  }
}

// ─── In-memory cache (backup) ─────────────────────────────────────────────────
const treeCache = new Map<string, { data: any; time: number }>()
const CACHE_TTL = 5 * 60 * 1000

export function clearTreeCache() {
  treeCache.clear()
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const accessToken = searchParams.get('accessToken')
    const target = searchParams.get('target')
    const refresh = searchParams.get('refresh') === 'true'

    if (!accessToken || !target) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

    if (refresh) {
      treeCache.clear()
    }

    // ── 1. Try PostgreSQL first if refresh is not explicitly requested ─────────
    if (!refresh) {
      const hasPgData = await hasAccountData(target)
      if (hasPgData) {
        const cached = treeCache.get(`pg_${target}`)
        if (cached && Date.now() - cached.time < CACHE_TTL) {
          return NextResponse.json({ success: true, source: 'pg_cache', data: cached.data })
        }

        const root = await buildAccountTree(target)
        const tree = root ? root.children : []

        // If PostgreSQL has nested nodes (depth > 1 or contains children with children), return them
        const hasDeepNesting = tree.some((c: any) => c.children && c.children.length > 0)
        if (tree && tree.length > 0 && hasDeepNesting) {
          treeCache.set(`pg_${target}`, { data: tree, time: Date.now() })
          return NextResponse.json({ success: true, source: 'postgres', data: tree })
        }
      }
    }

    // ── 2. Fallback / Fresh: JIMI API with in-memory cache ───────────────────
    if (!refresh) {
      const cached = treeCache.get(target)
      if (cached && Date.now() - cached.time < CACHE_TTL) {
        return NextResponse.json({ success: true, source: 'jimi_cache', data: cached.data })
      }
    }

    const tree = await fetchTreeFromJimi(accessToken, target)
    treeCache.set(target, { data: tree, time: Date.now() })
    return NextResponse.json({ success: true, source: 'jimi', data: tree })

  } catch (e: any) {
    console.error('Tree API Error:', e)
    return NextResponse.json({ error: e.message || 'Internal Error' }, { status: 500 })
  }
}
