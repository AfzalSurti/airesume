const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

let accessToken = null
let refreshPromise = null

function setAccessToken(token) {
  accessToken = token
}

function getAccessToken() {
  return accessToken
}

async function refreshAccessToken() {
  const res = await fetch(`${API_URL}/api/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  })
  if (!res.ok) {
    accessToken = null
    throw new Error('Session expired')
  }
  const data = await res.json()
  accessToken = data.accessToken
  return accessToken
}

async function authedFetch(path, { method = 'GET', body, isForm = false } = {}) {
  const headers = {}
  if (!isForm) headers['Content-Type'] = 'application/json'
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`

  const doFetch = () =>
    fetch(`${API_URL}${path}`, {
      method,
      headers,
      credentials: 'include',
      body: isForm ? body : body !== undefined ? JSON.stringify(body) : undefined,
    })

  let res = await doFetch()

  if (res.status === 401 && accessToken) {
    try {
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => {
          refreshPromise = null
        })
      }
      await refreshPromise
      headers.Authorization = `Bearer ${accessToken}`
      res = await doFetch()
    } catch {
      // fall through and surface the original 401
    }
  }

  return res
}

async function request(path, opts) {
  const res = await authedFetch(path, opts)

  const contentType = res.headers.get('content-type') || ''
  const data = contentType.includes('application/json') ? await res.json() : await res.text()

  if (!res.ok) {
    const message = (data && data.message) || `Request failed with status ${res.status}`
    const error = new Error(message)
    error.status = res.status
    throw error
  }

  return data
}

async function requestBlob(path) {
  const res = await authedFetch(path)
  if (!res.ok) {
    const error = new Error(`Request failed with status ${res.status}`)
    error.status = res.status
    throw error
  }
  return res.blob()
}

export const api = {
  get: (path) => request(path),
  post: (path, body, opts) => request(path, { method: 'POST', body, ...opts }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  delete: (path) => request(path, { method: 'DELETE' }),
  getBlob: (path) => requestBlob(path),
  setAccessToken,
  getAccessToken,
  refreshAccessToken,
}

export { API_URL }
