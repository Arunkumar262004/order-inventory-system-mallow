import {
  AlarmClock,
  History,
  KeyRound,
  LayoutDashboard,
  Package,
  ReceiptText,
  ShieldCheck,
  Users,
} from 'lucide-react'

// One source of truth for the sidebar, route guards and the landing page.
// `permission` is checked against the list returned by GET /api/me.
export const NAV_SECTIONS = [
  {
    title: 'Store',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: 'dashboard.view' },
      { to: '/billing', label: 'New Bill', icon: ReceiptText, permission: 'billing.create' },
      { to: '/orders', label: 'Order History', icon: History, permission: 'orders.view' },
      { to: '/inventory', label: 'Inventory', icon: Package, permission: 'products.view' },
      { to: '/reminders', label: 'Reminders', icon: AlarmClock, permission: null },
    ],
  },
  {
    title: 'Settings',
    items: [
      { to: '/settings/users', label: 'Users', icon: Users, permission: 'settings.manage' },
      { to: '/settings/roles', label: 'Roles & Permissions', icon: ShieldCheck, permission: 'settings.manage' },
      { to: '/settings/password-reset', label: 'Password Reset', icon: KeyRound, permission: 'settings.manage' },
    ],
  },
]

export const visibleSections = (can) =>
  NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => item.permission === null || can(item.permission)),
  })).filter((section) => section.items.length > 0)

/** First page this user may open; used after login and for "/". */
export const homePath = (can) => visibleSections(can)[0]?.items[0]?.to ?? '/reminders'

export const titleFor = (pathname) =>
  NAV_SECTIONS.flatMap((s) => s.items).find((item) => pathname.startsWith(item.to))?.label ??
  (pathname.startsWith('/profile') ? 'My Profile' : '')
