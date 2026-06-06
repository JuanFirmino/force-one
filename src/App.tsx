import { useState, useEffect, useRef } from 'react'
import { Target, Wifi, Eye, EyeOff, Lock } from 'lucide-react'
import { AcessoModule } from './modules/acesso/AcessoModule'
import { ConfiguracoesModule } from './modules/configuracoes/ConfiguracoesModule'
import { OperadoresModule } from './modules/operadores/OperadoresModule'
import { JogoModule } from './modules/jogo/JogoModule'
import { OcorrenciasModule } from './modules/ocorrencias/OcorrenciasModule'
import { VendaModule } from './modules/venda/VendaModule'
import { CozinhaModule } from './modules/cozinha/CozinhaModule'
import { EstoqueModule } from './modules/estoque/EstoqueModule'
import { CaixaModule } from './modules/caixa/CaixaModule'
import { UnitSelector } from './components/UnitSelector'
import { supabase } from './lib/supabase'


// ── Login Screen ───────────────────────────────────────────
function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [input, setInput] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim()) return
    setLoading(true)
    setError('')
    const { data, error: err } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'app_password')
      .single()
    setLoading(false)
    if (err || !data) { setError('Erro ao conectar. Verifique a conexão.'); return }
    if (data.value === input.trim()) {
      onLogin()
    } else {
      setError('Senha incorreta.')
      setInput('')
      inputRef.current?.focus()
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl p-10 w-full max-w-sm flex flex-col items-center gap-8">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 bg-green-500 rounded-2xl flex items-center justify-center shadow-lg">
            <Target size={32} className="text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-800">Force One</h1>
            <p className="text-sm text-gray-400 mt-1">Gestão de Campo</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-600 flex items-center gap-1.5">
              <Lock size={14} /> Senha de acesso
            </label>
            <div className="relative">
              <input
                ref={inputRef}
                type={show ? 'text' : 'password'}
                value={input}
                onChange={e => { setInput(e.target.value); setError('') }}
                placeholder="Digite sua senha"
                className="w-full border-2 rounded-xl px-4 py-3 pr-12 focus:outline-none focus:border-green-400 text-gray-800 transition-colors"
              />
              <button type="button" onClick={() => setShow(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-red-500 text-sm text-center">{error}</p>
          )}

          <button type="submit" disabled={loading || !input.trim()}
            className="w-full py-3 bg-green-500 text-white font-semibold rounded-xl hover:bg-green-600 disabled:opacity-50 transition-colors">
            {loading ? 'Verificando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Main App ───────────────────────────────────────────────
type Tab = 'acesso' | 'venda' | 'cozinha' | 'caixa' | 'estoque' | 'jogo' | 'operadores' | 'ocorrencias' | 'configuracoes'

const TABS: { id: Tab; label: string }[] = [
  { id: 'acesso',       label: 'Entrada' },
  { id: 'venda',        label: 'Venda' },
  { id: 'cozinha',      label: 'Cozinha' },
  { id: 'caixa',        label: 'Caixa' },
  { id: 'estoque',      label: 'Estoque' },
  { id: 'jogo',         label: 'Status dos Campos' },
  { id: 'operadores',   label: 'Operadores' },
  { id: 'ocorrencias',  label: 'Advertências' },
  { id: 'configuracoes',label: 'Configurações' },
]

export default function App() {
  const [tab, setTab] = useState<Tab>('acesso')
  const [loggedIn, setLoggedIn] = useState(false)

  if (!loggedIn) return <LoginScreen onLogin={() => setLoggedIn(true)} />

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-green-500 rounded-xl flex items-center justify-center">
            <Target size={20} className="text-white" />
          </div>
          <span className="text-xl font-bold text-gray-800">Force One</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 text-xs text-green-600">
            <Wifi size={14} />
            <span className="hidden sm:inline">Online</span>
          </div>
          <UnitSelector />
        </div>
      </header>

      <nav className="bg-white border-b border-gray-200 px-6">
        <div className="flex gap-1">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors
                ${tab === t.id
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="flex-1 overflow-auto">
        {tab === 'acesso' && <AcessoModule />}
        {tab === 'venda' && <VendaModule />}
        {tab === 'cozinha' && <CozinhaModule />}
        {tab === 'caixa' && <CaixaModule />}
        {tab === 'estoque' && <EstoqueModule />}
        {tab === 'jogo' && <JogoModule />}
        {tab === 'operadores' && <OperadoresModule />}
        {tab === 'ocorrencias' && <OcorrenciasModule />}
        {tab === 'configuracoes' && <ConfiguracoesModule />}
      </main>
    </div>
  )
}
