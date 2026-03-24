import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { FluentProvider, webLightTheme, webDarkTheme } from '@fluentui/react-components'
import './index.css'
import App from './app/App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FluentProvider theme={window.matchMedia('(prefers-color-scheme: light)').matches ? webLightTheme : webDarkTheme}>
      <App />
    </FluentProvider>
  </StrictMode>,
)
