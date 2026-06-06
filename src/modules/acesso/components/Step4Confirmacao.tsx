import { useState } from 'react'
import { CheckCircle, RotateCcw } from 'lucide-react'
import { dataService } from '../../../lib/dataService'
import { useUnitStore } from '../../../stores/unitStore'
import type { AccessType, Customer, PaymentMethod } from '../../../types'

interface Props {
  customer: Customer
  accessType: AccessType
  quantity: number
  paymentMethod: PaymentMethod
  baseAmount: number
  feeAmount: number
  totalAmount: number
  onFinish: (success?: boolean) => void
  onBack: () => void
}

export function Step4Confirmacao({
  customer, accessType, quantity, paymentMethod,
  baseAmount, feeAmount, totalAmount,
  onFinish, onBack
}: Props) {
  const currentUnit = useUnitStore(s => s.currentUnit)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  async function handleConfirm() {
    if (!currentUnit) { setError('Unidade não selecionada.'); return }
    setSaving(true)
    const result = await dataService.from('visits').insert({
      id: crypto.randomUUID(),
      customer_id: customer.id,
      unit_id: currentUnit.id,
      access_type_id: accessType.id,
      payment_method_id: paymentMethod.id,
      base_amount: baseAmount,
      fee_amount: feeAmount,
      total_amount: totalAmount,
      visited_at: new Date().toISOString(),
    })
    setSaving(false)
    if (result.error) { setError(String(result.error)); onFinish(false); return }
    onFinish(true)
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-6 text-center">
        <CheckCircle size={80} className="text-green-500" />
        <h2 className="text-3xl font-bold text-gray-800">Acesso Registrado!</h2>
        <div className="bg-white rounded-2xl shadow p-6 w-full max-w-sm text-left flex flex-col gap-3">
          <Row label="Cliente" value={customer.name} />
          <Row label="Tipo" value={accessType.name} />
          {quantity > 1 && <Row label="Quantidade" value={`${quantity}×`} />}
          <Row label="Pagamento" value={paymentMethod.name} />
          {feeAmount > 0 && <Row label="Taxa" value={`R$ ${feeAmount.toFixed(2).replace('.', ',')}`} />}
          <div className="border-t pt-3">
            <Row label="Total" value={`R$ ${totalAmount.toFixed(2).replace('.', ',')}`} bold />
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={() => onFinish()}
            className="flex items-center gap-2 px-6 py-3 bg-green-500 text-white rounded-xl font-semibold hover:bg-green-600">
            <RotateCcw size={18} /> Nova Venda
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-lg">
      <div className="flex items-center gap-3 w-full">
        <button onClick={onBack} className="text-gray-400 hover:text-gray-600 text-xl">←</button>
        <h2 className="text-2xl font-bold text-gray-800">Confirmar Acesso</h2>
      </div>

      <div className="w-full bg-white rounded-2xl shadow p-6 flex gap-4 items-center">
        {customer.photo_url
          ? <img src={customer.photo_url} className="w-16 h-16 rounded-full object-cover border-4 border-green-400 shrink-0" />
          : <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center text-2xl font-bold text-gray-400 shrink-0">
              {customer.name[0]}
            </div>
        }
        <div>
          <p className="text-xl font-bold text-gray-800">{customer.name}</p>
          <p className="text-sm text-gray-400">CPF: {customer.cpf}</p>
        </div>
      </div>

      <div className="w-full bg-white rounded-2xl shadow p-6 flex flex-col gap-3">
        <Row label="Tipo de acesso" value={accessType.name} />
        {quantity > 1 && <Row label="Quantidade" value={`${quantity}×`} />}
        <Row label="Valor base" value={`R$ ${baseAmount.toFixed(2).replace('.', ',')}`} />
        <Row label="Pagamento" value={paymentMethod.name} />
        {feeAmount > 0 && <Row label="Taxa" value={`R$ ${feeAmount.toFixed(2).replace('.', ',')}`} />}
        <div className="border-t pt-3">
          <Row label="Total" value={`R$ ${totalAmount.toFixed(2).replace('.', ',')}`} bold />
        </div>
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <button onClick={handleConfirm} disabled={saving}
        className="w-full py-4 bg-green-500 text-white font-bold text-lg rounded-2xl hover:bg-green-600 disabled:opacity-50">
        {saving ? 'Registrando...' : 'Confirmar Acesso'}
      </button>
    </div>
  )
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-gray-500 text-sm">{label}</span>
      <span className={`${bold ? 'text-xl font-bold text-green-600' : 'text-gray-800 font-medium'}`}>{value}</span>
    </div>
  )
}
