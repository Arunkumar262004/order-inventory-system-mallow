import { useState } from 'react'
import { Eye, EyeOff, LockKeyhole, Store } from 'lucide-react'
import { parseApiError } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { Alert, Button, Field, inputClass } from '../components/ui'

const DEMO_ACCOUNTS = [
  { label: 'Admin', email: 'admin@store.test' },
  { label: 'Manager', email: 'manager@store.test' },
  { label: 'Cashier', email: 'cashier@store.test' },
]

export default function Login() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(email.trim(), password)
    } catch (e) {
      setError(parseApiError(e))
      setSubmitting(false)
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-slate-900 lg:block">
        <div className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-indigo-500/30 blur-3xl" />
        <div className="absolute -bottom-32 right-0 h-96 w-96 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-500">
              <Store size={20} />
            </div>
            <span className="text-lg font-semibold">Store Billing</span>
          </div>
          <div>
            <h2 className="max-w-md text-3xl font-semibold leading-tight">Bill faster. Never oversell. Know what to restock.</h2>
            <p className="mt-4 max-w-md text-slate-300">
              Counter billing, live inventory and low-stock reminders in one place, with email and WhatsApp receipts.
            </p>
          </div>
          <p className="text-sm text-slate-500">Order & Inventory Mini-System</p>
        </div>
      </div>

      <div className="flex items-center justify-center bg-slate-50 px-4 py-12 sm:px-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-600 text-white">
              <Store size={20} />
            </div>
            <span className="text-lg font-semibold text-slate-900">Store Billing</span>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Sign in</h1>
          <p className="mt-1 text-sm text-slate-500">Use the account your admin created for you.</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4" noValidate>
            {error && <Alert>{error.errors?.email?.[0] ?? error.message}</Alert>}
            <Field label="Email">
              <input
                type="email"
                autoComplete="username"
                className={inputClass}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@store.test"
                required
                autoFocus
              />
            </Field>
            <Field label="Password" error={error?.errors?.password?.[0]}>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className={`${inputClass} pr-10`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute inset-y-0 right-0 px-3 text-slate-400 hover:text-slate-600"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </Field>
            <Button type="submit" loading={submitting} icon={LockKeyhole} className="w-full" size="lg">
              Sign in
            </Button>
            <p className="text-center text-xs text-slate-500">Forgot your password? Ask your admin to reset it.</p>
          </form>

          <div className="mt-8 rounded-xl border border-dashed border-slate-300 p-4">
            <p className="text-xs font-medium text-slate-600">Demo accounts (password: password123)</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {DEMO_ACCOUNTS.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  onClick={() => {
                    setEmail(account.email)
                    setPassword('password123')
                  }}
                  className="rounded-md bg-white px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100"
                >
                  {account.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
