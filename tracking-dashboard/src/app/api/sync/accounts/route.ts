import { NextRequest, NextResponse } from 'next/server'
import { getChildAccountsDirect } from '@/lib/api/tracksolid'
import { upsertAccount, hasAccountData } from '@/lib/db/postgres'

/**
 * JIMI `jimi.user.child.list` returns ALL descendants flat in one call.
 * Each node has `userId` (its own numeric ID) and `parentId` (parent's numeric ID).
 * 
 * Strategy:
 * 1. Call child.list once for the root account → get the flat list of ALL descendants
 * 2. Build a map: userId (string) → account (string)
 * 3. For each descendant, look up its parent via parentId in that map
 * 4. If parentId not found in map → parent is the root account itself
 * 5. Upsert all into PostgreSQL with correct parent_account
 */
async function syncFromFlatList(
  accessToken: string,
  rootAccount: string
): Promise<{ total: number; accounts: string[] }> {
  // Single API call — returns ALL descendants flat
  const res = await getChildAccountsDirect(accessToken, rootAccount)
  const allChildren: any[] = ((res as any).result || []).filter(
    (c: any) => c.account !== rootAccount
  )

  if (allChildren.length === 0) {
    await upsertAccount({ account: rootAccount, parent_account: null })
    return { total: 1, accounts: [rootAccount] }
  }

  // Build userId → account lookup (all children)
  const userIdToAccount = new Map<string, string>()
  for (const c of allChildren) {
    if (c.userId) userIdToAccount.set(String(c.userId), c.account)
  }

  // Derive the root account's userId from children's parentId values
  // The root's userId is any parentId that is NOT in userIdToAccount (i.e., not a child itself)
  let rootUserId: string | null = null
  for (const c of allChildren) {
    const pid = String(c.parentId)
    if (!userIdToAccount.has(pid)) {
      rootUserId = pid
      break
    }
  }
  if (rootUserId) userIdToAccount.set(rootUserId, rootAccount)

  // Upsert root account first
  await upsertAccount({ account: rootAccount, parent_account: null })

  const synced: string[] = [rootAccount]

  // Upsert all descendants with correct parent resolved via parentId
  for (const c of allChildren) {
    const parentAcc = userIdToAccount.get(String(c.parentId)) ?? rootAccount
    await upsertAccount({
      account: c.account,
      parent_account: parentAcc,
      name: c.name,
      company_name: c.companyName,
      email: c.email,
      phone: c.phone,
      type: c.type,
    })
    synced.push(c.account)
  }

  return { total: synced.length, accounts: synced }
}

export async function POST(req: NextRequest) {
  try {
    const { accessToken, target, force } = await req.json()
    if (!accessToken || !target) {
      return NextResponse.json({ error: 'Missing accessToken or target' }, { status: 400 })
    }

    if (!force) {
      const hasData = await hasAccountData(target)
      if (hasData) {
        return NextResponse.json({
          success: true,
          message: 'Already synced. Use force=true to re-sync.',
        })
      }
    }

    const { total, accounts } = await syncFromFlatList(accessToken, target)

    return NextResponse.json({ success: true, total_synced: total, accounts })
  } catch (e: any) {
    console.error('Sync error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const accounts = await import('@/lib/db/postgres').then(m => m.getAllAccounts())
    return NextResponse.json({ success: true, total: accounts.length, data: accounts })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
