import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import ThemeToggle from './components/ThemeToggle.jsx'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    <ThemeToggle />
  </StrictMode>,
)
