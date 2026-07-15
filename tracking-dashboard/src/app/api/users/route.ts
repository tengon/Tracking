import { NextRequest, NextResponse } from 'next/server'
import {
  getChildAccounts,
  createChildAccount,
  updateChildAccount,
  deleteChildAccount,
} from '@/lib/api/tracksolid'
import CryptoJS from 'crypto-js'

// GET  /api/users — list sub-accounts
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const accessToken = searchParams.get('accessToken')
  const target      = searchParams.get('target')

  if (!accessToken || !target) {
    return NextResponse.json({ success: false, error: 'Missing accessToken or target' }, { status: 400 })
  }

  try {
    const res = await getChildAccounts(accessToken, target)
    return NextResponse.json({ success: true, data: (res as any).result ?? [] })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}

// POST /api/users — create sub-account
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { accessToken, account, name, password, email, phone, companyName } = body

  if (!accessToken || !account || !name || !password) {
    return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
  }

  // Hash password to MD5
  const passwordMd5 = CryptoJS.MD5(password).toString()

  try {
    await createChildAccount(accessToken, { account, name, passwordMd5, email, phone, companyName })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}

// PUT /api/users — update sub-account
export async function PUT(req: NextRequest) {
  const body = await req.json()
  const { accessToken, account, name, email, phone, companyName } = body

  if (!accessToken || !account) {
    return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
  }

  try {
    await updateChildAccount(accessToken, { account, name, email, phone, companyName })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}

// DELETE /api/users — delete sub-account
export async function DELETE(req: NextRequest) {
  const body = await req.json()
  const { accessToken, account } = body

  if (!accessToken || !account) {
    return NextResponse.json({ success: false, error: 'Missing accessToken or account' }, { status: 400 })
  }

  try {
    await deleteChildAccount(accessToken, account)
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}
