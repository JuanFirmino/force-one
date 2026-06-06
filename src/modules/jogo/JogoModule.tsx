import { useEffect, useState, useCallback, useRef } from 'react'
import { Users, Shield, ShieldOff, RefreshCw, MapPin, Clock, Star, Lock, Eye, EyeOff, AlertTriangle, X, User } from 'lucide-react'
import { dataService } from '../../lib/dataService'
import { supabase } from '../../lib/supabase'

/* ── types ──────────────────────────────────────── */
interface VisitToday {
  id: string
  visited_at: string
  total_amount: number
  customer_id?: string
  unit_id?: string
  access_type_id?: string
  payment_method_id?: string
  customer: { name: string; photo_url?: string; gender?: string; birth_date?: string; play_style?: string } | null
  access_type: { name: string } | null
  payment_method: { name: string } | null
  unit: { name: string } | null
}

interface TkmDay { label: string; avg: number }

interface UnitSummary { unitName: string; count: number; revenue: number }

interface DayStats {
  totalVisits: number; totalRevenue: number
  byAccessType: Record<string, number>; byPayment: Record<string, number>
  byUnit: UnitSummary[]; visits: VisitToday[]; lastUpdated: Date
  byGender: Record<string, number>; byAge: Record<string, number>
  byPlayStyle: Record<string, number>; tkmTrend: TkmDay[]
  newVisitors: number; returningVisitors: number
  recurrence7d: number; recurrence30d: number
  freqBuckets: [string, number][]
}

/* ── helpers ─────────────────────────────────────── */
function timeAgo(date: Date) {
  const s = Math.floor((Date.now() - date.getTime()) / 1000)
  if (s < 10) return 'agora mesmo'
  if (s < 60) return `há ${s}s`
  return `há ${Math.floor(s / 60)}min`
}

function ageGroup(birth?: string): string {
  if (!birth) return 'N/I'
  const age = Math.floor((Date.now() - new Date(birth).getTime()) / (365.25 * 86400000))
  if (age < 18) return 'Menor de 18'
  if (age <= 25) return '18 – 25'
  if (age <= 35) return '26 – 35'
  if (age <= 45) return '36 – 45'
  return 'Acima de 45'
}

const AGE_ORDER = ['Menor de 18', '18 – 25', '26 – 35', '36 – 45', 'Acima de 45', 'N/I']

function buildView(visits: VisitToday[]) {
  const totalVisits = visits.length
  const totalRevenue = visits.reduce((s, v) => s + (v.total_amount ?? 0), 0)
  const byAccessType: Record<string, number> = {}
  visits.forEach(v => { const n = v.access_type?.name ?? 'N/A'; byAccessType[n] = (byAccessType[n] ?? 0) + 1 })
  const byPayment: Record<string, number> = {}
  visits.forEach(v => { const n = v.payment_method?.name ?? 'N/A'; byPayment[n] = (byPayment[n] ?? 0) + 1 })
  const byGender: Record<string, number> = {}
  visits.forEach(v => {
    const g = v.customer?.gender === 'M' ? 'Masculino' : v.customer?.gender === 'F' ? 'Feminino' : v.customer?.gender === 'O' ? 'Outro' : 'N/I'
    byGender[g] = (byGender[g] ?? 0) + 1
  })
  const byAge: Record<string, number> = {}
  visits.forEach(v => { const g = ageGroup(v.customer?.birth_date); byAge[g] = (byAge[g] ?? 0) + 1 })
  const byPlayStyle: Record<string, number> = {}
  visits.forEach(v => { const p = v.customer?.play_style || 'N/I'; byPlayStyle[p] = (byPlayStyle[p] ?? 0) + 1 })
  return { totalVisits, totalRevenue, byAccessType, byPayment, byGender, byAge, byPlayStyle }
}

/* ── mini chart components ───────────────────────── */
const COLORS = ['bg-green-400', 'bg-blue-400', 'bg-purple-400', 'bg-orange-400', 'bg-teal-400', 'bg-gray-300']

function HBarChart({ data, total }: { data: [string, number][]; total: number }) {
  return (
    <div className="flex flex-col gap-2">
      {data.map(([label, count], i) => {
        const pct = total > 0 ? Math.round((count / total) * 100) : 0
        return (
          <div key={label}>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm text-gray-700">{label}</span>
              <span className="text-sm font-bold text-gray-800">{count} <span className="text-xs text-gray-400 font-normal">({pct}%)</span></span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${COLORS[i % COLORS.length]} transition-all`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function TkmChart({ data }: { data: TkmDay[] }) {
  const safeAvgs = data.map(d => (isNaN(d.avg) || !isFinite(d.avg) ? 0 : d.avg))
  const max = Math.max(...safeAvgs, 1)
  return (
    <div className="flex items-end gap-1.5 h-28">
      {data.map((d, i) => {
        const avg = safeAvgs[i]
        const h = max > 0 ? Math.round((avg / max) * 100) : 0
        const isToday = i === data.length - 1
        return (
          <div key={d.label} className="flex-1 flex flex-col items-center gap-1">
            <span className="text-xs font-bold text-gray-700">{avg > 0 ? avg.toFixed(0) : ''}</span>
            <div className="w-full flex flex-col justify-end" style={{ height: 72 }}>
              <div
                className={`w-full rounded-t-lg transition-all ${isToday ? 'bg-green-500' : 'bg-green-200'}`}
                style={{ height: avg > 0 ? `${Math.max(h, 4)}%` : '2px', opacity: avg > 0 ? 1 : 0.2 }}
              />
            </div>
            <span className={`text-xs ${isToday ? 'font-bold text-green-600' : 'text-gray-400'}`}>{d.label}</span>
          </div>
        )
      })}
    </div>
  )
}

// ── Comparison Badge ─────────────────────────────────────
function CompBadge({ curr, prev, prefix, money, light, invert }: {
  curr: number; prev: number; prefix?: string; money?: boolean; light?: boolean; invert?: boolean
}) {
  if (prev === 0 && curr === 0) return null
  const diff    = curr - prev
  const pct     = prev === 0 ? 100 : Math.round((diff / prev) * 100)
  const up      = invert !== undefined ? (invert ? diff < 0 : diff > 0) : diff >= 0
  const color   = diff === 0
    ? (light ? 'bg-white/20 text-white/80' : 'bg-gray-100 text-gray-500')
    : up
      ? (light ? 'bg-white/20 text-white' : 'bg-green-100 text-green-700')
      : (light ? 'bg-red-400/30 text-white' : 'bg-red-100 text-red-600')
  const arrow   = diff === 0 ? '→' : diff > 0 ? '▲' : '▼'
  const absVal  = money
    ? `R$ ${Math.abs(diff).toFixed(2).replace('.', ',')}`
    : `${prefix ?? ''}${Math.abs(diff)}`

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${color}`}>
      {arrow} {pct !== 0 ? `${Math.abs(pct)}%` : ''} {absVal !== 'R$ 0,00' && absVal !== `${prefix ?? ''}0` ? `(${absVal})` : ''}
    </span>
  )
}

// Formata uma data como string YYYY-MM-DD no fuso local
function toLocalDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/* ── main component ──────────────────────────────── */
export function JogoModule() {
  const [stats, setStats] = useState<DayStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedUnit, setSelectedUnit] = useState<string>('geral')
  const [starOps, setStarOps] = useState<{ id: string; name: string; photo_url?: string; arrivedAt: string; teams: string[] }[]>([])
  const [infraOps, setInfraOps] = useState<{ id: string; name: string; photo_url?: string; arrivedAt: string; count: number }[]>([])
  const [modal, setModal] = useState<{ type: 'infractions' | 'profile'; customerId: string; customerName: string; photo?: string } | null>(null)
  const [modalData, setModalData] = useState<any[]>([])
  const [todayInfractions, setTodayInfractions] = useState<any[]>([])
  const [prevStats, setPrevStats] = useState<{ visits: number; revenue: number; newVisitors: number; returning: number } | null>(null)
  const [starUnlocked, setStarUnlocked] = useState(false)
  const [starInput, setStarInput] = useState('')
  const [starShowInput, setStarShowInput] = useState(false)
  const [starShowPwd, setStarShowPwd] = useState(false)
  const [starError, setStarError] = useState('')
  const [starChecking, setStarChecking] = useState(false)
  const starInputRef = useRef<HTMLInputElement>(null)
  const [salesStats, setSalesStats] = useState<{ count: number; revenue: number; byPayment: [string,number][]; topItems: [string,number][] } | null>(null)

  // Seletor de data
  const [dateMode, setDateMode] = useState<'hoje' | 'ontem' | 'custom'>('hoje')
  const [customDate, setCustomDate] = useState(toLocalDate(new Date()))

  function getDateRange() {
    const base = new Date()
    if (dateMode === 'ontem') base.setDate(base.getDate() - 1)
    else if (dateMode === 'custom') {
      const [y, m, d] = customDate.split('-').map(Number)
      base.setFullYear(y, m - 1, d)
    }
    const start = new Date(base); start.setHours(0, 0, 0, 0)
    const end   = new Date(base); end.setHours(23, 59, 59, 999)
    return { start, end, base }
  }

  const isToday = dateMode === 'hoje'

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true)

    const { start, end } = getDateRange()
    const startIso = start.toISOString()
    const endIso   = end.toISOString()

    // TKM trend: 7 dias até a data selecionada
    const tkmFrom = new Date(start); tkmFrom.setDate(tkmFrom.getDate() - 6)

    const [visitsResult, tkmResult, customersResult, accessTypesResult, paymentMethodsResult, unitsResult, salesResult] = await Promise.all([
      dataService.from('visits').select('*').gte('visited_at', startIso).lte('visited_at', endIso).order('visited_at', { ascending: false }).execute(),
      dataService.from('visits').select('*').gte('visited_at', tkmFrom.toISOString()).lte('visited_at', endIso).execute(),
      dataService.from('customers').select('*').execute(),
      dataService.from('access_types').select('*').execute(),
      dataService.from('payment_methods').select('*').execute(),
      dataService.from('units').select('*').execute(),
      supabase.from('sales').select('*, sale_items(*), payment_methods(name)').gte('created_at', startIso).lte('created_at', endIso),
    ])

    // Map data by ID for quick lookup
    const customersMap = new Map((customersResult.data ?? []).map((c: any) => [c.id, c]))
    const accessTypesMap = new Map((accessTypesResult.data ?? []).map((a: any) => [a.id, a]))
    const paymentMethodsMap = new Map((paymentMethodsResult.data ?? []).map((p: any) => [p.id, p]))
    const unitsMap = new Map((unitsResult.data ?? []).map((u: any) => [u.id, u]))

    // Join visits with related data
    const visitsWithRelations = (visitsResult.data ?? []).map((v: any) => ({
      ...v,
      customer: customersMap.get(v.customer_id),
      access_type: accessTypesMap.get(v.access_type_id),
      payment_method: paymentMethodsMap.get(v.payment_method_id),
      unit: unitsMap.get(v.unit_id),
    }))

    const visits = visitsWithRelations as unknown as VisitToday[]

    // busca histórico dos clientes de hoje (visitas ANTES de hoje)
    const customerIds = [...new Set(visits.map(v => v.customer_id ?? v.id))]
    const ago30 = new Date(start.getTime() - 30 * 86400000).toISOString()
    const ago7  = new Date(start.getTime() - 7  * 86400000).toISOString()

    const allVisitsResult = await dataService.from('visits').select('customer_id, visited_at').execute()
    const allVisits = (allVisitsResult.data ?? []) as any[]
    const histRows = allVisits.filter(v => {
      const visitDate = new Date(v.visited_at)
      return customerIds.includes(v.customer_id) && visitDate < start
    })

    // contagem de visitas anteriores por cliente
    const prevCountMap: Record<string, number> = {}
    const prev7Map:  Record<string, boolean> = {}
    const prev30Map: Record<string, boolean> = {}
    histRows.forEach(r => {
      prevCountMap[r.customer_id] = (prevCountMap[r.customer_id] ?? 0) + 1
      if (r.visited_at >= ago7)  prev7Map[r.customer_id]  = true
      if (r.visited_at >= ago30) prev30Map[r.customer_id] = true
    })

    // mapa de clientes legacy (histórico anterior ao sistema)
    const legacyMap: Record<string, boolean> = {}
    visits.forEach(v => {
      if ((v as any).customer?.is_legacy) legacyMap[(v as any).customer_id] = true
    })

    // novos: nunca vieram antes E não são legacy
    const todayCustomerIds = [...new Set(visits.map(v => (v as any).customer_id ?? v.id))]
    let newVisitors = 0, returningVisitors = 0
    todayCustomerIds.forEach(id => {
      const hasHistory = (prevCountMap[id] ?? 0) > 0
      const isLegacy = legacyMap[id] ?? false
      if (!hasHistory && !isLegacy) newVisitors++
      else returningVisitors++
    })

    // recorrência: % de hoje que veio nos últimos 7 / 30 dias (legacy sempre conta como recorrente)
    const total = todayCustomerIds.length || 1
    const rec7Count  = todayCustomerIds.filter(id => prev7Map[id]  || legacyMap[id]).length
    const rec30Count = todayCustomerIds.filter(id => prev30Map[id] || legacyMap[id]).length
    const recurrence7d  = Math.round((rec7Count  / total) * 100)
    const recurrence30d = Math.round((rec30Count / total) * 100)

    // frequência: distribuição de visitas totais (incluindo hoje); legacy começa no bucket 2–3x mínimo
    const allCounts: Record<string, number> = { ...prevCountMap }
    todayCustomerIds.forEach(id => {
      allCounts[id] = (allCounts[id] ?? 0) + 1
      // legacy com apenas 1 visita no sistema → trata como se tivesse 2 (bucket 2-3x)
      if (legacyMap[id] && allCounts[id] < 2) allCounts[id] = 2
    })
    const freqMap: Record<string, number> = {}
    Object.values(allCounts).forEach(n => {
      const bucket = n === 1 ? '1ª visita' : n <= 3 ? '2 – 3x' : n <= 6 ? '4 – 6x' : n <= 10 ? '7 – 10x' : '10x+'
      freqMap[bucket] = (freqMap[bucket] ?? 0) + 1
    })
    const FREQ_ORDER = ['1ª visita', '2 – 3x', '4 – 6x', '7 – 10x', '10x+']
    const freqBuckets = FREQ_ORDER.map(k => [k, freqMap[k] ?? 0] as [string, number]).filter(([, n]) => n > 0)

    // TKM por dia (últimos 7 dias)
    const tkmMap: Record<string, number[]> = {}
    ;(tkmResult.data ?? []).forEach((r: { visited_at: string; total_amount: number }) => {
      const key = new Date(r.visited_at).toLocaleDateString('pt-BR', { weekday: 'short' })
      if (!tkmMap[key]) tkmMap[key] = []
      tkmMap[key].push(r.total_amount)
    })
    const tkmTrend: TkmDay[] = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start.getTime() - (6 - i) * 86400000)
      const label = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
      const vals = tkmMap[label] ?? []
      return { label, avg: vals.length ? vals.reduce((s, x) => s + x, 0) / vals.length : 0 }
    })

    const totalRevenue = visits.reduce((s, v) => s + (v.total_amount ?? 0), 0)
    const byAccessType: Record<string, number> = {}
    visits.forEach(v => { const n = v.access_type?.name ?? 'N/A'; byAccessType[n] = (byAccessType[n] ?? 0) + 1 })
    const byPayment: Record<string, number> = {}
    visits.forEach(v => { const n = v.payment_method?.name ?? 'N/A'; byPayment[n] = (byPayment[n] ?? 0) + 1 })
    const unitMap: Record<string, UnitSummary> = {}
    visits.forEach(v => {
      const n = v.unit?.name?.replace('Force One - ', '') ?? 'N/A'
      if (!unitMap[n]) unitMap[n] = { unitName: n, count: 0, revenue: 0 }
      unitMap[n].count++; unitMap[n].revenue += v.total_amount ?? 0
    })
    const byGender: Record<string, number> = {}
    visits.forEach(v => {
      const g = v.customer?.gender === 'M' ? 'Masculino' : v.customer?.gender === 'F' ? 'Feminino' : v.customer?.gender === 'O' ? 'Outro' : 'N/I'
      byGender[g] = (byGender[g] ?? 0) + 1
    })
    const byAge: Record<string, number> = {}
    visits.forEach(v => { const g = ageGroup(v.customer?.birth_date); byAge[g] = (byAge[g] ?? 0) + 1 })
    const byPlayStyle: Record<string, number> = {}
    visits.forEach(v => { const p = v.customer?.play_style || 'N/I'; byPlayStyle[p] = (byPlayStyle[p] ?? 0) + 1 })

    setStats({
      totalVisits: visits.length, totalRevenue, byAccessType, byPayment,
      byUnit: Object.values(unitMap).sort((a, b) => b.count - a.count),
      visits, lastUpdated: new Date(), byGender, byAge, byPlayStyle, tkmTrend,
      newVisitors, returningVisitors, recurrence7d, recurrence30d, freqBuckets,
    })

    // Processa vendas
    const sales = (salesResult.data ?? []) as any[]
    const salesRevenue = sales.reduce((s: number, v: any) => s + Number(v.total_amount), 0)
    const salesByPayment: Record<string, number> = {}
    sales.forEach((s: any) => {
      const n = s.payment_methods?.name ?? 'N/A'
      salesByPayment[n] = (salesByPayment[n] ?? 0) + Number(s.total_amount)
    })
    const itemsMap: Record<string, number> = {}
    sales.forEach((s: any) => {
      ;(s.sale_items ?? []).forEach((i: any) => {
        itemsMap[i.product_name] = (itemsMap[i.product_name] ?? 0) + i.quantity
      })
    })
    const topItems = Object.entries(itemsMap).sort((a, b) => b[1] - a[1]).slice(0, 5) as [string,number][]
    setSalesStats({ count: sales.length, revenue: salesRevenue, byPayment: Object.entries(salesByPayment).sort((a,b) => b[1]-a[1]) as [string,number][], topItems })

    // Busca mesmo dia da semana passada para comparação
    const prevStart = new Date(start); prevStart.setDate(prevStart.getDate() - 7)
    const prevEnd   = new Date(end);   prevEnd.setDate(prevEnd.getDate() - 7)
    const { data: prevVisitsRaw } = await supabase
      .from('visits')
      .select('customer_id, total_amount')
      .gte('visited_at', prevStart.toISOString())
      .lte('visited_at', prevEnd.toISOString())

    if (prevVisitsRaw) {
      const prevVisitCount = prevVisitsRaw.length
      const prevRevenue    = prevVisitsRaw.reduce((s: number, v: any) => s + (v.total_amount ?? 0), 0)
      // Novos vs recorrentes semana passada (simplificado: todos que vieram antes desse dia)
      const prevCustomerIds = [...new Set(prevVisitsRaw.map((v: any) => v.customer_id))]
      const prevAllHist = allVisits.filter((v: any) => {
        const vd = new Date(v.visited_at)
        return prevCustomerIds.includes(v.customer_id) && vd < prevStart
      })
      const prevPrevMap: Record<string, number> = {}
      prevAllHist.forEach((r: any) => { prevPrevMap[r.customer_id] = (prevPrevMap[r.customer_id] ?? 0) + 1 })
      let prevNew = 0, prevRet = 0
      prevCustomerIds.forEach(id => {
        const leg = (customersMap.get(id) as any)?.is_legacy
        if ((prevPrevMap[id] ?? 0) === 0 && !leg) prevNew++
        else prevRet++
      })
      setPrevStats({ visits: prevVisitCount, revenue: prevRevenue, newVisitors: prevNew, returning: prevRet })
    } else {
      setPrevStats(null)
    }

    // Operadores estrela presentes hoje
    const starCustomerIds = [...new Set(
      visits.filter(v => (v as any).customer?.is_star).map(v => (v as any).customer_id)
    )]
    if (starCustomerIds.length > 0) {
      const { data: ctData } = await supabase
        .from('customer_teams')
        .select('customer_id, teams(name)')
        .in('customer_id', starCustomerIds)
      const teamsPerCustomer: Record<string, string[]> = {}
      ;(ctData ?? []).forEach((r: any) => {
        if (!teamsPerCustomer[r.customer_id]) teamsPerCustomer[r.customer_id] = []
        if (r.teams?.name) teamsPerCustomer[r.customer_id].push(r.teams.name)
      })
      const starList = starCustomerIds.map(id => {
        const c = (customersResult.data ?? []).find((c: any) => c.id === id) as any
        const arrival = visits.filter(v => (v as any).customer_id === id)
          .sort((a, b) => new Date(a.visited_at).getTime() - new Date(b.visited_at).getTime())[0]
        return {
          id,
          name: c?.name ?? '—',
          photo_url: c?.photo_url,
          arrivedAt: arrival ? new Date(arrival.visited_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—',
          teams: teamsPerCustomer[id] ?? [],
        }
      })
      setStarOps(starList)
    } else {
      setStarOps([])
    }

    // Operadores com advertências presentes no período
    const allCustomerIds = [...new Set(visits.map(v => (v as any).customer_id))]
    if (allCustomerIds.length > 0) {
      const { data: infraCounts } = await supabase
        .from('infractions')
        .select('customer_id')
        .in('customer_id', allCustomerIds)
      if (infraCounts && infraCounts.length > 0) {
        const countMap: Record<string, number> = {}
        infraCounts.forEach((r: any) => { countMap[r.customer_id] = (countMap[r.customer_id] ?? 0) + 1 })
        const infraList = Object.entries(countMap).map(([id, count]) => {
          const c = (customersResult.data ?? []).find((c: any) => c.id === id) as any
          const arrival = visits.filter(v => (v as any).customer_id === id)
            .sort((a, b) => new Date(a.visited_at).getTime() - new Date(b.visited_at).getTime())[0]
          return {
            id, count,
            name: c?.name ?? '—',
            photo_url: c?.photo_url,
            arrivedAt: arrival ? new Date(arrival.visited_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—',
          }
        }).sort((a, b) => b.count - a.count)
        setInfraOps(infraList)
      } else {
        setInfraOps([])
      }
    } else {
      setInfraOps([])
    }

    // Advertências do período
    const { data: infraData } = await supabase
      .from('infractions')
      .select('*, customers(name, photo_url), units(name)')
      .gte('created_at', startIso)
      .lte('created_at', endIso)
      .order('created_at', { ascending: false })
    setTodayInfractions(infraData ?? [])

    setLoading(false); setRefreshing(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateMode, customDate])

  useEffect(() => {
    load()
    if (!isToday) return
    const interval = setInterval(() => load(true), 60000)
    return () => clearInterval(interval)
  }, [load, isToday])

  const { base } = getDateRange()
  const dateLabel = base.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
  const dateLabelCap = dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)

  async function openModal(type: 'infractions' | 'profile', op: { id: string; name: string; photo_url?: string }) {
    setModal({ type, customerId: op.id, customerName: op.name, photo: op.photo_url })
    setModalData([])
    if (type === 'infractions') {
      const { data } = await supabase
        .from('infractions').select('*, units(name)')
        .eq('customer_id', op.id).order('created_at', { ascending: false })
      setModalData(data ?? [])
    } else {
      const { data } = await supabase
        .from('customers').select('*, customer_teams(teams(name))')
        .eq('id', op.id).single()
      setModalData(data ? [data] : [])
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400">
      <div className="text-center">
        <RefreshCw size={32} className="mx-auto mb-3 animate-spin opacity-40" />
        <p>Carregando dados do dia...</p>
      </div>
    </div>
  )

  const s = stats!
  const unitTabs = ['geral', ...Array.from(new Set(s.visits.map(v => v.unit?.name ?? '').filter(Boolean)))]
  const filteredVisits = selectedUnit === 'geral' ? s.visits : s.visits.filter(v => (v.unit?.name ?? '') === selectedUnit)
  const v = buildView(filteredVisits)

  const genderData = Object.entries(v.byGender).sort((a, b) => b[1] - a[1])
  const ageData = AGE_ORDER.map(k => [k, v.byAge[k] ?? 0] as [string, number]).filter(([, n]) => n > 0)
  const styleData = Object.entries(v.byPlayStyle).sort((a, b) => b[1] - a[1])

  return (
    <div className="flex flex-col gap-6 px-4 py-6 max-w-2xl mx-auto">

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Header do modal */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
              {modal.photo
                ? <img src={modal.photo} className="w-10 h-10 rounded-full object-cover shrink-0" />
                : <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-400 shrink-0">{modal.customerName[0]}</div>
              }
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-800 truncate">{modal.customerName}</p>
                <p className="text-xs text-gray-400">{modal.type === 'infractions' ? 'Histórico de advertências' : 'Perfil completo'}</p>
              </div>
              <button onClick={() => setModal(null)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* Conteúdo do modal */}
            <div className="overflow-y-auto flex-1 px-5 py-4 flex flex-col gap-3">
              {modalData.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-gray-400 text-sm">Carregando...</div>
              ) : modal.type === 'infractions' ? (
                modalData.map((inf: any) => (
                  <div key={inf.id} className="bg-orange-50 border border-orange-100 rounded-xl p-4 flex flex-col gap-1.5">
                    <p className="text-sm text-gray-800">{inf.description}</p>
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-xs text-gray-400">📅 {new Date(inf.created_at).toLocaleDateString('pt-BR')}</span>
                      <span className="text-xs text-gray-400">🕐 {new Date(inf.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                      {inf.units?.name && <span className="text-xs text-green-600">📍 {inf.units.name.replace('Force One - ', '')}</span>}
                    </div>
                  </div>
                ))
              ) : (() => {
                const c = modalData[0]
                const teams = (c.customer_teams ?? []).map((ct: any) => ct.teams?.name).filter(Boolean)
                return (
                  <div className="flex flex-col gap-3">
                    <div className="bg-gray-50 rounded-xl divide-y divide-gray-100">
                      {[
                        ['CPF', c.cpf?.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')],
                        ['WhatsApp', c.whatsapp],
                        ['Nascimento', c.birth_date ? new Date(c.birth_date + 'T00:00:00').toLocaleDateString('pt-BR') : null],
                        ['Sexo', c.gender === 'M' ? 'Masculino' : c.gender === 'F' ? 'Feminino' : c.gender === 'O' ? 'Outro' : null],
                        ['E-mail', c.email],
                        ['Estilo', c.play_style],
                        ['Arma', c.weapon_type],
                        ['Legado', c.is_legacy ? '✅ Visitava antes' : null],
                        ['Estrela', c.is_star ? '⭐ Sim' : null],
                      ].filter(([, v]) => v).map(([label, value]) => (
                        <div key={label as string} className="flex justify-between px-4 py-2.5">
                          <span className="text-xs text-gray-400">{label as string}</span>
                          <span className="text-xs font-medium text-gray-700">{value as string}</span>
                        </div>
                      ))}
                    </div>
                    {teams.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-400 mb-2">Times</p>
                        <div className="flex flex-wrap gap-2">
                          {teams.map((t: string) => <span key={t} className="text-xs bg-green-100 text-green-700 px-2.5 py-1 rounded-full">{t}</span>)}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Status do Campo</h2>
          <p className="text-sm text-gray-400 capitalize">{dateLabelCap}</p>
        </div>
        <button onClick={() => load(true)} disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-gray-500 hover:border-green-400 hover:text-green-600 text-sm transition-colors">
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Atualizar
        </button>
      </div>

      {/* Seletor de período */}
      <div className="flex gap-2 flex-wrap items-center">
        {(['hoje', 'ontem'] as const).map(m => (
          <button key={m} onClick={() => setDateMode(m)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all
              ${dateMode === m ? 'bg-green-500 text-white border-green-500' : 'bg-white text-gray-600 border-gray-200 hover:border-green-400'}`}>
            {m === 'hoje' ? 'Hoje' : 'Ontem'}
          </button>
        ))}
        <div className="flex items-center gap-2">
          <button onClick={() => setDateMode('custom')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all
              ${dateMode === 'custom' ? 'bg-green-500 text-white border-green-500' : 'bg-white text-gray-600 border-gray-200 hover:border-green-400'}`}>
            📅 Calendário
          </button>
          {dateMode === 'custom' && (
            <input type="date" value={customDate}
              max={toLocalDate(new Date())}
              onChange={e => setCustomDate(e.target.value)}
              className="border-2 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:border-green-400" />
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 text-xs text-gray-400 -mt-2">
        <Clock size={12} /> Atualizado {timeAgo(s.lastUpdated)}
        {isToday && <span>· atualiza a cada 1 min</span>}
      </div>

      {/* Operadores Estrela / Com Advertências — só exibe se houver algum */}
      {(starOps.length > 0 || infraOps.length > 0) && <div className="bg-gradient-to-br from-yellow-50 to-amber-50 border border-yellow-200 rounded-2xl p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Star size={18} className="text-yellow-500 fill-yellow-400" />
            <h3 className="font-bold text-gray-800 text-sm">Atenção Especial</h3>
          </div>
          {starUnlocked
            ? <div className="flex items-center gap-2">
                {starOps.length > 0 && <span className="text-xs font-semibold bg-yellow-200 text-yellow-800 px-2 py-0.5 rounded-full">⭐ {starOps.length}</span>}
                {infraOps.length > 0 && <span className="text-xs font-semibold bg-orange-200 text-orange-800 px-2 py-0.5 rounded-full">⚠️ {infraOps.length}</span>}
              </div>
            : <Lock size={16} className="text-yellow-400" />
          }
        </div>

        {!starUnlocked ? (
          // Estado bloqueado — preview ofuscado com overlay de senha
          <div className="relative">
            {/* Conteúdo fantasma/blur */}
            <div className="flex flex-col gap-2 select-none pointer-events-none" style={{ filter: 'blur(6px)', opacity: 0.5 }}>
              {[...Array(Math.min((starOps.length + infraOps.length) || 2, 3))].map((_, i) => (
                <div key={i} className="flex items-center gap-3 bg-white rounded-xl p-3 shadow-sm">
                  <div className="w-10 h-10 rounded-full bg-gray-200 shrink-0" />
                  <div className="flex-1 flex flex-col gap-1.5">
                    <div className="h-3 bg-gray-200 rounded w-28" />
                    <div className="h-2.5 bg-gray-100 rounded w-16" />
                  </div>
                  <div className="flex flex-col gap-1 items-end">
                    <div className="h-2.5 bg-gray-100 rounded w-10" />
                    <div className="h-3 bg-gray-200 rounded w-12" />
                  </div>
                </div>
              ))}
            </div>

            {/* Overlay com senha */}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-xl bg-yellow-50/70 backdrop-blur-[1px]">
              {!starShowInput ? (
                <button onClick={() => { setStarShowInput(true); setTimeout(() => starInputRef.current?.focus(), 50) }}
                  className="flex items-center gap-2 text-sm text-yellow-800 font-semibold bg-yellow-200 hover:bg-yellow-300 px-5 py-2.5 rounded-xl transition-colors shadow-sm">
                  <Lock size={15} /> Clique para ver
                </button>
              ) : (
                <form onSubmit={async e => {
                  e.preventDefault()
                  setStarChecking(true); setStarError('')
                  const { data } = await supabase.from('settings').select('value').eq('key', 'config_password').single()
                  setStarChecking(false)
                  if (data?.value === starInput.trim()) {
                    setStarUnlocked(true); setStarShowInput(false); setStarInput('')
                  } else {
                    setStarError('Senha incorreta'); setStarInput('')
                    starInputRef.current?.focus()
                  }
                }} className="flex flex-col gap-2 w-full px-2">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        ref={starInputRef}
                        type={starShowPwd ? 'text' : 'password'}
                        value={starInput}
                        onChange={e => { setStarInput(e.target.value); setStarError('') }}
                        placeholder="Digite a senha..."
                        className="w-full border-2 rounded-xl px-3 py-2 pr-9 text-sm focus:outline-none focus:border-yellow-400 bg-white"
                      />
                      <button type="button" onClick={() => setStarShowPwd(v => !v)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400">
                        {starShowPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    <button type="submit" disabled={starChecking || !starInput.trim()}
                      className="px-3 py-2 bg-yellow-400 text-white rounded-xl font-semibold hover:bg-yellow-500 disabled:opacity-50 text-sm">
                      {starChecking ? '...' : 'Ver'}
                    </button>
                    <button type="button" onClick={() => { setStarShowInput(false); setStarInput(''); setStarError('') }}
                      className="px-3 py-2 border bg-white rounded-xl text-gray-500 hover:bg-gray-50 text-sm">
                      ✕
                    </button>
                  </div>
                  {starError && <p className="text-red-500 text-xs text-center">{starError}</p>}
                </form>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Estrelas */}
            {starOps.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold text-yellow-700 uppercase tracking-wide">⭐ Operadores Estrela</p>
                {starOps.map(op => (
                  <div key={op.id} className="flex flex-col bg-white rounded-xl shadow-sm border border-yellow-100 overflow-hidden">
                    <div className="flex items-center gap-3 p-3">
                      {op.photo_url
                        ? <img src={op.photo_url} className="w-10 h-10 rounded-full object-cover border-2 border-yellow-300 shrink-0" />
                        : <div className="w-10 h-10 rounded-full bg-yellow-100 border-2 border-yellow-300 flex items-center justify-center text-yellow-600 font-bold shrink-0">{op.name[0]}</div>
                      }
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-semibold text-gray-800 text-sm truncate">{op.name}</p>
                          <Star size={11} className="text-yellow-400 fill-yellow-400 shrink-0" />
                        </div>
                        {op.teams.length > 0 && (
                          <div className="flex gap-1 flex-wrap mt-0.5">
                            {op.teams.map(t => <span key={t} className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{t}</span>)}
                          </div>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-gray-400">chegou</p>
                        <p className="text-sm font-bold text-gray-700">{op.arrivedAt}</p>
                      </div>
                    </div>
                    <div className="flex border-t border-gray-100">
                      <button onClick={() => openModal('profile', op)}
                        className="flex-1 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-1.5 transition-colors">
                        <User size={12} /> Ver perfil
                      </button>
                      <div className="w-px bg-gray-100" />
                      <button onClick={() => openModal('infractions', op)}
                        className="flex-1 py-2 text-xs font-medium text-orange-600 hover:bg-orange-50 flex items-center justify-center gap-1.5 transition-colors">
                        <AlertTriangle size={12} /> Ver advertências
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Com Advertências */}
            {infraOps.length > 0 && (
              <div className="flex flex-col gap-2">
                {starOps.length > 0 && <div className="border-t border-yellow-200 pt-2" />}
                <p className="text-xs font-semibold text-orange-600 uppercase tracking-wide">⚠️ Com Advertências Registradas</p>
                {infraOps.map(op => (
                  <div key={op.id} className="flex flex-col bg-white rounded-xl shadow-sm border border-orange-100 overflow-hidden">
                    <div className="flex items-center gap-3 p-3">
                      {op.photo_url
                        ? <img src={op.photo_url} className="w-10 h-10 rounded-full object-cover border-2 border-orange-200 shrink-0" />
                        : <div className="w-10 h-10 rounded-full bg-orange-50 border-2 border-orange-200 flex items-center justify-center text-orange-500 font-bold shrink-0">{op.name[0]}</div>
                      }
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-800 text-sm truncate">{op.name}</p>
                        <p className="text-xs text-orange-500 font-medium">{op.count} advertência{op.count > 1 ? 's' : ''} no histórico</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-gray-400">chegou</p>
                        <p className="text-sm font-bold text-gray-700">{op.arrivedAt}</p>
                      </div>
                    </div>
                    <div className="flex border-t border-gray-100">
                      <button onClick={() => openModal('profile', op)}
                        className="flex-1 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-1.5 transition-colors">
                        <User size={12} /> Ver perfil
                      </button>
                      <div className="w-px bg-gray-100" />
                      <button onClick={() => openModal('infractions', op)}
                        className="flex-1 py-2 text-xs font-medium text-orange-600 hover:bg-orange-50 flex items-center justify-center gap-1.5 transition-colors">
                        <AlertTriangle size={12} /> Ver advertências
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>}

      {/* Seletor de filial */}
      {unitTabs.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {unitTabs.map(u => (
            <button key={u} onClick={() => setSelectedUnit(u)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-colors border
                ${selectedUnit === u ? 'bg-green-500 text-white border-green-500' : 'bg-white text-gray-600 border-gray-200 hover:border-green-400 hover:text-green-600'}`}>
              {u === 'geral' ? '🌐 Geral' : <><MapPin size={13} />{u.replace('Force One - ', '')}</>}
            </button>
          ))}
        </div>
      )}

      {/* Cards principais */}
      <div className="grid grid-cols-2 gap-3">
        {/* Card principal — total de operadores */}
        <div className="col-span-2 bg-green-500 rounded-2xl p-5 text-white flex items-center justify-between">
          <div className="flex-1">
            <p className="text-green-100 text-sm font-medium">Operadores em campo</p>
            <div className="flex items-end gap-3 mt-1">
              <p className="text-5xl font-black">{v.totalVisits}</p>
              {prevStats && <CompBadge curr={v.totalVisits} prev={prevStats.visits} invert={false} light />}
            </div>
            {selectedUnit !== 'geral' && <p className="text-green-200 text-xs mt-1">{selectedUnit.replace('Force One - ', '')} · {s.totalVisits} no total geral</p>}
          </div>
          <Users size={48} className="text-green-300 opacity-60" />
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-400 font-medium mb-1">Receita do dia</p>
          <p className="text-2xl font-bold text-gray-800">R$ {v.totalRevenue.toFixed(2).replace('.', ',')}</p>
          {prevStats && <CompBadge curr={v.totalRevenue} prev={prevStats.revenue} prefix="R$" money />}
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-400 font-medium mb-1">Ticket médio</p>
          <p className="text-2xl font-bold text-gray-800">
            R$ {v.totalVisits > 0 ? (v.totalRevenue / v.totalVisits).toFixed(2).replace('.', ',') : '0,00'}
          </p>
          {prevStats && prevStats.visits > 0 && (
            <CompBadge curr={v.totalVisits > 0 ? v.totalRevenue / v.totalVisits : 0} prev={prevStats.revenue / prevStats.visits} prefix="R$" money />
          )}
        </div>
      </div>

      {/* Novos vs Recorrentes */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col gap-1">
          <p className="text-xs text-gray-400 font-medium">🆕 Novos</p>
          <p className="text-3xl font-black text-gray-800">{s.newVisitors}</p>
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400">primeira visita</p>
            {prevStats && <CompBadge curr={s.newVisitors} prev={prevStats.newVisitors} />}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col gap-1">
          <p className="text-xs text-gray-400 font-medium">🔄 Recorrentes</p>
          <p className="text-3xl font-black text-gray-800">{s.returningVisitors}</p>
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400">já vieram antes</p>
            {prevStats && <CompBadge curr={s.returningVisitors} prev={prevStats.returning} />}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col gap-1">
          <p className="text-xs text-gray-400 font-medium">📅 Recorrência 7d</p>
          <p className="text-3xl font-black text-gray-800">{s.recurrence7d}%</p>
          <p className="text-xs text-gray-400">vieram na última semana</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col gap-1">
          <p className="text-xs text-gray-400 font-medium">📅 Recorrência 30d</p>
          <p className="text-3xl font-black text-gray-800">{s.recurrence30d}%</p>
          <p className="text-xs text-gray-400">vieram no último mês</p>
        </div>
      </div>

      {/* Caixa — Vendas */}
      {salesStats && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">🛒 Caixa — Vendas do dia</p>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-green-50 rounded-xl p-4">
              <p className="text-xs text-green-600 font-medium mb-1">Pedidos</p>
              <p className="text-3xl font-black text-green-700">{salesStats.count}</p>
            </div>
            <div className="bg-green-50 rounded-xl p-4">
              <p className="text-xs text-green-600 font-medium mb-1">Receita</p>
              <p className="text-2xl font-black text-green-700">R$ {salesStats.revenue.toFixed(2).replace('.', ',')}</p>
            </div>
          </div>

          {salesStats.byPayment.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Por método</p>
              <div className="flex flex-col gap-1.5">
                {salesStats.byPayment.map(([name, val]) => (
                  <div key={name} className="flex justify-between text-sm">
                    <span className="text-gray-600">{name}</span>
                    <span className="font-semibold text-gray-800">R$ {val.toFixed(2).replace('.', ',')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {salesStats.topItems.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Mais vendidos</p>
              <div className="flex flex-col gap-1.5">
                {salesStats.topItems.map(([name, qty]) => (
                  <div key={name} className="flex justify-between text-sm">
                    <span className="text-gray-600">{name}</span>
                    <span className="font-semibold text-gray-800">{qty}x</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {salesStats.count === 0 && (
            <p className="text-sm text-gray-400 text-center py-2">Nenhuma venda registrada neste dia.</p>
          )}
        </div>
      )}

      {/* Frequência */}
      {s.freqBuckets.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Frequência (total de visitas por jogador)</p>
          <HBarChart data={s.freqBuckets} total={v.totalVisits} />
        </div>
      )}

      {/* Por filial — só no Geral */}
      {selectedUnit === 'geral' && s.byUnit.length > 1 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">Por filial</p>
          <div className="flex flex-col gap-2">
            {s.byUnit.map(u => (
              <button key={u.unitName}
                onClick={() => setSelectedUnit(unitTabs.find(t => t.includes(u.unitName)) ?? 'geral')}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 flex items-center justify-between hover:border-green-300 transition-colors text-left">
                <div className="flex items-center gap-3">
                  <MapPin size={16} className="text-green-500 shrink-0" />
                  <p className="font-semibold text-gray-800">{u.unitName}</p>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right"><p className="text-xs text-gray-400">operadores</p><p className="font-bold text-gray-800">{u.count}</p></div>
                  <div className="text-right"><p className="text-xs text-gray-400">receita</p><p className="font-bold text-green-600">R$ {u.revenue.toFixed(2).replace('.', ',')}</p></div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Gráficos de perfil */}
      {v.totalVisits > 0 && (
        <div className="grid grid-cols-1 gap-4">

          {/* Sexo */}
          {genderData.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Sexo</p>
              <HBarChart data={genderData} total={v.totalVisits} />
            </div>
          )}

          {/* Faixa etária */}
          {ageData.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Faixa etária</p>
              <HBarChart data={ageData} total={v.totalVisits} />
            </div>
          )}

          {/* Estilo de jogo */}
          {styleData.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Estilo de jogo</p>
              <HBarChart data={styleData} total={v.totalVisits} />
            </div>
          )}
        </div>
      )}

      {/* Tipo de acesso */}
      {Object.keys(v.byAccessType).length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">Tipo de acesso</p>
          <div className="flex flex-col gap-2">
            {Object.entries(v.byAccessType).sort((a, b) => b[1] - a[1]).map(([name, count]) => {
              const pct = Math.round((count / v.totalVisits) * 100)
              const isEquip = name.toLowerCase().includes('com')
              return (
                <div key={name} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {isEquip ? <Shield size={15} className="text-green-500" /> : <ShieldOff size={15} className="text-blue-500" />}
                      <span className="text-sm font-medium text-gray-700">{name}</span>
                    </div>
                    <span className="font-bold text-gray-800">{count} <span className="text-xs text-gray-400 font-normal">({pct}%)</span></span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${isEquip ? 'bg-green-400' : 'bg-blue-400'}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Pagamentos */}
      {Object.keys(v.byPayment).length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">Formas de pagamento</p>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
            {Object.entries(v.byPayment).sort((a, b) => b[1] - a[1]).map(([name, count]) => {
              const pct = Math.round((count / v.totalVisits) * 100)
              return (
                <div key={name} className="flex items-center justify-between px-5 py-3">
                  <span className="text-sm text-gray-700">{name}</span>
                  <div className="flex items-center gap-3">
                    <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-green-400 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-sm font-bold text-gray-800 w-6 text-right">{count}</span>
                    <span className="text-xs text-gray-400 w-8 text-right">{pct}%</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Lista de operadores */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">Operadores ({filteredVisits.length})</p>
        {filteredVisits.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400">
            <Users size={36} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">Nenhum operador registrado hoje.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filteredVisits.map(visit => {
              const d = new Date(visit.visited_at)
              const isEquip = visit.access_type?.name?.toLowerCase().includes('com')
              return (
                <div key={visit.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-4">
                  {visit.customer?.photo_url
                    ? <img src={visit.customer.photo_url} className="w-10 h-10 rounded-full object-cover shrink-0" />
                    : <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold shrink-0">
                        {(visit.customer?.name ?? '?')[0].toUpperCase()}
                      </div>
                  }
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 truncate">{visit.customer?.name ?? '—'}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      {isEquip ? <Shield size={11} className="text-green-500" /> : <ShieldOff size={11} className="text-blue-500" />}
                      <span>{visit.access_type?.name ?? '—'}</span>
                      {selectedUnit === 'geral' && <><span>·</span><span>{visit.unit?.name?.replace('Force One - ', '') ?? '—'}</span></>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-green-600 text-sm">R$ {visit.total_amount.toFixed(2).replace('.', ',')}</p>
                    <p className="text-xs text-gray-400">{d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Advertências do dia */}
      {todayInfractions.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className="text-orange-500" />
            Advertências do Dia
            <span className="ml-auto text-xs font-normal text-gray-400">{todayInfractions.length} registro{todayInfractions.length > 1 ? 's' : ''}</span>
          </h3>
          <div className="bg-white rounded-2xl border border-orange-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-orange-50 border-b border-orange-100">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Jogador</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Descrição</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Campo</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Horário</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {todayInfractions.map((inf: any) => (
                  <tr key={inf.id} className="hover:bg-orange-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {inf.customers?.photo_url
                          ? <img src={inf.customers.photo_url} className="w-7 h-7 rounded-full object-cover shrink-0" />
                          : <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-400 shrink-0">{inf.customers?.name?.[0]}</div>
                        }
                        <span className="font-medium text-gray-800 text-xs truncate max-w-[80px]">{inf.customers?.name ?? '—'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 max-w-[140px]">
                      <p className="line-clamp-2">{inf.description}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-green-600 hidden sm:table-cell">
                      {inf.units?.name?.replace('Force One - ', '') ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 text-right whitespace-nowrap">
                      {new Date(inf.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  )
}
