import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Screen } from '../../App'
import { SAAS_BASE } from '../../services/account'
import type { WizardResume } from '../../services/account-routing'
import type { AccountCreds } from '../../services/credential-vault'
import { listServers } from '../../services/server-registry'
import {
  checkSlugAvailability, createFamily, finishWizard, linkAccountToCaretaker, saveBaby, saveSecurity, suggestSlug,
  WizardError, type BabyConfig, type FinishDeps, type SecurityConfig,
} from '../../services/wizard'
import Step1Family from './Step1Family'
import Step2Security from './Step2Security'
import Step3Baby from './Step3Baby'

export interface WizardDeps {
  checkSlugAvailability: typeof checkSlugAvailability
  suggestSlug: typeof suggestSlug
  createFamily: typeof createFamily
  saveSecurity: typeof saveSecurity
  saveBaby: typeof saveBaby
  linkAccountToCaretaker: typeof linkAccountToCaretaker
  finishWizard: typeof finishWizard
  listServers: typeof listServers
  finish?: FinishDeps
}

const defaultDeps = (): WizardDeps => ({
  checkSlugAvailability,
  suggestSlug,
  createFamily,
  saveSecurity,
  saveBaby,
  linkAccountToCaretaker,
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
  // Security mode, needed by linkAccountToCaretaker to know which caretaker-lookup endpoint to
  // hit when linking the account. Set in step 2, or carried through resume.mode when resuming
  // directly at stage 3 (account-routing.ts maps the server's setup-status authType). If still
  // unknown (e.g. an older server that doesn't report authType), default to 'caretakers' as the
  // last resort - safe because linkAccountToCaretaker's caretakers-mode lookup falls back to the
  // system caretaker when the family has none but the reserved '00' entry, so a pin-mode family
  // guessed as 'caretakers' still links correctly instead of throwing.
  const [mode, setMode] = useState<'pin' | 'caretakers' | undefined>(resume?.mode)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ReactNode | null>(null)
  const [hasFamilies, setHasFamilies] = useState(true)
  // Tracks whether saveBaby has already succeeded this session, so a step-3 retry (after e.g. a
  // failed link or finish call) re-runs only the still-failing remainder instead of re-POSTing
  // the baby - each sub-call is retried only if it hasn't already succeeded (idempotent-by-
  // construction retries, per the design spec's step-retry requirement).
  const babySavedRef = useRef(false)

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
      // Idempotent-by-construction retry: saveBaby POSTs a new baby record, so it must not
      // repeat once it has already succeeded this session - only the failed remainder (link,
      // then finish) is re-run when the button is clicked again after an error.
      if (!babySavedRef.current) {
        await deps.saveBaby(SAAS_BASE, token, familyId, baby)
        babySavedRef.current = true
      }
      await deps.linkAccountToCaretaker(SAAS_BASE, token, familyId, effectiveMode)
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
