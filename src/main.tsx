import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { FxProvider } from './state/fx-context'
import { RowsProvider } from './state/rows-context'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FxProvider>
      <RowsProvider>
        <App />
      </RowsProvider>
    </FxProvider>
  </StrictMode>,
)
