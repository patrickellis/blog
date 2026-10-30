import type { ReactNode } from 'react'
import { RowsContext, useComputedRows } from './results'

export function RowsProvider({ children }: { children: ReactNode }) {
  return <RowsContext.Provider value={useComputedRows()}>{children}</RowsContext.Provider>
}
