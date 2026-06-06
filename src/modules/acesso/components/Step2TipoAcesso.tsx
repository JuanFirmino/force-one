import { useEffect, useState } from 'react'
import React from 'react'
import { Shield, ShieldOff, Minus, Plus } from 'lucide-react'
import { dataService } from '../../../lib/dataService'
import type { AccessType, Customer } from '../../../types'

interface Props {
  customer: Customer
  onSelect: (accessType: AccessType, quantity: number) => void
  onBack: () => void
}

export function Step2TipoAcesso({ customer, onSelect, onBack }: Props) {
  const [types, setTypes] = useState<AccessType[]>([])
  const [loading, setLoading] = useState(true)
  const [quantities, setQuantities] = useState<Record<string, number>>({})

  useEffect(() => {
    const load = async () => {
      const result = await dataService.from('access_types').select('*').eq('active', true).execute()
      const list = result.data ?? []
      setTypes(list)
      const init: Record<string, number> = {}
      list.forEach(t => { init[t.id] = 1 })
      setQuantities(init)
      setLoading(false)
    }
    load()
  }, [])

  function changeQty(id: string, delta: number) {
    setQuantities(prev => ({ ...prev, [id]: Math.max(1, (prev[id] ?? 1) + delta) }))
  }

  const icons: Record<string, React.ReactElement> = {
    'Com Equipamento': <Shield size={28} className="text-green-500" />,
    'Sem Equipamento': <ShieldOff size={28} className="text-blue-500" />,
  }

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-lg">
      <div className="flex items-center gap-3 w-full">
        <button onClick={onBack} className="text-gray-400 hover:text-gray-600 text-xl">←</button>
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Tipo de Acesso</h2>
          <p className="text-gray-500 text-sm">{customer.name}</p>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-400">Carregando...</p>
      ) : (
        <div className="flex flex-col gap-4 w-full">
          {types.map(t => {
            const qty = quantities[t.id] ?? 1
            const total = t.price * qty
            return (
              <div key={t.id} className="bg-white rounded-2xl shadow border-2 border-transparent hover:border-green-400 transition-all p-5 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {icons[t.name] ?? <Shield size={28} className="text-gray-400" />}
                    <div>
                      <p className="font-bold text-gray-800 text-lg">{t.name}</p>
                      {t.description && <p className="text-xs text-gray-400">{t.description}</p>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400">unitário</p>
                    <p className="text-lg font-bold text-gray-600">R$ {t.price.toFixed(2).replace('.', ',')}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  {/* Quantidade */}
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-500 font-medium">Qtd.</span>
                    <button
                      onClick={() => changeQty(t.id, -1)}
                      className="w-8 h-8 rounded-full border-2 border-gray-200 flex items-center justify-center text-gray-500 hover:border-green-400 hover:text-green-500 transition-colors">
                      <Minus size={14} />
                    </button>
                    <span className="w-6 text-center font-bold text-gray-800 text-lg">{qty}</span>
                    <button
                      onClick={() => changeQty(t.id, 1)}
                      className="w-8 h-8 rounded-full border-2 border-gray-200 flex items-center justify-center text-gray-500 hover:border-green-400 hover:text-green-500 transition-colors">
                      <Plus size={14} />
                    </button>
                  </div>

                  {/* Total + Selecionar */}
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xs text-gray-400">total</p>
                      <p className="text-xl font-bold text-green-600">R$ {total.toFixed(2).replace('.', ',')}</p>
                    </div>
                    <button
                      onClick={() => onSelect(t, qty)}
                      className="px-4 py-2 bg-green-500 text-white rounded-xl font-semibold hover:bg-green-600 transition-colors text-sm">
                      Selecionar
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
