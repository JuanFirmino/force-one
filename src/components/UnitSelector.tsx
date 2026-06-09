import { useEffect, useState } from 'react'
import { MapPin } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useUnitStore } from '../stores/unitStore'
import type { Unit } from '../types'

// ── Dropdown de troca de filial (no header) ────────────────
export function UnitSelector() {
  const { currentUnit, setCurrentUnit } = useUnitStore()
  const [units, setUnits] = useState<Unit[]>([])
  const [open, setOpen]   = useState(false)

  useEffect(() => {
    supabase.from('units').select('*').then(({ data }) => setUnits(data ?? []))
  }, [])

  if (!currentUnit) return null

  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-50 text-green-700 text-sm font-medium hover:bg-green-100 transition-colors">
        <MapPin size={14} />
        <span className="hidden sm:inline">{currentUnit.name.replace('Force One - ', '')}</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-gray-100 w-56 z-20">
            {units.map(u => (
              <button key={u.id} onClick={() => { setCurrentUnit(u); setOpen(false) }}
                className={`w-full text-left px-4 py-3 text-sm hover:bg-gray-50 first:rounded-t-xl last:rounded-b-xl transition-colors
                  ${u.id === currentUnit.id ? 'font-bold text-green-600' : 'text-gray-700'}`}>
                {u.name.replace('Force One - ', '')}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── Tela de seleção obrigatória de filial ─────────────────
export function UnitSelectionScreen({ onSelect }: { onSelect: (u: Unit) => void }) {
  const [units, setUnits]     = useState<Unit[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('units').select('*').order('name').then(({ data }) => {
      setUnits(data ?? [])
      setLoading(false)
    })
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl p-10 w-full max-w-sm flex flex-col gap-8">
        <div className="text-center">
          <div className="w-14 h-14 bg-green-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <MapPin size={28} className="text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800">Selecionar Filial</h2>
          <p className="text-gray-400 text-sm mt-1">Em qual unidade você está trabalhando hoje?</p>
        </div>

        <div className="flex flex-col gap-3">
          {loading ? (
            <div className="py-8 text-center text-gray-400 text-sm">Carregando filiais...</div>
          ) : units.length === 0 ? (
            <p className="text-center text-sm text-red-400 py-4">Nenhuma filial cadastrada.</p>
          ) : (
            units.map(u => (
              <button key={u.id} onClick={() => onSelect(u)}
                className="flex items-center gap-4 p-4 border-2 border-gray-200 rounded-xl hover:border-green-400 hover:bg-green-50 text-left transition-all group">
                <div className="w-10 h-10 bg-green-100 group-hover:bg-green-200 rounded-xl flex items-center justify-center shrink-0 transition-colors">
                  <MapPin size={20} className="text-green-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-800">{u.name.replace('Force One - ', '')}</p>
                  {u.address && <p className="text-xs text-gray-400 mt-0.5">{u.address}</p>}
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
