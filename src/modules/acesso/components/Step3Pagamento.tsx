import { useEffect, useState } from 'react'
import React from 'react'
import { Banknote, CreditCard, QrCode, Landmark } from 'lucide-react'
import { dataService } from '../../../lib/dataService'
import type { AccessType, Customer, PaymentMethod } from '../../../types'

interface Props {
  customer: Customer
  accessType: AccessType
  quantity: number
  onSelect: (method: PaymentMethod, total: number, fee: number) => void
  onBack: () => void
}

const methodIcon: Record<string, React.ReactElement> = {
  'Dinheiro': <Banknote size={28} className="text-green-600" />,
  'Pix': <QrCode size={28} className="text-blue-500" />,
  'Cartão de Débito': <Landmark size={28} className="text-purple-500" />,
  'Cartão de Crédito': <CreditCard size={28} className="text-orange-500" />,
}

export function Step3Pagamento({ customer, accessType, quantity, onSelect, onBack }: Props) {
  const [methods, setMethods] = useState<PaymentMethod[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchMethods = async () => {
      const result = await dataService.from('payment_methods').select('*').eq('active', true).execute()
      setMethods(result.data ?? [])
      setLoading(false)
    }
    fetchMethods()
  }, [])

  const base = accessType.price * quantity

  function calc(method: PaymentMethod) {
    const fee = method.fee_amount ?? 0
    return { fee, total: base + fee }
  }

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-lg">
      <div className="flex items-center gap-3 w-full">
        <button onClick={onBack} className="text-gray-400 hover:text-gray-600 text-xl">←</button>
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Meio de Pagamento</h2>
          <p className="text-gray-500 text-sm">{customer.name} · {accessType.name}</p>
        </div>
      </div>

      <div className="w-full bg-gray-50 rounded-xl p-4 flex items-center justify-between">
        <div>
          <p className="text-gray-500 text-sm">Valor base</p>
          {quantity > 1 && (
            <p className="text-xs text-gray-400">
              {quantity}× R$ {accessType.price.toFixed(2).replace('.', ',')}
            </p>
          )}
        </div>
        <p className="text-3xl font-bold text-gray-800">
          R$ {base.toFixed(2).replace('.', ',')}
        </p>
      </div>

      {loading ? (
        <p className="text-gray-400">Carregando...</p>
      ) : (
        <div className="flex flex-col gap-3 w-full">
          {methods.map(m => {
            const { fee, total } = calc(m)
            return (
              <button key={m.id} onClick={() => onSelect(m, total, fee)}
                className="flex items-center justify-between p-4 bg-white rounded-2xl shadow hover:shadow-md border-2 border-transparent hover:border-green-400 transition-all">
                <div className="flex items-center gap-3">
                  {methodIcon[m.name] ?? <CreditCard size={28} className="text-gray-400" />}
                  <div className="text-left">
                    <p className="font-semibold text-gray-800">{m.name}</p>
                    {(m.fee_amount ?? 0) > 0
                      ? <p className="text-xs text-gray-400">+ R$ {Number(m.fee_amount).toFixed(2).replace('.', ',')} taxa</p>
                      : <p className="text-xs text-green-500">Sem taxa</p>
                    }
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
