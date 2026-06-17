import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const { mockSignIn, mockSignInWithRif } = vi.hoisted(() => ({
  mockSignIn: vi.fn(),
  mockSignInWithRif: vi.fn(),
}))

vi.mock('../../lib/supabase.js', () => ({
  supabase: {
    auth: {
      signInWithPassword: mockSignIn,
    },
  },
}))

vi.mock('../../store/authStore.js', () => ({
  useAuthStore: () => ({
    signInWithRif: mockSignInWithRif,
  }),
}))

import LoginPage from '../LoginPage.jsx'

const renderLogin = () =>
  render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>
  )

describe('<LoginPage /> - Renderizado y validación', () => {
  beforeEach(() => {
    mockSignIn.mockClear()
    mockSignInWithRif.mockClear()
  })

  it('✅ Renderiza el input de Cédula de Identidad', () => {
    renderLogin()
    const cedulaInput = screen.getByLabelText(/Cédula de Identidad/i)
    expect(cedulaInput).toBeInTheDocument()
    expect(cedulaInput).toHaveAttribute('type', 'tel')
  })

  it('✅ Renderiza el input de Contraseña', () => {
    renderLogin()
    const passwordInput = screen.getByLabelText(/Contraseña/i)
    expect(passwordInput).toBeInTheDocument()
    expect(passwordInput).toHaveAttribute('type', 'password')
  })

  it('✅ Renderiza el botón de Iniciar Sesión', () => {
    renderLogin()
    expect(screen.getByRole('button', { name: /Iniciar Sesión/i }))
      .toBeInTheDocument()
  })

  it('❌ Botón de submit está deshabilitado si la cédula y la contraseña están vacíos', () => {
    renderLogin()
    const submitBtn = screen.getByRole('button', { name: /Iniciar Sesión/i })
    expect(submitBtn).toBeDisabled()
  })

  it('❌ No llama a Supabase si el usuario hace submit con la cédula vacía', async () => {
    const user = userEvent.setup()
    renderLogin()

    const passwordInput = screen.getByLabelText(/Contraseña/i)
    await user.type(passwordInput, 'micontraseña')

    const submitBtn = screen.getByRole('button', { name: /Iniciar Sesión/i })
    expect(submitBtn).toBeDisabled()

    await user.click(submitBtn).catch(() => {})

    expect(mockSignIn).not.toHaveBeenCalled()
    expect(mockSignInWithRif).not.toHaveBeenCalled()
  })

  it('❌ No llama a Supabase si se intenta submit con cédula < 6 dígitos', async () => {
    const user = userEvent.setup()
    renderLogin()

    await user.type(screen.getByLabelText(/Cédula de Identidad/i), '12345') // 5 dígitos
    await user.type(screen.getByLabelText(/Contraseña/i), 'secreto123')

    const submitBtn = screen.getByRole('button', { name: /Iniciar Sesión/i })
    expect(submitBtn).toBeDisabled()

    await user.click(submitBtn).catch(() => {})

    expect(mockSignIn).not.toHaveBeenCalled()
    expect(mockSignInWithRif).not.toHaveBeenCalled()
  })

  it('✅ Llama a signInWithRif cuando el formulario es válido', async () => {
    mockSignInWithRif.mockResolvedValueOnce({ data: { user: { id: 'u1' } }, error: null })
    const user = userEvent.setup()
    renderLogin()

    await user.type(screen.getByLabelText(/Cédula de Identidad/i), '12345678')
    await user.type(screen.getByLabelText(/Contraseña/i), 'secreto123')

    const submitBtn = screen.getByRole('button', { name: /Iniciar Sesión/i })
    expect(submitBtn).not.toBeDisabled()

    await user.click(submitBtn)

    expect(mockSignInWithRif).toHaveBeenCalledTimes(1)
    expect(mockSignInWithRif).toHaveBeenCalledWith('12345678', 'secreto123')
  })
})
