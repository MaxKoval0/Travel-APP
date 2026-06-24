import { OverlayView } from '@react-google-maps/api'
import type { FpvStatus, TouristStatus } from '../../lib/database.types'
import { DEFAULT_PIN_COLOR, FPV_STATUS_COLORS, TOURIST_STATUS_COLORS } from './statusStyles'

// Teardrop pin, tip at local (0,0), head centered at (0,-18) with radius 9.
export const PIN_PATH = 'M 0,0 C -1.8,-12 -9,-13.2 -9,-18 A 9,9 0 1 1 9,-18 C 9,-13.2 1.8,-12 0,0 Z'
const PIN_VIEWBOX = '-10 -29 21 29'
const VIEW_WIDTH = 21
const VIEW_HEIGHT = 29
const BASE_DISPLAY_WIDTH = 26
const BADGE_POSITION = { cx: 6.5, cy: -24.5, r: 4 }
const PENDING_COLOR = '#2563eb'

interface MapPinProps {
  lat: number
  lng: number
  touristStatus?: TouristStatus | null
  fpvStatus?: FpvStatus | null
  visited?: boolean
  selected?: boolean
  pending?: boolean
  label?: string
  onClick?: () => void
}

export default function MapPin({
  lat,
  lng,
  touristStatus,
  fpvStatus,
  visited,
  selected,
  pending,
  label,
  onClick,
}: MapPinProps) {
  const scale = (selected ? 1.35 : 1) * (BASE_DISPLAY_WIDTH / VIEW_WIDTH)
  const width = VIEW_WIDTH * scale
  const height = VIEW_HEIGHT * scale
  const pinColor = pending ? PENDING_COLOR : touristStatus ? TOURIST_STATUS_COLORS[touristStatus] : DEFAULT_PIN_COLOR
  const badgeColor = !pending && fpvStatus ? FPV_STATUS_COLORS[fpvStatus] : null

  return (
    <OverlayView position={{ lat, lng }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
      <div
        onClick={(e) => {
          if (!onClick) return
          e.stopPropagation()
          onClick()
        }}
        className="flex -translate-x-1/2 -translate-y-full flex-col items-center"
        style={{ cursor: onClick ? 'pointer' : 'default' }}
      >
        {label && (
          <span className="mb-0.5 max-w-[120px] truncate rounded bg-white px-1 text-[10px] font-medium text-slate-700 shadow">
            {label}
          </span>
        )}
        <svg width={width} height={height} viewBox={PIN_VIEWBOX}>
          <g opacity={visited ? 0.55 : 1}>
            <path d={PIN_PATH} fill={pinColor} stroke="#1f2937" strokeWidth={1} />
            {badgeColor && (
              <circle cx={BADGE_POSITION.cx} cy={BADGE_POSITION.cy} r={BADGE_POSITION.r} fill={badgeColor} stroke="#fff" strokeWidth={1} />
            )}
          </g>
        </svg>
      </div>
    </OverlayView>
  )
}
