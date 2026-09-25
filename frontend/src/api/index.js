import client from './client'

export const getProducts = () => client.get('/products').then((r) => r.data.data)

export const getLowStock = (threshold) =>
  client
    .get('/products/low-stock', { params: threshold === '' || threshold == null ? {} : { threshold } })
    .then((r) => r.data)

/** Look up a customer by { email } or { phone }. Rejects with 404 when unknown. */
export const findCustomer = (query) => client.get('/customers/lookup', { params: query }).then((r) => r.data.data)

export const getOrderHistory = (email, page = 1) =>
  client.get(`/customers/${encodeURIComponent(email)}/orders`, { params: { page } }).then((r) => r.data)

export const createOrder = (payload) => client.post('/orders', payload).then((r) => r.data.data)
