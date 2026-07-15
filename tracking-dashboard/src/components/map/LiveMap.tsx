'use client'
import { useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'
import type { DeviceLocation } from '@/lib/api/types'

interface Props {
  devices: DeviceLocation[]
  selected: DeviceLocation | null
  onSelect: (d: DeviceLocation) => void
}

export default function LiveMap({ devices, selected, onSelect }: Props) {
  const mapRef = useRef<any>(null)
  const markersRef = useRef<Map<string, any>>(new Map())
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (typeof window === 'undefined' || mapRef.current) return

    import('leaflet').then(L => {
      if (!containerRef.current || mapRef.current) return

      // Fix default marker icon path issue in webpack
      // @ts-expect-error – internal leaflet type
      delete L.Icon.Default.prototype._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      const map = L.map(containerRef.current, {
        center: [-2.5, 118.0],
        zoom: 5,
        zoomControl: true,
        attributionControl: true,
      })

      // Standard OpenStreetMap tiles
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        subdomains: 'abc',
        maxZoom: 19,
      }).addTo(map)

      mapRef.current = map
    })

    return () => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }
    }
  }, [])

  // Update markers when devices change
  useEffect(() => {
    if (!mapRef.current || typeof window === 'undefined') return

    import('leaflet').then(L => {
      const map = mapRef.current
      const existingKeys = new Set(markersRef.current.keys())

      devices.forEach(device => {
        if (!device.lat || !device.lng) return
        existingKeys.delete(device.imei)

        const isOnline = device.status === '1'
        const isMoving = isOnline && Number(device.speed) > 0
        const defaultColor = isMoving ? '#00D4FF' : isOnline ? '#00FF94' : '#FF4560'
        const color    = device.customColor || defaultColor
        const bg       = `${color}30` // Use hex + alpha

        const icon = L.divIcon({
          className: '',
          html: `
            <div style="position:relative;width:40px;height:40px">
              <div style="
                width:40px;height:40px;border-radius:50%;
                background:${bg};
                border:2.5px solid ${color};
                display:flex;align-items:center;justify-content:center;
                font-size:18px;
                box-shadow:0 0 12px ${color}80, 0 2px 8px rgba(0,0,0,0.5);
              ">🚗</div>
              ${isMoving ? `<div style="
                position:absolute;top:0;right:0;
                width:11px;height:11px;
                background:${color};border-radius:50%;
                border:2px solid #0d1520;
                animation:blink 1s infinite;
              "></div>` : ''}
            </div>`,
          iconSize: [40, 40],
          iconAnchor: [20, 20],
          popupAnchor: [0, -24],
        })

        const popup = `
          <div style="min-width:210px;font-family:Inter,system-ui,sans-serif;color:#1E293B">
            <div style="font-weight:700;font-size:14px;margin-bottom:4px;color:#0369A1">${device.deviceName}</div>
            <div style="font-size:10px;color:#94A3B8;margin-bottom:6px;font-family:monospace">${device.imei}</div>
            ${device.assignedTo ? `<div style="font-size:10px;color:#0EA5E9;font-weight:600;margin-bottom:10px;padding:2px 6px;background:#E0F2FE;border-radius:4px;display:inline-block;">👤 ${device.assignedTo}</div>` : ''}
            <div style="height:1px;background:#E2E8F0;margin-bottom:10px"></div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px">
              <div style="background:#F0F9FF;border-radius:8px;padding:6px 8px;border:1px solid #BAE6FD">
                <div style="color:#64748B;font-size:10px;margin-bottom:2px">Speed</div>
                <div style="font-weight:700;color:#0369A1">${device.speed} km/h</div>
              </div>
              <div style="background:#F8FAFC;border-radius:8px;padding:6px 8px;border:1px solid #E2E8F0">
                <div style="color:#64748B;font-size:10px;margin-bottom:2px">ACC</div>
                <div style="font-weight:600;color:#1E293B">${device.accStatus === '1' ? '🔑 ON' : '⚫ OFF'}</div>
              </div>
              <div style="background:#F8FAFC;border-radius:8px;padding:6px 8px;border:1px solid #E2E8F0">
                <div style="color:#64748B;font-size:10px;margin-bottom:2px">GPS Sat</div>
                <div style="font-weight:600;color:#1E293B">${device.gpsNum || '—'}</div>
              </div>
              <div style="background:#F8FAFC;border-radius:8px;padding:6px 8px;border:1px solid #E2E8F0">
                <div style="color:#64748B;font-size:10px;margin-bottom:2px">Battery</div>
                <div style="font-weight:700;color:${Number(device.batteryPowerVal) < 20 ? '#DC2626' : '#16A34A'}">${device.batteryPowerVal ? `${device.batteryPowerVal}%` : '—'}</div>
              </div>
            </div>
            <div style="margin-top:10px;font-size:10px;color:#94A3B8">📅 ${device.gpsTime?.slice(0,16) || '—'}</div>
          </div>
        `

        if (markersRef.current.has(device.imei)) {
          const m = markersRef.current.get(device.imei)!
          m.setLatLng([device.lat, device.lng])
          m.setIcon(icon)
          m.getPopup()?.setContent(popup)
        } else {
          const m = L.marker([device.lat, device.lng], { icon })
            .addTo(map)
            .bindPopup(popup, { maxWidth: 280, className: 'fleet-popup' })
          m.on('click', () => onSelect(device))
          markersRef.current.set(device.imei, m)
        }
      })

      // Remove stale markers
      existingKeys.forEach(key => {
        markersRef.current.get(key)?.remove()
        markersRef.current.delete(key)
      })
    })
  }, [devices, onSelect])

  // Pan to selected
  useEffect(() => {
    if (selected && mapRef.current && selected.lat && selected.lng) {
      mapRef.current.flyTo([selected.lat, selected.lng], 15, { animate: true, duration: 1 })
      markersRef.current.get(selected.imei)?.openPopup()
    }
  }, [selected])

  return (
    <>
      <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: 400 }} />
      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }

        /* Leaflet container base */
        .leaflet-container { background:#e8e8e8 !important; font-family: Inter, system-ui, sans-serif; }

        /* Zoom controls – clean white card style */
        .leaflet-control-zoom { border: none !important; border-radius: 12px !important; overflow:hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.15) !important; }
        .leaflet-control-zoom a { background: #ffffff !important; color: #334155 !important; border-bottom: 1px solid #E2E8F0 !important; width:34px !important; height:34px !important; line-height:34px !important; font-size:18px !important; font-weight:600 !important; transition: all 0.15s !important; }
        .leaflet-control-zoom a:hover { background: #0EA5E9 !important; color: #ffffff !important; }
        .leaflet-control-attribution { background: rgba(255,255,255,0.85) !important; color: #94A3B8 !important; font-size:10px !important; border-radius: 6px 0 0 0 !important; backdrop-filter: blur(4px); }
        .leaflet-control-attribution a { color: #64748B !important; }

        /* Custom popup – crisp white card */
        .fleet-popup .leaflet-popup-content-wrapper {
          background: #ffffff !important;
          border: none !important;
          border-radius: 16px !important;
          box-shadow: 0 8px 30px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08) !important;
          color: #1E293B !important;
          padding: 0 !important;
        }
        .fleet-popup .leaflet-popup-content {
          margin: 14px 16px !important;
        }
        .fleet-popup .leaflet-popup-tip-container { margin-top: -1px; }
        .fleet-popup .leaflet-popup-tip { background: #ffffff !important; box-shadow: none !important; }
        .fleet-popup .leaflet-popup-close-button { color: #94A3B8 !important; font-size:18px !important; top:8px !important; right:10px !important; }
        .fleet-popup .leaflet-popup-close-button:hover { color: #0EA5E9 !important; }
      `}</style>
    </>
  )
}
