import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import '@fontsource/literata/400.css'
import '@fontsource/literata/600.css'
import '@fontsource/literata/700.css'
import '@fontsource/literata/400-italic.css'
import '@fontsource/alegreya-sans/400.css'
import '@fontsource/alegreya-sans/500.css'
import '@fontsource/alegreya-sans/700.css'
import '@fontsource/alegreya-sans/800.css'
import './index.css'
import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'

if (Capacitor.isNativePlatform()) {
  // Paper background → dark status-bar content. Style.Light = dark text for light backgrounds.
  void StatusBar.setStyle({ style: Style.Light })
  if (Capacitor.getPlatform() === 'android') void StatusBar.setBackgroundColor({ color: '#f7f1e2' })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
