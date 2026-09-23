import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
// The base stylesheet, which @imports the tokens: importing it here is what puts the design
// system in the bundle, and it is the only stylesheet imported from outside src/ui.
import './styles/base.css'

const root = document.getElementById('root')
if (!root) throw new Error('index.html is missing the #root element')

// The worker the build emits is registered by `App` as it mounts, through
// `useServiceWorkerUpdate` — the same registration whose `onNeedRefresh` puts the "Update
// ready" control on screen. Registering here as well would install a second, callback-less
// registration of the same worker, so E2-T3 left this call site with one owner.
ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
