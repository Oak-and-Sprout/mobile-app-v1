import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { Header, ErrBox } from './chrome'

describe('chrome', () => {
  it('Header renders title and fires onBack', async () => {
    const onBack = vi.fn()
    render(<Header title="Settings" onBack={onBack} />)
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(onBack).toHaveBeenCalled()
  })
  it('ErrBox renders an alert', () => {
    render(<ErrBox>bad news</ErrBox>)
    expect(screen.getByRole('alert')).toHaveTextContent('bad news')
  })
})
