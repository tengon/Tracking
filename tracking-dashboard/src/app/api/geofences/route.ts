import { NextRequest, NextResponse } from 'next/server'
import { getGeofenceList, createPlatformFence, deletePlatformFence, bindFenceToDevice } from '@/lib/api/tracksolid'
import {
  getAllGeofences,
  getGeofencesByAccount,
  getGeofencesForTree,
  upsertGeofence,
  deleteGeofence,
  bindGeofenceToDevices,
  hasGeofenceData
} from '@/lib/db/postgres'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const account = searchParams.get('account')

    let geofences = []
    if (account) {
      geofences = await getGeofencesForTree(account)
      if (geofences.length === 0) {
        geofences = await getGeofencesByAccount(account)
      }
    } else {
      geofences = await getAllGeofences()
    }

    return NextResponse.json({ success: true, data: geofences })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { accessToken, account, action, fenceId, fenceData, imeis } = await req.json()

    // ─── ACTION: DELETE ────────────────────────────────────────────────────────
    if (action === 'delete') {
      if (!fenceId) return NextResponse.json({ error: 'fenceId is required' }, { status: 400 })
      
      // Delete from PostgreSQL
      await deleteGeofence(fenceId)

      // Try delete from JIMI API if accessToken available
      let jimiRes = null
      if (accessToken) {
        try {
          jimiRes = await deletePlatformFence(accessToken, fenceId)
        } catch (e: any) {
          console.warn('JIMI API fence delete warning:', e.message)
        }
      }

      return NextResponse.json({ success: true, message: 'Geofence deleted', jimi: jimiRes })
    }

    // ─── ACTION: BIND ──────────────────────────────────────────────────────────
    if (action === 'bind') {
      if (!fenceId || !Array.isArray(imeis)) {
        return NextResponse.json({ error: 'fenceId and imeis array required' }, { status: 400 })
      }

      await bindGeofenceToDevices(fenceId, imeis, account)

      if (accessToken && imeis.length > 0) {
        try {
          await bindFenceToDevice(accessToken, fenceId, imeis.join(','))
        } catch (e: any) {
          console.warn('JIMI API fence bind warning:', e.message)
        }
      }

      return NextResponse.json({ success: true, message: 'Geofence bound to devices' })
    }

    // ─── ACTION: CREATE / UPSERT ──────────────────────────────────────────────
    if (action === 'create') {
      if (!fenceData || !fenceData.fence_name) {
        return NextResponse.json({ error: 'fenceData.fence_name is required' }, { status: 400 })
      }

      const generatedId = fenceId || `fence_${Date.now()}_${Math.floor(Math.random()*1000)}`

      const newFence = {
        fence_id: generatedId,
        fence_name: fenceData.fence_name,
        account: account || fenceData.account || 'tengon',
        fence_type: fenceData.fence_type || 'CIRCLE',
        coordinates: fenceData.coordinates ? (typeof fenceData.coordinates === 'string' ? fenceData.coordinates : JSON.stringify(fenceData.coordinates)) : null,
        center_lat: fenceData.center_lat ? Number(fenceData.center_lat) : null,
        center_lng: fenceData.center_lng ? Number(fenceData.center_lng) : null,
        radius: fenceData.radius ? Number(fenceData.radius) : 500,
        alarm_type: fenceData.alarm_type || 'IN_OUT',
        zoom_level: fenceData.zoom_level ? Number(fenceData.zoom_level) : 14,
        color: fenceData.color || '#3B82F6',
        enabled: fenceData.enabled !== undefined ? Number(fenceData.enabled) : 1,
        bound_imeis: fenceData.bound_imeis || [],
        raw_detail: fenceData
      }

      await upsertGeofence(newFence)

      let jimiRes = null
      if (accessToken) {
        try {
          jimiRes = await createPlatformFence(accessToken, {
            fence_name: fenceData.fence_name,
            fence_type: fenceData.fence_type || 'CIRCLE',
            coordinates: newFence.coordinates || '',
            radius: String(newFence.radius),
            alert_type: newFence.alarm_type,
          })
        } catch (e: any) {
          console.warn('JIMI API fence create warning:', e.message)
        }
      }

      return NextResponse.json({ success: true, data: newFence, jimi: jimiRes })
    }

    // ─── ACTION: LIST (WITH PG + JIMI FALLBACK) ───────────────────────────────
    // Check if PG has geofence data
    const hasData = await hasGeofenceData(account)
    if (hasData) {
      const dbGeofences = account ? await getGeofencesForTree(account) : await getAllGeofences()
      return NextResponse.json({ success: true, data: dbGeofences, source: 'database' })
    }

    // If PG is empty and accessToken is provided, sync from JIMI
    if (accessToken && account) {
      const jimiResult = await getGeofenceList(accessToken, account)
      const list = (jimiResult as any).result || []
      
      // Save synced items into PostgreSQL
      for (const item of list) {
        await upsertGeofence({
          fence_id: item.fence_id || item.fenceId || `jimi_${Date.now()}`,
          fence_name: item.fence_name || item.fenceName || 'Unnamed Geofence',
          account: account,
          fence_type: item.fence_type || 'CIRCLE',
          coordinates: item.coordinates || item.pointList || null,
          center_lat: item.lat ? Number(item.lat) : null,
          center_lng: item.lng ? Number(item.lng) : null,
          radius: item.radius ? Number(item.radius) : 500,
          alarm_type: item.alarm_type || item.alertType || 'IN_OUT',
          bound_imeis: item.bound_imeis || [],
          raw_detail: item
        })
      }

      const dbGeofences = await getGeofencesForTree(account)
      return NextResponse.json({ success: true, data: dbGeofences, source: 'jimi_synced' })
    }

    // Fallback: return from DB
    const dbGeofences = account ? await getGeofencesForTree(account) : await getAllGeofences()
    return NextResponse.json({ success: true, data: dbGeofences, source: 'database' })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
