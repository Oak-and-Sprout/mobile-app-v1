import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Screen } from '../../App'
import { SAAS_BASE } from '../../services/account'
import type { WizardResume } from '../../services/account-routing'
import type { AccountCreds, StoredCredentials } from '../../services/credential-vault'
import { listServers } from '../../services/server-registry'
import {
  checkSlugAvailability, createFamily, exchangeSetupToken, finishSetupWizard, finishWizard, linkAccountToCaretaker,
  saveBaby, saveSecurity, suggestSlug, validateSetupToken,
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
  finishSetupWizard: typeof finishSetupWizard
  validateSetupToken: typeof validateSetupToken
  exchangeSetupToken: typeof exchangeSetupToken
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
  finishSetupWizard,
  validateSetupToken,
  exchangeSetupToken,
  listServers,
  // finish left undefined - finishWizard/finishSetupWizard fall back to their own real
  // (login/saveServer/vault) deps.
})

/** Derives the PIN/caretaker credential from step 2's security config, for setup mode's
 *  finishSetupWizard (there is no account credential to reuse there). Caretakers mode selects
 *  by role, not position, since the first-added caretaker is only forced ADMIN at add-time -
 *  a later removal can leave the real admin at a non-zero index (or, in principle, leave no
 *  admin at all). The `?? caretakers[0]` is a last-resort fallback for that no-admin shape;
 *  in practice it should never fire for setup mode because `handleStep2Next` below refuses to
 *  advance past step 2 without an ADMIN present in a caretakers-mode config. The underlying gap
 *  - Step2Security's removal handler doesn't re-promote or block removing the sole admin - is
 *  a UX issue in that file, deliberately left alone here; this fallback exists only so a
 *  malformed config can't crash the finish step instead of surfacing a coherent error. */
function credsFromSecurityConfig(config: SecurityConfig): StoredCredentials {
  if (config.mode === 'pin') {
    return { type: 'pin', loginId: null, securityPin: config.securityPin }
  }
  const admin = config.caretakers.find(c => c.role === 'ADMIN') ?? config.caretakers[0]
  return { type: 'pin', loginId: admin.loginId, securityPin: admin.securityPin }
}

const CANCEL_TOAST = 'Setup paused - sign back in anytime to finish.'
const GENERIC_ERROR_MSG = 'That didn’t work - check your details and try again.'
const UNREACHABLE_MSG = 'Can’t reach that server. Check the address and your connection.'
const NO_ADMIN_MSG = 'You need at least one admin caretaker - promote one before continuing.'

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
  navigate, token, creds, biometric, resume, firstName, mode: wizardMode = 'account', setupToken, deps: depsOverride,
}: {
  navigate: (s: Screen) => void
  token: string
  creds: AccountCreds | null
  biometric: boolean
  resume?: WizardResume
  firstName?: string
  mode?: 'account' | 'setup'
  setupToken?: string
  deps?: Partial<WizardDeps>
}) {
  const [deps] = useState<WizardDeps>(() => ({ ...defaultDeps(), ...depsOverride }))
  const [step, setStep] = useState<1 | 2 | 3>(resume ? resume.stage : 1)
  const [familyId, setFamilyId] = useState(resume?.familyId ?? '')
  const [familyName, setFamilyName] = useState(resume?.familyName ?? '')
  const [slug, setSlug] = useState(resume?.slug ?? '')
  // Captured from step 2's security config, for setup mode's finishSetupWizard - there is no
  // account credential in that mode, so the PIN/caretaker credential the user just configured
  // is what gets logged in with and stored (see credsFromSecurityConfig above).
  const [pinCreds, setPinCreds] = useState<StoredCredentials | null>(null)
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
      const args = wizardMode === 'setup' ? { name, slug: nextSlug, setupToken } : { name, slug: nextSlug }
      const { familyId: id } = await deps.createFamily(SAAS_BASE, token, args)
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
    // Setup mode's finish logs in as whichever caretaker credsFromSecurityConfig picks - it
    // must be an admin (that's the whole point of a provisioning link). Step2Security's UI
    // lets a caretakers-mode config end up with no ADMIN at all (add one, add a second as
    // USER, remove the first) with nothing stopping Next - refuse to advance here instead of
    // silently handing an admin-provisioning flow a non-admin credential. Account mode never
    // reads this credential (it links via the account, not a caretaker PIN), so it's unaffected.
    if (wizardMode === 'setup' && config.mode === 'caretakers' && !config.caretakers.some(c => c.role === 'ADMIN')) {
      setError(NO_ADMIN_MSG)
      return
    }
    setBusy(true)
    try {
      await deps.saveSecurity(SAAS_BASE, token, familyId, config)
      setMode(config.mode)
      setPinCreds(credsFromSecurityConfig(config))
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
      let toast: string
      if (wizardMode === 'setup') {
        // No account to link in setup mode - finishSetupWizard logs in with the PIN/caretaker
        // credential captured from step 2 instead.
        if (!pinCreds) throw new WizardError('rejected')
        ;({ toast } = await deps.finishSetupWizard(SAAS_BASE, slug, familyName, pinCreds, biometric, deps.finish))
      } else {
        if (!creds) throw new WizardError('rejected')
        await deps.linkAccountToCaretaker(SAAS_BASE, token, familyId, effectiveMode)
        ;({ toast } = await deps.finishWizard(SAAS_BASE, creds, familyName, biometric, deps.finish))
      }
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
