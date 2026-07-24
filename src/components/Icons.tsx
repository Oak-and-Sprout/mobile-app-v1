import type { CSSProperties } from 'react'
import {
  ArrowClockwiseIcon,
  ArrowLeftIcon,
  ArrowSquareOutIcon,
  CaretDownIcon,
  CaretRightIcon,
  CheckIcon,
  EnvelopeSimpleIcon,
  GearSixIcon,
  KeyIcon,
  LinkSimpleIcon,
  ListIcon,
  PlusIcon,
  ScanSmileyIcon,
  ShieldCheckIcon,
  SignOutIcon,
  StarIcon,
  UserIcon,
  UsersIcon,
  WarningIcon,
  XIcon,
  type Icon,
  type IconWeight,
} from '@phosphor-icons/react'

const ICONS: Record<string, { C: Icon; weight?: IconWeight }> = {
  'i-back': { C: ArrowLeftIcon },
  'i-gear': { C: GearSixIcon },
  'i-x': { C: XIcon },
  'i-plus': { C: PlusIcon },
  'i-alert': { C: WarningIcon },
  'i-shield': { C: ShieldCheckIcon },
  'i-face': { C: ScanSmileyIcon },
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
}

export function Ic({ id, s = 18, style }: { id: string; s?: number; style?: CSSProperties }) {
  const entry = ICONS[id]
  if (!entry) return null
  const { C, weight } = entry
  return <C size={s} weight={weight} style={style} aria-hidden="true" />
}
