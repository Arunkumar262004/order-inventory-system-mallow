import axios from 'axios'

// The API lives on another origin (Laravel on :8000), so the browser sends a
// CORS preflight first; backend/config/cors.php allows this app's origin.
const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api',
  headers: {
    // Makes Laravel answer validation failures with JSON 422, not a redirect.
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
  timeout: 15000,
})

/**
 * Normalises an axios error into { message, errors } where errors is
 * Laravel's field => [messages] map (empty when not a validation error).
 */
export function parseApiError(error) {
  const data = error?.response?.data
  if (data) {
    return { message: data.message ?? 'Request failed.', errors: data.errors ?? {}, status: error.response.status }
  }
  if (error?.request) {
    return { message: 'Cannot reach the API. Is `php artisan serve` running on port 8000?', errors: {}, status: 0 }
  }
  return { message: error?.message ?? 'Unexpected error.', errors: {}, status: 0 }
}

export default client
