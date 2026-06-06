import { useState, useEffect } from 'react'
import { CheckCircle, XCircle } from 'lucide-react'
import { Step1Identificacao } from './components/Step1Identificacao'
import { Step2TipoAcesso } from './components/Step2TipoAcesso'
import { Step3Pagamento } from './components/Step3Pagamento'
import { Step4Confirmacao } from './components/Step4Confirmacao'
import type { AccessType, Customer, PaymentMethod } from '../../types'

type Step = 1 | 2 | 3 | 4

const STEPS = ['Identificação', 'Tipo de Acesso', 'Pagamento', 'Confirmação']

function StepBar({ current }: { current: Step }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((label, i) => {
        const n = (i + 1) as Step
        const active = n === current
        const done = n < current
        return (
          <div key={n} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-1">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm
                ${done ? 'bg-green-500 text-white' : active ? 'bg-green-500 text-white ring-4 ring-green-100' : 'bg-gray-200 text-gray-400'}`}>
                {done ? '✓' : n}
              </div>
              <span className={`text-xs mt-1 font-medium ${active ? 'text-green-600' : done ? 'text-green-400' : 'text-gray-400'}`}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`h-0.5 flex-1 -mt-5 ${done ? 'bg-green-400' : 'bg-gray-200'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Toast ──────────────────────────────────────────────────
function Toast({ success, onDone }: { success: boolean; onDone: () => void }) {
  const [progress, setProgress] = useState(100)

  useEffect(() => {
    const duration = 3000
    const interval = 30
    const step = (interval / duration) * 100
    const timer = setInterval(() => {
      setProgress(p => {
        if (p - step <= 0) { clearInterval(timer); onDone(); return 0 }
        return p - step
      })
    }, interval)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4`}>
      <div className={`rounded-2xl shadow-xl overflow-hidden ${success ? 'bg-green-500' : 'bg-red-500'}`}>
        <div className="flex items-center gap-3 px-5 py-4 text-white">
          {success
            ? <CheckCircle size={24} className="shrink-0" />
            : <XCircle size={24} className="shrink-0" />
          }
          <div>
            <p className="font-semibold text-sm">
              {success ? 'Entrada registrada com sucesso!' : 'Erro ao registrar entrada'}
            </p>
            <p className="text-xs opacity-80">
              {success ? 'Acesso liberado.' : 'Tente novamente.'}
            </p>
          </div>
        </div>
        {/* barra de progresso */}
        <div className="h-1 bg-white/30">
          <div
            className="h-full bg-white transition-none"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  )
}

// ── Module ─────────────────────────────────────────────────
export function AcessoModule() {
  const [step, setStep] = useState<Step>(1)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [accessType, setAccessType] = useState<AccessType | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null)
  const [feeAmount, setFeeAmount] = useState(0)
  const [totalAmount, setTotalAmount] = useState(0)
  const [toast, setToast] = useState<{ show: boolean; success: boolean } | null>(null)

  function reset(success?: boolean) {
    setStep(1); setCustomer(null); setAccessType(null)
    setQuantity(1); setPaymentMethod(null); setFeeAmount(0); setTotalAmount(0)
    if (success !== undefined) setToast({ show: true, success })
  }

  return (
    <div className="flex flex-col items-center px-4 py-8 min-h-full">
      {toast?.show && (
        <Toast success={toast.success} onDone={() => setToast(null)} />
      )}
      <div className="w-full max-w-lg">
        <StepBar current={step} />
        {step === 1 && (
          <Step1Identificacao onCustomerSelected={c => { setCustomer(c); setStep(2) }} />
        )}
        {step === 2 && customer && (
          <Step2TipoAcesso
            customer={customer}
            onSelect={(t, qty) => { setAccessType(t); setQuantity(qty); setStep(3) }}
            onBack={() => setStep(1)}
          />
        )}
        {step === 3 && customer && accessType && (
          <Step3Pagamento
            customer={customer}
            accessType={accessType}
            quantity={quantity}
            onSelect={(m, total, fee) => {
              setPaymentMethod(m); setTotalAmount(total); setFeeAmount(fee); setStep(4)
            }}
            onBack={() => setStep(2)}
          />
        )}
        {step === 4 && customer && accessType && paymentMethod && (
          <Step4Confirmacao
            customer={customer}
            accessType={accessType}
            quantity={quantity}
            paymentMethod={paymentMethod}
            baseAmount={accessType.price * quantity}
            feeAmount={feeAmount}
            totalAmount={totalAmount}
            onFinish={reset}
            onBack={() => setStep(3)}
          />
        )}
      </div>
    </div>
  )
}
