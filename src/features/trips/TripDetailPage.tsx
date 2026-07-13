import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { useTrip, useUpdateTrip, useDeleteTrip } from '../../hooks/useTrips'
import { useTripItems, useReorderTripItems } from '../../hooks/useTripItems'
import type { TripStatus } from '../../lib/database.types'
import Modal from '../../components/Modal'
import PlaceCard from '../places/PlaceCard'
import TripMiniMap from './TripMiniMap'
import TripItemRow from './TripItemRow'
import TripItemForm from './TripItemForm'
import TextImportForm from './TextImportForm'
import TextUpdateForm from './TextUpdateForm'
import TripCosts from './TripCosts'
import type { TripItemWithPlace } from './types'

const STATUSES: TripStatus[] = ['planned', 'active', 'done']
const STATUS_LABELS: Record<TripStatus, string> = {
  planned: 'Планируется',
  active: 'В процессе',
  done: 'Завершена',
}

export default function TripDetailPage() {
  const { tripId } = useParams<{ tripId: string }>()
  const navigate = useNavigate()
  const { data: trip } = useTrip(tripId)
  const { data: items } = useTripItems(tripId)
  const updateTrip = useUpdateTrip()
  const deleteTrip = useDeleteTrip()
  const reorderItems = useReorderTripItems()

  const [openPlaceId, setOpenPlaceId] = useState<string | null>(null)
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null)
  const [editingItem, setEditingItem] = useState<TripItemWithPlace | 'new' | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [showUpdate, setShowUpdate] = useState(false)
  const [groupBy, setGroupBy] = useState<'date' | 'area'>('date')
  const [mapFocusPoint, setMapFocusPoint] = useState<{ lat: number; lng: number } | null>(null)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const { dated, undated } = useMemo(() => {
    const all = (items ?? []) as TripItemWithPlace[]
    const dated = all
      .filter((i) => i.date)
      .sort((a, b) => (a.date! < b.date! ? -1 : a.date! > b.date! ? 1 : a.sort_order - b.sort_order))
    const undated = all.filter((i) => !i.date).sort((a, b) => a.sort_order - b.sort_order)
    return { dated, undated }
  }, [items])

  const byArea = useMemo(() => {
    const all = (items ?? []) as TripItemWithPlace[]
    const groups = new Map<string, TripItemWithPlace[]>()
    for (const item of all) {
      const key = item.area || 'Без района'
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(item)
    }
    for (const list of groups.values()) list.sort((a, b) => a.sort_order - b.sort_order)
    return Array.from(groups.entries())
  }, [items])

  const dateGroups = useMemo(() => {
    const groups = new Map<string, TripItemWithPlace[]>()
    for (const item of dated) {
      const key = item.date!
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(item)
    }
    return Array.from(groups.entries())
  }, [dated])

  if (!trip) {
    return <div className="p-4 text-sm text-slate-400">Загрузка…</div>
  }

  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const makeHandleDragEnd = (groupItems: TripItemWithPlace[]) => (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id || !tripId) return
    const oldIndex = groupItems.findIndex((i) => i.id === active.id)
    const newIndex = groupItems.findIndex((i) => i.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const reordered = arrayMove(groupItems, oldIndex, newIndex)
    reorderItems.mutate({
      tripId,
      items: reordered.map((item, index) => ({ id: item.id, sort_order: index })),
    })
  }

  const handleShowOnMap = (lat: number, lng: number) => {
    setMapFocusPoint({ lat, lng })
  }

  const renderItem = (item: TripItemWithPlace) => (
    <TripItemRow
      key={item.id}
      item={item}
      expanded={expandedItemId === item.id}
      draggable
      onToggle={() => setExpandedItemId(expandedItemId === item.id ? null : item.id)}
      onShowOnMap={handleShowOnMap}
      onEdit={setEditingItem}
    />
  )

  const renderGroup = (key: string, label: string, groupItems: TripItemWithPlace[]) => {
    const collapsed = collapsedGroups.has(key)
    return (
      <div key={key} className="mt-3">
        <button
          type="button"
          onClick={() => toggleGroup(key)}
          className="flex w-full items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400 hover:text-slate-600"
        >
          <span className={`text-[10px] transition-transform ${collapsed ? '' : 'rotate-90'}`}>▸</span>
          {label}
          <span className="font-normal">({groupItems.length})</span>
        </button>
        {!collapsed && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={makeHandleDragEnd(groupItems)}>
            <SortableContext items={groupItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              <ul className="mt-1.5 flex flex-col gap-1.5">
                {groupItems.map((item) => renderItem(item))}
              </ul>
            </SortableContext>
          </DndContext>
        )}
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      <div className="mx-auto max-w-2xl p-4">
        <Link to="/trips" className="text-xs text-slate-400 hover:text-slate-600">
          ← Все поездки
        </Link>

        <input
          key={trip.id}
          defaultValue={trip.title}
          onBlur={(e) => {
            const value = e.target.value.trim()
            if (value && value !== trip.title) updateTrip.mutate({ id: trip.id, title: value })
          }}
          className="mt-2 block w-full bg-transparent text-xl font-semibold text-slate-800 outline-none"
        />

        <div className="mt-2 flex gap-2">
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => updateTrip.mutate({ id: trip.id, status: s })}
              className={`rounded border px-2 py-1 text-xs font-medium ${
                trip.status === s ? 'border-slate-800 bg-slate-800 text-white' : 'border-slate-300 text-slate-600'
              }`}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>

        <div className="mt-2 flex gap-2">
          <input
            type="date"
            key={`${trip.id}-start`}
            defaultValue={trip.date_start ?? ''}
            onBlur={(e) => updateTrip.mutate({ id: trip.id, date_start: e.target.value || null })}
            className="rounded border border-slate-300 px-2 py-1 text-xs"
          />
          <input
            type="date"
            key={`${trip.id}-end`}
            defaultValue={trip.date_end ?? ''}
            onBlur={(e) => updateTrip.mutate({ id: trip.id, date_end: e.target.value || null })}
            className="rounded border border-slate-300 px-2 py-1 text-xs"
          />
        </div>

        <textarea
          key={`${trip.id}-description`}
          defaultValue={trip.description ?? ''}
          onBlur={(e) => {
            const value = e.target.value.trim()
            if (value !== (trip.description ?? '')) updateTrip.mutate({ id: trip.id, description: value || null })
          }}
          placeholder="Описание поездки"
          rows={2}
          className="mt-2 w-full rounded border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-emerald-500"
        />

        <TripCosts trip={trip} items={dated.concat(undated)} />

        <div className="mt-3 overflow-hidden rounded">
          <TripMiniMap
            tripId={trip.id}
            items={dated.concat(undated)}
            onOpenPlace={setOpenPlaceId}
            focusPoint={mapFocusPoint}
          />
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-600">Пункты</h2>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowImport(true)}
              className="rounded border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600"
            >
              Импорт из текста
            </button>
            {items && items.length > 0 && (
              <button
                type="button"
                onClick={() => setShowUpdate(true)}
                className="rounded border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700"
              >
                Обновить через AI
              </button>
            )}
            <button
              type="button"
              onClick={() => setEditingItem('new')}
              className="rounded bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white"
            >
              + Добавить пункт
            </button>
          </div>
        </div>

        {showImport && (
          <div className="mt-2">
            <TextImportForm tripId={trip.id} tripDateStart={trip.date_start} onClose={() => setShowImport(false)} />
          </div>
        )}

        {showUpdate && items && items.length > 0 && (
          <div className="mt-2">
            <TextUpdateForm items={dated.concat(undated)} onClose={() => setShowUpdate(false)} />
          </div>
        )}

        {editingItem && (
          <div className="mt-2">
            <TripItemForm
              tripId={trip.id}
              editing={editingItem === 'new' ? null : editingItem}
              onClose={() => setEditingItem(null)}
            />
          </div>
        )}

        {items && items.length > 0 && (
          <div className="mt-3 flex gap-2">
            {(['date', 'area'] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGroupBy(g)}
                className={`rounded border px-2.5 py-1 text-xs font-medium ${
                  groupBy === g ? 'border-slate-800 bg-slate-800 text-white' : 'border-slate-300 text-slate-600'
                }`}
              >
                {g === 'date' ? 'По дате' : 'По району'}
              </button>
            ))}
          </div>
        )}

        {groupBy === 'date' ? (
          <>
            {dateGroups.map(([date, groupItems]) =>
              renderGroup(
                `date:${date}`,
                new Date(date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }),
                groupItems,
              ),
            )}
            {undated.length > 0 && renderGroup('undated', 'Не распределено', undated)}
          </>
        ) : (
          byArea.map(([area, areaItems]) => renderGroup(`area:${area}`, area, areaItems))
        )}

        {dated.length === 0 && undated.length === 0 && !editingItem && (
          <p className="mt-2 text-sm text-slate-400">Пока нет пунктов</p>
        )}

        <button
          type="button"
          onClick={() => {
            if (confirm(`Удалить поездку «${trip.title}»?`)) {
              deleteTrip.mutate(trip.id)
              navigate('/trips')
            }
          }}
          className="mt-6 text-xs text-red-500 hover:underline"
        >
          Удалить поездку
        </button>
      </div>

      {openPlaceId && (
        <Modal onClose={() => setOpenPlaceId(null)}>
          <PlaceCard placeId={openPlaceId} onClose={() => setOpenPlaceId(null)} />
        </Modal>
      )}
    </div>
  )
}
