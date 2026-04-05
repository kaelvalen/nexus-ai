import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'

const ACCENT_COLORS = [
  { primary: '#00ff88', secondary: '#00d4ff' },
  { primary: '#00d4ff', secondary: '#00ff88' },
  { primary: '#c678dd', secondary: '#61afef' },
  { primary: '#f0a500', secondary: '#ff6b6b' },
  { primary: '#ff6b9d', secondary: '#c678dd' },
  { primary: '#e0e6ed', secondary: '#8ba4b0' },
]

function restoreSettings() {
  const fontSize = localStorage.getItem('nexus:font-size')
  const fontFamily = localStorage.getItem('nexus:font-family')
  const accentIdx = localStorage.getItem('nexus:accent-idx')

  if (fontSize) document.documentElement.style.fontSize = `${fontSize}px`
  if (fontFamily) document.documentElement.style.fontFamily = fontFamily

  if (accentIdx !== null) {
    const accent = ACCENT_COLORS[parseInt(accentIdx)]
    if (accent) {
      document.documentElement.style.setProperty('--primary', accent.primary)
      document.documentElement.style.setProperty('--secondary', accent.secondary)
    }
  }
}

restoreSettings()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
