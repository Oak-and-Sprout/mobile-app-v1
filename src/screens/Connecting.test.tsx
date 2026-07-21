import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import Connecting from './Connecting'
import type { ServerEntry } from '../services/server-registry'

const entry: ServerEntry = {
  id: 'e1', baseUrl: 'https://track.example.com', familySlug: 'smith-family',
  familyName: 'Smith Family', deploymentMode: 'selfhosted', authType: 'SYSTEM',
  lastUsedAt: null, isDefault: true,
}

describe('Connecting', () => {
  it('shows family name and host while connecting', () => {
    render(<Connecting entry={entry} navigate={vi.fn()} connect={() => new Promise(() => {})} />)
    expect(screen.getByText('Opening Smith Family…')).toBeInTheDocument()
    expect(screen.getByText(/track\.example\.com/)).toBeInTheDocument()
    expect(screen.getByText(/signing you in with your saved credentials/)).toBeInTheDocument()
  })

  it('shows the same message for ACCOUNT entries', () => {
    render(<Connecting entry={{ ...entry, authType: 'ACCOUNT' }} navigate={vi.fn()} connect={() => new Promise(() => {})} />)
    expect(screen.getByText(/signing you in with your saved credentials/)).toBeInTheDocument()
  })

  it('navigates to offline on offline outcome', async () => {
    const navigate = vi.fn()
    render(<Connecting entry={entry} navigate={navigate} connect={vi.fn().mockResolvedValue('offline')} />)
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ name: 'offline', entry }))
  })

  it('returns to families with a notice when locked', async () => {
    const navigate = vi.fn()
    render(<Connecting entry={entry} navigate={navigate} connect={vi.fn().mockResolvedValue('locked')} />)
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ name: 'families', notice: 'locked' }))
  })

  it('stays put on navigated (webview is taking over)', async () => {
    const navigate = vi.fn()
    const connect = vi.fn().mockResolvedValue('navigated')
    render(<Connecting entry={entry} navigate={navigate} connect={connect} />)
    await waitFor(() => expect(connect).toHaveBeenCalled())
    expect(navigate).not.toHaveBeenCalled()
  })

  it('only runs connect once across re-renders', async () => {
    const connect = vi.fn().mockResolvedValue('navigated')
    const { rerender } = render(<Connecting entry={entry} navigate={vi.fn()} connect={connect} />)
    rerender(<Connecting entry={entry} navigate={vi.fn()} connect={connect} />)
    await waitFor(() => expect(connect).toHaveBeenCalledTimes(1))
  })
})
