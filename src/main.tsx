import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './lib/installPrompt'
import { registerServiceWorker } from './lib/registerServiceWorker'
import { applyStoredTheme } from './lib/theme'
import './index.css'
import App from './App.tsx'

// Applied before the first paint (not inside a React effect) so a previously
// chosen theme never flashes the wrong colours for a frame on load.
applyStoredTheme()
registerServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
