import { useState, useEffect } from 'react'

type Theme = 'dark' | 'night' | 'day'

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('pilot-theme') as Theme) || 'dark'
  })

  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('dark', 'theme-night', 'theme-day')
    if (theme === 'dark' || theme === 'night') {
      root.classList.add('dark')
    }
    if (theme === 'night') root.classList.add('theme-night')
    if (theme === 'day') root.classList.add('theme-day')
    localStorage.setItem('pilot-theme', theme)
  }, [theme])

  return { theme, setTheme }
}
