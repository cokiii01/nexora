// Lets pages react to the guided demo without knowing how it works.
// `null` outside the demo, so normal use is untouched.
import { createContext, useContext } from 'react'

export const DemoContext = createContext(null)

/** { running, scene, focusApproval } while the guided demo is running, else null. */
export function useDemo() {
  return useContext(DemoContext)
}
