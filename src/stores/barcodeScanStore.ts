import { create } from 'zustand'

interface BarcodeScanStore {
  pendingBarcode: string | null
  setPendingBarcode: (code: string | null) => void
}

export const useBarcodeScanStore = create<BarcodeScanStore>()((set) => ({
  pendingBarcode: null,
  setPendingBarcode: (code) => set({ pendingBarcode: code }),
}))
