import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.sprouttrack.app',
  appName: 'Sprout Track',
  webDir: 'dist',
  server: {
    // Spec §2/§10-risk-3: user-entered self-hosted servers must load in the same
    // webview with the bridge available. Validated by the bridge spike.
    allowNavigation: ['*'],
    // LAN self-hosts may be plain http (spec §3); shell shows a cleartext warning.
    cleartext: true,
  },
  ios: {
    appendUserAgent: 'SproutTrackApp/0.1.0 (ios)',
  },
  android: {
    allowMixedContent: false,
    appendUserAgent: 'SproutTrackApp/0.1.0 (android)',
  },
}

export default config
