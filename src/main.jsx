import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import { initializeDesktopRuntime } from '@/lib/desktopRuntime'
import '@/index.css'

initializeDesktopRuntime()

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
