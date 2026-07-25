import { useEffect, useRef, useState } from 'react'
import type { PluginListenerHandle } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
import { PushNotifications, type ActionPerformed } from '@capacitor/push-notifications'
import Splash from './screens/Splash'
import Fork from './screens/Fork'
import Families from './screens/Families'
import AddFamily from './screens/AddFamily'
import AccountSignIn from './screens/AccountSignIn'
import AccountSignUp from './screens/AccountSignUp'
import AccountVerify from './screens/AccountVerify'
import AccountReset from './screens/AccountReset'
import AccountResetConfirm from './screens/AccountResetConfirm'
import Offline from './screens/Offline'
import Connecting from './screens/Connecting'
import ReAuth from './screens/ReAuth'
import Settings, { isAutoOpenEnabled } from './screens/Settings'
import NotificationsIntro from './screens/NotificationsIntro'
import Wizard from './screens/wizard/Wizard'
import { getDefaultServer, listServers, type ServerEntry } from './services/server-registry'
import { bootActionFromSearch, stripBridgeEvent } from './services/bridge-events'
import { entryForNotification } from './services/notification-routing'
import { getOptIn, hasConnectedOnce } from './services/push-opt-in'
import { screenForDeepLink } from './services/deep-links'
import type { AccountCreds } from './services/credential-vault'
import type { WizardResume } from './services/account-routing'

export type Screen =
  | { name: 'splash' }
  | { name: 'fork' }
  | { name: 'acct-signin'; notice?: string }
  | { name: 'acct-signup' }
  | { name: 'acct-verify'; token: string; creds: AccountCreds; biometric: boolean }
  | { name: 'acct-reset' }
  | { name: 'acct-reset-confirm'; token: string }
  // Built in a later task: the deep-link resolver already needs to type-check
  // against these two, but the screens/render branches aren't wired up yet.
  | { name: 'acct-verify-link'; token: string }
  | { name: 'setup-link'; token: string }
  | { name: 'wizard'; token: string; creds: AccountCreds; biometric: boolean; resume?: WizardResume; firstName?: string }
  | { name: 'add-family'; prefillInput?: string }
  | { name: 'families'; toast?: string; notice?: string }
  | { name: 'settings' }
  | { name: 'offline'; entry: ServerEntry }
  | { name: 'connecting'; entry: ServerEntry; route?: string }
  | { name: 'reauth'; entry: ServerEntry }
  | { name: 'push-intro'; next: Screen }

// Narrowed to the one listener this component attaches (the real plugin's
// `addListener` is overloaded across several event names, which doesn't
// structurally match a single-signature test double). Defaults to the real
// plugin; tests inject a fake so the tap listener is exercised without
// `vi.mock('@capacitor/...')` (none exists in this repo) - there's no other
// clean seam, since the plugin proxy only exists as an import side effect.
interface PushActionPlugin {
  addListener(
    eventName: 'pushNotificationActionPerformed',
    listenerFunc: (notification: ActionPerformed) => void,
  ): Promise<PluginListenerHandle>
}

// Same narrowing rationale as PushActionPlugin above, for @capacitor/app's
// `appUrlOpen` (Universal/App Link) event: the real plugin's `addListener` is
// overloaded across several event names, and there's no `vi.mock('@capacitor/...')`
// in this repo, so tests inject a fake through this single-signature seam.
interface DeepLinkPlugin {
  addListener(
    eventName: 'appUrlOpen',
    listenerFunc: (event: { url: string }) => void,
  ): Promise<PluginListenerHandle>
}

export default function App({
  pushPlugin = PushNotifications,
  deepLinkPlugin = CapApp,
}: { pushPlugin?: PushActionPlugin; deepLinkPlugin?: DeepLinkPlugin } = {}) {
  const [screen, setScreen] = useState<Screen>({ name: 'splash' })
  const bootTarget = useRef<Screen | null>(null)
  const splashDone = useRef(false)

  useEffect(() => {
    // A `?bridge-event=` param means the web app handed control back to the shell.
    // Read it before the async work below and strip it immediately so it isn't
    // reprocessed on a later remount.
    const bootAction = bootActionFromSearch(window.location.search)
    stripBridgeEvent()

    const applyBootTarget = (target: Screen) => {
      bootTarget.current = target
      if (splashDone.current) setScreen(s => (s.name === 'splash' ? target : s))
    }

    // pushNotificationActionPerformed fires with retainUntilConsumed on both
    // platforms, so a cold-start tap is still queued when this attaches here.
    // Route through applyBootTarget (never setScreen) so the splash/bootTarget
    // guards above still protect an in-flight user interaction. A pending
    // bridge event (logout, switch-family, session-expired) is an explicit
    // signal from the web app and must keep winning over a queued tap.
    // The plugin has no web implementation, so addListener rejects outright
    // in a browser (dev server, tests) - that must never surface as an
    // unhandled rejection or block anything else in this effect. It's still
    // worth a diagnostic though: on a real device this same rejection would
    // mean a genuine registration failure, and push already swallows every
    // other failure silently by design (see push.ts) - this is the one place
    // left where that could be surfaced.
    pushPlugin.addListener('pushNotificationActionPerformed', async action => {
      if (bootAction !== 'auto-open') return
      const match = entryForNotification(action.notification.data, await listServers())
      if (match) applyBootTarget({ name: 'connecting', entry: match.entry, route: match.route })
    }).catch(err => {
      console.warn('[push] failed to attach pushNotificationActionPerformed listener', err)
    })

    // A Universal/App Link (setup, verify, password-reset) can arrive at any
    // point after launch, cold-start included. Route through applyBootTarget
    // (never setScreen) so it's still subject to the splash/bootTarget guards
    // above - a pending bridge event or queued push tap keeps winning over it.
    // screenForDeepLink returns null for anything it doesn't claim (including
    // /account, deliberately, for App Store payment compliance) - that means
    // "not ours", so the link is simply not routed and the normal boot proceeds.
    // Same web-implementation caveat as the push listener: addListener rejects
    // outright outside a native runtime (dev server, tests), which must never
    // surface as an unhandled rejection - but is worth a console.warn so a
    // genuine on-device registration failure stays diagnosable.
    deepLinkPlugin.addListener('appUrlOpen', ({ url }) => {
      const target = screenForDeepLink(url)
      if (target) applyBootTarget(target)
    }).catch(err => {
      console.warn('[deep-link] failed to attach appUrlOpen listener', err)
    })

    void (async () => {
      const servers = await listServers()
      if (servers.length === 0) return applyBootTarget({ name: 'fork' })
      if (bootAction === 'show-server-list') return applyBootTarget({ name: 'families' })
      if (bootAction === 'reconnect') {
        // listServers() sorts most-recently-used first; the entry we just left is at the top.
        const recent = servers.find(e => e.lastUsedAt !== null)
        return applyBootTarget(recent ? { name: 'connecting', entry: recent } : { name: 'families' })
      }
      const def = await getDefaultServer()
      const autoOpen = def ? await isAutoOpenEnabled() : false
      const next: Screen = def && autoOpen ? { name: 'connecting', entry: def } : { name: 'families' }
      // The soft pre-prompt only makes sense once the user has connected at
      // least once before (see push-opt-in.ts) and only while the choice is
      // still unmade - never re-show it after granted/declined.
      if ((await getOptIn()) === 'unasked' && (await hasConnectedOnce())) {
        return applyBootTarget({ name: 'push-intro', next })
      }
      applyBootTarget(next)
    })()
  }, [])

  const handleSplashDone = () => {
    splashDone.current = true
    const target = bootTarget.current
    if (target) setScreen(s => (s.name === 'splash' ? target : s))
  }

  return (
    <div className="m-root" data-testid="app-root">
      {screen.name === 'splash' && <Splash onDone={handleSplashDone} />}
      {screen.name === 'fork' && <Fork navigate={setScreen} />}
      {screen.name === 'acct-signin' && <AccountSignIn navigate={setScreen} notice={screen.notice} />}
      {screen.name === 'acct-signup' && <AccountSignUp navigate={setScreen} />}
      {screen.name === 'acct-verify' && (
        <AccountVerify navigate={setScreen} token={screen.token} creds={screen.creds} biometric={screen.biometric} />
      )}
      {screen.name === 'acct-reset' && <AccountReset navigate={setScreen} />}
      {screen.name === 'acct-reset-confirm' && (
        <AccountResetConfirm navigate={setScreen} token={screen.token} />
      )}
      {screen.name === 'wizard' && (
        <Wizard
          navigate={setScreen}
          token={screen.token}
          creds={screen.creds}
          biometric={screen.biometric}
          resume={screen.resume}
          firstName={screen.firstName}
        />
      )}
      {screen.name === 'families' && <Families navigate={setScreen} toast={screen.toast} notice={screen.notice} />}
      {screen.name === 'add-family' && <AddFamily navigate={setScreen} prefillInput={screen.prefillInput} />}
      {screen.name === 'settings' && <Settings navigate={setScreen} />}
      {screen.name === 'offline' && <Offline navigate={setScreen} entry={screen.entry} />}
      {screen.name === 'connecting' && <Connecting entry={screen.entry} route={screen.route} navigate={setScreen} />}
      {screen.name === 'reauth' && <ReAuth entry={screen.entry} navigate={setScreen} />}
      {screen.name === 'push-intro' && <NotificationsIntro navigate={setScreen} next={screen.next} />}
    </div>
  )
}
