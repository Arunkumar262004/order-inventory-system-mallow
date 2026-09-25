import { Link } from 'react-router-dom'
import { changeBreakdown, formatINR, toCents } from '../lib/money'

export default function Bill({ order, onNewOrder }) {
  const change = order.change_due !== null ? changeBreakdown(toCents(order.change_due)) : null

  return (
    <div className="mx-auto max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2 border-b border-dashed border-slate-300 pb-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-green-700">Order confirmed</p>
          <h2 className="text-xl font-semibold">{order.order_number}</h2>
          <p className="text-sm text-slate-500">{new Date(order.created_at).toLocaleString('en-IN')}</p>
        </div>
        <div className="text-right text-sm">
          <p className="font-medium">{order.customer.name}</p>
          <p className="text-slate-500">{order.customer.email}</p>
          {order.customer.phone && <p className="text-slate-500">{order.customer.phone}</p>}
        </div>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase text-slate-500">
            <th className="py-1">Product</th>
            <th className="py-1 text-right">Qty</th>
            <th className="py-1 text-right">Price</th>
            <th className="py-1 text-right">Tax</th>
            <th className="py-1 text-right">Line total</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item) => (
            <tr key={item.product_id} className="border-t border-slate-100">
              <td className="py-1.5">{item.product_name}</td>
              <td className="py-1.5 text-right">{item.quantity}</td>
              <td className="py-1.5 text-right">{formatINR(item.unit_price)}</td>
              <td className="py-1.5 text-right text-slate-500">{Number(item.tax_percent)}%</td>
              <td className="py-1.5 text-right">{formatINR(item.line_total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="mt-4 space-y-1 border-t border-dashed border-slate-300 pt-4 text-sm">
        <Row label="Subtotal" value={formatINR(order.subtotal)} />
        <Row label="Tax" value={formatINR(order.tax_total)} />
        <Row label="Grand total" value={formatINR(order.grand_total)} strong />
        {order.amount_paid !== null && (
          <>
            <Row label="Amount given" value={formatINR(order.amount_paid)} />
            <Row label="Balance returned" value={formatINR(order.change_due)} strong />
            {change && change.parts.length + change.paise > 0 && (
              <p className="text-right text-xs text-slate-500">
                {change.parts.map((p) => `${p.count}×₹${p.value}`).join(' + ')}
                {change.paise > 0 && `${change.parts.length ? ' + ' : ''}${change.paise} paise`}
              </p>
            )}
          </>
        )}
      </dl>

      <p className="mt-4 text-xs text-slate-500">
        A confirmation email has been queued for {order.customer.email}
        {order.customer.phone && <> and a WhatsApp message for {order.customer.phone}</>}.
      </p>

      <div className="no-print mt-6 flex flex-wrap gap-2">
        <button onClick={onNewOrder} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          New order
        </button>
        <button onClick={() => window.print()} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50">
          Print bill
        </button>
        <Link
          to={`/history?email=${encodeURIComponent(order.customer.email)}`}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
        >
          Customer history
        </Link>
      </div>
    </div>
  )
}

function Row({ label, value, strong }) {
  return (
    <div className={`flex justify-between ${strong ? 'font-semibold text-slate-900' : 'text-slate-600'}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}
