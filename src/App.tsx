import { useState, useEffect, useRef } from 'react'
import { Target, Wifi, Eye, EyeOff, Lock, User, LogOut } from 'lucide-react'
import { AcessoModule } from './modules/acesso/AcessoModule'
import { ConfiguracoesModule } from './modules/configuracoes/ConfiguracoesModule'
import { OperadoresModule } from './modules/operadores/OperadoresModule'
import { JogoModule } from './modules/jogo/JogoModule'
import { OcorrenciasModule } from './modules/ocorrencias/OcorrenciasModule'
import { VendaModule } from './modules/venda/VendaModule'
import { CozinhaModule } from './modules/cozinha/CozinhaModule'
import { EstoqueModule } from './modules/estoque/EstoqueModule'
import { CaixaModule } from './modules/caixa/CaixaModule'
import { UnitSelector, UnitSelectionScreen } from './components/UnitSelector'
import { useUnitStore } from './stores/unitStore'
import { useBarcodeScanStore } from './stores/barcodeScanStore'
import { useBarcodeScanner } from './hooks/useBarcodeScanner'
import { verifyPassword } from './lib/supabase'
import type { Unit } from './types'

// ── Rate limiter ────────────────────────────────────────────
const MAX_ATTEMPTS = 5
const LOCKOUT_MS   = 30_000

// ── Login Screen ───────────────────────────────────────────
interface LoginResult {
  permissions: Record<string, boolean>
  name: string
}

function LoginScreen({ onLogin }: { onLogin: (r: LoginResult) => void }) {
  const [login,    setLogin]    = useState('')
  const [password, setPassword] = useState('')
  const [show,     setShow]     = useState(false)
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [attempts, setAttempts] = useState(0)
  const [lockedUntil, setLockedUntil] = useState(0)
  const [remaining, setRemaining] = useState(0)
  const loginRef = useRef<HTMLInputElement>(null)

  useEffect(() => { loginRef.current?.focus() }, [])

  // Countdown para lockout
  useEffect(() => {
    if (lockedUntil <= 0) return
    const id = setInterval(() => {
      const left = Math.ceil((lockedUntil - Date.now()) / 1000)
      if (left <= 0) { setLockedUntil(0); setRemaining(0); setAttempts(0) }
      else setRemaining(left)
    }, 500)
    return () => clearInterval(id)
  }, [lockedUntil])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!password.trim()) return
    if (Date.now() < lockedUntil) return

    setLoading(true); setError('')

    const result = await verifyPassword({
      type: 'login',
      login: login.trim() || 'admin',
      password: password.trim(),
    })

    setLoading(false)

    if (result.valid) {
      onLogin({
        permissions: result.permissions ?? {},
        name: result.name ?? 'Usuário',
      })
    } else {
      if (result.rateLimited) {
        setLockedUntil(Date.now() + LOCKOUT_MS)
        setError('Muitas tentativas. Aguarde antes de tentar novamente.')
      } else {
        const next = attempts + 1
        setAttempts(next)
        if (next >= MAX_ATTEMPTS) {
          setLockedUntil(Date.now() + LOCKOUT_MS)
          setError(`Muitas tentativas. Aguarde 30 segundos.`)
        } else {
          setError(`Login ou senha incorretos. (${next}/${MAX_ATTEMPTS})`)
        }
      }
      setPassword('')
    }
  }

  const locked = Date.now() < lockedUntil

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl p-10 w-full max-w-sm flex flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 bg-green-500 rounded-2xl flex items-center justify-center shadow-lg">
            <Target size={32} className="text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-800">Force One</h1>
            <p className="text-sm text-gray-400 mt-1">Gestão de Campo</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-600 flex items-center gap-1.5">
              <User size={14} /> Login
            </label>
            <input
              ref={loginRef}
              type="text"
              value={login}
              onChange={e => { setLogin(e.target.value); setError('') }}
              placeholder="admin"
              autoComplete="username"
              className="w-full border-2 rounded-xl px-4 py-3 focus:outline-none focus:border-green-400 text-gray-800 transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-600 flex items-center gap-1.5">
              <Lock size={14} /> Senha
            </label>
            <div className="relative">
              <input
                type={show ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setError('') }}
                placeholder="••••••••"
                autoComplete="current-password"
                disabled={locked}
                className="w-full border-2 rounded-xl px-4 py-3 pr-12 focus:outline-none focus:border-green-400 text-gray-800 transition-colors disabled:bg-gray-50 disabled:text-gray-400"
              />
              <button type="button" onClick={() => setShow(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {locked && (
            <p className="text-orange-500 text-sm text-center font-medium">
              Aguarde {remaining}s para tentar novamente
            </p>
          )}
          {error && !locked && (
            <p className="text-red-500 text-sm text-center">{error}</p>
          )}

          <button type="submit" disabled={loading || locked || !password.trim()}
            className="w-full py-3 bg-green-500 text-white font-semibold rounded-xl hover:bg-green-600 disabled:opacity-50 transition-colors">
            {loading ? 'Verificando...' : locked ? `Bloqueado (${remaining}s)` : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Main App ───────────────────────────────────────────────
type Tab = 'acesso' | 'venda' | 'cozinha' | 'caixa' | 'estoque' | 'jogo' | 'operadores' | 'ocorrencias' | 'configuracoes'

const ALL_TABS: { id: Tab; label: string }[] = [
  { id: 'acesso',        label: 'Entrada' },
  { id: 'venda',         label: 'Venda' },
  { id: 'cozinha',       label: 'Cozinha' },
  { id: 'caixa',         label: 'Caixa' },
  { id: 'estoque',       label: 'Estoque' },
  { id: 'jogo',          label: 'Status dos Campos' },
  { id: 'operadores',    label: 'Operadores' },
  { id: 'ocorrencias',   label: 'Advertências' },
  { id: 'configuracoes', label: 'Configurações' },
]

export default function App() {
  const [tab, setTab]          = useState<Tab>('acesso')
  const [session, setSession_] = useState<LoginResult | null>(null)
  const { currentUnit, setCurrentUnit, clearUnit } = useUnitStore()
  const { setPendingBarcode } = useBarcodeScanStore()

  // Scanner global — ao bipar, vai para Venda e passa o código
  useBarcodeScanner({
    enabled: !!session && !!currentUnit,
    onScan: (code) => {
      setTab('venda')
      setPendingBarcode(code)
    },
  })

  function handleLogin(result: LoginResult) {
    setSession_(result)
    const first = ALL_TABS.find(t => result.permissions[t.id])
    if (first) setTab(first.id)
  }

  function handleLogout() {
    clearUnit()
    setSession_(null)
    setTab('acesso')
  }

  if (!session) return <LoginScreen onLogin={handleLogin} />

  // Após login, exige seleção de filial
  if (!currentUnit) return <UnitSelectionScreen onSelect={(u: Unit) => setCurrentUnit(u)} />

  // Filtra abas conforme permissões (admin com todas as perms vê tudo)
  const hasAllPerms = Object.values(session.permissions).every(Boolean)
  const visibleTabs = hasAllPerms
    ? ALL_TABS
    : ALL_TABS.filter(t => session.permissions[t.id])

  // Garante que a aba atual ainda está visível
  const currentTab = visibleTabs.find(t => t.id === tab) ? tab : (visibleTabs[0]?.id ?? 'acesso')

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
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <User size={14} />
            <span className="hidden sm:inline">{session.name}</span>
            <button onClick={handleLogout} title="Sair"
              className="p-1 hover:text-red-500 transition-colors">
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </header>

      <nav className="bg-white border-b border-gray-200 px-6">
        <div className="flex gap-1 overflow-x-auto">
          {visibleTabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap
                ${currentTab === t.id
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="flex-1 overflow-auto">
        {currentTab === 'acesso'        && <AcessoModule />}
        {currentTab === 'venda'         && <VendaModule />}
        {currentTab === 'cozinha'       && <CozinhaModule />}
        {currentTab === 'caixa'         && <CaixaModule />}
        {currentTab === 'estoque'       && <EstoqueModule />}
        {currentTab === 'jogo'          && <JogoModule />}
        {currentTab === 'operadores'    && <OperadoresModule />}
        {currentTab === 'ocorrencias'   && <OcorrenciasModule />}
        {currentTab === 'configuracoes' && <ConfiguracoesModule />}
      </main>
    </div>
  )
}
