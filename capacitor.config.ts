import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.sprouttrack.app',
  appName: 'Sprout Track',
  webDir: 'dist',
  // Paper theme color behind the webview: with the launch screen now a plain
  // paper-colored view (no giant icon), launch → splash-hide → first web paint
  // stays one continuous color instead of flashing white.
  backgroundColor: '#f7f1e2',
  server: {
    // Spec §2/§10-risk-3: user-entered self-hosted servers must load in the same
    // webview with the bridge available. Validated by the bridge spike.
    allowNavigation: ['*'],
    // LAN self-hosts may be plain http (spec §3); shell shows a cleartext warning.
    cleartext: true,
  },
  plugins: {
    // Route the shell's window.fetch through native HTTP: probe/login calls to
    // user-entered servers would otherwise die on CORS and (for http:// LAN
    // hosts) mixed-content blocking, since the shell origin is https/capacitor.
    CapacitorHttp: {
      enabled: true,
    },
    SplashScreen: {
      backgroundColor: '#f7f1e2',
      launchAutoHide: true,
    },
  },
  ios: {
    appendUserAgent: 'SproutTrackApp/0.2.0 (ios)',
  },
  android: {
    allowMixedContent: false,
    appendUserAgent: 'SproutTrackApp/0.2.0 (android)',
  },
}

export default config
