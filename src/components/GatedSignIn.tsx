/**
 * One sign-in path on gated pages: while the (protected) layout's signed-out
 * panel is on screen, the nav hides its own "Sign in" button. The panel's
 * buttons carry `returnTo` (server cookie); the nav's SDK overlay can't.
 *
 * The panel announces itself rather than the nav matching a list of gated
 * paths, so new gated pages need no extra wiring.
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

interface GatedSignInState {
  panelShown: boolean
  setPanelShown: (shown: boolean) => void
}

const GatedSignInContext = createContext<GatedSignInState>({
  panelShown: false,
  setPanelShown: () => {},
})

export function GatedSignInProvider({ children }: { children: ReactNode }) {
  const [panelShown, setPanelShown] = useState(false)
  return (
    <GatedSignInContext.Provider value={{ panelShown, setPanelShown }}>{children}</GatedSignInContext.Provider>
  )
}

/** Call from the gated signed-out panel: marks it shown while mounted. */
export function useAnnounceGatedSignInPanel(): void {
  const { setPanelShown } = useContext(GatedSignInContext)
  useEffect(() => {
    setPanelShown(true)
    return () => setPanelShown(false)
  }, [setPanelShown])
}

export function useGatedSignInPanelShown(): boolean {
  return useContext(GatedSignInContext).panelShown
}
