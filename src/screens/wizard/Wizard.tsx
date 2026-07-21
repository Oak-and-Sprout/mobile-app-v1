import { useEffect, useState, type ReactNode } from 'react'
import type { Screen } from '../../App'
import { SAAS_BASE } from '../../services/account'
import type { WizardResume } from '../../services/account-routing'
import type { AccountCreds } from '../../services/credential-vault'
import { listServers } from '../../services/server-registry'
import {
  checkSlugAvailability, createFamily, finishWizard, saveBabyAndLink, saveSecurity, suggestSlug, WizardError,
  type BabyConfig, type FinishDeps, type SecurityConfig,
} from '../../services/wizard'
import Step1Family from './Step1Family'
import Step2Security from './Step2Security'
import Step3Baby from './Step3Baby'

export interface WizardDeps {
  checkSlugAvailability: typeof checkSlugAvailability
  suggestSlug: typeof suggestSlug
  createFamily: typeof createFamily
  saveSecurity: typeof saveSecurity
  saveBabyAndLink: typeof saveBabyAndLink
  finishWizard: typeof finishWizard
  listServers: typeof listServers
  finish?: FinishDeps
}

const defaultDeps = (): WizardDeps => ({
  checkSlugAvailability,
  suggestSlug,
  createFamily,
  saveSecurity,
  saveBabyAndLink,
  finishWizard,
  listServers,
  // finish left undefined - finishWizard falls back to its own real (login/saveServer/vault) deps.
})

const CANCEL_TOAST = 'Setup paused - sign back in anytime to finish.'
const GENERIC_ERROR_MSG = 'That didn’t work - check your details and try again.'
const UNREACHABLE_MSG = 'Can’t reach that server. Check the address and your connection.'

/** Maps a WizardError to the ErrBox copy for whichever step threw it. */
function messageForError(err: unknown, slug: string): ReactNode {
  if (err instanceof WizardError) {
    if (err.kind === 'slug-taken') {
      return <>Another family already lives at <b>/{slug}</b> - try a different one.</>
    }
    if (err.kind === 'unreachable') {
      return UNREACHABLE_MSG
    }
    if (err.kind === 'rejected' && err.message && err.message !== 'rejected') {
      return err.message
    }
  }
  return GENERIC_ERROR_MSG
}

export default function Wizard({
  navigate, token, creds, biometric, resume, firstName, deps: depsOverride,
}: {
  navigate: (s: Screen) => void
  token: string
  creds: AccountCreds
  biometric: boolean
  resume?: WizardResume
  firstName?: string
  deps?: Partial<WizardDeps>
}) {
  const [deps] = useState<WizardDeps>(() => ({ ...defaultDeps(), ...depsOverride }))
  const [step, setStep] = useState<1 | 2 | 3>(resume ? resume.stage : 1)
  const [familyId, setFamilyId] = useState(resume?.familyId ?? '')
  const [familyName, setFamilyName] = useState(resume?.familyName ?? '')
  const [slug, setSlug] = useState(resume?.slug ?? '')
  // Security mode chosen in step 2, needed by saveBabyAndLink to know which caretaker-lookup
  // endpoint to hit when linking the account. When resuming directly at stage 3, this session
  // never saw step 2 run, so the mode is unrecoverable from the resume payload (fetchSetupStatus
  // carries no security-mode signal) - we default to 'caretakers' as the more common path. A
  // wrong guess here surfaces as a retryable WizardError('rejected'), not silent data loss.
  const [mode, setMode] = useState<'pin' | 'caretakers' | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ReactNode | null>(null)
  const [hasFamilies, setHasFamilies] = useState(true)

  useEffect(() => {
    let cancelled = false
    deps.listServers().then(list => {
      if (!cancelled) setHasFamilies(list.length > 0)
    }).catch(() => { /* keep default true - don't strand the user on a listServers error */ })
    return () => { cancelled = true }
  }, [deps])

  function handleCancel() {
    navigate(hasFamilies ? { name: 'families', toast: CANCEL_TOAST } : { name: 'fork' })
  }

  async function handleStep1Next({ name, slug: nextSlug }: { name: string; slug: string }) {
    setError(null)
    setBusy(true)
    try {
      const { familyId: id } = await deps.createFamily(SAAS_BASE, token, { name, slug: nextSlug })
      setFamilyId(id)
      setFamilyName(name)
      setSlug(nextSlug)
      setStep(2)
    } catch (e) {
      setError(messageForError(e, nextSlug))
    } finally {
      setBusy(false)
    }
  }

  async function handleStep2Next(config: SecurityConfig) {
    setError(null)
    setBusy(true)
    try {
      await deps.saveSecurity(SAAS_BASE, token, familyId, config)
      setMode(config.mode)
      setStep(3)
    } catch (e) {
      setError(messageForError(e, slug))
    } finally {
      setBusy(false)
    }
  }

  async function handleStep3Complete(baby: BabyConfig) {
    setError(null)
    setBusy(true)
    try {
      const effectiveMode = mode ?? 'caretakers'
      await deps.saveBabyAndLink(SAAS_BASE, token, familyId, baby, effectiveMode)
      const { toast } = await deps.finishWizard(SAAS_BASE, creds, familyName, biometric, deps.finish)
      navigate({ name: 'families', toast })
    } catch (e) {
      setError(messageForError(e, slug))
    } finally {
      setBusy(false)
    }
  }

  if (step === 1) {
    return (
      <Step1Family
        base={SAAS_BASE}
        busy={busy}
        error={error}
        onCancel={handleCancel}
        onNext={args => void handleStep1Next(args)}
        deps={{ checkSlugAvailability: deps.checkSlugAvailability, suggestSlug: deps.suggestSlug }}
      />
    )
  }
  if (step === 2) {
    return (
      <Step2Security
        busy={busy}
        error={error}
        firstName={firstName}
        onNext={config => void handleStep2Next(config)}
      />
    )
  }
  return <Step3Baby busy={busy} error={error} onComplete={baby => void handleStep3Complete(baby)} />
}
