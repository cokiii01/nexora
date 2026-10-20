import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import Prompter from './demo/Prompter.jsx'

const isPrompter = new URLSearchParams(window.location.search).has('prompter')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isPrompter ? <Prompter /> : <App />}
  </StrictMode>,
)

// PWA: register the service worker in production builds only (dev uses Vite HMR).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}))
}
