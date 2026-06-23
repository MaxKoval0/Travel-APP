import { OverlayView } from '@react-google-maps/api'
import type { FpvStatus, TouristStatus } from '../../lib/database.types'
import { DEFAULT_PIN_COLOR, FPV_STATUS_COLORS, TOURIST_STATUS_COLORS } from './statusStyles'

// Teardrop pin, tip at local (0,0), head centered at (0,-42) with radius 14.
export const PIN_PATH = 'M 0,0 C -2.8,-28 -14,-30.8 -14,-42 A 14,14 0 1 1 14,-42 C 14,-30.8 2.8,-28 0,0 Z'
const PIN_VIEWBOX = '-14 -56 28 56'
const BADGE_POSITION = { cx: 11, cy: -50, r: 5.5 }

interface MapPinProps {
  lat: number
  lng: number
  touristStatus?: TouristStatus | null
  fpvStatus?: FpvStatus | null
  visited?: boolean
  selected?: boolean
  label?: string
  onClick?: () => void
}

export default function MapPin({ lat, lng, touristStatus, fpvStatus, visited, selected, label, onClick }: MapPinProps) {
  const scale = selected ? 1.4 : 1
  const width = 28 * scale
  const height = 56 * scale
  const pinColor = touristStatus ? TOURIST_STATUS_COLORS[touristStatus] : DEFAULT_PIN_COLOR
  const badgeColor = fpvStatus ? FPV_STATUS_COLORS[fpvStatus] : null

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
            <path d={PIN_PATH} fill={pinColor} stroke="#1f2937" strokeWidth={1.2} />
            {badgeColor && (
              <circle cx={BADGE_POSITION.cx} cy={BADGE_POSITION.cy} r={BADGE_POSITION.r} fill={badgeColor} stroke="#fff" strokeWidth={1.2} />
            )}
          </g>
        </svg>
      </div>
    </OverlayView>
  )
}
