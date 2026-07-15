'use client'
import { useEffect, useRef, useState } from 'react'
import type { TrackPoint, MileageTrip } from '@/lib/api/types'

interface Props {
  points: TrackPoint[]
  trips: MileageTrip[]
  selectedTrip: MileageTrip | null
}

export default function TrackMap({ points, trips, selectedTrip }: Props) {
  const mapRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const polylineRef = useRef<any>(null)
  const animatedMarkerRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])

  const [isPlaying, setIsPlaying] = useState(false)
  const [playIndex, setPlayIndex] = useState(0)
  const [playSpeed, setPlaySpeed] = useState(400) // ms interval
  const [autoCenter, setAutoCenter] = useState(true)

  // Initialize Map
  useEffect(() => {
    if (typeof window === 'undefined' || mapRef.current) return
    import('leaflet').then(L => {
      if (!containerRef.current || mapRef.current) return
      const map = L.map(containerRef.current, { center: [-6.1754, 106.8272], zoom: 12 })
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap', maxZoom: 19
      }).addTo(map)
      mapRef.current = map
    })
    return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null } }
  }, [])

  // Reset playback when points change
  useEffect(() => {
    setPlayIndex(0)
    setIsPlaying(false)
    if (animatedMarkerRef.current && mapRef.current) {
      mapRef.current.removeLayer(animatedMarkerRef.current)
      animatedMarkerRef.current = null
    }
  }, [points])

  // Setup static track polyline and start/end markers
  useEffect(() => {
    if (!mapRef.current || typeof window === 'undefined' || points.length === 0) return
    import('leaflet').then(L => {
      const map = mapRef.current

      // Clean old layers
      if (polylineRef.current) { map.removeLayer(polylineRef.current) }
      markersRef.current.forEach(m => map.removeLayer(m))
      markersRef.current = []

      const latlngs = points.map(p => [p.lat, p.lng] as [number, number])
      const polyline = L.polyline(latlngs, { color: '#00D4FF', weight: 4, opacity: 0.85 }).addTo(map)
      polylineRef.current = polyline

      // Start/end markers
      if (latlngs.length > 0) {
        const startIcon = L.divIcon({ className: '', html: '<div style="background:#00FF94;width:14px;height:14px;border-radius:50%;border:3px solid #0A0E1A;box-shadow:0 0 8px #00FF94"></div>', iconSize: [14,14], iconAnchor: [7,7] })
        const endIcon = L.divIcon({ className: '', html: '<div style="background:#FF4560;width:14px;height:14px;border-radius:50%;border:3px solid #0A0E1A;box-shadow:0 0 8px #FF4560"></div>', iconSize: [14,14], iconAnchor: [7,7] })
        const m1 = L.marker(latlngs[0], { icon: startIcon }).addTo(map).bindPopup('🟢 Start')
        const m2 = L.marker(latlngs[latlngs.length - 1], { icon: endIcon }).addTo(map).bindPopup('🔴 End')
        markersRef.current = [m1, m2]

        map.fitBounds(polyline.getBounds(), { padding: [50, 50] })
      }
    })
  }, [points])

  // Playback timer
  useEffect(() => {
    if (!isPlaying || points.length === 0) return
    const interval = setInterval(() => {
      setPlayIndex(prev => {
        if (prev >= points.length - 1) {
          setIsPlaying(false)
          return prev
        }
        return prev + 1
      })
    }, playSpeed)
    return () => clearInterval(interval)
  }, [isPlaying, playSpeed, points.length])

  // Move animated marker
  useEffect(() => {
    if (!mapRef.current || points.length === 0) return
    const point = points[playIndex]
    if (!point) return

    import('leaflet').then(L => {
      const map = mapRef.current
      const latlng: [number, number] = [point.lat, point.lng]

      if (!animatedMarkerRef.current) {
        const carIcon = L.divIcon({
          className: '',
          html: `<div style="transform: rotate(${point.direction}deg); transition: transform 0.2s ease; display: flex; align-items: center; justify-content: center; background: var(--cyan); width: 28px; height: 28px; border-radius: 50%; border: 3px solid #0A0E1A; box-shadow: 0 0 12px var(--cyan); color: #000; font-size: 14px; font-weight: bold;">🚗</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14]
        })
        animatedMarkerRef.current = L.marker(latlng, { icon: carIcon }).addTo(map)
      } else {
        animatedMarkerRef.current.setLatLng(latlng)
        const iconElement = animatedMarkerRef.current.getElement()
        if (iconElement) {
          const innerDiv = iconElement.querySelector('div')
          if (innerDiv) {
            innerDiv.style.transform = `rotate(${point.direction}deg)`
          }
        }
      }

      if (autoCenter) {
        map.panTo(latlng)
      }
    })
  }, [playIndex, points, autoCenter])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 700 }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: 700 }} />

      {/* Floating Playback Controls */}
      {points.length > 0 && (
        <div style={{
          position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
          zIndex: 1000, background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(8px)',
          border: '1px solid var(--bg-border)', borderRadius: 'var(--r-lg)', padding: '12px 18px',
          display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
        }}>
          <button className={`btn btn-sm ${isPlaying ? 'btn-danger' : 'btn-primary'}`}
            onClick={() => setIsPlaying(!isPlaying)} style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 80 }}>
            {isPlaying ? '⏹ Pause' : '▶ Play'}
          </button>

          <button className="btn btn-sm btn-ghost" onClick={() => setPlayIndex(0)} style={{ fontSize: 12 }}>
            🔄 Reset
          </button>

          {/* Slider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="range" min={0} max={points.length - 1} value={playIndex}
              onChange={e => setPlayIndex(Number(e.target.value))}
              style={{ width: 120, accentColor: 'var(--cyan)' }} />
            <span className="mono" style={{ fontSize: 11, minWidth: 45, color: 'var(--text-muted)' }}>
              {playIndex + 1}/{points.length}
            </span>
          </div>

          {/* Speed Selector */}
          <select className="form-input" value={playSpeed} onChange={e => setPlaySpeed(Number(e.target.value))}
            style={{ padding: '2px 8px', fontSize: 11, width: 80, height: 28, background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', color: 'var(--text-main)', borderRadius: 'var(--r-md)' }}>
            <option value={800}>0.5x Speed</option>
            <option value={400}>1x Speed</option>
            <option value={200}>2x Speed</option>
            <option value={100}>5x Speed</option>
            <option value={50}>10x Speed</option>
          </select>

          {/* Auto Pan Toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, cursor: 'pointer', userSelect: 'none', color: 'var(--text-secondary)' }}>
            <input type="checkbox" checked={autoCenter} onChange={e => setAutoCenter(e.target.checked)}
              style={{ accentColor: 'var(--cyan)' }} />
            Auto-Pan
          </label>
        </div>
      )}

      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }

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
    </div>
  )
}
