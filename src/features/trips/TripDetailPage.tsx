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
  const [editingItem, setEditingItem] = useState<TripItemWithPlace | 'new' | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [groupBy, setGroupBy] = useState<'date' | 'area'>('date')

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

  if (!trip) {
    return <div className="p-4 text-sm text-slate-400">Загрузка…</div>
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id || !tripId) return
    const oldIndex = undated.findIndex((i) => i.id === active.id)
    const newIndex = undated.findIndex((i) => i.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const reordered = arrayMove(undated, oldIndex, newIndex)
    reorderItems.mutate({
      tripId,
      items: reordered.map((item, index) => ({ id: item.id, sort_order: index })),
    })
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

        <div className="mt-3 overflow-hidden rounded">
          <TripMiniMap tripId={trip.id} items={dated.concat(undated)} onOpenPlace={setOpenPlaceId} />
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-600">Пункты</h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowImport(true)}
              className="rounded border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600"
            >
              Импорт из текста
            </button>
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
            <ul className="mt-2 flex flex-col gap-1.5">
              {dated.map((item) => (
                <TripItemRow key={item.id} item={item} onOpenPlace={setOpenPlaceId} onEdit={setEditingItem} />
              ))}
            </ul>

            {undated.length > 0 && (
              <>
                <p className="mb-1.5 mt-4 text-xs font-medium uppercase tracking-wide text-slate-400">
                  Не распределено
                </p>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={undated.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                    <ul className="flex flex-col gap-1.5">
                      {undated.map((item) => (
                        <TripItemRow
                          key={item.id}
                          item={item}
                          draggable
                          onOpenPlace={setOpenPlaceId}
                          onEdit={setEditingItem}
                        />
                      ))}
                    </ul>
                  </SortableContext>
                </DndContext>
              </>
            )}
          </>
        ) : (
          byArea.map(([area, areaItems]) => (
            <div key={area}>
              <p className="mb-1.5 mt-4 text-xs font-medium uppercase tracking-wide text-slate-400">{area}</p>
              <ul className="flex flex-col gap-1.5">
                {areaItems.map((item) => (
                  <TripItemRow key={item.id} item={item} onOpenPlace={setOpenPlaceId} onEdit={setEditingItem} />
                ))}
              </ul>
            </div>
          ))
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
