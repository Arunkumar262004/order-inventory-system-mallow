import { useRef, useState } from 'react'
import { findCustomer } from '../api'
import { parseApiError } from '../api/client'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const EMPTY = { email: '', phone: '', name: '' }

const isLookupable = (field, value) =>
  field === 'email' ? EMAIL_RE.test(value.trim()) : value.replace(/\D/g, '').length >= 10

/**
 * Customer fields with two-way auto-fill: entering a known mobile number
 * fills email + name, entering a known email fills mobile + name.
 *
 * status: idle | checking | found | new
 */
export default function useCustomerLookup() {
  const [fields, setFields] = useState(EMPTY)
  const [status, setStatus] = useState('idle')
  const [autofilled, setAutofilled] = useState([]) // fields filled from the lookup
  const [lookupError, setLookupError] = useState(null)
  const seq = useRef(0)

  function change(field, value) {
    setLookupError(null)
    if (status === 'found' && field !== 'name') {
      // Editing the identifying field of a matched customer starts over:
      // drop everything the previous match filled in.
      const cleared = { ...fields, name: '', [field]: value }
      autofilled.filter((f) => f !== field).forEach((f) => (cleared[f] = ''))
      setFields(cleared)
      setAutofilled([])
      setStatus('idle')
      return
    }
    setFields((prev) => ({ ...prev, [field]: value }))
    if (status === 'new' && field !== 'name') setStatus('idle')
  }

  async function lookup(field) {
    const value = fields[field]
    if (status === 'found' || !isLookupable(field, value)) return

    const current = ++seq.current
    setStatus('checking')
    try {
      const customer = await findCustomer({ [field]: value.trim() })
      if (current !== seq.current) return
      const filled = ['name']
      const next = { ...fields, name: customer.name }
      if (field === 'phone') {
        next.email = customer.email
        filled.push('email')
      } else if (customer.phone) {
        next.phone = customer.phone
        filled.push('phone')
      }
      setFields(next)
      setAutofilled(filled)
      setStatus('found')
    } catch (e) {
      if (current !== seq.current) return
      const err = parseApiError(e)
      if (err.status === 404) {
        setStatus('new')
      } else {
        setStatus('idle')
        setLookupError(err.errors?.[field]?.[0] ?? null)
      }
    }
  }

  function reset() {
    seq.current++
    setFields(EMPTY)
    setStatus('idle')
    setAutofilled([])
    setLookupError(null)
  }

  return { ...fields, status, autofilled, lookupError, change, lookup, reset }
}
