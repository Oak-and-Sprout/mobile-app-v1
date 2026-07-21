import { render, screen, act } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import Splash from './Splash'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

test('renders brand, fades out at 2150ms, fires onDone at 2700ms', () => {
  const onDone = vi.fn()
  const { container } = render(<Splash onDone={onDone} />)
  expect(screen.getByText('Sprout Track')).toBeTruthy()
  expect(screen.getByText('The shareable baby tracker')).toBeTruthy()
  act(() => vi.advanceTimersByTime(2149))
  expect(container.querySelector('.splash.out')).toBeNull()
  expect(onDone).not.toHaveBeenCalled()
  act(() => vi.advanceTimersByTime(1))
  expect(container.querySelector('.splash.out')).toBeTruthy()
  act(() => vi.advanceTimersByTime(551))
  expect(onDone).toHaveBeenCalledOnce()
})
