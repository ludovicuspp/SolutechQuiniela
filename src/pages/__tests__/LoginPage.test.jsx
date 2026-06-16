import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

// 🛡️ Mock de Supabase: NO debe llegar a la red. signInWithPassword debe
// ser una función espía que devolvemos en supabase.auth.
// `vi.hoisted` garantiza que `mockSignIn` exista cuando se evalúa el factory
// de vi.mock (Vitest levanta los `vi.mock` antes de los imports del archivo).
const { mockSignIn, mockSignInWithPhone } = vi.hoisted(() => ({
  mockSignIn: vi.fn(),
  mockSignInWithPhone: vi.fn(),
}))

vi.mock('../../lib/supabase.js', () => ({
  supabase: {
    auth: {
      signInWithPassword: mockSignIn,
    },
  },
}))

// Mock del store de auth: devolvemos signInWithPhone controlable
vi.mock('../../store/authStore.js', () => ({
  useAuthStore: () => ({
    signInWithPhone: mockSignInWithPhone,
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
    mockSignInWithPhone.mockClear()
  })

  it('✅ Renderiza el input de Número de Teléfono', () => {
    renderLogin()
    const phoneInput = screen.getByLabelText(/Número de Teléfono/i)
    expect(phoneInput).toBeInTheDocument()
    expect(phoneInput).toHaveAttribute('type', 'tel')
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

  it('❌ Botón de submit está deshabilitado si el teléfono y la contraseña están vacíos', () => {
    renderLogin()
    const submitBtn = screen.getByRole('button', { name: /Iniciar Sesión/i })
    expect(submitBtn).toBeDisabled()
  })

  it('❌ No llama a Supabase si el usuario hace submit con el teléfono vacío', async () => {
    const user = userEvent.setup()
    renderLogin()

    // Llenar solo la contraseña, dejar el teléfono vacío
    const passwordInput = screen.getByLabelText(/Contraseña/i)
    await user.type(passwordInput, 'micontraseña')

    const submitBtn = screen.getByRole('button', { name: /Iniciar Sesión/i })
    // El botón sigue disabled por `!phoneValido`
    expect(submitBtn).toBeDisabled()

    // Forzar click por si el usuario lograra saltarse el disable
    await user.click(submitBtn).catch(() => {})

    expect(mockSignIn).not.toHaveBeenCalled()
    expect(mockSignInWithPhone).not.toHaveBeenCalled()
  })

  it('❌ No llama a Supabase si se intenta submit con teléfono < 10 dígitos', async () => {
    const user = userEvent.setup()
    renderLogin()

    await user.type(screen.getByLabelText(/Número de Teléfono/i), '412') // solo 3 dígitos
    await user.type(screen.getByLabelText(/Contraseña/i), 'secreto123')

    const submitBtn = screen.getByRole('button', { name: /Iniciar Sesión/i })
    expect(submitBtn).toBeDisabled()

    await user.click(submitBtn).catch(() => {})

    expect(mockSignIn).not.toHaveBeenCalled()
    expect(mockSignInWithPhone).not.toHaveBeenCalled()
  })

  it('✅ Llama a signInWithPhone cuando el formulario es válido', async () => {
    mockSignInWithPhone.mockResolvedValueOnce({ data: { user: { id: 'u1' } }, error: null })
    const user = userEvent.setup()
    renderLogin()

    await user.type(screen.getByLabelText(/Número de Teléfono/i), '4121234567')
    await user.type(screen.getByLabelText(/Contraseña/i), 'secreto123')

    const submitBtn = screen.getByRole('button', { name: /Iniciar Sesión/i })
    expect(submitBtn).not.toBeDisabled()

    await user.click(submitBtn)

    // El botón concatena +58 + dígitos → +584121234567
    expect(mockSignInWithPhone).toHaveBeenCalledTimes(1)
    expect(mockSignInWithPhone).toHaveBeenCalledWith('+584121234567', 'secreto123')
  })
})
