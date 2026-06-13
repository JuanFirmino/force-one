import { useState, useEffect, useCallback } from 'react'
import { Eye, EyeOff, Lock, Users, RefreshCw, LogOut, Target, MapPin, Clock, Shield, Calendar } from 'lucide-react'
import { verifyPassword } from '../lib/supabase'
import { supabase } from '../lib/supabase'

const SESSION_KEY = 'ninja_auth'

/* ── types ─────────────────────────────────────────── */
interface Player {
  id: string
  name: string
  photo_url?: string
  visited_at: string
  teams: string[]
}

interface FieldGroup {
  unit_id: string
  unit_name: string
  players: Player[]
}

interface UnitOption { id: string; name: string }

type DayMode = 'hoje' | 'ontem' | 'data'

/* ── PIN screen ─────────────────────────────────────── */
function PinScreen({ onAuth }: { onAuth: () => void }) {
  const [pwd, setPwd]       = useState('')
  const [show, setShow]     = useState(false)
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!pwd.trim()) return
    setLoading(true)
    setError('')
    const result = await verifyPassword({ type: 'ninja_password', password: pwd.trim() })
    setLoading(false)
    if (result.valid) {
      sessionStorage.setItem(SESSION_KEY, '1')
      onAuth()
    } else if (result.rateLimited) {
      setError('Muitas tentativas. Aguarde um momento.')
    } else {
      setError('Senha incorreta.')
      setPwd('')
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="bg-gray-900 rounded-2xl shadow-2xl p-10 w-full max-w-sm flex flex-col items-center gap-8 border border-gray-800">
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center shadow-lg border border-gray-700">
            <Target size={30} className="text-green-400" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white">Ninja</h1>
            <p className="text-sm text-gray-500 mt-1">Acesso restrito</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-400 flex items-center gap-1.5">
              <Lock size={13} /> Senha
            </label>
            <div className="relative">
              <input
                autoFocus
                type={show ? 'text' : 'password'}
                value={pwd}
                onChange={e => { setPwd(e.target.value); setError('') }}
                placeholder="••••••••"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 pr-12 text-white placeholder-gray-600 focus:outline-none focus:border-green-500 transition-colors"
              />
              <button type="button" onClick={() => setShow(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                {show ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}

          <button type="submit" disabled={loading || !pwd.trim()}
            className="w-full py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-500 disabled:opacity-40 transition-colors">
            {loading ? 'Verificando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}

/* ── Dashboard ──────────────────────────────────────── */
function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function NinjaDashboard({ onLogout }: { onLogout: () => void }) {
  const [fields, setFields]     = useState<FieldGroup[]>([])
  const [units, setUnits]       = useState<UnitOption[]>([])
  const [loading, setLoading]   = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  // filtros
  const [dayMode, setDayMode]     = useState<DayMode>('hoje')
  const [customDate, setCustomDate] = useState<string>(todayStr())
  const [unitFilter, setUnitFilter] = useState<string>('all')

  // carrega filiais uma vez (para o seletor)
  useEffect(() => {
    supabase.from('units').select('id, name').order('name').then(({ data }) => {
      const opts = (data ?? []).map((u: any) => ({
        id: u.id,
        name: u.name.replace('Force One - ', '').replace('Force One', '').trim() || u.name,
      }))
      setUnits(opts)
      // Mooca selecionada por padrão, se existir
      const mooca = opts.find((u: UnitOption) => u.name.toLowerCase().includes('mooca'))
      if (mooca) setUnitFilter(mooca.id)
    })
  }, [])

  const load = useCallback(async () => {
    setLoading(true)

    // resolve o dia selecionado
    const base = new Date()
    base.setHours(0, 0, 0, 0)
    if (dayMode === 'ontem') base.setDate(base.getDate() - 1)
    else if (dayMode === 'data') {
      const [y, m, d] = customDate.split('-').map(Number)
      base.setFullYear(y, m - 1, d)
    }
    const startIso = base.toISOString()
    const endIso   = new Date(base.getTime() + 86400000 - 1).toISOString()

    const [visitsRes, unitsRes] = await Promise.all([
      supabase
        .from('visits')
        .select('id, visited_at, customer_id, unit_id, customers(name, photo_url, customer_teams(teams(name)))')
        .gte('visited_at', startIso)
        .lte('visited_at', endIso)
        .order('visited_at', { ascending: true }),
      supabase.from('units').select('id, name').order('name'),
    ])

    let visits: any[] = visitsRes.data ?? []
    const unitsData: any[] = unitsRes.data ?? []

    // aplica filtro de filial
    if (unitFilter !== 'all') {
      visits = visits.filter(v => v.unit_id === unitFilter)
    }

    // monta mapa de filiais
    const unitMap = new Map<string, FieldGroup>()
    unitsData
      .filter(u => unitFilter === 'all' || u.id === unitFilter)
      .forEach(u => {
        unitMap.set(u.id, {
          unit_id: u.id,
          unit_name: u.name.replace('Force One - ', '').replace('Force One', '').trim() || u.name,
          players: [],
        })
      })

    visits.forEach(v => {
      const teams: string[] = (v.customers?.customer_teams ?? [])
        .map((ct: any) => ct.teams?.name)
        .filter(Boolean)
      const player: Player = {
        id: v.id,
        name: v.customers?.name ?? 'Visitante',
        photo_url: v.customers?.photo_url,
        visited_at: v.visited_at,
        teams,
      }
      if (v.unit_id && unitMap.has(v.unit_id)) {
        unitMap.get(v.unit_id)!.players.push(player)
      } else {
        if (!unitMap.has('none')) {
          unitMap.set('none', { unit_id: 'none', unit_name: 'Sem campo', players: [] })
        }
        unitMap.get('none')!.players.push(player)
      }
    })

    const grouped = [...unitMap.values()].filter(f => f.players.length > 0)
    setFields(grouped)
    setLastUpdate(new Date())
    setLoading(false)
  }, [dayMode, customDate, unitFilter])

  useEffect(() => {
    load()
    // auto-refresh só faz sentido para "hoje"
    if (dayMode !== 'hoje') return
    const interval = setInterval(load, 60_000)
    return () => clearInterval(interval)
  }, [load, dayMode])

  const totalPlayers = fields.reduce((sum, f) => sum + f.players.length, 0)

  function initials(name: string) {
    return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
  }

  function arrivalTime(iso: string) {
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur border-b border-gray-800 px-4 sm:px-6 py-3 sm:py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 sm:w-9 sm:h-9 bg-gray-800 rounded-lg flex items-center justify-center border border-gray-700 shrink-0">
              <Target size={16} className="text-green-400" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-white leading-tight">Ninja</h1>
              {lastUpdate && (
                <p className="text-[11px] sm:text-xs text-gray-500">
                  Atualizado às {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <button onClick={load} disabled={loading}
              className="p-2 text-gray-500 hover:text-green-400 hover:bg-gray-800 rounded-xl transition-colors disabled:opacity-40">
              <RefreshCw size={17} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={onLogout}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 text-sm text-gray-500 hover:text-red-400 hover:bg-gray-800 rounded-xl transition-colors">
              <LogOut size={15} /> <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </header>

      <div className="px-4 sm:px-6 py-5 sm:py-7 max-w-6xl mx-auto flex flex-col gap-5 sm:gap-6">

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          {/* Dia */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex bg-gray-900 border border-gray-800 rounded-xl p-1">
              {([['hoje', 'Hoje'], ['ontem', 'Ontem'], ['data', 'Data']] as const).map(([mode, label]) => (
                <button key={mode} onClick={() => setDayMode(mode)}
                  className={`px-3 sm:px-4 py-1.5 text-sm font-semibold rounded-lg transition-colors
                    ${dayMode === mode ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                  {label}
                </button>
              ))}
            </div>
            {dayMode === 'data' && (
              <div className="relative">
                <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                <input
                  type="date"
                  value={customDate}
                  max={todayStr()}
                  onChange={e => setCustomDate(e.target.value)}
                  className="bg-gray-900 border border-gray-800 rounded-xl pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-green-500 [color-scheme:dark]"
                />
              </div>
            )}
          </div>

          {/* Filial */}
          <div className="relative">
            <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            <select
              value={unitFilter}
              onChange={e => setUnitFilter(e.target.value)}
              className="appearance-none bg-gray-900 border border-gray-800 rounded-xl pl-9 pr-9 py-2 text-sm font-medium text-white focus:outline-none focus:border-green-500 cursor-pointer w-full sm:w-auto">
              <option value="all">Todas as filiais</option>
              {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <svg className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        {/* Cards de resumo */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl px-4 sm:px-6 py-4 sm:py-5 flex items-center gap-3 sm:gap-4">
            <div className="w-11 h-11 sm:w-12 sm:h-12 bg-green-500/10 border border-green-500/20 rounded-2xl flex items-center justify-center shrink-0">
              <Users size={20} className="text-green-400" />
            </div>
            <div className="min-w-0">
              <p className="text-2xl sm:text-3xl font-black text-white leading-none">{totalPlayers}</p>
              <p className="text-xs sm:text-sm text-gray-400 mt-1 leading-tight">jogador{totalPlayers !== 1 ? 'es' : ''} em campo</p>
            </div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl px-4 sm:px-6 py-4 sm:py-5 flex items-center gap-3 sm:gap-4">
            <div className="w-11 h-11 sm:w-12 sm:h-12 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-center justify-center shrink-0">
              <MapPin size={20} className="text-blue-400" />
            </div>
            <div className="min-w-0">
              <p className="text-2xl sm:text-3xl font-black text-white leading-none">{fields.length}</p>
              <p className="text-xs sm:text-sm text-gray-400 mt-1 leading-tight">campo{fields.length !== 1 ? 's' : ''} ativo{fields.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
        </div>

        {/* Loading */}
        {loading && fields.length === 0 && (
          <div className="text-center py-16 text-gray-600">
            <RefreshCw size={28} className="mx-auto mb-3 animate-spin opacity-50" />
            <p className="text-sm">Carregando...</p>
          </div>
        )}

        {/* Nenhum jogador */}
        {!loading && fields.length === 0 && (
          <div className="text-center py-16 text-gray-600">
            <Users size={36} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">
              Nenhum jogador {dayMode === 'hoje' ? 'em campo hoje' : dayMode === 'ontem' ? 'no dia de ontem' : 'nesta data'}
            </p>
          </div>
        )}

        {/* Por campo — grid responsivo */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 items-start">
          {fields.map(field => (
            <div key={field.unit_id} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              {/* Header do campo */}
              <div className="px-4 sm:px-5 py-3.5 sm:py-4 border-b border-gray-800 flex items-center justify-between bg-gray-900/50">
                <h2 className="text-sm sm:text-base font-bold text-white truncate pr-2">{field.unit_name}</h2>
                <span className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-green-400 bg-green-400/10 px-2.5 sm:px-3 py-1 rounded-full shrink-0">
                  <Users size={13} /> {field.players.length}
                </span>
              </div>

              {/* Lista de jogadores */}
              <div className="divide-y divide-gray-800/60 max-h-[420px] overflow-y-auto">
                {field.players.map((p) => (
                  <div key={p.id} className="px-4 sm:px-5 py-2.5 sm:py-3 flex items-center gap-3 hover:bg-gray-800/40 transition-colors">
                    {/* Avatar */}
                    {p.photo_url ? (
                      <img src={p.photo_url} className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover shrink-0 ring-1 ring-gray-700" />
                    ) : (
                      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center shrink-0 text-xs font-bold text-gray-400">
                        {initials(p.name)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-200 truncate">{p.name}</p>
                      {p.teams.length > 0 ? (
                        <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                          <Shield size={10} className="text-gray-500 shrink-0" />
                          {p.teams.map(t => (
                            <span key={t} className="text-[11px] leading-tight text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded">{t}</span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px] text-gray-600 mt-0.5">Sem time</p>
                      )}
                    </div>
                    <span className="flex items-center gap-1 text-xs text-gray-500 shrink-0 tabular-nums">
                      <Clock size={11} /> {arrivalTime(p.visited_at)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── Page ───────────────────────────────────────────── */
export function NinjaPage() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem(SESSION_KEY) === '1')

  function handleLogout() {
    sessionStorage.removeItem(SESSION_KEY)
    setAuthed(false)
  }

  if (!authed) return <PinScreen onAuth={() => setAuthed(true)} />
  return <NinjaDashboard onLogout={handleLogout} />
}
