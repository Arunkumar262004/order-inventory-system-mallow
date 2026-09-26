import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AlarmClock, Pencil, Plus, Trash2 } from 'lucide-react'
import { createReminder, deleteReminder, getReminders, updateReminder } from '../api'
import { parseApiError } from '../api/client'
import { useToast } from '../components/Toast'
import { Alert, Badge, Button, Card, EmptyState, Field, Modal, PageHeader, Spinner, inputClass } from '../components/ui'

const refreshBell = () => window.dispatchEvent(new Event('store:refresh-notifications'))

// <input type="datetime-local"> works in local time without a timezone suffix.
const toLocalInput = (iso) => {
  const d = iso ? new Date(iso) : new Date(Date.now() + 60 * 60 * 1000)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const formatDue = (iso) => new Date(iso).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

export default function Reminders() {
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const [status, setStatus] = useState('pending')
  const [reminders, setReminders] = useState(null)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(params.get('new') ? 'new' : null)

  const load = useCallback(() => {
    getReminders(status)
      .then(setReminders)
      .catch((e) => setError(parseApiError(e).message))
  }, [status])

  useEffect(load, [load])

  const payload = (r, extra = {}) => ({ title: r.title, notes: r.notes, due_at: r.due_at, ...extra })

  async function toggle(reminder) {
    await updateReminder(reminder.id, payload(reminder, { completed: !reminder.completed_at }))
    toast(reminder.completed_at ? 'Reminder reopened.' : 'Nice, marked as done.')
    load()
    refreshBell()
  }

  async function remove(reminder) {
    if (!window.confirm(`Delete "${reminder.title}"?`)) return
    await deleteReminder(reminder.id)
    toast('Reminder deleted.')
    load()
    refreshBell()
  }

  function closeEditor() {
    setEditing(null)
    if (params.get('new')) setParams({}, { replace: true })
  }

  return (
    <>
      <PageHeader
        title="Reminders"
        description="Personal to-dos with a due time. Due and overdue ones show in the bell."
        actions={<Button icon={Plus} onClick={() => setEditing('new')}>New reminder</Button>}
      />

      <Card padded={false}>
        <div className="border-b border-slate-100 p-4">
          <div className="inline-flex rounded-lg bg-slate-100 p-1 text-sm">
            {[
              ['pending', 'Pending'],
              ['completed', 'Completed'],
            ].map(([key, label]) => (
              <button
                key={key}
                onClick={() => {
                  setReminders(null)
                  setStatus(key)
                }}
                className={`rounded-md px-3 py-1.5 font-medium ${status === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {error && <div className="p-4"><Alert>{error}</Alert></div>}
        {!reminders && !error && <div className="grid place-items-center py-16 text-slate-400"><Spinner size={24} /></div>}
        {reminders?.length === 0 && (
          <EmptyState icon={AlarmClock} title={status === 'pending' ? 'Nothing pending' : 'No completed reminders yet'}>
            {status === 'pending' && 'Add reminders for supplier calls, stock-takes or cash counts.'}
          </EmptyState>
        )}

        <ul className="divide-y divide-slate-100">
          {reminders?.map((r) => (
            <li key={r.id} className="flex items-start gap-4 px-5 py-4">
              <input
                type="checkbox"
                checked={Boolean(r.completed_at)}
                onChange={() => toggle(r)}
                className="mt-1 h-4 w-4 rounded border-slate-300 accent-indigo-600"
                aria-label={r.completed_at ? `Reopen "${r.title}"` : `Mark "${r.title}" done`}
              />
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium ${r.completed_at ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{r.title}</p>
                {r.notes && <p className="mt-0.5 text-sm text-slate-500">{r.notes}</p>}
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  {r.is_overdue ? <Badge tone="red">Overdue</Badge> : !r.completed_at && <Badge tone="indigo">Upcoming</Badge>}
                  <span>{formatDue(r.due_at)}</span>
                </div>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" icon={Pencil} onClick={() => setEditing(r)} aria-label="Edit" />
                <Button variant="ghost" size="sm" icon={Trash2} onClick={() => remove(r)} aria-label="Delete" />
              </div>
            </li>
          ))}
        </ul>
      </Card>

      {editing && (
        <ReminderModal
          reminder={editing === 'new' ? null : editing}
          onClose={closeEditor}
          onSaved={(isNew) => {
            closeEditor()
            toast(isNew ? 'Reminder added.' : 'Reminder updated.')
            load()
            refreshBell()
          }}
        />
      )}
    </>
  )
}

function ReminderModal({ reminder, onClose, onSaved }) {
  const [form, setForm] = useState({
    title: reminder?.title ?? '',
    notes: reminder?.notes ?? '',
    due_at: toLocalInput(reminder?.due_at),
  })
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const body = { ...form, notes: form.notes || null, due_at: new Date(form.due_at).toISOString() }
    try {
      if (reminder) await updateReminder(reminder.id, body)
      else await createReminder(body)
      onSaved(!reminder)
    } catch (err) {
      setError(parseApiError(err))
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      size="sm"
      title={reminder ? 'Edit reminder' : 'New reminder'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="reminder-form" loading={saving}>Save</Button>
        </>
      }
    >
      <form id="reminder-form" onSubmit={submit} className="space-y-4" noValidate>
        <Field label="What" error={error?.errors?.title?.[0]}>
          <input className={inputClass} value={form.title} onChange={set('title')} placeholder="e.g. Call milk supplier" autoFocus />
        </Field>
        <Field label="When" error={error?.errors?.due_at?.[0]}>
          <input type="datetime-local" className={inputClass} value={form.due_at} onChange={set('due_at')} />
        </Field>
        <Field label="Notes (optional)" error={error?.errors?.notes?.[0]}>
          <textarea rows={3} className={inputClass} value={form.notes} onChange={set('notes')} />
        </Field>
      </form>
    </Modal>
  )
}
