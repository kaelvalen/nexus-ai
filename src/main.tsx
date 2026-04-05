import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './design.css'

export interface Theme {
  id: string
  label: string
  // surfaces
  bg: string
  surfaceLowest: string
  surfaceLow: string
  surface: string
  surfaceHigh: string
  surfaceHighest: string
  // accents
  primary: string
  secondary: string
  tertiary: string
  error: string
  // text
  text: string
  textDim: string
  muted: string
  outline: string
  ghost: string
}

export const THEMES: Theme[] = [
  {
    id: 'void',
    label: 'VOID',
    bg: '#080c10', surfaceLowest: '#0a0f13', surfaceLow: '#181c20',
    surface: '#1c2024', surfaceHigh: '#262a2f', surfaceHighest: '#31353a',
    primary: '#00ff88', secondary: '#00d4ff', tertiary: '#ff6b35', error: '#ff4444',
    text: '#e0e3e8', textDim: '#b9cbb9', muted: '#849585', outline: '#3b4b3d',
    ghost: 'rgba(0, 255, 136, 0.10)',
  },
  {
    id: 'midnight',
    label: 'MIDNIGHT',
    bg: '#060811', surfaceLowest: '#08091a', surfaceLow: '#0e1326',
    surface: '#13192e', surfaceHigh: '#1c2440', surfaceHighest: '#243050',
    primary: '#7aa2f7', secondary: '#7dcfff', tertiary: '#ff9e64', error: '#f7768e',
    text: '#c0caf5', textDim: '#9aa5ce', muted: '#565f89', outline: '#292e42',
    ghost: 'rgba(122, 162, 247, 0.10)',
  },
  {
    id: 'dracula',
    label: 'DRACULA',
    bg: '#191a2e', surfaceLowest: '#1c1d32', surfaceLow: '#21222c',
    surface: '#282a36', surfaceHigh: '#313346', surfaceHighest: '#3d3f52',
    primary: '#50fa7b', secondary: '#8be9fd', tertiary: '#ffb86c', error: '#ff5555',
    text: '#f8f8f2', textDim: '#cdd6f4', muted: '#6272a4', outline: '#44475a',
    ghost: 'rgba(80, 250, 123, 0.10)',
  },
  {
    id: 'monokai',
    label: 'MONOKAI',
    bg: '#1a1b16', surfaceLowest: '#1e1f1a', surfaceLow: '#272822',
    surface: '#2d2e2a', surfaceHigh: '#363734', surfaceHighest: '#414240',
    primary: '#a6e22e', secondary: '#66d9e8', tertiary: '#e6db74', error: '#f92672',
    text: '#f8f8f2', textDim: '#e0e0e0', muted: '#75715e', outline: '#3c3d38',
    ghost: 'rgba(166, 226, 46, 0.10)',
  },
  {
    id: 'nord',
    label: 'NORD',
    bg: '#1c1f28', surfaceLowest: '#21242e', surfaceLow: '#2e3440',
    surface: '#353d4a', surfaceHigh: '#3b4453', surfaceHighest: '#434c5e',
    primary: '#88c0d0', secondary: '#81a1c1', tertiary: '#ebcb8b', error: '#bf616a',
    text: '#eceff4', textDim: '#d8dee9', muted: '#7b88a1', outline: '#434c5e',
    ghost: 'rgba(136, 192, 208, 0.10)',
  },
  {
    id: 'phosphor',
    label: 'PHOSPHOR',
    bg: '#0a0800', surfaceLowest: '#100e00', surfaceLow: '#1a1800',
    surface: '#211f00', surfaceHigh: '#2c2a00', surfaceHighest: '#383500',
    primary: '#ffb800', secondary: '#ff9900', tertiary: '#ff6600', error: '#ff2200',
    text: '#ffe080', textDim: '#c8a840', muted: '#7a6030', outline: '#3a3400',
    ghost: 'rgba(255, 184, 0, 0.10)',
  },
  {
    id: 'matrix',
    label: 'MATRIX',
    bg: '#000000', surfaceLowest: '#020502', surfaceLow: '#050c05',
    surface: '#081008', surfaceHigh: '#0c180c', surfaceHighest: '#102010',
    primary: '#00ff41', secondary: '#00cc33', tertiary: '#00aa28', error: '#ff0000',
    text: '#00ff41', textDim: '#00cc33', muted: '#008822', outline: '#003311',
    ghost: 'rgba(0, 255, 65, 0.10)',
  },
]

export function applyTheme(theme: Theme) {
  const root = document.documentElement
  root.style.setProperty('--bg',               theme.bg)
  root.style.setProperty('--surface-lowest',   theme.surfaceLowest)
  root.style.setProperty('--surface-low',      theme.surfaceLow)
  root.style.setProperty('--surface',          theme.surface)
  root.style.setProperty('--surface-high',     theme.surfaceHigh)
  root.style.setProperty('--surface-highest',  theme.surfaceHighest)
  root.style.setProperty('--primary',          theme.primary)
  root.style.setProperty('--secondary',        theme.secondary)
  root.style.setProperty('--tertiary',         theme.tertiary)
  root.style.setProperty('--error',            theme.error)
  root.style.setProperty('--text',             theme.text)
  root.style.setProperty('--text-dim',         theme.textDim)
  root.style.setProperty('--muted',            theme.muted)
  root.style.setProperty('--outline',          theme.outline)
  root.style.setProperty('--ghost',            theme.ghost)
  // Update glow shadows based on primary/secondary
  root.style.setProperty('--glow-primary',   `0 0 15px ${theme.primary}4d`)
  root.style.setProperty('--glow-secondary', `0 0 15px ${theme.secondary}33`)
  // Also update body background for immediate effect
  document.body.style.background = theme.bg
}

function restoreSettings() {
  const fontSize   = localStorage.getItem('nexus:font-size')
  const fontFamily = localStorage.getItem('nexus:font-family')
  const themeId    = localStorage.getItem('nexus:theme-id')

  if (fontSize)   document.documentElement.style.fontSize   = `${fontSize}px`
  if (fontFamily) document.documentElement.style.fontFamily = fontFamily

  const theme = themeId ? THEMES.find((t) => t.id === themeId) : THEMES[0]
  if (theme) applyTheme(theme)
}

restoreSettings()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
