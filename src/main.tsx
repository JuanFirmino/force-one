import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { CozinhaPage } from './pages/CozinhaPage.tsx'
import { NinjaPage } from './pages/NinjaPage.tsx'

const path = window.location.pathname.replace(/\/$/, '')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {path === '/cozinha' ? <CozinhaPage /> : path === '/ninja' ? <NinjaPage /> : <App />}
  </StrictMode>,
)
