import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import { registerServiceWorker } from './pwa/registerSW'

const root = document.getElementById('root')
if (!root) throw new Error('index.html is missing the #root element')

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// Without this nothing ever installs the worker the build emits, so the app has no cache to
// start from when the network is gone. E2-T3 passes the update callbacks.
registerServiceWorker()
