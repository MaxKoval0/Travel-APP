import { NavLink, Outlet } from 'react-router-dom'

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
    isActive
      ? 'border-emerald-600 text-emerald-700'
      : 'border-transparent text-slate-500 hover:text-slate-800'
  }`

export default function Layout() {
  return (
    <div className="flex h-screen flex-col">
      <header className="flex shrink-0 items-center border-b border-slate-200 bg-white px-2">
        <span className="px-3 text-sm font-semibold text-slate-800">
          Travel Tracker
        </span>
        <nav className="flex">
          <NavLink to="/places" className={tabClass}>
            Места
          </NavLink>
          <NavLink to="/trips" className={tabClass}>
            Поездки
          </NavLink>
        </nav>
      </header>
      <main className="min-h-0 flex-1">
        <Outlet />
      </main>
    </div>
  )
}
