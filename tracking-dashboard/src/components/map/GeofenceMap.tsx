'use client'
import { useEffect, useRef } from 'react'
import type { Geofence } from '@/lib/api/types'

interface Props {
  geofences: Geofence[]
  selected: Geofence | null
  onSelect: (f: Geofence) => void
  isDrawing?: boolean
  draftFence?: any
  onDraftUpdate?: (updates: any) => void
}

export default function GeofenceMap({ geofences, selected, onSelect, isDrawing, draftFence, onDraftUpdate }: Props) {
  const mapRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const shapesRef = useRef<Map<string, any>>(new Map())
  
  // Drawing states
  const draftShapeRef = useRef<any>(null)
  const isDraggingRef = useRef(false)
  const draftCenterRef = useRef<any>(null)

  useEffect(() => {
    if (typeof window === 'undefined' || mapRef.current) return
    import('leaflet').then(L => {
      if (!containerRef.current || mapRef.current) return
      const map = L.map(containerRef.current, { center: [-2.5, 118], zoom: 5 })
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap', maxZoom: 19 }).addTo(map)
      mapRef.current = map
    })
    return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null } }
  }, [])

  useEffect(() => {
    if (!mapRef.current || typeof window === 'undefined') return
    import('leaflet').then(L => {
      const map = mapRef.current
      // Remove old shapes
      shapesRef.current.forEach(s => map.removeLayer(s))
      shapesRef.current.clear()

      geofences.forEach(fence => {
        const color = fence.fence_color || '#00D4FF'
        let shape: any

        if (fence.fence_type === 'circle') {
          const [lat, lng] = fence.coordinates.split(',').map(Number)
          shape = L.circle([lat, lng], {
            radius: Number(fence.radius || 500),
            color, fillColor: color, fillOpacity: 0.15, weight: 2,
          }).addTo(map)
          shape.bindPopup(`<b>${fence.fence_name}</b><br>Alert: ${fence.alert_type}<br>Radius: ${fence.radius}m`)
        } else {
          const pts = fence.coordinates.split(';').map(p => p.split(',').map(Number) as [number, number])
          shape = L.polygon(pts, { color, fillColor: color, fillOpacity: 0.15, weight: 2 }).addTo(map)
          shape.bindPopup(`<b>${fence.fence_name}</b><br>Alert: ${fence.alert_type}`)
        }
        shape.on('click', () => onSelect(fence))
        shapesRef.current.set(fence.fence_id, shape)
      })
    })
  }, [geofences, onSelect])

  // Interactive Drawing Logic
  useEffect(() => {
    if (!mapRef.current || typeof window === 'undefined') return
    const map = mapRef.current

    if (!isDrawing) {
      if (draftShapeRef.current) {
        map.removeLayer(draftShapeRef.current)
        draftShapeRef.current = null
      }
      map.off('mousedown')
      map.off('mousemove')
      map.off('mouseup')
      map.getContainer().style.cursor = ''
      map.dragging.enable()
      return
    }

    map.getContainer().style.cursor = 'crosshair'
    map.dragging.disable()

    import('leaflet').then(L => {
      const isCircle = draftFence?.type === 'circle'

      // Switch layer type if user changes dropdown
      if (draftShapeRef.current) {
         const currentIsCircle = draftShapeRef.current instanceof L.Circle
         if ((isCircle && !currentIsCircle) || (!isCircle && currentIsCircle)) {
             map.removeLayer(draftShapeRef.current)
             draftShapeRef.current = null
         }
      }

      if (!draftShapeRef.current) {
        if (isCircle) {
          draftShapeRef.current = L.circle([0, 0], {
            radius: 0, color: '#F59E0B', fillColor: '#F59E0B', fillOpacity: 0.2, weight: 2, dashArray: '5, 5'
          }).addTo(map)
        } else {
          draftShapeRef.current = L.polygon([[0,0],[0,0],[0,0],[0,0]], {
            color: '#F59E0B', fillColor: '#F59E0B', fillOpacity: 0.2, weight: 2, dashArray: '5, 5'
          }).addTo(map)
        }
      }

      map.off('mousedown').on('mousedown', (e: any) => {
        isDraggingRef.current = true
        draftCenterRef.current = e.latlng
        
        if (draftShapeRef.current) {
           if (isCircle) {
             draftShapeRef.current.setLatLng(e.latlng)
             draftShapeRef.current.setRadius(10)
           } else {
             const lat2 = e.latlng.lat - 0.0001
             const lng2 = e.latlng.lng + 0.0001
             draftShapeRef.current.setLatLngs([
               [e.latlng.lat, e.latlng.lng],
               [e.latlng.lat, lng2],
               [lat2, lng2],
               [lat2, e.latlng.lng]
             ])
           }
        }
      })

      map.off('mousemove').on('mousemove', (e: any) => {
        if (!isDraggingRef.current || !draftShapeRef.current) return
        
        if (isCircle) {
           const dist = draftCenterRef.current.distanceTo(e.latlng)
           draftShapeRef.current.setRadius(dist)
        } else {
           const start = draftCenterRef.current
           const end = e.latlng
           draftShapeRef.current.setLatLngs([
             [start.lat, start.lng], // Point 1: Top-Left
             [start.lat, end.lng],   // Point 2: Top-Right
             [end.lat, end.lng],     // Point 3: Bottom-Right
             [end.lat, start.lng]    // Point 4: Bottom-Left
           ])
        }
      })

      map.off('mouseup').on('mouseup', (e: any) => {
        if (!isDraggingRef.current) return
        isDraggingRef.current = false
        if (onDraftUpdate) {
           if (isCircle) {
             const dist = draftCenterRef.current.distanceTo(e.latlng)
             onDraftUpdate({ 
               coordinates: `${draftCenterRef.current.lat.toFixed(5)},${draftCenterRef.current.lng.toFixed(5)}`,
               radius: Math.max(10, Math.round(dist)).toString()
             })
           } else {
             const start = draftCenterRef.current
             const end = e.latlng
             const coords = [
               `${start.lat.toFixed(5)},${start.lng.toFixed(5)}`,
               `${start.lat.toFixed(5)},${end.lng.toFixed(5)}`,
               `${end.lat.toFixed(5)},${end.lng.toFixed(5)}`,
               `${end.lat.toFixed(5)},${start.lng.toFixed(5)}`
             ].join(';')
             onDraftUpdate({ coordinates: coords })
           }
        }
      })
    })
  }, [isDrawing, draftFence?.type, onDraftUpdate])

  // Sync Manual Input to Map (when NOT actively dragging)
  useEffect(() => {
    if (isDraggingRef.current || !isDrawing || !draftFence || !draftShapeRef.current) return
    if (draftFence.type === 'circle') {
      const [lat, lng] = draftFence.coordinates.split(',').map(Number)
      if (!isNaN(lat) && !isNaN(lng)) {
        if (typeof draftShapeRef.current.setLatLng === 'function') {
          draftShapeRef.current.setLatLng([lat, lng])
          draftShapeRef.current.setRadius(Number(draftFence.radius || 100))
        }
      } else {
        if (typeof draftShapeRef.current.setRadius === 'function') draftShapeRef.current.setRadius(0)
      }
    } else {
      if (typeof draftShapeRef.current.setLatLngs === 'function') {
        const ptsStr = draftFence.coordinates.split(';').filter(Boolean)
        if (ptsStr.length >= 3) {
          const pts = ptsStr.map((p: string) => p.split(',').map(Number) as [number, number])
          draftShapeRef.current.setLatLngs(pts)
        } else {
          draftShapeRef.current.setLatLngs([])
        }
      }
    }
  }, [draftFence, isDrawing])

  useEffect(() => {
    if (!selected || !mapRef.current) return
    const shape = shapesRef.current.get(selected.fence_id)
    if (shape) {
      if (shape.getBounds) mapRef.current.fitBounds(shape.getBounds(), { padding: [40, 40] })
      shape.openPopup()
    }
  }, [selected])

  return (
    <>
      <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: 700 }} />
      <style>{`
        /* Leaflet container base */
        .leaflet-container { background:#e8e8e8 !important; font-family: Inter, system-ui, sans-serif; }

        /* Zoom controls */
        .leaflet-control-zoom { border: none !important; border-radius: 12px !important; overflow:hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.15) !important; }
        .leaflet-control-zoom a { background: #ffffff !important; color: #334155 !important; border-bottom: 1px solid #E2E8F0 !important; width:34px !important; height:34px !important; line-height:34px !important; font-size:18px !important; font-weight:600 !important; transition: all 0.15s !important; }
        .leaflet-control-zoom a:hover { background: #0EA5E9 !important; color: #ffffff !important; }
        .leaflet-control-attribution { background: rgba(255,255,255,0.85) !important; color: #94A3B8 !important; font-size:10px !important; border-radius: 6px 0 0 0 !important; backdrop-filter: blur(4px); }
        .leaflet-control-attribution a { color: #64748B !important; }

        /* Custom popup */
        .leaflet-popup-content-wrapper {
          background: #ffffff !important;
          border: none !important;
          border-radius: 16px !important;
          box-shadow: 0 8px 30px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08) !important;
          color: #1E293B !important;
          padding: 0 !important;
        }
        .leaflet-popup-content { margin: 14px 16px !important; }
        .leaflet-popup-tip-container { margin-top: -1px; }
        .leaflet-popup-tip { background: #ffffff !important; box-shadow: none !important; }
        .leaflet-popup-close-button { color: #94A3B8 !important; font-size:18px !important; top:8px !important; right:10px !important; }
        .leaflet-popup-close-button:hover { color: #0EA5E9 !important; }
      `}</style>
    </>
  )
}
