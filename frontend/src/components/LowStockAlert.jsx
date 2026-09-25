import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getLowStock } from '../api'

export default function LowStockAlert({ refreshKey }) {
  const [state, setState] = useState({ loading: true, products: [], threshold: null, error: false })

  useEffect(() => {
    let cancelled = false
    getLowStock()
      .then((res) => !cancelled && setState({ loading: false, products: res.data, threshold: res.meta.threshold, error: false }))
      .catch(() => !cancelled && setState((s) => ({ ...s, loading: false, error: true })))
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  return (
    <aside className="rounded-xl border border-amber-300 bg-amber-50 p-5">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-800">
        <span aria-hidden>⚠</span> Low Stock Alert
        {state.threshold !== null && <span className="font-normal text-amber-700">(below {state.threshold})</span>}
      </h2>
      {state.loading && <p className="text-sm text-amber-700">Loading…</p>}
      {state.error && <p className="text-sm text-red-600">Could not load low-stock items.</p>}
      {!state.loading && !state.error && state.products.length === 0 && (
        <p className="text-sm text-amber-700">All products are well stocked.</p>
      )}
      <ul className="space-y-1.5">
        {state.products.map((p) => (
          <li key={p.id} className="flex justify-between gap-2 text-sm text-amber-900">
            <span>• {p.name}</span>
            <span className={p.stock === 0 ? 'font-semibold text-red-600' : 'font-medium'}>
              {p.stock === 0 ? 'out of stock' : `${p.stock} left`}
            </span>
          </li>
        ))}
      </ul>
      <Link to="/low-stock" className="no-print mt-4 inline-block text-xs font-medium text-amber-800 underline">
        View all / change threshold
      </Link>
    </aside>
  )
}
