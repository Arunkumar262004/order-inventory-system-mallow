import { useEffect, useState } from 'react'
import { getLowStock } from '../api'
import { parseApiError } from '../api/client'
import { Alert, Card, Field, inputClass } from '../components/ui'
import { formatINR } from '../lib/money'

export default function LowStock() {
  const [threshold, setThreshold] = useState('')
  const [applied, setApplied] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    getLowStock(applied)
      .then((data) => {
        if (cancelled) return
        setResult(data)
        setError(null)
        if (applied === '') setThreshold(String(data.meta.threshold))
      })
      .catch((e) => !cancelled && setError(parseApiError(e)))
    return () => {
      cancelled = true
    }
  }, [applied])

  return (
    <div className="space-y-6">
      <Card title="Low stock products">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            setApplied(threshold)
          }}
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <div className="sm:w-60">
            <Field label="Show products with stock below" error={error?.errors?.threshold?.[0]}>
              <input
                type="number"
                min="0"
                className={inputClass}
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
              />
            </Field>
          </div>
          <button className="rounded-md bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700">Apply</button>
        </form>
        <p className="mt-2 text-xs text-slate-500">The default comes from LOW_STOCK_THRESHOLD in the backend .env.</p>
      </Card>

      {error && !error.errors?.threshold && <Alert>{error.message}</Alert>}

      {result && (
        <Card>
          {result.data.length === 0 ? (
            <p className="text-sm text-slate-600">No products below {result.meta.threshold}.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-slate-500">
                    <th className="py-2">Product</th>
                    <th className="py-2">Code</th>
                    <th className="py-2 text-right">Price</th>
                    <th className="py-2 text-right">Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {result.data.map((p) => (
                    <tr key={p.id} className="border-t border-slate-100">
                      <td className="py-2">{p.name}</td>
                      <td className="py-2 font-mono text-xs text-slate-500">{p.code}</td>
                      <td className="py-2 text-right">{formatINR(p.price)}</td>
                      <td className={`py-2 text-right font-semibold ${p.stock === 0 ? 'text-red-600' : 'text-amber-700'}`}>
                        {p.stock}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
