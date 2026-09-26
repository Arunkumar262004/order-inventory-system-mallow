import { useCallback, useEffect, useMemo, useState } from 'react'
import { createOrder, getProducts } from '../api'
import { parseApiError } from '../api/client'
import Bill from '../components/Bill'
import LowStockAlert from '../components/LowStockAlert'
import { Plus, ReceiptText, Trash2 } from 'lucide-react'
import { Alert, Badge, Button, Card, Field, Spinner, inputClass } from '../components/ui'
import { useAuth } from '../auth/AuthContext'
import useCustomerLookup from '../hooks/useCustomerLookup'
import { changeBreakdown, formatINR, taxOn, toCents } from '../lib/money'

let nextKey = 1
const newLine = () => ({ key: nextKey++, productId: '', quantity: 1 })

export default function NewOrder() {
  const { can } = useAuth()
  const [products, setProducts] = useState([])
  const [loadError, setLoadError] = useState(null)

  const customer = useCustomerLookup()

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

  function updateLine(key, patch) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  }

  function removeLine(key) {
    setLines((prev) => (prev.length === 1 ? [newLine()] : prev.filter((l) => l.key !== key)))
  }

  function resetForm() {
    customer.reset()
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
        customer_email: customer.email.trim(),
        customer_name: customer.name.trim() || null,
        customer_phone: customer.phone.trim() || null,
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
      window.dispatchEvent(new Event('store:refresh-notifications'))
    }
  }

  if (order) {
    return <Bill order={order} onNewOrder={resetForm} />
  }

  const selectedIds = new Set(lines.map((l) => String(l.productId)).filter(Boolean))
  const filledLines = selectedIds.size

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      <div className="min-w-0 space-y-6">
        {loadError && <Alert>{loadError}</Alert>}
        {error && <Alert>{error.message}</Alert>}

        <Card title="Customer" actions={<CustomerStatus status={customer.status} />}>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field
              label="Mobile no."
              error={fieldError('customer_phone') || customer.lookupError}
              hint="For the WhatsApp bill"
            >
              <input
                type="tel"
                inputMode="tel"
                className={inputClass}
                placeholder="e.g. 98765 43210"
                value={customer.phone}
                onChange={(e) => customer.change('phone', e.target.value)}
                onBlur={() => customer.lookup('phone')}
              />
            </Field>
            <Field label="Email" error={fieldError('customer_email')}>
              <input
                type="email"
                className={inputClass}
                placeholder="e.g. thomas@example.com"
                value={customer.email}
                onChange={(e) => customer.change('email', e.target.value)}
                onBlur={() => customer.lookup('email')}
                required
              />
            </Field>
            <Field label="Name" error={fieldError('customer_name')}>
              <input
                className={inputClass}
                placeholder="auto-filled if customer exists"
                value={customer.name}
                onChange={(e) => customer.change('name', e.target.value)}
                readOnly={customer.status === 'found'}
              />
            </Field>
          </div>
        </Card>

        <Card
          padded={false}
          className="@container"
          title={
            <span className="flex items-center gap-2">
              Products
              {filledLines > 0 && <Badge tone="indigo">{filledLines} item{filledLines === 1 ? '' : 's'}</Badge>}
            </span>
          }
          actions={
            <Button
              size="sm"
              icon={Plus}
              onClick={() => setLines((prev) => [...prev, newLine()])}
              disabled={lines.length >= products.length}
            >
              Add product
            </Button>
          }
        >
          {/* Wide card: one line per product. Narrow card (phone, or zoomed-in laptop): product + delete on top, qty / price / total below. */}
          <div className="hidden grid-cols-[1.5rem_minmax(0,1fr)_5.5rem_6rem_6.5rem_2.25rem] gap-3 border-y border-slate-100 bg-slate-50 px-5 py-2.5 text-xs font-medium uppercase tracking-wide text-slate-500 @2xl:grid">
            <span>#</span>
            <span>Product</span>
            <span>Qty</span>
            <span className="text-right">Price</span>
            <span className="text-right">Line total</span>
            <span />
          </div>
          <ul className="divide-y divide-slate-100 border-t border-slate-100 @2xl:border-t-0">
            {lines.map((line, i) => {
              const product = productById.get(String(line.productId))
              const overStock = product && Number(line.quantity) > product.stock
              const rowError =
                fieldError(`items.${i}.product_id`) ||
                fieldError(`items.${i}.quantity`) ||
                (overStock ? `Only ${product.stock} in stock.` : null)
              return (
                <li
                  key={line.key}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 px-5 py-4 @2xl:grid-cols-[1.5rem_minmax(0,1fr)_5.5rem_6rem_6.5rem_2.25rem]"
                >
                  <span className="hidden pt-2.5 text-xs tabular-nums text-slate-400 @2xl:block">{i + 1}</span>

                  <div className="min-w-0">
                    <select
                      className={inputClass}
                      value={line.productId}
                      onChange={(e) => updateLine(line.key, { productId: e.target.value })}
                      aria-label={`Product for row ${i + 1}`}
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
                  </div>

                  <button
                    type="button"
                    onClick={() => removeLine(line.key)}
                    className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600 @2xl:order-last"
                    aria-label={`Delete row ${i + 1}`}
                    title="Delete"
                  >
                    <Trash2 size={18} />
                  </button>

                  <div className="col-span-2 grid grid-cols-3 items-start gap-3 @2xl:contents">
                    <label className="block">
                      <span className="mb-1 block text-[11px] font-medium uppercase text-slate-500 @2xl:hidden">Qty</span>
                      <input
                        type="number"
                        min="1"
                        max={product?.stock}
                        className={`${inputClass} ${overStock ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : ''}`}
                        value={line.quantity}
                        onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                        aria-label={`Quantity for row ${i + 1}`}
                      />
                    </label>
                    <div className="text-right text-sm tabular-nums text-slate-600 @2xl:pt-2">
                      <span className="mb-1 block text-[11px] font-medium uppercase text-slate-500 @2xl:hidden">Price</span>
                      {product ? formatINR(product.price) : '—'}
                      {product && Number(product.tax_percent) > 0 && (
                        <span className="block text-xs text-slate-400">+{Number(product.tax_percent)}% GST</span>
                      )}
                    </div>
                    <div className="text-right text-sm font-semibold tabular-nums text-slate-900 @2xl:pt-2">
                      <span className="mb-1 block text-[11px] font-medium uppercase text-slate-500 @2xl:hidden">Total</span>
                      {product ? formatINR(preview.rows[i].total, { cents: true }) : '—'}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
          {fieldError('items') && <p className="px-5 pb-4 text-xs text-red-600">{fieldError('items')}</p>}
        </Card>
      </div>

      {/* Bottom row: low stock on the left, summary + Generate on the right (summary first on phones). */}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="lg:col-start-2 lg:row-start-1">
          <Card title="Bill summary">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between text-slate-600">
                <dt>Subtotal</dt>
                <dd className="tabular-nums">{formatINR(preview.subtotal, { cents: true })}</dd>
              </div>
              <div className="flex justify-between text-slate-600">
                <dt>Tax (GST)</dt>
                <dd className="tabular-nums">{formatINR(preview.tax, { cents: true })}</dd>
              </div>
            </dl>
            <div className="mt-4 flex items-baseline justify-between rounded-xl bg-slate-900 px-4 py-3 text-white">
              <span className="text-sm text-slate-300">Grand total</span>
              <span className="text-2xl font-semibold tabular-nums">{formatINR(preview.total, { cents: true })}</span>
            </div>

            <div className="mt-5">
              <Field label="Amount given by customer" hint="Optional: shows the change to return" error={fieldError('amount_paid')}>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">₹</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className={`${inputClass} pl-7`}
                    placeholder="0.00"
                    value={amountGiven}
                    onChange={(e) => setAmountGiven(e.target.value)}
                  />
                </div>
              </Field>
              {balanceCents !== null && <BalanceLine balanceCents={balanceCents} />}
            </div>

            <Button
              type="submit"
              variant="success"
              size="lg"
              icon={ReceiptText}
              loading={submitting}
              disabled={products.length === 0 || filledLines === 0}
              className="mt-5 w-full"
            >
              Generate bill
            </Button>
            <p className="mt-2 text-center text-xs text-slate-500">
              Confirmation goes by email{customer.phone.trim() ? ' and WhatsApp' : ''}.
            </p>
          </Card>
        </div>

        {can('products.view') && (
          <div className="lg:col-start-1 lg:row-start-1">
            <LowStockAlert refreshKey={lowStockKey} />
          </div>
        )}
      </div>
    </form>
  )
}

function CustomerStatus({ status }) {
  const states = {
    checking: { text: 'Looking up…', className: 'text-slate-500', spinner: true },
    found: { text: '✓ Returning customer: details filled in', className: 'text-green-700' },
    new: { text: 'New customer: enter name and email', className: 'text-indigo-700' },
  }
  const state = states[status]
  if (!state) return <span className="text-xs text-slate-400">Enter mobile or email to find a customer</span>
  return (
    <span className={`flex items-center gap-1.5 text-xs font-medium ${state.className}`}>
      {state.spinner && <Spinner />} {state.text}
    </span>
  )
}

function BalanceLine({ balanceCents }) {
  if (balanceCents < 0) {
    return (
      <div className="mt-3 flex justify-between rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
        <span>Short by</span>
        <span className="tabular-nums">{formatINR(-balanceCents, { cents: true })}</span>
      </div>
    )
  }
  const { parts, paise } = changeBreakdown(balanceCents)
  const breakdown = [...parts.map((p) => `${p.count}×₹${p.value}`), ...(paise ? [`${paise} paise`] : [])].join(' + ')
  return (
    <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
      <div className="flex justify-between font-semibold">
        <span>Balance to return</span>
        <span className="tabular-nums">{formatINR(balanceCents, { cents: true })}</span>
      </div>
      {breakdown && <p className="mt-0.5 text-xs text-emerald-700">{breakdown}</p>}
    </div>
  )
}
