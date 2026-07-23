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
        zoomControl: false, // Disable default so we can place it custom
        attributionControl: true,
      })

      // Add zoom control to top-right to avoid overlapping with sidebar toggle
      L.control.zoom({ position: 'topright' }).addTo(map)

      // Standard OpenStreetMap tiles
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        subdomains: 'abc',
        maxZoom: 19,
      }).addTo(map)

      mapRef.current = map

      // Watch for container resizes (e.g. sidebar toggle) and invalidate map size
      const resizeObserver = new ResizeObserver(() => {
        if (mapRef.current) {
          mapRef.current.invalidateSize()
        }
      })
      resizeObserver.observe(containerRef.current)

      // Store observer to clean up later
      // @ts-expect-error - Attach to map object for cleanup
      map.resizeObserver = resizeObserver
    })

    return () => {
      if (mapRef.current) {
        if (mapRef.current.resizeObserver) mapRef.current.resizeObserver.disconnect()
        mapRef.current.remove()
        mapRef.current = null
      }
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

        const deviceLabel = device.deviceName || device.imei || ''
        const shortLabel  = deviceLabel.length > 14 ? deviceLabel.slice(0, 14) + '…' : deviceLabel

        const icon = L.divIcon({
          className: '',
          html: `
            <div style="position:relative;display:flex;flex-direction:column;align-items:center;gap:3px">
              <div style="
                width:40px;height:40px;border-radius:50%;
                background:${bg};
                border:2.5px solid ${color};
                display:flex;align-items:center;justify-content:center;
                font-size:18px;
                box-shadow:0 0 12px ${color}80, 0 2px 8px rgba(0,0,0,0.5);
                position:relative;
              ">🚗${isMoving ? `<div style="
                position:absolute;top:0;right:0;
                width:11px;height:11px;
                background:${color};border-radius:50%;
                border:2px solid #0d1520;
                animation:blink 1s infinite;
              "></div>` : ''}</div>
              <div style="
                white-space:nowrap;
                font-size:10px;
                font-weight:700;
                font-family:Inter,system-ui,sans-serif;
                color:#fff;
                background:rgba(10,10,20,0.78);
                border:1px solid ${color}60;
                border-radius:20px;
                padding:1px 7px;
                letter-spacing:0.02em;
                line-height:1.4;
                backdrop-filter:blur(6px);
                box-shadow:0 2px 6px rgba(0,0,0,0.45);
                pointer-events:none;
              ">${shortLabel}</div>
            </div>`,
          iconSize: [80, 62],
          iconAnchor: [40, 40],
          popupAnchor: [0, -44],
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
            <!--ADDR_${device.imei}-->
            <div style="margin-top:10px;font-size:10px;color:#94A3B8">📅 ${device.gpsTime
              ? (() => { try { return new Date(device.gpsTime.replace(' ', 'T') + 'Z').toLocaleString(undefined, { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false }) } catch { return device.gpsTime.slice(0,16) } })()
              : '—'
            }</div>
          </div>
        `

        let m: any = markersRef.current.get(device.imei)
        
        if (m) {
          m.setLatLng([device.lat, device.lng])
          m.setIcon(icon)
          
          // Preserve address if already fetched, else just update popup template
          const existingPopup = m.getPopup()?.getContent() || ''
          if (m._lastAddress && existingPopup.includes('📍')) {
            const newPopup = popup.replace(`<!--ADDR_${device.imei}-->`, `<div style="font-size:10px;color:#334155;margin-top:8px;line-height:1.4;background:#F1F5F9;padding:6px;border-radius:4px">📍 ${m._lastAddress}</div>`)
            m.getPopup()?.setContent(newPopup)
          } else {
            m.getPopup()?.setContent(popup)
          }
        } else {
          m = L.marker([device.lat, device.lng], { icon })
            .addTo(map)
            .bindPopup(popup, { maxWidth: 280, className: 'fleet-popup' })
            
          m.on('click', () => {
            onSelect(device)
          })

          m.on('popupopen', async () => {
            // On-demand reverse geocoding via OpenStreetMap Nominatim
            if (!m._addressFetched) {
              try {
                m.getPopup().setContent(popup.replace(`<!--ADDR_${device.imei}-->`, `<div style="font-size:10px;color:#64748B;margin-top:8px;line-height:1.4">📍 <i>Memuat alamat...</i></div>`))
                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${device.lat}&lon=${device.lng}`)
                const data = await res.json()
                if (data && data.display_name) {
                  m._addressFetched = true
                  m._lastAddress = data.display_name
                  const newPopup = popup.replace(`<!--ADDR_${device.imei}-->`, `<div style="font-size:10px;color:#334155;margin-top:8px;line-height:1.4;background:#F1F5F9;padding:6px;border-radius:4px">📍 ${data.display_name}</div>`)
                  m.getPopup().setContent(newPopup)
                } else {
                  m.getPopup().setContent(popup.replace(`<!--ADDR_${device.imei}-->`, `<div style="font-size:10px;color:#EF4444;margin-top:8px">📍 Alamat tidak ditemukan</div>`))
                }
              } catch (e) {
                m.getPopup().setContent(popup.replace(`<!--ADDR_${device.imei}-->`, `<div style="font-size:10px;color:#EF4444;margin-top:8px">📍 Gagal memuat alamat</div>`))
              }
            } else if (m._lastAddress) {
                const newPopup = popup.replace(`<!--ADDR_${device.imei}-->`, `<div style="font-size:10px;color:#334155;margin-top:8px;line-height:1.4;background:#F1F5F9;padding:6px;border-radius:4px">📍 ${m._lastAddress}</div>`)
                m.getPopup().setContent(newPopup)
            }
          })
          
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
