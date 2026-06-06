import { useEffect, useState, useRef } from 'react'
import {
  Search, Pencil, Trash2, X, Check, ChevronRight, Users,
  CalendarDays, Clock, TrendingUp, Banknote, ShieldCheck, Repeat2, Star,
  Camera, RotateCcw, AlertTriangle
} from 'lucide-react'
import Webcam from 'react-webcam'
import { dataService } from '../../lib/dataService'
import { supabase } from '../../lib/supabase'
import { TeamSelector } from '../../components/TeamSelector'
import type { Customer } from '../../types'

/* ── helpers ─────────────────────────────────────── */
function formatCPF(v: string) {
  return v.replace(/\D/g, '').slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}
function formatWhatsApp(v: string) {
  return v.replace(/\D/g, '').slice(0, 11)
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2')
}
function displayCPF(v?: string) {
  if (!v) return '—'
  return v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}
function displayWA(v?: string) {
  if (!v) return '—'
  return v.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
}
const DAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

/* ── types ────────────────────────────────────────── */
interface VisitRow {
  id: string
  visited_at: string
  total_amount: number
  access_types: { name: string } | null
  payment_methods: { name: string } | null
  unit: { name: string } | null
}

interface Stats {
  total: number
  totalSpent: number
  avgTicket: number
  firstVisit: string
  lastVisit: string
  daysSinceLastVisit: number
  topDay: string
  avgHour: string
  topAccessType: string
  topPayment: string
  avgIntervalDays: number | null
  streak: number
}

function computeStats(visits: VisitRow[]): Stats | null {
  if (!visits.length) return null

  const sorted = [...visits].sort((a, b) => new Date(a.visited_at).getTime() - new Date(b.visited_at).getTime())

  const total = visits.length
  const totalSpent = visits.reduce((s, v) => s + (v.total_amount ?? 0), 0)
  const avgTicket = totalSpent / total

  const firstVisit = new Date(sorted[0].visited_at).toLocaleDateString('pt-BR')
  const lastVisit = new Date(sorted[sorted.length - 1].visited_at).toLocaleDateString('pt-BR')
  const daysSinceLastVisit = Math.floor((Date.now() - new Date(sorted[sorted.length - 1].visited_at).getTime()) / 86400000)

  // top day of week
  const dayCount: Record<number, number> = {}
  visits.forEach(v => {
    const d = new Date(v.visited_at).getDay()
    dayCount[d] = (dayCount[d] ?? 0) + 1
  })
  const topDayNum = Number(Object.entries(dayCount).sort((a, b) => b[1] - a[1])[0][0])
  const topDay = DAYS[topDayNum]

  // avg hour
  const totalMinutes = visits.reduce((s, v) => {
    const d = new Date(v.visited_at)
    return s + d.getHours() * 60 + d.getMinutes()
  }, 0)
  const avgMin = Math.round(totalMinutes / total)
  const avgHour = `${String(Math.floor(avgMin / 60)).padStart(2, '0')}:${String(avgMin % 60).padStart(2, '0')}`

  // top access type
  const atCount: Record<string, number> = {}
  visits.forEach(v => { const n = v.access_types?.name ?? 'N/A'; atCount[n] = (atCount[n] ?? 0) + 1 })
  const topAccessType = Object.entries(atCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'

  // top payment
  const pmCount: Record<string, number> = {}
  visits.forEach(v => { const n = v.payment_methods?.name ?? 'N/A'; pmCount[n] = (pmCount[n] ?? 0) + 1 })
  const topPayment = Object.entries(pmCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'

  // avg interval
  let avgIntervalDays: number | null = null
  if (sorted.length >= 2) {
    const intervals = sorted.slice(1).map((v, i) =>
      (new Date(v.visited_at).getTime() - new Date(sorted[i].visited_at).getTime()) / 86400000
    )
    avgIntervalDays = Math.round(intervals.reduce((s, x) => s + x, 0) / intervals.length)
  }

  // streak: consecutive months with at least 1 visit
  const monthSet = new Set(visits.map(v => {
    const d = new Date(v.visited_at)
    return `${d.getFullYear()}-${d.getMonth()}`
  }))
  let streak = 0
  const now = new Date()
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    if (monthSet.has(`${d.getFullYear()}-${d.getMonth()}`)) streak++
    else break
  }

  return { total, totalSpent, avgTicket, firstVisit, lastVisit, daysSinceLastVisit, topDay, avgHour, topAccessType, topPayment, avgIntervalDays, streak }
}

/* ── component ───────────────────────────────────── */
type View = 'list' | 'detail'

export function OperadoresModule() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [view, setView] = useState<View>('list')
  const [selected, setSelected] = useState<Customer | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [visits, setVisits] = useState<VisitRow[]>([])
  const [loadingStats, setLoadingStats] = useState(false)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Partial<Customer>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showCam, setShowCam] = useState(false)
  const [newPhoto, setNewPhoto] = useState<string | null>(null)
  const webcamRef = useRef<Webcam>(null)
  const [customerTeamIds, setCustomerTeamIds] = useState<string[]>([])
  const [customerTeams, setCustomerTeams] = useState<{ id: string; name: string }[]>([])
  const [customerInfractions, setCustomerInfractions] = useState<any[]>([])
  const [customerSales, setCustomerSales] = useState<any[]>([])

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const result = await dataService.from('customers').select('*').execute()
    const sorted = (result.data ?? []).sort((a: any, b: any) => a.name.localeCompare(b.name))
    setCustomers(sorted)
    setLoading(false)
  }

  const q = query.trim().toLowerCase()
  const qDigits = query.replace(/\D/g, '')
  const filtered = customers.filter(c =>
    !q ||
    (c.name ?? '').toLowerCase().includes(q) ||
    (qDigits && (c.cpf ?? '').includes(qDigits)) ||
    (qDigits && (c.whatsapp ?? '').includes(qDigits)) ||
    (c.email ?? '').toLowerCase().includes(q)
  )

  async function openDetail(c: Customer) {
    setSelected(c)
    setForm({
      name: c.name, cpf: displayCPF(c.cpf), whatsapp: displayWA(c.whatsapp),
      birth_date: c.birth_date, gender: c.gender ?? '', email: c.email ?? '',
      play_style: c.play_style ?? '', weapon_type: c.weapon_type ?? '',
      is_legacy: c.is_legacy ?? false,
      is_star: c.is_star ?? false,
    })
    setEditing(false); setConfirmDelete(false); setError('')
    setNewPhoto(null)
    setView('detail')

    // Carrega times do cliente
    const { data: ctData } = await supabase
      .from('customer_teams')
      .select('team_id, teams(id, name)')
      .eq('customer_id', c.id)
    const teams = (ctData ?? []).map((r: any) => r.teams).filter(Boolean)
    setCustomerTeamIds(teams.map((t: any) => t.id))
    setCustomerTeams(teams)

    // Carrega advertências do cliente
    const { data: infraData } = await supabase
      .from('infractions')
      .select('*, units(name)')
      .eq('customer_id', c.id)
      .order('created_at', { ascending: false })
    setCustomerInfractions(infraData ?? [])

    // Carrega vendas do cliente
    const { data: salesData } = await supabase
      .from('sales')
      .select('*, sale_items(*), payment_methods(name), units(name)')
      .eq('customer_id', c.id)
      .order('created_at', { ascending: false })
    setCustomerSales(salesData ?? [])

    setLoadingStats(true)
    const visitsResult = await dataService.from('visits').select('*').eq('customer_id', c.id).order('visited_at', { ascending: false }).execute()
    const accessTypesResult = await dataService.from('access_types').select('*').execute()
    const paymentMethodsResult = await dataService.from('payment_methods').select('*').execute()
    const unitsResult = await dataService.from('units').select('*').execute()

    const accessTypesMap  = new Map((accessTypesResult.data ?? []).map((a: any) => [a.id, a]))
    const paymentMethodsMap = new Map((paymentMethodsResult.data ?? []).map((p: any) => [p.id, p]))
    const unitsMap        = new Map((unitsResult.data ?? []).map((u: any) => [u.id, u]))

    const rows = (visitsResult.data ?? []).map((v: any) => ({
      ...v,
      access_types:    accessTypesMap.get(v.access_type_id),
      payment_methods: paymentMethodsMap.get(v.payment_method_id),
      unit:            unitsMap.get(v.unit_id) ?? null,
    })) as VisitRow[]

    setStats(computeStats(rows))
    setVisits(rows)
    setLoadingStats(false)
  }

  async function handleSave() {
    setError('')
    if (!form.name?.trim()) { setError('Nome é obrigatório.'); return }
    setSaving(true)
    const updated = {
      name: form.name?.trim(),
      cpf: form.cpf?.replace(/\D/g, ''),
      whatsapp: form.whatsapp?.replace(/\D/g, ''),
      birth_date: form.birth_date,
      gender: form.gender || null,
      email: form.email?.trim() || null,
      play_style: form.play_style || null,
      weapon_type: form.weapon_type || null,
      is_legacy: form.is_legacy ?? false,
      is_star: form.is_star ?? false,
      ...(newPhoto ? { photo_url: newPhoto } : {}),
    }
    const result = await dataService.from('customers').update(updated).eq('id', selected!.id).execute()
    setSaving(false)
    if (result.error) { setError(String(result.error)); return }
    setSelected(prev => prev ? { ...prev, ...updated } : prev)

    // Atualiza times: remove todos e reinserve os selecionados
    await supabase.from('customer_teams').delete().eq('customer_id', selected!.id)
    if (customerTeamIds.length > 0) {
      await supabase.from('customer_teams').insert(
        customerTeamIds.map(team_id => ({ customer_id: selected!.id, team_id }))
      )
    }
    // Atualiza lista de times exibida no perfil
    const { data: ctData } = await supabase
      .from('customer_teams')
      .select('team_id, teams(id, name)')
      .eq('customer_id', selected!.id)
    const teams = (ctData ?? []).map((r: any) => r.teams).filter(Boolean)
    setCustomerTeamIds(teams.map((t: any) => t.id))
    setCustomerTeams(teams)

    setNewPhoto(null)
    setShowCam(false)
    await load()
    setEditing(false)
  }

  async function handleDelete() {
    if (!selected) return
    await dataService.from('visits').delete().eq('customer_id', selected.id).execute()
    await dataService.from('customers').delete().eq('id', selected.id).execute()
    await load()
    setView('list')
  }

  async function deleteInfraction(id: string) {
    await supabase.from('infractions').delete().eq('id', id)
    setCustomerInfractions(prev => prev.filter((i: any) => i.id !== id))
  }

  /* ── LIST ──────────────────────────────────────── */
  if (view === 'list') {
    return (
      <div className="flex flex-col gap-5 px-4 py-8 max-w-2xl mx-auto">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Cadastros</h2>
            <p className="text-sm text-gray-400">{customers.length} cliente{customers.length !== 1 ? 's' : ''} cadastrado{customers.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={load} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-gray-500 hover:border-green-400 hover:text-green-600 text-sm transition-colors disabled:opacity-50">
            <RotateCcw size={14} className={loading ? 'animate-spin' : ''} /> Atualizar
          </button>
        </div>
        <div className="relative">
          <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Buscar por nome, CPF ou WhatsApp..."
            className="w-full border rounded-xl pl-11 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-400" />
        </div>
        {loading ? (
          <p className="text-center text-gray-400 py-12">Carregando...</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Users size={48} className="mx-auto mb-3 opacity-30" />
            <p>{query ? 'Nenhum resultado encontrado.' : 'Nenhum cliente cadastrado.'}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map(c => (
              <button key={c.id} onClick={() => openDetail(c)}
                className="flex items-center justify-between p-4 bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:border-green-300 transition-all text-left">
                <div className="flex items-center gap-4">
                  {c.photo_url
                    ? <img src={c.photo_url} className="w-11 h-11 rounded-full object-cover shrink-0" />
                    : <div className="w-11 h-11 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold text-lg shrink-0">{c.name[0].toUpperCase()}</div>
                  }
                  <div>
                    <p className="font-semibold text-gray-800">{c.name}</p>
                    <p className="text-xs text-gray-400">{displayCPF(c.cpf)} · {displayWA(c.whatsapp)}</p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-gray-300 shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  /* ── DETAIL ────────────────────────────────────── */
  return (
    <div className="flex flex-col gap-5 px-4 py-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <button onClick={() => setView('list')} className="text-gray-400 hover:text-gray-600 text-xl">←</button>
        <h2 className="text-2xl font-bold text-gray-800">{editing ? 'Editar Cadastro' : selected?.name}</h2>
        {!editing && (
          <div className="ml-auto flex gap-2">
            <button onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-gray-600 hover:border-green-400 hover:text-green-600 text-sm font-medium">
              <Pencil size={14} /> Editar
            </button>
            <button onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-200 text-red-500 hover:bg-red-50 text-sm font-medium">
              <Trash2 size={14} /> Excluir
            </button>
          </div>
        )}
      </div>

      {confirmDelete && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center justify-between gap-4">
          <p className="text-red-700 font-medium text-sm">Excluir <strong>{selected?.name}</strong> e todo o histórico de visitas permanentemente?</p>
          <div className="flex gap-2 shrink-0">
            <button onClick={() => setConfirmDelete(false)} className="px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 text-sm">Cancelar</button>
            <button onClick={handleDelete} className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-sm font-semibold">Excluir</button>
          </div>
        </div>
      )}

      {!editing && selected && (
        <>
          {/* Foto + nome */}
          <div className="flex items-center gap-5">
            {selected.photo_url
              ? <img src={selected.photo_url} className="w-20 h-20 rounded-full object-cover border-4 border-green-400 shrink-0" />
              : <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold text-3xl shrink-0">{selected.name[0].toUpperCase()}</div>
            }
            <div>
              <p className="text-xl font-bold text-gray-800">{selected.name}</p>
              <p className="text-sm text-gray-400">{displayCPF(selected.cpf)}</p>
              <p className="text-sm text-gray-400">{displayWA(selected.whatsapp)}</p>
            </div>
          </div>

          {/* Métricas de frequência */}
          {loadingStats ? (
            <p className="text-center text-gray-400 py-4 text-sm">Carregando métricas...</p>
          ) : stats ? (
            <>
              {/* Cards principais */}
              <div className="grid grid-cols-2 gap-3">
                <MetricCard icon={<CalendarDays size={20} className="text-green-500" />} label="Total de visitas" value={`${stats.total}`} sub="desde o cadastro" />
                <MetricCard icon={<Banknote size={20} className="text-green-500" />} label="Total gasto" value={`R$ ${stats.totalSpent.toFixed(2).replace('.', ',')}`} sub={`média R$ ${stats.avgTicket.toFixed(2).replace('.', ',')} / visita`} />
                <MetricCard icon={<TrendingUp size={20} className="text-blue-500" />} label="Último acesso" value={stats.lastVisit} sub={`${stats.daysSinceLastVisit === 0 ? 'hoje' : `há ${stats.daysSinceLastVisit} dia${stats.daysSinceLastVisit !== 1 ? 's' : ''}`}`} />
                <MetricCard icon={<Repeat2 size={20} className="text-purple-500" />} label="Intervalo médio" value={stats.avgIntervalDays != null ? `${stats.avgIntervalDays} dias` : '—'} sub="entre visitas" />
                <MetricCard icon={<CalendarDays size={20} className="text-orange-400" />} label="Dia favorito" value={stats.topDay} sub="mais visitas nesse dia" />
                <MetricCard icon={<Clock size={20} className="text-orange-400" />} label="Horário médio" value={stats.avgHour} sub="de chegada" />
                <MetricCard icon={<ShieldCheck size={20} className="text-teal-500" />} label="Acesso preferido" value={stats.topAccessType} sub="tipo mais usado" />
                <MetricCard icon={<Banknote size={20} className="text-teal-500" />} label="Pagamento preferido" value={stats.topPayment} sub="método mais usado" />
              </div>

              {/* Linha de sequência + primeira visita */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Star size={18} className="text-yellow-400" />
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{stats.streak} {stats.streak === 1 ? 'mês consecutivo' : 'meses consecutivos'}</p>
                    <p className="text-xs text-gray-400">sequência de frequência</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-800">{stats.firstVisit}</p>
                  <p className="text-xs text-gray-400">primeira visita</p>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-gray-50 rounded-2xl p-6 text-center text-gray-400 text-sm">Nenhuma visita registrada ainda.</div>
          )}

          {/* Histórico de compras */}
          {customerSales.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">
                Histórico de compras ({customerSales.length})
              </p>
              <div className="flex flex-col gap-2">
                {customerSales.map((s: any) => {
                  const d = new Date(s.created_at)
                  return (
                    <div key={s.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="text-sm font-semibold text-gray-800">
                            {d.toLocaleDateString('pt-BR')}
                            <span className="ml-2 text-xs font-normal text-gray-400">
                              {d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {s.payment_methods?.name ?? '—'} · {s.units?.name?.replace('Force One - ', '') ?? '—'}
                          </p>
                        </div>
                        <span className="font-bold text-green-600">
                          R$ {Number(s.total_amount).toFixed(2).replace('.', ',')}
                        </span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        {(s.sale_items ?? []).map((item: any) => (
                          <div key={item.id} className="flex justify-between text-xs text-gray-500">
                            <span>{item.quantity}x {item.product_name}</span>
                            <span>R$ {Number(item.subtotal).toFixed(2).replace('.', ',')}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Dados do cadastro */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">Dados do cadastro</p>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-50">
              <Row label="Data de nascimento" value={selected.birth_date ? new Date(selected.birth_date + 'T00:00:00').toLocaleDateString('pt-BR') : '—'} />
              <Row label="Sexo" value={selected.gender === 'M' ? 'Masculino' : selected.gender === 'F' ? 'Feminino' : selected.gender === 'O' ? 'Outro' : '—'} />
              <Row label="E-mail" value={selected.email || '—'} />
              <Row label="Estilo de jogo" value={selected.play_style || '—'} />
              <Row label="Tipo de arma" value={selected.weapon_type || '—'} />
              <Row label="Histórico anterior" value={selected.is_legacy ? '✅ Já visitava o campo' : 'Cadastro novo'} />
              <Row label="Classificação" value={selected.is_star ? '⭐ Operador Estrela' : 'Operador padrão'} />
            </div>
          </div>

          {/* Times */}
          {customerTeams.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">Times</p>
              <div className="flex flex-wrap gap-2">
                {customerTeams.map(t => (
                  <span key={t.id} className="px-3 py-1.5 bg-green-50 border border-green-200 text-green-700 rounded-xl text-sm font-medium">
                    {t.name}
                  </span>
                ))}
              </div>
            </div>
          )}


          {/* Advertências */}
          {customerInfractions.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">
                Advertências ({customerInfractions.length})
              </p>
              <div className="flex flex-col gap-2">
                {customerInfractions.map((inf: any) => (
                  <div key={inf.id} className="bg-white rounded-2xl border border-orange-100 shadow-sm p-4 flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm text-gray-800 flex-1">{inf.description}</p>
                      <button
                        onClick={() => deleteInfraction(inf.id)}
                        className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                        title="Excluir advertência">
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-xs text-gray-400">
                        📅 {new Date(inf.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </span>
                      <span className="text-xs text-gray-400">
                        🕐 {new Date(inf.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {inf.units?.name && (
                        <span className="text-xs text-green-600 font-medium">
                          📍 {inf.units.name.replace('Force One - ', '')}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Histórico de visitas */}
          {!loadingStats && visits.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">Histórico de visitas</p>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Data</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Dia</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Campo</th>
                      <th className="text-right px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Valor pago</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {visits.map(v => {
                      const d = new Date(v.visited_at)
                      return (
                        <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-5 py-3 text-gray-800 font-medium">
                            {d.toLocaleDateString('pt-BR')}
                            <span className="ml-2 text-xs text-gray-400">{d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                          </td>
                          <td className="px-4 py-3 text-gray-500">{DAYS[d.getDay()]}</td>
                          <td className="px-4 py-3 text-xs text-green-600 font-medium">
                            {v.unit?.name?.replace('Force One - ', '') ?? '—'}
                          </td>
                          <td className="px-5 py-3 text-right font-bold text-green-600">
                            R$ {v.total_amount.toFixed(2).replace('.', ',')}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-100 bg-gray-50">
                      <td colSpan={3} className="px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Total</td>
                      <td className="px-5 py-3 text-right font-bold text-gray-800">
                        R$ {visits.reduce((s, v) => s + v.total_amount, 0).toFixed(2).replace('.', ',')}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Editing form */}
      {editing && (
        <div className="flex flex-col gap-4">

          {/* Foto */}
          <div className="flex flex-col items-center gap-3">
            {showCam ? (
              <div className="flex flex-col items-center gap-3">
                <Webcam ref={webcamRef} screenshotFormat="image/jpeg"
                  className="rounded-xl w-64 h-48 object-cover bg-black" />
                <div className="flex gap-2">
                  <button type="button" onClick={() => {
                    const src = webcamRef.current?.getScreenshot()
                    if (src) { setNewPhoto(src); setShowCam(false) }
                  }} className="px-4 py-2 bg-green-500 text-white rounded-xl flex items-center gap-2 text-sm">
                    <Camera size={14} /> Capturar
                  </button>
                  <button type="button" onClick={() => setShowCam(false)}
                    className="px-4 py-2 border rounded-xl text-gray-600 text-sm">Cancelar</button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                {(newPhoto ?? selected?.photo_url) ? (
                  <img src={newPhoto ?? selected?.photo_url ?? ''} className="w-20 h-20 rounded-full object-cover border-4 border-green-400" />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center text-2xl font-bold text-gray-400">
                    {selected?.name[0]}
                  </div>
                )}
                <button type="button" onClick={() => setShowCam(true)}
                  className="flex items-center gap-1.5 text-sm text-green-600 hover:text-green-700 font-medium">
                  <RotateCcw size={14} /> Trocar foto
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="text-sm text-gray-600 mb-1 block">Nome completo *</label>
            <input value={form.name ?? ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full border rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-400" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-600 mb-1 block">CPF</label>
              <input value={form.cpf ?? ''}
                onChange={e => setForm(f => ({ ...f, cpf: formatCPF(e.target.value) }))}
                placeholder="000.000.000-00"
                className="w-full border rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-400" />
            </div>
            <div>
              <label className="text-sm text-gray-600 mb-1 block">WhatsApp</label>
              <input value={form.whatsapp ?? ''}
                onChange={e => setForm(f => ({ ...f, whatsapp: formatWhatsApp(e.target.value) }))}
                placeholder="(00) 00000-0000"
                className="w-full border rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-400" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Data de nascimento</label>
              <input type="date" value={form.birth_date ?? ''}
                onChange={e => setForm(f => ({ ...f, birth_date: e.target.value }))}
                className="w-full border rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-400" />
            </div>
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Sexo</label>
              <select value={form.gender ?? ''} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}
                className="w-full border rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-400 bg-white">
                <option value="">Selecionar</option>
                <option value="M">Masculino</option>
                <option value="F">Feminino</option>
                <option value="O">Outro</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-sm text-gray-600 mb-1 block">E-mail</label>
            <input value={form.email ?? ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className="w-full border rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-400" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Estilo de jogo</label>
              <select value={form.play_style ?? ''} onChange={e => setForm(f => ({ ...f, play_style: e.target.value }))}
                className="w-full border rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-400 bg-white">
                <option value="">Selecionar</option>
                <option value="Milsim">Milsim</option>
                <option value="Speed">Speed</option>
                <option value="Indefinido">Indefinido</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Tipo de arma</label>
              <select value={form.weapon_type ?? ''} onChange={e => setForm(f => ({ ...f, weapon_type: e.target.value }))}
                className="w-full border rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-400 bg-white">
                <option value="">Selecionar</option>
                <option value="HPA">HPA</option>
                <option value="AEG">Arma Comum (AEG)</option>
              </select>
            </div>
          </div>
          {/* Times */}
          <TeamSelector selectedIds={customerTeamIds} onChange={setCustomerTeamIds} />

          {/* Flag estrela */}
          <button type="button" onClick={() => setForm(f => ({ ...f, is_star: !f.is_star }))}
            className={`flex items-center gap-3 w-full p-4 rounded-xl border-2 text-left transition-all ${form.is_star ? 'border-yellow-400 bg-yellow-50' : 'border-gray-200 bg-white'}`}>
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${form.is_star ? 'bg-yellow-400 border-yellow-400' : 'border-gray-300'}`}>
              {form.is_star && <svg viewBox="0 0 12 12" className="w-3 h-3"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </div>
            <div>
              <p className={`text-sm font-semibold ${form.is_star ? 'text-yellow-700' : 'text-gray-700'}`}>⭐ Operador Estrela</p>
              <p className="text-xs text-gray-400">Operador especial do campo</p>
            </div>
          </button>

          {/* Flag legado */}
          <button type="button" onClick={() => setForm(f => ({ ...f, is_legacy: !f.is_legacy }))}
            className={`flex items-center gap-3 w-full p-4 rounded-xl border-2 text-left transition-all ${form.is_legacy ? 'border-amber-400 bg-amber-50' : 'border-gray-200 bg-white'}`}>
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${form.is_legacy ? 'bg-amber-400 border-amber-400' : 'border-gray-300'}`}>
              {form.is_legacy && <svg viewBox="0 0 12 12" className="w-3 h-3"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </div>
            <div>
              <p className={`text-sm font-semibold ${form.is_legacy ? 'text-amber-700' : 'text-gray-700'}`}>Já visitava o campo antes</p>
              <p className="text-xs text-gray-400">Cliente com histórico anterior ao sistema</p>
            </div>
          </button>

          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button onClick={() => setEditing(false)}
              className="flex-1 py-3 border border-gray-300 text-gray-600 rounded-xl font-semibold hover:bg-gray-50 flex items-center justify-center gap-2">
              <X size={16} /> Cancelar
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex-1 py-3 bg-green-500 text-white rounded-xl font-semibold hover:bg-green-600 disabled:opacity-50 flex items-center justify-center gap-2">
              <Check size={16} /> {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── sub-components ──────────────────────────────── */
function MetricCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col gap-1">
      <div className="flex items-center gap-2 mb-1">{icon}<span className="text-xs text-gray-400 font-medium">{label}</span></div>
      <p className="text-xl font-bold text-gray-800 leading-tight">{value}</p>
      <p className="text-xs text-gray-400">{sub}</p>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center px-5 py-3.5">
      <span className="text-sm text-gray-400">{label}</span>
      <span className="text-sm font-medium text-gray-800">{value}</span>
    </div>
  )
}
