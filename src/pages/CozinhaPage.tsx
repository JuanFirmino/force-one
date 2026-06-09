import { useState, useEffect } from 'react'
import { ChefHat, Lock, Eye, EyeOff } from 'lucide-react'
import { CozinhaModule } from '../modules/cozinha/CozinhaModule'
import { verifyPassword } from '../lib/supabase'

const SESSION_KEY = 'kitchen_auth'

function PinScreen({ onAuth }: { onAuth: () => void }) {
  const [pin, setPin]         = useState('')
  const [show, setShow]       = useState(false)
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!pin.trim()) return
    setLoading(true)
    setError('')
    const result = await verifyPassword({ type: 'kitchen_pin', password: pin.trim() })
    setLoading(false)
    if (result.valid) {
      sessionStorage.setItem(SESSION_KEY, '1')
      onAuth()
    } else if (result.rateLimited) {
      setError('Muitas tentativas. Aguarde um momento.')
    } else {
      setError('PIN incorreto.')
      setPin('')
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      <div className="bg-gray-800 rounded-2xl shadow-2xl p-10 w-full max-w-sm flex flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 bg-orange-500 rounded-2xl flex items-center justify-center shadow-lg">
            <ChefHat size={32} className="text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white">Cozinha</h1>
            <p className="text-sm text-gray-400 mt-1">Force One</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-300 flex items-center gap-1.5">
              <Lock size={14} /> PIN de acesso
            </label>
            <div className="relative">
              <input
                type={show ? 'text' : 'password'}
                value={pin}
                onChange={e => { setPin(e.target.value); setError('') }}
                placeholder="••••"
                autoFocus
                className="w-full bg-gray-700 border-2 border-gray-600 rounded-xl px-4 py-3 pr-12 text-white placeholder-gray-500 focus:outline-none focus:border-orange-400 transition-colors text-center text-xl tracking-widest"
              />
              <button type="button" onClick={() => setShow(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200">
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}

          <button type="submit" disabled={loading || !pin.trim()}
            className="w-full py-3 bg-orange-500 text-white font-semibold rounded-xl hover:bg-orange-600 disabled:opacity-50 transition-colors">
            {loading ? 'Verificando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}

export function CozinhaPage() {
  const [authed, setAuthed] = useState(false)

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY) === '1') setAuthed(true)
  }, [])

  if (!authed) return <PinScreen onAuth={() => setAuthed(true)} />

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-gray-900 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-orange-500 rounded-xl flex items-center justify-center">
            <ChefHat size={18} className="text-white" />
          </div>
          <span className="text-white font-bold">Cozinha · Force One</span>
        </div>
        <button
          onClick={() => { sessionStorage.removeItem(SESSION_KEY); setAuthed(false) }}
          className="text-xs text-gray-400 hover:text-red-400 transition-colors px-2 py-1 rounded">
          Sair
        </button>
      </header>
      <main className="flex-1 overflow-auto">
        <CozinhaModule />
      </main>
    </div>
  )
}
