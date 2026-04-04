/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#080c10',
        surface: '#0d1117',
        border: '#1a2332',
        primary: '#00ff88',
        secondary: '#00d4ff',
        muted: '#4a6070',
        danger: '#ff4444',
        warn: '#ffaa00',
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'Consolas', 'Monaco', 'monospace'],
      },
    },
  },
  plugins: [],
}
