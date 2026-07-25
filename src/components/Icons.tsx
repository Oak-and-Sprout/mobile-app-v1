import type { CSSProperties } from 'react'
import {
  ArrowClockwiseIcon,
  ArrowLeftIcon,
  ArrowSquareOutIcon,
  BellIcon,
  CaretDownIcon,
  CaretRightIcon,
  CheckIcon,
  EnvelopeSimpleIcon,
  GearSixIcon,
  KeyIcon,
  LinkSimpleIcon,
  ListIcon,
  PlusIcon,
  ShieldCheckIcon,
  SignOutIcon,
  StarIcon,
  UserIcon,
  UsersIcon,
  WarningIcon,
  XIcon,
  type IconProps,
  type IconWeight,
} from '@phosphor-icons/react'
import type { ComponentType } from 'react'

// Custom Face ID glyph (Apple-style brackets + face) — Phosphor has no direct
// equivalent, so this keeps the original hand-drawn art.
function FaceIdIcon({ size = 24, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      aria-hidden="true"
    >
      <path d="M3 8V5.5A2.5 2.5 0 0 1 5.5 3H8M16 3h2.5A2.5 2.5 0 0 1 21 5.5V8M21 16v2.5a2.5 2.5 0 0 1-2.5 2.5H16M8 21H5.5A2.5 2.5 0 0 1 3 18.5V16" />
      <path d="M8.6 9.5v1.4M15.4 9.5v1.4M12 9.5v3.2a1 1 0 0 1-1 1M9 16.2c.9.9 1.9 1.3 3 1.3s2.1-.4 3-1.3" />
    </svg>
  )
}

const ICONS: Record<string, { C: ComponentType<IconProps>; weight?: IconWeight }> = {
  'i-back': { C: ArrowLeftIcon },
  'i-gear': { C: GearSixIcon },
  'i-x': { C: XIcon },
  'i-plus': { C: PlusIcon },
  'i-alert': { C: WarningIcon },
  'i-shield': { C: ShieldCheckIcon },
  'i-face': { C: FaceIdIcon },
  'i-star': { C: StarIcon },
  'i-starf': { C: StarIcon, weight: 'fill' },
  'i-refresh': { C: ArrowClockwiseIcon },
  'i-mail': { C: EnvelopeSimpleIcon },
  'i-user': { C: UserIcon },
  'i-people': { C: UsersIcon },
  'i-chevr': { C: CaretRightIcon },
  'i-chevd': { C: CaretDownIcon },
  'i-menu': { C: ListIcon },
  'i-out': { C: SignOutIcon },
  'i-ext': { C: ArrowSquareOutIcon },
  'i-key': { C: KeyIcon },
  'i-check': { C: CheckIcon },
  'i-link': { C: LinkSimpleIcon },
  'i-bell': { C: BellIcon },
}

export function Ic({ id, s = 18, style }: { id: string; s?: number; style?: CSSProperties }) {
  const entry = ICONS[id]
  if (!entry) return null
  const { C, weight } = entry
  return <C size={s} weight={weight} style={style} aria-hidden="true" />
}
