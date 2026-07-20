import { render, screen } from '@testing-library/react'
import App from './App'

test('renders the app root', () => {
  render(<App />)
  expect(screen.getByTestId('app-root')).toBeInTheDocument()
})

test('shows Welcome when no servers are saved', () => {
  render(<App />)
  expect(screen.getByText(/welcome to sprout track/i)).toBeInTheDocument()
})
