import { createContext, useContext, type ReactNode } from 'react'
import { FALLBACK_RATES, useFxRates, type FxState } from '../data/fx'

const FxContext = createContext<FxState>({ rates: FALLBACK_RATES, live: false })

export function FxProvider({ children }: { children: ReactNode }) {
  const fx = useFxRates()
  return <FxContext.Provider value={fx}>{children}</FxContext.Provider>
}

export const useFx = () => useContext(FxContext)
