import { create } from 'zustand'

export const useThemeStore = create((set) => ({
  dark: localStorage.getItem('theme') === 'dark' ||
    (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches),

  toggle: () => set((state) => {
    const next = !state.dark
    localStorage.setItem('theme', next ? 'dark' : 'light')
    document.documentElement.classList.toggle('dark', next)
    return { dark: next }
  }),

  init: () => set((state) => {
    document.documentElement.classList.toggle('dark', state.dark)
    return state
  }),
}))
