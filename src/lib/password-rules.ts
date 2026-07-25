export const PW_REQS = [
  ['8+ characters', (p: string) => p.length >= 8],
  ['A number', (p: string) => /\d/.test(p)],
  ['A lowercase letter', (p: string) => /[a-z]/.test(p)],
  ['A symbol', (p: string) => /[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(p)],
  ['An uppercase letter', (p: string) => /[A-Z]/.test(p)],
] as const

export function passwordMeetsRules(p: string): boolean {
  return PW_REQS.every(([, fn]) => fn(p))
}
