import { NextRequest, NextResponse } from 'next/server'
import { getChildAccounts } from '@/lib/api/tracksolid'

async function fetchTree(accessToken: string, target: string): Promise<any> {
  try {
    const res = await getChildAccounts(accessToken, target)
    let children = (res as any).result || []
    
    // Prevent JIMI from returning the target account itself in its children list
    // This stops infinite recursion and prevents the parent from deleting itself during deduplication
    children = children.filter((c: any) => c.account !== target)

    // For each child, fetch its children (recursively)
    const promises = children.map(async (child: any) => {
      const grandchildren = await fetchTree(accessToken, child.account)
      return {
        ...child,
        children: grandchildren
      }
    })
    
    let nestedChildren = await Promise.all(promises)

    // Deduplicate: JIMI returns all descendants in the flat list at the top level.
    // We must remove sub-sub-accounts from the top level if they belong to a sub-account.
    const getAllDescendantAccounts = (nodes: any[]): string[] => {
      let accs: string[] = []
      for (const n of nodes) {
        accs.push(n.account)
        if (n.children) {
          accs = accs.concat(getAllDescendantAccounts(n.children))
        }
      }
      return accs
    }

    const descendantMap = new Set<string>()
    for (const child of nestedChildren) {
      if (child.children) {
        const desc = getAllDescendantAccounts(child.children)
        desc.forEach(a => descendantMap.add(a))
      }
    }

    // Filter out direct children that are actually descendants of another child
    nestedChildren = nestedChildren.filter(child => !descendantMap.has(child.account))

    if (target === 'tengon') require('fs').writeFileSync('tree-debug.json', JSON.stringify(nestedChildren, null, 2)); return nestedChildren
  } catch (e) {
    console.error(`Failed to fetch children for ${target}:`, e)
    return []
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const accessToken = searchParams.get('accessToken')
  const target      = searchParams.get('target')

  if (!accessToken || !target) {
    return NextResponse.json({ success: false, error: 'Missing accessToken or target' }, { status: 400 })
  }

  try {
    const tree = await fetchTree(accessToken, target)
    return NextResponse.json({ success: true, data: tree })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}
