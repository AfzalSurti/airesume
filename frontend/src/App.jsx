import { useEffect, useState } from 'react'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

function App() {
  const [status, setStatus] = useState({ state: 'loading' })

  useEffect(() => {
    fetch(`${API_URL}/api/health`)
      .then((res) => res.json())
      .then((data) => setStatus({ state: 'ok', data }))
      .catch((err) => setStatus({ state: 'error', message: err.message }))
  }, [])

  return (
    <section id="center">
      <h1>AI Recruitment System</h1>
      <p>Frontend is running. Checking backend connection…</p>

      {status.state === 'loading' && <p>Contacting backend…</p>}

      {status.state === 'ok' && (
        <pre>{JSON.stringify(status.data, null, 2)}</pre>
      )}

      {status.state === 'error' && (
        <p style={{ color: 'crimson' }}>
          Could not reach backend at {API_URL}: {status.message}
        </p>
      )}
    </section>
  )
}

export default App
