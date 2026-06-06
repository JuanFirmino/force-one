import { useEffect, useState } from 'react'
import {
  AlertTriangle, ChevronRight, ArrowLeft, Star,
  Shield, ClipboardList, Search, MapPin, Users, Check, Trash2, History, CalendarDays, Plus
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { dataService } from '../../lib/dataService'
import { useUnitStore } from '../../stores/unitStore'

interface HistoryCustomer {
  id: string
  name: string
  photo_url?: string
  is_star: boolean
  count: number
  lastDate: string
  infractions: any[]
  expanded: boolean
}

interface Player {
  id: string
  name: string
  photo_url?: string
  is_star: boolean
  arrivedAt: string
  unitName: string
  unitId: string | null
}

type View = 'list' | 'bulk' | 'detail' | 'form' | 'direct'
type DescMode = 'group' | 'individual'

export function OcorrenciasModule() {
  const currentUnit = useUnitStore(s => s.currentUnit)
  const [players, setPlayers]   = useState<Player[]>([])
  const [loading, setLoading]   = useState(true)
  const [view, setView]         = useState<View>('list')
  const [todayInfractions, setTodayInfractions] = useState<any[]>([])
  const [playersWithHistory, setPlayersWithHistory] = useState<any[]>([])
  const [selected, setSelected] = useState<Player | null>(null)
  const [infractions, setInfractions] = useState<any[]>([])
  const [loadingInf, setLoadingInf]   = useState(false)

  // tabs
  const [tab, setTab] = useState<'hoje' | 'historico'>('hoje')
  const [historyData, setHistoryData]       = useState<HistoryCustomer[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historySearch, setHistorySearch]   = useState('')

  // individual form
  const [description,  setDescription]  = useState('')
  const [activateStar, setActivateStar] = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState('')

  // bulk form
  const [checkedIds,   setCheckedIds]   = useState<string[]>([])
  const [descMode,     setDescMode]     = useState<DescMode>('group')
  const [groupDesc,    setGroupDesc]    = useState('')
  const [indivDescs,   setIndivDescs]   = useState<Record<string, string>>({})
  const [bulkSaving,   setBulkSaving]   = useState(false)
  const [bulkError,    setBulkError]    = useState('')
  const [bulkDone,     setBulkDone]     = useState(false)

  // filters
  const [search,        setSearch]        = useState('')
  const [filterUnit,    setFilterUnit]    = useState<string>('todos')

  // modo registrar na aba hoje
  const [hojeMode,      setHojeMode]      = useState<'view' | 'register'>('view')
  const [hojeChecked,   setHojeChecked]   = useState<string[]>([])
  const [hojeDescMode,  setHojeDescMode]  = useState<'group' | 'individual'>('group')
  const [hojeGroupDesc, setHojeGroupDesc] = useState('')
  const [hojeIndivDescs,setHojeIndivDescs]= useState<Record<string, string>>({})
  const [hojeRanger,    setHojeRanger]    = useState('')
  const [hojeSaving,    setHojeSaving]    = useState(false)
  const [hojeError,     setHojeError]     = useState('')

  // direct new advertência
  const [directQuery,      setDirectQuery]      = useState('')
  const [directResults,    setDirectResults]    = useState<any[]>([])
  const [directSearching,  setDirectSearching]  = useState(false)
  const [directSelected,   setDirectSelected]   = useState<any[]>([])
  const [directDescMode,   setDirectDescMode]   = useState<'group' | 'individual'>('group')
  const [directGroupDesc,  setDirectGroupDesc]  = useState('')
  const [directIndivDescs, setDirectIndivDescs] = useState<Record<string, string>>({})
  const [directRanger,     setDirectRanger]     = useState('')
  const [directSaving,     setDirectSaving]     = useState(false)
  const [directError,      setDirectError]      = useState('')
  const [directDone,       setDirectDone]       = useState(false)
  const [directUnits,      setDirectUnits]      = useState<any[]>([])
  const [directFilterUnit, setDirectFilterUnit] = useState('todos')
  const [directAllCustomers, setDirectAllCustomers] = useState<any[]>([])
  const [directLoadingAll,   setDirectLoadingAll]   = useState(false)

  useEffect(() => { loadPlayers() }, [])

  useEffect(() => {
    if (!directQuery.trim()) { setDirectResults([]); return }
    setDirectSearching(true)
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('customers')
        .select('id, name, cpf, whatsapp, photo_url, is_star')
        .or(`name.ilike.%${directQuery}%,cpf.ilike.%${directQuery}%,whatsapp.ilike.%${directQuery}%`)
        .limit(8)
      setDirectResults(data ?? [])
      setDirectSearching(false)
    }, 300)
    return () => clearTimeout(t)
  }, [directQuery])

  async function openDirect() {
    setDirectQuery(''); setDirectResults([])
    setDirectSelected([]); setDirectDescMode('group')
    setDirectGroupDesc(''); setDirectIndivDescs({})
    setDirectRanger(''); setDirectError(''); setDirectDone(false)
    setDirectAllCustomers([])
    setView('direct')

    // carrega unidades e operadores
    setDirectLoadingAll(true)
    const [{ data: units }, { data: customers }] = await Promise.all([
      supabase.from('units').select('id, name').order('name'),
      supabase.from('customers').select('id, name, cpf, whatsapp, photo_url, is_star').order('name').limit(200),
    ])
    setDirectUnits(units ?? [])

    // pré-seleciona a filial logada
    const unitId = currentUnit?.id ?? 'todos'
    setDirectFilterUnit(unitId)
    if (unitId !== 'todos') {
      const { data: visits } = await supabase
        .from('visits').select('customer_id, customers(id, name, cpf, whatsapp, photo_url, is_star)')
        .eq('unit_id', unitId)
      const seen = new Set<string>(); const list: any[] = []
      ;(visits ?? []).forEach((v: any) => {
        if (v.customers && !seen.has(v.customer_id)) { seen.add(v.customer_id); list.push(v.customers) }
      })
      setDirectAllCustomers(list.sort((a, b) => a.name.localeCompare(b.name)))
    } else {
      setDirectAllCustomers(customers ?? [])
    }
    setDirectLoadingAll(false)
  }

  async function loadDirectByUnit(unitId: string) {
    setDirectLoadingAll(true)
    if (unitId === 'todos') {
      const { data } = await supabase.from('customers').select('id, name, cpf, whatsapp, photo_url, is_star').order('name').limit(200)
      setDirectAllCustomers(data ?? [])
    } else {
      // busca clientes que visitaram essa unidade
      const { data: visits } = await supabase
        .from('visits').select('customer_id, customers(id, name, cpf, whatsapp, photo_url, is_star)')
        .eq('unit_id', unitId)
      const seen = new Set<string>()
      const list: any[] = []
      ;(visits ?? []).forEach((v: any) => {
        if (v.customers && !seen.has(v.customer_id)) {
          seen.add(v.customer_id); list.push(v.customers)
        }
      })
      list.sort((a, b) => a.name.localeCompare(b.name))
      setDirectAllCustomers(list)
    }
    setDirectLoadingAll(false)
  }

  function openHojeRegister() {
    setHojeChecked([]); setHojeDescMode('group')
    setHojeGroupDesc(''); setHojeIndivDescs({})
    setHojeRanger(''); setHojeError('')
    setHojeMode('register')
  }

  async function handleHojeSave() {
    if (hojeChecked.length === 0) { setHojeError('Selecione pelo menos um jogador.'); return }
    if (hojeDescMode === 'group' && !hojeGroupDesc.trim()) { setHojeError('Escreva a descrição.'); return }
    if (hojeDescMode === 'individual') {
      const missing = hojeChecked.filter(id => !hojeIndivDescs[id]?.trim())
      if (missing.length > 0) { setHojeError(`Preencha a descrição de ${missing.length} jogador(es).`); return }
    }
    setHojeSaving(true); setHojeError('')
    const rows = hojeChecked.map(id => {
      const p = players.find(x => x.id === id)
      return {
        customer_id: id,
        unit_id: p?.unitId ?? null,
        description: hojeDescMode === 'group' ? hojeGroupDesc.trim() : hojeIndivDescs[id].trim(),
        ranger_name: hojeRanger.trim() || null,
      }
    })
    const { error: err } = await supabase.from('infractions').insert(rows)
    if (err) { setHojeError(err.message); setHojeSaving(false); return }
    setHojeSaving(false); setHojeMode('view')
    await loadPlayers()
  }

  async function handleDirectSave() {
    if (directSelected.length === 0) { setDirectError('Adicione pelo menos um operador.'); return }
    if (directDescMode === 'group' && !directGroupDesc.trim()) { setDirectError('Escreva a descrição.'); return }
    if (directDescMode === 'individual') {
      const missing = directSelected.filter(c => !directIndivDescs[c.id]?.trim())
      if (missing.length > 0) { setDirectError(`Preencha a descrição de ${missing.length} operador(es).`); return }
    }
    setDirectSaving(true); setDirectError('')
    const rows = directSelected.map(c => ({
      customer_id: c.id,
      unit_id: currentUnit?.id ?? null,
      description: directDescMode === 'group' ? directGroupDesc.trim() : directIndivDescs[c.id].trim(),
      ranger_name: directRanger.trim() || null,
    }))
    const { error: err } = await supabase.from('infractions').insert(rows)
    if (err) { setDirectError(err.message); setDirectSaving(false); return }
    setDirectSaving(false); setDirectDone(true)
    await loadPlayers()
    if (tab === 'historico') loadHistory()
  }

  async function loadPlayers() {
    setLoading(true)
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)

    // Busca advertências do dia
    const { data: infraData } = await supabase
      .from('infractions')
      .select('*, customers(name, photo_url), units(name)')
      .gte('created_at', todayStart.toISOString())
      .order('created_at', { ascending: false })
    setTodayInfractions(infraData ?? [])
    const { data: visits } = await supabase
      .from('visits')
      .select('customer_id, unit_id, visited_at, customers(id, name, photo_url, is_star), units(id, name)')
      .gte('visited_at', todayStart.toISOString())
      .order('visited_at', { ascending: true })

    const seen = new Set<string>()
    const list: Player[] = []
    ;(visits ?? []).forEach((v: any) => {
      if (!v.customers || seen.has(v.customer_id)) return
      seen.add(v.customer_id)
      list.push({
        id: v.customer_id,
        name: v.customers.name,
        photo_url: v.customers.photo_url,
        is_star: v.customers.is_star,
        arrivedAt: new Date(v.visited_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        unitName: v.units?.name?.replace('Force One - ', '') ?? '—',
        unitId: v.units?.id ?? v.unit_id ?? null,
      })
    })
    setPlayers(list)

    // Busca histórico de advertências dos jogadores em campo hoje
    if (list.length > 0) {
      const ids = list.map(p => p.id)
      const { data: histInf } = await supabase
        .from('infractions')
        .select('customer_id, description, created_at, ranger_name, units(name)')
        .in('customer_id', ids)
        .order('created_at', { ascending: false })

      // Agrupa por jogador
      const map = new Map<string, any>()
      ;(histInf ?? []).forEach((inf: any) => {
        if (!map.has(inf.customer_id)) {
          map.set(inf.customer_id, { total: 0, last: inf, all: [] })
        }
        const e = map.get(inf.customer_id)!
        e.total++
        e.all.push(inf)
      })

      const withHistory = list
        .filter(p => map.has(p.id))
        .map(p => ({ ...p, ...map.get(p.id) }))
      setPlayersWithHistory(withHistory)
    } else {
      setPlayersWithHistory([])
    }

    setLoading(false)
  }

  // Unidades disponíveis hoje
  const allUnits = ['todos', ...Array.from(new Set(players.map(p => p.unitName))).sort()]

  // Players filtrados por busca + unidade
  const filteredPlayers = players.filter(p => {
    const matchSearch = !search.trim() || p.name.toLowerCase().includes(search.toLowerCase())
    const matchUnit   = filterUnit === 'todos' || p.unitName === filterUnit
    return matchSearch && matchUnit
  })

  async function openDetail(p: Player) {
    setSelected(p); setActivateStar(p.is_star); setView('detail')
    setLoadingInf(true)
    await loadInfractions(p.id)
    setLoadingInf(false)
  }

  async function loadHistory() {
    setHistoryLoading(true)
    const { data } = await supabase
      .from('infractions')
      .select('*, customers(id, name, photo_url, is_star), units(name)')
      .order('created_at', { ascending: false })

    // Agrupa por cliente
    const map = new Map<string, HistoryCustomer>()
    ;(data ?? []).forEach((inf: any) => {
      const cid = inf.customer_id
      if (!map.has(cid)) {
        map.set(cid, {
          id: cid,
          name: inf.customers?.name ?? '—',
          photo_url: inf.customers?.photo_url,
          is_star: inf.customers?.is_star ?? false,
          count: 0,
          lastDate: inf.created_at,
          infractions: [],
          expanded: false,
        })
      }
      const entry = map.get(cid)!
      entry.count++
      entry.infractions.push(inf)
    })
    setHistoryData(Array.from(map.values()).sort((a, b) => b.count - a.count))
    setHistoryLoading(false)
  }

  async function loadInfractions(customerId: string) {
    const { data } = await supabase
      .from('infractions').select('*, units(name)')
      .eq('customer_id', customerId).order('created_at', { ascending: false })
    setInfractions(data ?? [])
  }

  async function deleteInfraction(id: string) {
    await supabase.from('infractions').delete().eq('id', id)
    setInfractions(prev => prev.filter(i => i.id !== id))
    setTodayInfractions(prev => prev.filter(i => i.id !== id))
    setHistoryData(prev => prev
      .map(c => ({ ...c, infractions: c.infractions.filter(i => i.id !== id), count: c.infractions.filter(i => i.id !== id).length }))
      .filter(c => c.count > 0)
    )
  }

  function toggleHistoryExpand(id: string) {
    setHistoryData(prev => prev.map(c => c.id === id ? { ...c, expanded: !c.expanded } : c))
  }

  function openBulk() {
    setCheckedIds([]); setGroupDesc(''); setIndivDescs({})
    setDescMode('group'); setBulkError(''); setBulkDone(false); setView('bulk')
  }

  function toggleCheck(id: string) {
    setCheckedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function toggleAll() {
    const ids = filteredPlayers.map(p => p.id)
    const allChecked = ids.every(id => checkedIds.includes(id))
    setCheckedIds(prev => allChecked ? prev.filter(id => !ids.includes(id)) : [...new Set([...prev, ...ids])])
  }

  async function handleBulkSave() {
    if (checkedIds.length === 0) { setBulkError('Selecione pelo menos um jogador.'); return }
    if (descMode === 'group' && !groupDesc.trim()) { setBulkError('Escreva a descrição.'); return }
    if (descMode === 'individual') {
      const missing = checkedIds.filter(id => !indivDescs[id]?.trim())
      if (missing.length > 0) { setBulkError(`Preencha a descrição de ${missing.length} jogador(es).`); return }
    }
    setBulkSaving(true); setBulkError('')
    const rows = checkedIds.map(id => {
      const player = players.find(p => p.id === id)
      return {
        customer_id: id,
        unit_id: player?.unitId ?? null,
        description: descMode === 'group' ? groupDesc.trim() : indivDescs[id].trim(),
      }
    })
    const { error: err } = await supabase.from('infractions').insert(rows)
    if (err) { setBulkError(err.message); setBulkSaving(false); return }
    setBulkSaving(false); setBulkDone(true)
    await loadPlayers()
  }

  async function handleSave() {
    if (!description.trim()) { setError('Descreva o acontecimento.'); return }
    if (!selected) return
    setSaving(true)
    const { error: err } = await supabase.from('infractions').insert({
      customer_id: selected.id,
      unit_id: selected.unitId ?? null,
      description: description.trim(),
    })
    if (err) { setError(err.message); setSaving(false); return }
    if (activateStar && !selected.is_star) {
      await dataService.from('customers').update({ is_star: true }).eq('id', selected.id).execute()
      setSelected(prev => prev ? { ...prev, is_star: true } : prev)
      setPlayers(prev => prev.map(p => p.id === selected.id ? { ...p, is_star: true } : p))
    }
    setSaving(false)
    await loadPlayers()
    if (selected.arrivedAt === '' && selected.unitId === null) {
      if (tab === 'historico') loadHistory()
      setView('list')
    } else {
      await openDetail({ ...selected, is_star: activateStar || selected.is_star })
    }
  }

  // ── LIST ────────────────────────────────────────────────
  if (view === 'list') {
    return (
      <div className="flex flex-col gap-4 px-4 py-8 max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <AlertTriangle size={22} className="text-orange-500" /> Advertências
            </h2>
          </div>
          <button onClick={openDirect}
            className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-semibold hover:bg-orange-600 transition-colors">
            <Plus size={16} /> Advertência
          </button>
        </div>

        {/* Abas */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          <button onClick={() => setTab('hoje')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all
              ${tab === 'hoje' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            <CalendarDays size={15} /> Hoje
          </button>
          <button onClick={() => { setTab('historico'); if (historyData.length === 0) loadHistory() }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all
              ${tab === 'historico' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            <History size={15} /> Histórico
          </button>
        </div>

        {/* ── ABA HISTÓRICO ── */}
        {tab === 'historico' && (
          <>
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={historySearch} onChange={e => setHistorySearch(e.target.value)}
                placeholder="Buscar operador..." className="w-full pl-9 pr-4 py-2.5 border-2 rounded-xl text-sm focus:outline-none focus:border-orange-400" />
            </div>

            {historyLoading ? (
              <div className="text-center py-16 text-gray-400">Carregando histórico...</div>
            ) : historyData.filter(c => !historySearch || c.name.toLowerCase().includes(historySearch.toLowerCase())).length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <Shield size={40} className="mx-auto mb-3 opacity-30" />
                <p>Nenhuma advertência registrada</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {historyData
                  .filter(c => !historySearch || c.name.toLowerCase().includes(historySearch.toLowerCase()))
                  .map(c => (
                    <div key={c.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                      {/* Cabeçalho do operador */}
                      <button onClick={() => toggleHistoryExpand(c.id)}
                        className="flex items-center gap-3 p-4 w-full text-left hover:bg-gray-50 transition-colors">
                        <div className="relative shrink-0">
                          {c.photo_url
                            ? <img src={c.photo_url} className="w-11 h-11 rounded-full object-cover" />
                            : <div className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-400">{c.name[0]}</div>}
                          {c.is_star && <span className="absolute -top-1 -right-1 bg-yellow-400 rounded-full w-4 h-4 flex items-center justify-center"><Star size={8} className="text-white fill-white" /></span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-800">{c.name}</p>
                          <p className="text-xs text-gray-400">
                            {c.count} advertência{c.count > 1 ? 's' : ''} · última em {new Date(c.lastDate).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full shrink-0
                          ${c.count >= 3 ? 'bg-red-100 text-red-600' : c.count === 2 ? 'bg-orange-100 text-orange-600' : 'bg-yellow-100 text-yellow-600'}`}>
                          {c.count}
                        </span>
                        <ChevronRight size={16} className={`text-gray-300 shrink-0 transition-transform ${c.expanded ? 'rotate-90' : ''}`} />
                      </button>

                      {/* Advertências expandidas */}
                      {c.expanded && (
                        <div className="border-t border-gray-100 divide-y divide-gray-50">
                          {c.infractions.map((inf: any) => (
                            <div key={inf.id} className="px-4 py-3 flex items-start gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-gray-700">{inf.description}</p>
                                <div className="flex items-center gap-3 mt-1 flex-wrap">
                                  <span className="text-xs text-gray-400 capitalize">📅 {new Date(inf.created_at).toLocaleDateString('pt-BR', { weekday: 'long' })}, {new Date(inf.created_at).toLocaleDateString('pt-BR')}</span>
                                  <span className="text-xs text-gray-400">🕐 {new Date(inf.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                                  {inf.units?.name && <span className="text-xs text-green-600">📍 {inf.units.name.replace('Force One - ', '')}</span>}
                                  {inf.ranger_name && <span className="text-xs text-blue-500">👮 {inf.ranger_name}</span>}
                                </div>
                              </div>
                              <button onClick={() => deleteInfraction(inf.id)}
                                className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0">
                                <Trash2 size={13} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </>
        )}

        {/* ── ABA HOJE ── */}
        {tab === 'hoje' && (<>


        {/* ── Advertências registradas hoje ── */}
        {todayInfractions.length > 0 && (
          <div className="mt-2">
            <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2 mb-3">
              <AlertTriangle size={15} className="text-orange-500" />
              Advertências de Hoje
              <span className="ml-auto text-xs font-normal text-gray-400">{todayInfractions.length} registro{todayInfractions.length > 1 ? 's' : ''}</span>
            </h3>
            <div className="bg-white rounded-2xl border border-orange-100 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-orange-50 border-b border-orange-100">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Jogador</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Descrição</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Campo</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Ranger</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Horário</th>
                    <th className="w-8" />
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
                      <td className="px-4 py-3 text-xs text-blue-500 hidden sm:table-cell">
                        {inf.ranger_name ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400 text-right whitespace-nowrap">
                        {new Date(inf.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => deleteInfraction(inf.id)}
                          className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Excluir">
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Operadores em campo com histórico de advertências ── */}
        {!loading && playersWithHistory.length > 0 && (
          <div className="mt-2">
            <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2 mb-3">
              <Shield size={15} className="text-red-500" />
              Em campo hoje com histórico de advertências
              <span className="ml-auto text-xs font-normal text-gray-400">{playersWithHistory.length} operador{playersWithHistory.length > 1 ? 'es' : ''}</span>
            </h3>
            <div className="flex flex-col gap-3">
              {playersWithHistory.map((p: any) => (
                <div key={p.id} className="bg-white rounded-2xl border border-red-100 shadow-sm p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="relative shrink-0">
                      {p.photo_url
                        ? <img src={p.photo_url} className="w-10 h-10 rounded-full object-cover" />
                        : <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-400">{p.name[0]}</div>}
                      {p.is_star && <span className="absolute -top-1 -right-1 bg-yellow-400 rounded-full w-4 h-4 flex items-center justify-center"><Star size={8} className="text-white fill-white" /></span>}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-800">{p.name}</p>
                      <p className="text-xs text-gray-400">Chegou às {p.arrivedAt} · {p.unitName}</p>
                    </div>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full
                      ${p.total >= 3 ? 'bg-red-100 text-red-600' : p.total === 2 ? 'bg-orange-100 text-orange-600' : 'bg-yellow-100 text-yellow-600'}`}>
                      {p.total} adv.
                    </span>
                  </div>
                  {/* Última advertência */}
                  <div className="bg-red-50 rounded-xl p-3">
                    <p className="text-xs font-semibold text-red-600 mb-1">Última advertência</p>
                    <p className="text-sm text-gray-800">{p.last.description}</p>
                    <div className="flex gap-3 mt-1.5 flex-wrap">
                      <span className="text-xs text-gray-400 capitalize">
                        📅 {new Date(p.last.created_at).toLocaleDateString('pt-BR', { weekday: 'long' })}, {new Date(p.last.created_at).toLocaleDateString('pt-BR')}
                      </span>
                      {p.last.units?.name && <span className="text-xs text-green-600">📍 {p.last.units.name.replace('Force One - ', '')}</span>}
                      {p.last.ranger_name && <span className="text-xs text-blue-500">👮 {p.last.ranger_name}</span>}
                    </div>
                  </div>
                  {/* Outras advertências se houver mais */}
                  {p.total > 1 && (
                    <p className="text-xs text-gray-400 mt-2 text-right">+ {p.total - 1} advertência{p.total - 1 > 1 ? 's' : ''} anterior{p.total - 1 > 1 ? 'es' : ''}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        </>)}
      </div>
    )
  }

  // ── BULK ────────────────────────────────────────────────
  if (view === 'bulk') {
    if (bulkDone) {
      return (
        <div className="flex flex-col items-center justify-center gap-6 px-4 py-20 max-w-2xl mx-auto text-center">
          <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center">
            <Check size={32} className="text-green-500" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">Advertências registradas!</h2>
            <p className="text-sm text-gray-400 mt-1">{checkedIds.length} jogador{checkedIds.length > 1 ? 'es' : ''} registrado{checkedIds.length > 1 ? 's' : ''}.</p>
          </div>
          <button onClick={() => setView('list')} className="px-8 py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600">
            Voltar
          </button>
        </div>
      )
    }

    // players visíveis no bulk (com busca + filtro)
    const bulkVisible = players.filter(p => {
      const matchSearch = !search.trim() || p.name.toLowerCase().includes(search.toLowerCase())
      const matchUnit   = filterUnit === 'todos' || p.unitName === filterUnit
      return matchSearch && matchUnit
    })
    const allVisibleChecked = bulkVisible.length > 0 && bulkVisible.every(p => checkedIds.includes(p.id))

    return (
      <div className="flex flex-col gap-5 px-4 py-8 max-w-2xl mx-auto">
        <div className="flex items-center gap-3">
          <button onClick={() => setView('list')} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
            <ArrowLeft size={20} className="text-gray-500" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-gray-800">Registrar Advertência</h2>
            <p className="text-sm text-gray-400">Selecione os jogadores envolvidos</p>
          </div>
        </div>

        {/* Busca */}
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar jogador..." className="w-full pl-9 pr-4 py-2.5 border-2 rounded-xl text-sm focus:outline-none focus:border-orange-400" />
        </div>

        {/* Filtro por campo */}
        {allUnits.length > 1 && (
          <div className="flex gap-2 flex-wrap">
            {allUnits.map(u => (
              <button key={u} onClick={() => setFilterUnit(u)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors
                  ${filterUnit === u ? 'bg-green-500 text-white border-green-500' : 'bg-white text-gray-600 border-gray-200 hover:border-green-400'}`}>
                {u === 'todos' ? <><Users size={12} /> Todos</> : <><MapPin size={12} />{u}</>}
              </button>
            ))}
          </div>
        )}

        {/* Selecionar todos (visíveis) */}
        <button onClick={toggleAll}
          className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all
            ${allVisibleChecked ? 'border-orange-400 bg-orange-50' : 'border-dashed border-gray-300 bg-white hover:border-orange-300'}`}>
          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors
            ${allVisibleChecked ? 'bg-orange-400 border-orange-400' : 'border-gray-300'}`}>
            {allVisibleChecked && <svg viewBox="0 0 12 12" className="w-3 h-3"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          </div>
          <span className="text-sm font-semibold text-gray-600">
            {allVisibleChecked ? 'Desmarcar todos' : 'Selecionar todos'}
          </span>
          <span className="ml-auto text-xs text-gray-400">{checkedIds.length}/{players.length}</span>
        </button>

        {/* Checklist */}
        <div className="flex flex-col gap-2">
          {bulkVisible.map(p => {
            const checked = checkedIds.includes(p.id)
            return (
              <div key={p.id} className={`rounded-2xl border-2 transition-all ${checked ? 'border-orange-300 bg-orange-50' : 'border-gray-100 bg-white'}`}>
                {/* Linha do jogador */}
                <button onClick={() => toggleCheck(p.id)} className="flex items-center gap-3 p-4 w-full text-left">
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors
                    ${checked ? 'bg-orange-400 border-orange-400' : 'border-gray-300'}`}>
                    {checked && <svg viewBox="0 0 12 12" className="w-3 h-3"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                  <div className="relative shrink-0">
                    {p.photo_url
                      ? <img src={p.photo_url} className="w-10 h-10 rounded-full object-cover" />
                      : <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-400">{p.name[0]}</div>}
                    {p.is_star && <span className="absolute -top-1 -right-1 bg-yellow-400 rounded-full w-4 h-4 flex items-center justify-center"><Star size={8} className="text-white fill-white" /></span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 text-sm">{p.name}</p>
                    <p className="text-xs text-gray-400">{p.arrivedAt} · <span className="text-green-600">{p.unitName}</span></p>
                  </div>
                </button>

                {/* Descrição individual (visível apenas quando selecionado e modo individual) */}
                {checked && descMode === 'individual' && (
                  <div className="px-4 pb-4">
                    <textarea
                      value={indivDescs[p.id] ?? ''}
                      onChange={e => setIndivDescs(prev => ({ ...prev, [p.id]: e.target.value }))}
                      placeholder={`Descrição para ${p.name.split(' ')[0]}...`}
                      rows={2}
                      className="w-full border-2 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400 resize-none bg-white"
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Modo de descrição */}
        {checkedIds.length > 0 && (
          <div>
            <label className="text-sm font-medium text-gray-600 mb-2 block">Descrição</label>
            {/* Toggle grupo / individual */}
            <div className="flex gap-2 mb-3">
              {(['group', 'individual'] as DescMode[]).map(m => (
                <button key={m} type="button" onClick={() => setDescMode(m)}
                  className={`flex-1 py-2 rounded-xl border-2 text-sm font-semibold transition-all
                    ${descMode === m ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-gray-200 text-gray-500 bg-white hover:border-gray-300'}`}>
                  {m === 'group' ? '👥 Em grupo' : '👤 Individual'}
                </button>
              ))}
            </div>

            {descMode === 'group' && (
              <textarea value={groupDesc} onChange={e => { setGroupDesc(e.target.value); setBulkError('') }}
                placeholder="Descrição aplicada a todos os selecionados..."
                rows={3} className="w-full border-2 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-400 resize-none" />
            )}
            {descMode === 'individual' && (
              <p className="text-xs text-gray-400 italic">Preencha a descrição de cada jogador acima ↑</p>
            )}
          </div>
        )}

        {bulkError && <p className="text-red-500 text-sm">{bulkError}</p>}

        {checkedIds.length > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 flex items-start gap-2">
            <AlertTriangle size={16} className="text-orange-500 shrink-0 mt-0.5" />
            <p className="text-sm text-orange-700">
              <strong>{checkedIds.length}</strong> jogador{checkedIds.length > 1 ? 'es' : ''}:&nbsp;
              {players.filter(p => checkedIds.includes(p.id)).map(p => p.name.split(' ')[0]).join(', ')}
            </p>
          </div>
        )}

        <button onClick={handleBulkSave} disabled={bulkSaving || checkedIds.length === 0}
          className="w-full py-3.5 bg-orange-500 text-white font-bold rounded-2xl hover:bg-orange-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
          <AlertTriangle size={18} />
          {bulkSaving ? 'Registrando...' : `Registrar para ${checkedIds.length || '...'} jogador${checkedIds.length !== 1 ? 'es' : ''}`}
        </button>
      </div>
    )
  }

  // ── DETAIL ──────────────────────────────────────────────
  if (view === 'detail' && selected) {
    return (
      <div className="flex flex-col gap-5 px-4 py-8 max-w-2xl mx-auto">
        <div className="flex items-center gap-3">
          <button onClick={() => setView('list')} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
            <ArrowLeft size={20} className="text-gray-500" />
          </button>
          <div className="flex items-center gap-3 flex-1">
            <div className="relative">
              {selected.photo_url
                ? <img src={selected.photo_url} className="w-12 h-12 rounded-full object-cover border-2 border-gray-200" />
                : <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-xl font-bold text-gray-400">{selected.name[0]}</div>}
              {selected.is_star && <span className="absolute -top-1 -right-1 bg-yellow-400 rounded-full w-5 h-5 flex items-center justify-center"><Star size={10} className="text-white fill-white" /></span>}
            </div>
            <div>
              <p className="font-bold text-gray-800">{selected.name}</p>
              <p className="text-xs text-gray-400">{selected.arrivedAt} · <span className="text-green-600">{selected.unitName}</span></p>
            </div>
          </div>
          <button onClick={() => { setDescription(''); setActivateStar(selected.is_star); setError(''); setView('form') }}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-xl text-sm font-semibold hover:bg-orange-600 transition-colors">
            <AlertTriangle size={14} /> Registrar
          </button>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Advertências registradas</p>
          {loadingInf ? <p className="text-sm text-gray-400 py-4 text-center">Carregando...</p>
          : infractions.length === 0 ? (
            <div className="bg-gray-50 rounded-2xl p-8 text-center text-gray-400">
              <Shield size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhuma advertência registrada</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {infractions.map(inf => (
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
                    <span className="text-xs text-gray-400 capitalize">
                      📅 {new Date(inf.created_at).toLocaleDateString('pt-BR', { weekday: 'long' })}, {new Date(inf.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </span>
                    <span className="text-xs text-gray-400">
                      🕐 {new Date(inf.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {inf.units?.name && (
                      <span className="text-xs text-green-600 font-medium">
                        📍 {inf.units.name.replace('Force One - ', '')}
                      </span>
                    )}
                    {inf.ranger_name && (
                      <span className="text-xs text-blue-500 font-medium">
                        👮 {inf.ranger_name}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── DIRECT (nova advertência com busca, filtro, cards, grupo/individual, ranger) ──
  if (view === 'direct') {
    if (directDone) return (
      <div className="flex flex-col items-center gap-6 px-4 py-16 max-w-2xl mx-auto text-center">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
          <Check size={40} className="text-green-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-800">Advertência{directSelected.length > 1 ? 's' : ''} Registrada{directSelected.length > 1 ? 's' : ''}!</h2>
        <p className="text-gray-500">{directSelected.length} operador{directSelected.length > 1 ? 'es' : ''} advertido{directSelected.length > 1 ? 's' : ''}.</p>
        <button onClick={() => setView('list')}
          className="px-8 py-3 bg-orange-500 text-white font-bold rounded-2xl hover:bg-orange-600 transition-colors">
          Voltar
        </button>
      </div>
    )

    // lista de operadores visíveis (sem os já selecionados)
    const visibleCustomers = directAllCustomers.filter(c => {
      if (directSelected.find(s => s.id === c.id)) return false
      if (directQuery.trim()) return c.name.toLowerCase().includes(directQuery.toLowerCase()) || c.cpf?.includes(directQuery) || c.whatsapp?.includes(directQuery)
      return true
    })

    return (
      <div className="flex flex-col gap-4 px-4 py-8 max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => setView('list')} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
            <ArrowLeft size={20} className="text-gray-500" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-gray-800">Nova Advertência</h2>
            <p className="text-sm text-gray-400">Selecione os operadores envolvidos</p>
          </div>
        </div>

        {/* ── Selecionados + descrição + ranger + botão ── */}
        {directSelected.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">

            {/* Header do bloco */}
            <div className="flex items-center justify-between px-4 py-3 bg-orange-50 border-b border-orange-100">
              <div className="flex items-center gap-2">
                <AlertTriangle size={15} className="text-orange-500" />
                <span className="text-sm font-bold text-orange-700">
                  {directSelected.length} operador{directSelected.length > 1 ? 'es' : ''} selecionado{directSelected.length > 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex gap-1 bg-white border border-orange-200 p-0.5 rounded-lg">
                <button onClick={() => setDirectDescMode('group')}
                  className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-semibold transition-all
                    ${directDescMode === 'group' ? 'bg-orange-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                  <Users size={11} /> Grupo
                </button>
                <button onClick={() => setDirectDescMode('individual')}
                  className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-semibold transition-all
                    ${directDescMode === 'individual' ? 'bg-orange-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                  <Shield size={11} /> Individual
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-0 divide-y divide-gray-100">

              {/* Descrição em grupo (1 campo) */}
              {directDescMode === 'group' && (
                <div className="px-4 py-4">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">
                    Descrição da Advertência *
                  </label>
                  <textarea value={directGroupDesc}
                    onChange={e => { setDirectGroupDesc(e.target.value); setDirectError('') }}
                    placeholder="Descreva o que aconteceu com todos os operadores selecionados..."
                    rows={3}
                    className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400 resize-none bg-gray-50 focus:bg-white transition-colors"
                  />
                </div>
              )}

              {/* Cards dos operadores */}
              {directSelected.map(c => (
                <div key={c.id} className="px-4 py-3">
                  {/* Operador */}
                  <div className="flex items-center gap-3 mb-3">
                    {c.photo_url
                      ? <img src={c.photo_url} className="w-9 h-9 rounded-full object-cover shrink-0" />
                      : <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-400 shrink-0">{c.name[0]}</div>
                    }
                    {c.is_star && <span className="text-yellow-400">⭐</span>}
                    <span className="font-semibold text-gray-800 flex-1 text-sm">{c.name}</span>
                    <button onClick={() => {
                      setDirectSelected(prev => prev.filter(s => s.id !== c.id))
                      setDirectIndivDescs(prev => { const n = { ...prev }; delete n[c.id]; return n })
                    }} className="p-1.5 text-gray-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
                  {/* Descrição individual */}
                  {directDescMode === 'individual' && (
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
                        Descrição *
                      </label>
                      <textarea
                        value={directIndivDescs[c.id] ?? ''}
                        onChange={e => { setDirectIndivDescs(prev => ({ ...prev, [c.id]: e.target.value })); setDirectError('') }}
                        placeholder={`Descreva o que aconteceu com ${c.name}...`}
                        rows={3}
                        className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400 resize-none bg-gray-50 focus:bg-white transition-colors"
                      />
                    </div>
                  )}
                </div>
              ))}

              {/* Ranger */}
              <div className="px-4 py-4">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">
                  Ranger que presenciou
                </label>
                <input value={directRanger} onChange={e => setDirectRanger(e.target.value)}
                  placeholder="Nome do ranger (opcional)"
                  className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400 bg-gray-50 focus:bg-white transition-colors" />
              </div>

              {/* Erro + botão */}
              <div className="px-4 py-4 bg-gray-50">
                {directError && <p className="text-red-500 text-sm mb-3">{directError}</p>}
                <button onClick={handleDirectSave} disabled={directSaving}
                  className="w-full py-3 bg-orange-500 text-white font-bold rounded-xl hover:bg-orange-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                  <AlertTriangle size={16} />
                  {directSaving ? 'Salvando...' : `Registrar ${directSelected.length > 1 ? `${directSelected.length} Advertências` : 'Advertência'}`}
                </button>
              </div>

            </div>
          </div>
        )}

        {/* Busca */}
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={directQuery} onChange={e => setDirectQuery(e.target.value)}
            placeholder="Buscar por nome, CPF ou WhatsApp..."
            className="w-full pl-9 pr-4 py-3 border-2 rounded-xl text-sm focus:outline-none focus:border-orange-400" />
        </div>

        {/* Filtro por filial — filiais primeiro, Todos no final */}
        {directUnits.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {directUnits.map(u => (
              <button key={u.id} onClick={() => { setDirectFilterUnit(u.id); loadDirectByUnit(u.id) }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors
                  ${directFilterUnit === u.id ? 'bg-green-500 text-white border-green-500' : 'bg-white text-gray-600 border-gray-200 hover:border-green-400'}`}>
                <MapPin size={12} /> {u.name.replace('Force One - ', '')}
              </button>
            ))}
            <button onClick={() => { setDirectFilterUnit('todos'); loadDirectByUnit('todos') }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors
                ${directFilterUnit === 'todos' ? 'bg-green-500 text-white border-green-500' : 'bg-white text-gray-600 border-gray-200 hover:border-green-400'}`}>
              <Users size={12} /> Todos
            </button>
          </div>
        )}

        {/* Cards de operadores */}
        {directLoadingAll ? (
          <p className="text-sm text-gray-400 text-center py-6">Carregando operadores...</p>
        ) : visibleCustomers.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">Nenhum operador encontrado.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {visibleCustomers.map(c => (
              <button key={c.id}
                onClick={() => setDirectSelected(prev => [...prev, c])}
                className="flex items-center gap-4 p-4 rounded-2xl shadow-sm border transition-all text-left bg-white border-gray-100 hover:border-orange-200">
                {c.photo_url
                  ? <img src={c.photo_url} className="w-10 h-10 rounded-full object-cover shrink-0" />
                  : <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-base font-bold text-gray-400 shrink-0">{c.name[0]}</div>
                }
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800">{c.name}</p>
                  <p className="text-xs text-gray-400">CPF: {c.cpf}</p>
                </div>
                {c.is_star && <Star size={14} className="text-yellow-400 fill-yellow-400 shrink-0" />}
                <Plus size={16} className="text-orange-400 shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ── FORM (individual) ───────────────────────────────────
  if (view === 'form' && selected) {
    return (
      <div className="flex flex-col gap-5 px-4 py-8 max-w-2xl mx-auto">
        <div className="flex items-center gap-3">
          <button onClick={() => selected.unitId === null && selected.arrivedAt === '' ? setView('direct') : setView('detail')}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
            <ArrowLeft size={20} className="text-gray-500" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-gray-800">Nova Advertência</h2>
            <p className="text-sm text-gray-400">{selected.name}</p>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-600 mb-2 block">Descrição *</label>
          <textarea value={description} onChange={e => { setDescription(e.target.value); setError('') }}
            placeholder="Descreva o que aconteceu..."
            rows={5} className="w-full border-2 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-400 resize-none" />
        </div>

        <button type="button" onClick={() => setActivateStar(v => !v)}
          className={`flex items-center gap-3 w-full p-4 rounded-xl border-2 text-left transition-all
            ${activateStar ? 'border-yellow-400 bg-yellow-50' : 'border-gray-200 bg-white'}`}>
          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors
            ${activateStar ? 'bg-yellow-400 border-yellow-400' : 'border-gray-300'}`}>
            {activateStar && <svg viewBox="0 0 12 12" className="w-3 h-3"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          </div>
          <div>
            <p className={`text-sm font-semibold ${activateStar ? 'text-yellow-700' : 'text-gray-700'}`}>⭐ Ativar como Operador Estrela</p>
            <p className="text-xs text-gray-400">Marcar este jogador para atenção especial</p>
          </div>
        </button>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button onClick={handleSave} disabled={saving}
          className="w-full py-3.5 bg-orange-500 text-white font-bold rounded-2xl hover:bg-orange-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
          <AlertTriangle size={18} /> {saving ? 'Salvando...' : 'Registrar Advertência'}
        </button>
      </div>
    )
  }

  return null
}
