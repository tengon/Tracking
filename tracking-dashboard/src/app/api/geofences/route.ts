import { NextRequest, NextResponse } from 'next/server'
import { getGeofenceList, createPlatformFence, deletePlatformFence } from '@/lib/api/tracksolid'

export async function POST(req: NextRequest) {
  try {
    const { accessToken, account, action, fenceId, fenceData } = await req.json()
    if (!accessToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (action === 'delete') {
      const result = await deletePlatformFence(accessToken, fenceId)
      return NextResponse.json({ success: true, data: result })
    } else if (action === 'create') {
      const result = await createPlatformFence(accessToken, fenceData)
      return NextResponse.json({ success: true, data: result })
    } else {
      const result = await getGeofenceList(accessToken, account)
      return NextResponse.json({ success: true, data: (result as any).result })
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
