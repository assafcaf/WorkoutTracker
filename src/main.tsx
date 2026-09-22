import React from 'react'
import ReactDOM from 'react-dom/client'

const root = document.getElementById('root')
if (!root) throw new Error('index.html is missing the #root element')

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <h1>Workout Tracker</h1>
  </React.StrictMode>,
)
