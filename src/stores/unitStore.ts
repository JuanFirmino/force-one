import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Unit } from '../types'

interface UnitStore {
  currentUnit: Unit | null
  setCurrentUnit: (unit: Unit) => void
}

export const useUnitStore = create<UnitStore>()(
  persist(
    (set) => ({
      currentUnit: null,
      setCurrentUnit: (unit) => set({ currentUnit: unit }),
    }),
    { name: 'force-one-unit' }
  )
)
