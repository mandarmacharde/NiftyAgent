import { NavLink, Outlet } from 'react-router-dom'
import {
  LayoutDashboard,
  TrendingUp,
  BarChart3,
  History,
  Zap,
} from 'lucide-react'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/market', icon: BarChart3, label: 'Market' },
  { to: '/trades', icon: TrendingUp, label: 'Trades' },
  { to: '/history', icon: History, label: 'History' },
]

export default function Layout() {
  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="flex w-64 flex-col border-r border-gray-800 bg-gray-900/50">
        <div className="flex items-center gap-3 border-b border-gray-800 px-6 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600/10">
            <Zap className="h-6 w-6 text-brand-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">NiftyAgent</h1>
            <p className="text-xs text-gray-500">Paper Trading</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-brand-600/10 text-brand-400'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                }`
              }
            >
              <Icon className="h-5 w-5" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-gray-800 px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs text-gray-500">Market Open</span>
          </div>
          <p className="mt-2 text-[10px] text-gray-600">Real-time data via Yahoo Finance</p>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-gray-950 p-8">
        <Outlet />
      </main>
    </div>
  )
}
