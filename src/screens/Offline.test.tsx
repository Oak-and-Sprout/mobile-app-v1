import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import Offline from './Offline'
import type { ServerEntry } from '../services/server-registry'

const entry = {
  id: 'e1', baseUrl: 'https://x.example.com', familySlug: 's', familyName: 'Smith Family',
  deploymentMode: 'selfhosted', authType: 'SYSTEM', lastUsedAt: null, isDefault: true,
} as ServerEntry

describe('Offline', () => {
  it('names the family and retries via connecting', async () => {
    const navigate = vi.fn()
    render(<Offline navigate={navigate} entry={entry} />)
    expect(screen.getByText(/Can’t reach your server\./)).toBeInTheDocument()
    expect(screen.getByText(/Smith Family/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Try again/ }))
    expect(navigate).toHaveBeenCalledWith({ name: 'connecting', entry })
    await userEvent.click(screen.getByRole('button', { name: 'Switch family' }))
    expect(navigate).toHaveBeenCalledWith({ name: 'families' })
  })
})
