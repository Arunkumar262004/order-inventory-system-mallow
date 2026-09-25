import { NavLink, Outlet } from 'react-router-dom'

const links = [
  { to: '/', label: 'New Order', end: true },
  { to: '/history', label: 'Order History' },
  { to: '/low-stock', label: 'Low Stock' },
]

export default function Layout() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="no-print bg-slate-900 text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <h1 className="text-lg font-semibold tracking-tight">Store Billing</h1>
          <nav className="flex gap-1">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  `rounded-md px-3 py-1.5 text-sm font-medium transition ${
                    isActive ? 'bg-white text-slate-900' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
