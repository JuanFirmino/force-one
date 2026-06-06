import { useEffect, useState } from 'react'
import { MapPin, Loader } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useUnitStore } from '../stores/unitStore'
import type { Unit } from '../types'

export function UnitSelector() {
  const { currentUnit, setCurrentUnit } = useUnitStore()
  const [units, setUnits] = useState<Unit[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    supabase.from('units').select('*').then(({ data }) => {
      setUnits(data ?? [])
      setLoading(false)
    })
  }, [])

  if (!currentUnit) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl shadow-2xl p-8 flex flex-col gap-6 w-full max-w-sm mx-4">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-800">Selecionar Unidade</h2>
            <p className="text-gray-400 text-sm mt-1">Em qual unidade você está trabalhando?</p>
          </div>
          <div className="flex flex-col gap-3">
            {loading ? (
              <div className="flex items-center justify-center py-6 gap-2 text-gray-400">
                <Loader size={20} className="animate-spin" />
                <span className="text-sm">Carregando unidades...</span>
              </div>
            ) : units.length === 0 ? (
              <p className="text-center text-sm text-red-400 py-4">Nenhuma unidade encontrada.</p>
            ) : (
              units.map(u => (
                <button key={u.id} onClick={() => setCurrentUnit(u)}
                  className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-xl hover:border-green-400 hover:bg-green-50 text-left transition-colors">
                  <MapPin size={20} className="text-green-500 shrink-0" />
                  <div>
                    <p className="font-semibold text-gray-800">{u.name}</p>
                    {u.address && <p className="text-xs text-gray-400">{u.address}</p>}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-50 text-green-700 text-sm font-medium hover:bg-green-100">
        <MapPin size={14} />
        {currentUnit.name}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-gray-100 w-56 z-10">
          {units.map(u => (
            <button key={u.id} onClick={() => { setCurrentUnit(u); setOpen(false) }}
              className={`w-full text-left px-4 py-3 text-sm hover:bg-gray-50 first:rounded-t-xl last:rounded-b-xl
                ${u.id === currentUnit.id ? 'font-bold text-green-600' : 'text-gray-700'}`}>
              {u.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
