import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Menu, PanelLeftClose, PanelLeftOpen, Store, X } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import NotificationBell from './NotificationBell'
import UserMenu from './UserMenu'
import { titleFor, visibleSections } from './navigation'

const COLLAPSED_KEY = 'store_billing_sidebar_collapsed'

const readCollapsed = () => {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

export default function AppLayout() {
  const { can } = useAuth()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(readCollapsed) // desktop
  const [mobileOpenAt, setMobileOpenAt] = useState(null) // pathname the drawer was opened on

  // The mobile drawer closes itself on navigation: it is only "open" for the page it was opened on.
  const mobileOpen = mobileOpenAt === location.pathname

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [collapsed])

  const sections = visibleSections(can)

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden" onClick={() => setMobileOpenAt(null)} aria-hidden />
      )}

      <aside
        className={`no-print fixed inset-y-0 left-0 z-40 flex flex-col bg-slate-900 text-slate-300 transition-all duration-200
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} w-64 lg:translate-x-0
          ${collapsed ? 'lg:w-[72px]' : 'lg:w-64'}`}
      >
        <div className="flex h-16 items-center gap-3 border-b border-white/10 px-4">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-indigo-500 text-white">
            <Store size={18} aria-hidden />
          </div>
          <span className={`truncate text-base font-semibold text-white ${collapsed ? 'lg:hidden' : ''}`}>Store Billing</span>
          <button
            onClick={() => setMobileOpenAt(null)}
            className="ml-auto rounded-md p-1 text-slate-400 hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
          {sections.map((section) => (
            <div key={section.title}>
              <p
                className={`mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 ${collapsed ? 'lg:hidden' : ''}`}
              >
                {section.title}
              </p>
              {collapsed && <div className="mx-3 mb-2 hidden border-t border-white/10 lg:block" />}
              <ul className="space-y-1">
                {section.items.map(({ to, label, icon: Icon }) => (
                  <li key={to}>
                    <NavLink
                      to={to}
                      title={collapsed ? label : undefined}
                      className={({ isActive }) =>
                        `group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                          isActive ? 'bg-indigo-500/15 text-white' : 'hover:bg-white/5 hover:text-white'
                        } ${collapsed ? 'lg:justify-center lg:px-0' : ''}`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <Icon size={18} className={isActive ? 'text-indigo-300' : 'text-slate-400 group-hover:text-slate-200'} aria-hidden />
                          <span className={collapsed ? 'lg:hidden' : ''}>{label}</span>
                        </>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <button
          onClick={() => setCollapsed((c) => !c)}
          className="hidden items-center gap-3 border-t border-white/10 px-6 py-4 text-sm text-slate-400 hover:text-white lg:flex"
          aria-label={collapsed ? 'Expand menu' : 'Collapse menu'}
        >
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          <span className={collapsed ? 'hidden' : ''}>Collapse menu</span>
        </button>
      </aside>

      <div className={`transition-all duration-200 ${collapsed ? 'lg:pl-[72px]' : 'lg:pl-64'}`}>
        <header className="no-print sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
          <button
            onClick={() => setMobileOpenAt(location.pathname)}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <h1 className="truncate text-base font-semibold text-slate-900">{titleFor(location.pathname)}</h1>
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <NotificationBell />
            <UserMenu />
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
