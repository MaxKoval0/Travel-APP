import { useState } from 'react'
import type { Trip, TripExpense } from '../../lib/database.types'
import { useUpdateTrip } from '../../hooks/useTrips'
import type { TripItemWithPlace } from './types'

function parseCost(s: string | null): number | null {
  if (!s) return null
  if (/бесплатн/i.test(s)) return 0
  const nums = s.match(/\d+(?:[.,]\d+)?/g)
  if (!nums) return null
  const values = nums.map((n) => parseFloat(n.replace(',', '.')))
  if (values.length >= 2) return (values[0] + values[1]) / 2
  return values[0]
}

interface Props {
  trip: Trip
  items: TripItemWithPlace[]
}

export default function TripCosts({ trip, items }: Props) {
  const updateTrip = useUpdateTrip()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')

  const expenses: TripExpense[] = (trip.expenses as TripExpense[] | undefined) ?? []
  const expensesTotal = expenses.reduce((sum, e) => sum + e.amount, 0)

  let planTotal = expensesTotal
  let confirmedTotal = expensesTotal
  for (const item of items) {
    const cost = parseCost(item.cost_estimate)
    if (cost == null) continue
    planTotal += cost
    if (item.confidence === 'confirmed') confirmedTotal += cost
  }

  const hasCosts = planTotal > 0

  const save = (next: TripExpense[]) => updateTrip.mutate({ id: trip.id, expenses: next })

  const startEdit = (e: TripExpense) => {
    setEditingId(e.id)
    setTitle(e.title)
    setAmount(String(e.amount))
  }

  const startAdd = () => {
    setEditingId('__new__')
    setTitle('')
    setAmount('')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setTitle('')
    setAmount('')
  }

  const handleSubmit = () => {
    const num = parseFloat(amount.replace(',', '.'))
    if (!title.trim() || isNaN(num) || num < 0) return
    if (editingId === '__new__') {
      save([...expenses, { id: crypto.randomUUID(), title: title.trim(), amount: num }])
    } else {
      save(expenses.map((e) => (e.id === editingId ? { ...e, title: title.trim(), amount: num } : e)))
    }
    cancelEdit()
  }

  return (
    <div className="mt-2 text-sm">
      {expenses.map((e) =>
        editingId === e.id ? (
          <ExpenseForm
            key={e.id}
            title={title}
            amount={amount}
            onTitleChange={setTitle}
            onAmountChange={setAmount}
            onSubmit={handleSubmit}
            onCancel={cancelEdit}
            onDelete={() => { save(expenses.filter((x) => x.id !== e.id)); cancelEdit() }}
          />
        ) : (
          <div key={e.id} className="flex items-center py-0.5">
            <button type="button" onClick={() => startEdit(e)} className="flex flex-1 items-center text-left">
              <span className="flex-1 text-slate-600">{e.title}</span>
              <span className="font-medium text-slate-700">{e.amount}€</span>
            </button>
            <button
              type="button"
              onClick={() => save(expenses.filter((x) => x.id !== e.id))}
              className="ml-2 px-1 text-slate-300 hover:text-red-500"
            >
              ×
            </button>
          </div>
        ),
      )}

      {editingId === '__new__' ? (
        <ExpenseForm
          title={title}
          amount={amount}
          onTitleChange={setTitle}
          onAmountChange={setAmount}
          onSubmit={handleSubmit}
          onCancel={cancelEdit}
        />
      ) : (
        !editingId && (
          <button
            type="button"
            onClick={startAdd}
            className="py-0.5 text-xs text-amber-600 hover:text-amber-700"
          >
            + Добавить расход
          </button>
        )
      )}

      {hasCosts && (
        <p className="mt-1 text-xs text-slate-400">
          {confirmedTotal > 0 && confirmedTotal < planTotal && (
            <>
              <span className="font-medium text-emerald-600">{Math.round(confirmedTotal)}€</span>
              {' факт · '}
            </>
          )}
          <span className={confirmedTotal >= planTotal ? 'font-medium text-emerald-600' : ''}>
            {confirmedTotal >= planTotal
              ? `${Math.round(planTotal)}€ итого`
              : `~${Math.round(planTotal)}€ план`}
          </span>
        </p>
      )}
    </div>
  )
}

function ExpenseForm({
  title,
  amount,
  onTitleChange,
  onAmountChange,
  onSubmit,
  onCancel,
  onDelete,
}: {
  title: string
  amount: string
  onTitleChange: (v: string) => void
  onAmountChange: (v: string) => void
  onSubmit: () => void
  onCancel: () => void
  onDelete?: () => void
}) {
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSubmit() }}
      className="flex items-center gap-1.5 py-0.5"
    >
      <input
        autoFocus
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder="Название"
        className="min-w-0 flex-1 rounded border border-slate-200 px-2 py-1 text-sm outline-none focus:border-amber-400"
      />
      <input
        value={amount}
        onChange={(e) => onAmountChange(e.target.value)}
        placeholder="€"
        inputMode="decimal"
        className="w-16 rounded border border-slate-200 px-2 py-1 text-sm outline-none focus:border-amber-400"
      />
      <button type="submit" className="px-1 font-medium text-amber-600">✓</button>
      {onDelete && (
        <button type="button" onClick={onDelete} className="px-1 text-red-400 hover:text-red-600">🗑</button>
      )}
      <button type="button" onClick={onCancel} className="px-1 text-slate-400">✕</button>
    </form>
  )
}
