import { create } from 'zustand'
import type { Unit } from '../types'

interface UnitStore {
  currentUnit: Unit | null
  setCurrentUnit: (unit: Unit) => void
  clearUnit: () => void
}

export const useUnitStore = create<UnitStore>()((set) => ({
  currentUnit: null,
  setCurrentUnit: (unit) => set({ currentUnit: unit }),
  clearUnit: () => set({ currentUnit: null }),
}))
