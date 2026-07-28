import { NextRequest, NextResponse } from 'next/server'
import { getToken, getChildAccountsDirect } from '@/lib/api/tracksolid'
import { upsertAccount, getAccountChildren } from '@/lib/db/postgres'
import CryptoJS from 'crypto-js'

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json()
    if (!username || !password) {
      return NextResponse.json({ error: 'Username dan password wajib diisi' }, { status: 400 })
    }

    let passwordMd5 = password
    // If not a 32-character hex string, hash it
    if (!/^[a-f0-9]{32}$/i.test(password)) {
      passwordMd5 = CryptoJS.MD5(password).toString()
    }
    const result = await getToken(username, passwordMd5, 7200)
    let tokenData = (result as any).result
    const accessToken = tokenData?.accessToken
    const account = tokenData?.account || username

    let accountsList: any[] = []

    // Background sync of accounts during login
    if (accessToken && account) {
      try {
        const childRes = await getChildAccountsDirect(accessToken, account)
        const children = (childRes as any)?.result || []
        
        if (Array.isArray(children)) {
          for (const child of children) {
            if (!child.account) continue;
            await upsertAccount({
              account: child.account,
              parent_account: account,
              name: child.name,
              company_name: child.companyName,
              email: child.email,
              phone: child.phone,
              type: child.type,
              display_flag: child.displayFlag,
              address: child.address,
              birth: child.birth,
              language: child.language,
              sex: child.sex,
              enabled_flag: child.enabledFlag,
              remark: child.remark,
              user_id: child.userId,
              parent_id: child.parentId,
              raw_detail: child,
            })
          }
        }
        
        // Load the synced data from DB to include in response
        accountsList = await getAccountChildren(account)
      } catch (dbErr: any) {
        console.warn('Sync accounts during login failed:', dbErr?.message || dbErr)
      }
    }

    return NextResponse.json({ 
      success: true, 
      data: tokenData,
      accounts: accountsList
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Login gagal' }, { status: 401 })
  }
}
