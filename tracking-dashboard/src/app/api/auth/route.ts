import { NextRequest, NextResponse } from 'next/server'
import { getToken } from '@/lib/api/tracksolid'
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

    return NextResponse.json({ success: true, data: (result as any).result })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Login gagal' }, { status: 401 })
  }
}
