import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createOrder, findCustomer, getProducts } from '../api'
import { parseApiError } from '../api/client'
import Bill from '../components/Bill'
import LowStockAlert from '../components/LowStockAlert'
import { Alert, Card, Field, Spinner, inputClass } from '../components/ui'
import { changeBreakdown, formatINR, taxOn, toCents } from '../lib/money'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

let nextKey = 1
const newLine = () => ({ key: nextKey++, productId: '', quantity: 1 })

export default function NewOrder() {
  const [products, setProducts] = useState([])
  const [loadError, setLoadError] = useState(null)

  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [customerStatus, setCustomerStatus] = useState('idle') // idle | checking | found | new
  const lookupSeq = useRef(0)

  const [lines, setLines] = useState([newLine()])
  const [amountGiven, setAmountGiven] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null) // { message, errors }
  const [order, setOrder] = useState(null)
  const [lowStockKey, setLowStockKey] = useState(0)

  const loadProducts = useCallback(() => {
    getProducts()
      .then((data) => {
        setProducts(data)
        setLoadError(null)
      })
      .catch((e) => setLoadError(parseApiError(e).message))
  }, [])

  useEffect(loadProducts, [loadProducts])

  const productById = useMemo(() => new Map(products.map((p) => [String(p.id), p])), [products])

  // Live preview using the same cent maths as the server.
  const preview = useMemo(() => {
    const rows = lines.map((line) => {
      const product = productById.get(String(line.productId))
      const qty = Number(line.quantity) || 0
      if (!product || qty < 1) return { subtotal: 0, tax: 0, total: 0 }
      const lineSubtotal = toCents(product.price) * qty
      const lineTax = taxOn(lineSubtotal, product.tax_percent)
      return { subtotal: lineSubtotal, tax: lineTax, total: lineSubtotal + lineTax }
    })
    const subtotal = rows.reduce((sum, r) => sum + r.subtotal, 0)
    const tax = rows.reduce((sum, r) => sum + r.tax, 0)
    return { rows, subtotal, tax, total: subtotal + tax }
  }, [lines, productById])

  const givenCents = amountGiven === '' ? null : toCents(amountGiven)
  const balanceCents = givenCents === null ? null : givenCents - preview.total

  const fieldError = (key) => error?.errors?.[key]?.[0]

  async function lookupCustomer() {
    const value = email.trim().toLowerCase()
    if (!EMAIL_RE.test(value)) {
      setCustomerStatus('idle')
      return
    }
    const seq = ++lookupSeq.current
    setCustomerStatus('checking')
    try {
      const customer = await findCustomer(value)
      if (seq !== lookupSeq.current) return
      setName(customer.name)
      setCustomerStatus('found')
    } catch (e) {
      if (seq !== lookupSeq.current) return
      if (parseApiError(e).status === 404) {
        setCustomerStatus('new')
      } else {
        setCustomerStatus('idle')
      }
    }
  }

  function updateLine(key, patch) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  }

  function removeLine(key) {
    setLines((prev) => (prev.length === 1 ? [newLine()] : prev.filter((l) => l.key !== key)))
  }

  function resetForm() {
    setEmail('')
    setName('')
    setCustomerStatus('idle')
    setLines([newLine()])
    setAmountGiven('')
    setError(null)
    setOrder(null)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError(null)

    const clientErrors = {}
    lines.forEach((line, i) => {
      if (!line.productId) clientErrors[`items.${i}.product_id`] = ['Select a product or remove this row.']
    })
    if (Object.keys(clientErrors).length) {
      setError({ message: 'Please fix the highlighted rows.', errors: clientErrors })
      return
    }

    setSubmitting(true)
    try {
      const created = await createOrder({
        customer_email: email.trim(),
        customer_name: name.trim() || null,
        items: lines.map((l) => ({ product_id: Number(l.productId), quantity: Number(l.quantity) })),
        amount_paid: amountGiven === '' ? null : Number(amountGiven),
      })
      setOrder(created)
    } catch (e) {
      setError(parseApiError(e))
    } finally {
      setSubmitting(false)
      // Stock may have changed either way (our order, or someone else's).
      loadProducts()
      setLowStockKey((k) => k + 1)
    }
  }

  if (order) {
    return <Bill order={order} onNewOrder={resetForm} />
  }

  const selectedIds = new Set(lines.map((l) => String(l.productId)).filter(Boolean))

  return (
    <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[1fr_300px]" noValidate>
      <div className="space-y-6">
        {loadError && <Alert>{loadError}</Alert>}
        {error && <Alert>{error.message}</Alert>}

        <Card title="Customer">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Email"
              error={fieldError('customer_email')}
              hint={
                customerStatus === 'found'
                  ? 'Returning customer: name filled in automatically.'
                  : customerStatus === 'new'
                    ? 'New customer: please enter their name.'
                    : null
              }
            >
              <input
                type="email"
                className={inputClass}
                placeholder="e.g. thomas@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (customerStatus === 'found') {
                    setCustomerStatus('idle')
                    setName('')
                  }
                }}
                onBlur={lookupCustomer}
                required
              />
            </Field>
            <Field label="Name" error={fieldError('customer_name')}>
              <div className="relative">
                <input
                  className={inputClass}
                  placeholder="auto-filled if email exists"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  readOnly={customerStatus === 'found'}
                />
                {customerStatus === 'checking' && (
                  <span className="absolute right-3 top-2.5 text-slate-400">
                    <Spinner />
                  </span>
                )}
              </div>
            </Field>
          </div>
        </Card>

        <Card title="Products">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="bg-slate-100 text-left text-xs uppercase text-slate-600">
                  <th className="rounded-l-md px-3 py-2">Product</th>
                  <th className="w-24 px-3 py-2">Qty</th>
                  <th className="w-24 px-3 py-2 text-right">Price</th>
                  <th className="w-28 px-3 py-2 text-right">Line total</th>
                  <th className="w-10 rounded-r-md px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {lines.map((line, i) => {
                  const product = productById.get(String(line.productId))
                  const overStock = product && Number(line.quantity) > product.stock
                  const rowError =
                    fieldError(`items.${i}.product_id`) ||
                    fieldError(`items.${i}.quantity`) ||
                    (overStock ? `Only ${product.stock} in stock.` : null)
                  return (
                    <tr key={line.key} className="align-top">
                      <td className="px-3 py-2">
                        <select
                          className={inputClass}
                          value={line.productId}
                          onChange={(e) => updateLine(line.key, { productId: e.target.value })}
                        >
                          <option value="">Select a product…</option>
                          {products.map((p) => (
                            <option
                              key={p.id}
                              value={p.id}
                              disabled={p.stock === 0 || (selectedIds.has(String(p.id)) && String(p.id) !== String(line.productId))}
                            >
                              {p.name} ({p.stock === 0 ? 'out of stock' : `${p.stock} left`})
                            </option>
                          ))}
                        </select>
                        {rowError && <p className="mt-1 text-xs text-red-600">{rowError}</p>}
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min="1"
                          max={product?.stock}
                          className={`${inputClass} ${overStock ? 'border-red-400' : ''}`}
                          value={line.quantity}
                          onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                        />
                      </td>
                      <td className="px-3 py-2 pt-4 text-right text-slate-600">
                        {product ? formatINR(product.price) : '—'}
                        {product && Number(product.tax_percent) > 0 && (
                          <span className="block text-xs text-slate-400">+{Number(product.tax_percent)}% tax</span>
                        )}
                      </td>
                      <td className="px-3 py-2 pt-4 text-right font-medium">
                        {product ? formatINR(preview.rows[i].total, { cents: true }) : '—'}
                      </td>
                      <td className="px-3 py-2 pt-3">
                        <button
                          type="button"
                          onClick={() => removeLine(line.key)}
                          className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          aria-label="Remove row"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {fieldError('items') && <p className="mt-2 text-xs text-red-600">{fieldError('items')}</p>}
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => setLines((prev) => [...prev, newLine()])}
              disabled={lines.length >= products.length}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              + Add Product
            </button>
          </div>
        </Card>

        <div className="grid gap-6 sm:grid-cols-[1fr_auto]">
          <Card title="Payment">
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between text-slate-600">
                <dt>Subtotal</dt>
                <dd>{formatINR(preview.subtotal, { cents: true })}</dd>
              </div>
              <div className="flex justify-between text-slate-600">
                <dt>Tax</dt>
                <dd>{formatINR(preview.tax, { cents: true })}</dd>
              </div>
              <div className="flex justify-between text-base font-semibold">
                <dt>Grand Total</dt>
                <dd>{formatINR(preview.total, { cents: true })}</dd>
              </div>
            </dl>
            <div className="mt-4 border-t border-dashed border-slate-300 pt-4">
              <Field label="Amount given by customer (optional)" error={fieldError('amount_paid')}>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={inputClass}
                  placeholder="₹0.00"
                  value={amountGiven}
                  onChange={(e) => setAmountGiven(e.target.value)}
                />
              </Field>
              {balanceCents !== null && <BalanceLine balanceCents={balanceCents} />}
            </div>
          </Card>

          <div className="flex flex-col justify-start">
            <button
              type="submit"
              disabled={submitting || products.length === 0}
              className="flex items-center justify-center gap-2 rounded-md bg-green-700 px-8 py-3 font-semibold text-white shadow hover:bg-green-800 disabled:opacity-60"
            >
              {submitting && <Spinner />}
              Generate Bill
            </button>
            <p className="mt-2 max-w-48 text-xs text-slate-500">Shows the bill here and queues a confirmation email.</p>
          </div>
        </div>
      </div>

      <div>
        <LowStockAlert refreshKey={lowStockKey} />
      </div>
    </form>
  )
}

function BalanceLine({ balanceCents }) {
  if (balanceCents < 0) {
    return (
      <p className="mt-2 text-sm font-medium text-red-600">
        Short by {formatINR(-balanceCents, { cents: true })}
      </p>
    )
  }
  const { parts, paise } = changeBreakdown(balanceCents)
  const breakdown = [...parts.map((p) => `${p.count}×₹${p.value}`), ...(paise ? [`${paise} paise`] : [])].join(' + ')
  return (
    <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2 text-sm">
      <span className="font-semibold">Balance to return: {formatINR(balanceCents, { cents: true })}</span>
      {breakdown && <span className="text-xs text-slate-500">{breakdown}</span>}
    </div>
  )
}
