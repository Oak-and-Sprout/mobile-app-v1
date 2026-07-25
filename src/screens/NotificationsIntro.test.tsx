import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NotificationsIntro from './NotificationsIntro'

const NEXT = { name: 'families' } as const

describe('NotificationsIntro', () => {
  it('explains what notifications are for before any OS prompt', () => {
    render(<NotificationsIntro navigate={vi.fn()} next={NEXT} deps={{ requestPermission: vi.fn(), setOptIn: vi.fn() }} />)
    expect(screen.getByText(/feed and medicine timers/i)).toBeInTheDocument()
  })

  it('does not fire the OS prompt until Turn on is pressed', () => {
    const requestPermission = vi.fn()
    render(<NotificationsIntro navigate={vi.fn()} next={NEXT} deps={{ requestPermission, setOptIn: vi.fn() }} />)
    expect(requestPermission).not.toHaveBeenCalled()
  })

  it('records granted and continues when the user turns it on', async () => {
    const navigate = vi.fn()
    const setOptIn = vi.fn().mockResolvedValue(undefined)
    render(<NotificationsIntro navigate={navigate} next={NEXT}
      deps={{ requestPermission: vi.fn().mockResolvedValue('granted'), setOptIn }} />)
    await userEvent.click(screen.getByRole('button', { name: /turn on/i }))
    expect(setOptIn).toHaveBeenCalledWith('granted')
    expect(navigate).toHaveBeenCalledWith(NEXT)
  })

  it('records declined and continues on Not now, without prompting', async () => {
    const navigate = vi.fn()
    const setOptIn = vi.fn().mockResolvedValue(undefined)
    const requestPermission = vi.fn()
    render(<NotificationsIntro navigate={navigate} next={NEXT} deps={{ requestPermission, setOptIn }} />)
    await userEvent.click(screen.getByRole('button', { name: /not now/i }))
    expect(requestPermission).not.toHaveBeenCalled()
    expect(setOptIn).toHaveBeenCalledWith('declined')
    expect(navigate).toHaveBeenCalledWith(NEXT)
  })

  it('records declined when the user denies at the OS level', async () => {
    const setOptIn = vi.fn().mockResolvedValue(undefined)
    render(<NotificationsIntro navigate={vi.fn()} next={NEXT}
      deps={{ requestPermission: vi.fn().mockResolvedValue('denied'), setOptIn }} />)
    await userEvent.click(screen.getByRole('button', { name: /turn on/i }))
    expect(setOptIn).toHaveBeenCalledWith('declined')
  })
})
