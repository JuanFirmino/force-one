import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, ChevronDown, ChevronUp, TrendingUp, ShoppingCart, DoorOpen, Calendar } from 'lucide-react'
import { supabase } from '../../lib/supabase'

/* ── types ── */
interface SaleItem { id: string; sale_id: string; product_name: string; quantity: number; unit_price: number; subtotal: number; notes?: string }
interface Sale {
  id: string; created_at: string; total_amount: number; subtotal?: number
  discount_amount?: number; payment_details?: string; unit_id?: string
  payment_methods?: { name: string }
  units?: { id: string; name: string }
  customers?: { name: string; photo_url?: string }
  sale_items: SaleItem[]
}
interface Visit {
  id: string; visited_at: string; total_amount: number; unit_id?: string
  payment_methods?: { name: string }
  units?: { id: string; name: string }
  access_types?: { name: string }
  customers?: { name: string; photo_url?: string }
}

/* ── helpers ── */
const fmt = (v: number) => `R$ ${Number(v).toFixed(2).replace('.', ',')}`
function toLocalDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
const PM_EMOJI: Record<string, string> = { 'cartão de crédito':'💳','cartão de débito':'🏧','dinheiro':'💵','pix':'⚡' }
const pmEmoji = (n = '') => PM_EMOJI[n.toLowerCase()] ?? '💰'

/* ── main ── */
export function CaixaModule() {
  const [dateMode, setDateMode]   = useState<'hoje'|'ontem'|'custom'>('hoje')
  const [customDate, setCustomDate] = useState(toLocalDate(new Date()))
  const [sales,  setSales]        = useState<Sale[]>([])
  const [visits, setVisits]       = useState<Visit[]>([])
  const [units,  setUnits]        = useState<{id:string;name:string}[]>([])
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [unitFilter, setUnitFilter] = useState('todas')
  const [typeFilter, setTypeFilter] = useState<'todos'|'entradas'|'vendas'>('todos')
  const [expanded,   setExpanded]   = useState<string|null>(null)

  function getRange() {
    const base = new Date()
    if (dateMode === 'ontem') base.setDate(base.getDate()-1)
    else if (dateMode === 'custom') {
      const [y,m,d] = customDate.split('-').map(Number)
      base.setFullYear(y,m-1,d)
    }
    const start = new Date(base); start.setHours(0,0,0,0)
    const end   = new Date(base); end.setHours(23,59,59,999)
    return {start,end}
  }

  const load = useCallback(async (silent=false) => {
    silent ? setRefreshing(true) : setLoading(true)
    const {start,end} = getRange()
    const s = start.toISOString(), e = end.toISOString()

    const [salesRes, visitsRes, unitsRes] = await Promise.all([
      supabase.from('sales')
        .select('id, created_at, total_amount, subtotal, discount_amount, payment_details, unit_id, payment_methods(name), units(id,name), customers(name,photo_url)')
        .gte('created_at',s).lte('created_at',e).order('created_at',{ascending:false}),
      supabase.from('visits')
        .select('*, payment_methods(name), units(id,name), access_types(name), customers(name,photo_url)')
        .gte('visited_at',s).lte('visited_at',e).order('visited_at',{ascending:false}),
      supabase.from('units').select('id,name').order('name'),
    ])

    const rawSales = (salesRes.data ?? []) as any[]
    let salesWithItems: Sale[] = rawSales.map(s => ({...s, sale_items:[]}))
    if (rawSales.length > 0) {
      const ids = rawSales.map((s:any) => s.id)
      const {data: itemsData} = await supabase.from('sale_items').select('*').in('sale_id', ids)
      const items = (itemsData ?? []) as SaleItem[]
      salesWithItems = rawSales.map((s:any) => ({...s, sale_items: items.filter(i => i.sale_id === s.id)}))
    }

    setSales(salesWithItems)
    setVisits((visitsRes.data ?? []) as Visit[])
    setUnits((unitsRes.data ?? []) as {id:string;name:string}[])
    silent ? setRefreshing(false) : setLoading(false)
  }, [dateMode, customDate])

  useEffect(() => { load() }, [load])

  /* filtros */
  const fSales  = unitFilter==='todas' ? sales  : sales.filter(s  => s.units?.id===unitFilter)
  const fVisits = unitFilter==='todas' ? visits : visits.filter(v => v.units?.id===unitFilter)

  /* métricas */
  const totalRec  = fSales.reduce((a,s)=>a+Number(s.total_amount),0) + fVisits.reduce((a,v)=>a+Number(v.total_amount),0)
  const salesRec  = fSales.reduce((a,s)=>a+Number(s.total_amount),0)
  const visitsRec = fVisits.reduce((a,v)=>a+Number(v.total_amount),0)
  const totalOps  = fSales.length + fVisits.length

  const byPayment: Record<string,{count:number;revenue:number}> = {}
  ;[...fSales,...fVisits].forEach(r => {
    const n = (r as any).payment_methods?.name ?? 'N/A'
    if (!byPayment[n]) byPayment[n] = {count:0,revenue:0}
    byPayment[n].count++; byPayment[n].revenue += Number((r as any).total_amount)
  })

  const itemsMap: Record<string,number> = {}
  fSales.forEach(s => s.sale_items.forEach(i => { itemsMap[i.product_name] = (itemsMap[i.product_name]??0)+i.quantity }))
  const topItems = Object.entries(itemsMap).sort((a,b)=>b[1]-a[1]).slice(0,5)

  /* lista combinada */
  const combined = [
    ...(typeFilter!=='vendas'   ? fVisits.map(v=>({type:'entrada' as const, time:new Date(v.visited_at).getTime(), data:v})) : []),
    ...(typeFilter!=='entradas' ? fSales.map(s =>({type:'venda'   as const, time:new Date(s.created_at).getTime(),  data:s})) : []),
  ].sort((a,b)=>b.time-a.time)

  const dateLabel = dateMode==='hoje' ? 'Hoje' : dateMode==='ontem' ? 'Ontem'
    : new Date(customDate+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'})

  return (
    <div className="min-h-full bg-gray-50">

      {/* ── Hero header ─────────────────────────────── */}
      <div className="bg-gray-900 px-6 pt-6 pb-8">
        <div className="max-w-4xl mx-auto">

          {/* título + refresh */}
          <div className="flex items-center justify-between mb-5">
            <h1 className="text-2xl font-black text-white">Caixa</h1>
            <button onClick={()=>load(true)} disabled={refreshing}
              className="p-2 text-gray-400 hover:text-white rounded-xl transition-colors">
              <RefreshCw size={18} className={refreshing?'animate-spin':''} />
            </button>
          </div>

          {/* Filtros de data */}
          <div className="flex gap-2 flex-wrap mb-4">
            {(['hoje','ontem'] as const).map(m=>(
              <button key={m} onClick={()=>setDateMode(m)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors
                  ${dateMode===m ? 'bg-white text-gray-900' : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}>
                {m==='hoje'?'Hoje':'Ontem'}
              </button>
            ))}
            <label className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium cursor-pointer transition-colors
              ${dateMode==='custom' ? 'bg-white text-gray-900' : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}>
              <Calendar size={13} />
              <input type="date" value={customDate}
                onChange={e=>{setCustomDate(e.target.value);setDateMode('custom')}}
                className="bg-transparent outline-none w-28 text-inherit" />
            </label>
          </div>

          {/* Filtros de filial */}
          {units.length > 1 && (
            <div className="flex gap-2 flex-wrap mb-5">
              <button onClick={()=>setUnitFilter('todas')}
                className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors
                  ${unitFilter==='todas' ? 'bg-green-500 text-white' : 'bg-white/10 text-gray-400 hover:bg-white/20'}`}>
                Todas as filiais
              </button>
              {units.map(u=>(
                <button key={u.id} onClick={()=>setUnitFilter(u.id)}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors
                    ${unitFilter===u.id ? 'bg-green-500 text-white' : 'bg-white/10 text-gray-400 hover:bg-white/20'}`}>
                  {u.name.replace('Force One - ','')}
                </button>
              ))}
            </div>
          )}

          {/* Número principal */}
          {!loading && (
            <div>
              <p className="text-gray-400 text-xs font-medium uppercase tracking-widest mb-1">Receita total</p>
              <p className="text-5xl font-black text-white">{fmt(totalRec)}</p>
              <p className="text-gray-400 text-sm mt-1">{totalOps} operaç{totalOps!==1?'ões':'ão'}</p>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-gray-400">Carregando...</div>
      ) : (
        <div className="max-w-4xl mx-auto px-4 py-6 flex flex-col gap-5">

          {/* Cards Entradas | Vendas */}
          <div className="grid grid-cols-2 gap-3 -mt-5">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center">
                  <DoorOpen size={14} className="text-blue-500" />
                </div>
                <span className="text-sm font-semibold text-gray-700">Entradas</span>
              </div>
              <p className="text-xl font-black text-gray-900">{fmt(visitsRec)}</p>
              <p className="text-xs text-gray-400 mt-0.5">{fVisits.length} operador{fVisits.length!==1?'es':''}</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 bg-green-100 rounded-lg flex items-center justify-center">
                  <ShoppingCart size={14} className="text-green-500" />
                </div>
                <span className="text-sm font-semibold text-gray-700">Vendas</span>
              </div>
              <p className="text-xl font-black text-gray-900">{fmt(salesRec)}</p>
              <p className="text-xs text-gray-400 mt-0.5">{fSales.length} pedido{fSales.length!==1?'s':''}</p>
            </div>
          </div>

          {totalOps === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center text-gray-400">
              <ShoppingCart size={36} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm">Nenhuma operação registrada neste dia.</p>
            </div>
          ) : (
            <>
              {/* Por pagamento */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Por pagamento</p>
                <div className="flex flex-col gap-3">
                  {Object.entries(byPayment).sort((a,b)=>b[1].revenue-a[1].revenue).map(([name,val])=>{
                    const pct = totalRec > 0 ? (val.revenue/totalRec)*100 : 0
                    return (
                      <div key={name}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-base">{pmEmoji(name)}</span>
                            <span className="text-sm font-medium text-gray-700">{name}</span>
                            <span className="text-xs text-gray-400">{val.count}x</span>
                          </div>
                          <span className="text-sm font-bold text-gray-800">{fmt(val.revenue)}</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-green-400 rounded-full" style={{width:`${pct}%`}} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Mais vendidos */}
              {topItems.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp size={14} className="text-green-500" />
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Mais vendidos</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    {topItems.map(([name,qty],i)=>(
                      <div key={name} className="flex items-center gap-3">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0
                          ${i===0?'bg-yellow-100 text-yellow-600':i===1?'bg-gray-100 text-gray-500':i===2?'bg-orange-100 text-orange-500':'bg-gray-50 text-gray-400'}`}>
                          {i+1}
                        </span>
                        <span className="flex-1 text-sm text-gray-700 truncate">{name}</span>
                        <span className="text-sm font-bold text-gray-800 shrink-0">{qty}×</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Lista de transações */}
              <div>
                {/* filtro de tipo */}
                <div className="flex gap-2 mb-3">
                  {([
                    {id:'todos',    label:'Todos',    count:combined.length},
                    {id:'entradas', label:'Entradas', count:fVisits.length},
                    {id:'vendas',   label:'Vendas',   count:fSales.length},
                  ] as const).map(f=>(
                    <button key={f.id} onClick={()=>setTypeFilter(f.id)}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors
                        ${typeFilter===f.id ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                      {f.label}
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full
                        ${typeFilter===f.id ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>
                        {f.count}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="flex flex-col gap-2">
                  {combined.map(row=>{
                    const key = row.data.id
                    const isOpen = expanded===key
                    const toggle = ()=>setExpanded(isOpen?null:key)

                    if (row.type==='entrada') {
                      const v = row.data as Visit
                      const d = new Date(v.visited_at)
                      return (
                        <div key={key} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                          <button onClick={toggle} className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors text-left">
                            {v.customers?.photo_url
                              ? <img src={v.customers.photo_url} className="w-9 h-9 rounded-full object-cover shrink-0" alt="" />
                              : <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-500 text-sm shrink-0">
                                  {(v.customers?.name??'A')[0].toUpperCase()}
                                </div>
                            }
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold text-gray-800 truncate">{v.customers?.name??'Anônimo'}</p>
                                <span className="text-xs bg-blue-100 text-blue-600 font-medium px-2 py-0.5 rounded-full shrink-0">Entrada</span>
                              </div>
                              <p className="text-xs text-gray-400 mt-0.5">
                                {d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})} · {v.units?.name?.replace('Force One - ','')??'—'}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="font-bold text-gray-800">{fmt(Number(v.total_amount))}</span>
                              {isOpen ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
                            </div>
                          </button>
                          {isOpen && (
                            <div className="border-t border-gray-50 px-4 py-3 bg-blue-50/40 flex flex-col gap-1.5">
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Tipo de acesso</span>
                                <span className="font-medium text-gray-800">{v.access_types?.name??'—'}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Pagamento</span>
                                <span className="font-medium text-gray-800">{pmEmoji(v.payment_methods?.name)} {v.payment_methods?.name??'—'}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Unidade</span>
                                <span className="font-medium text-gray-800">{v.units?.name?.replace('Force One - ','')??'—'}</span>
                              </div>
                              <div className="flex justify-between text-sm font-bold text-blue-600 border-t border-blue-100 pt-2 mt-1">
                                <span>Total pago</span><span>{fmt(Number(v.total_amount))}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    }

                    const s = row.data as Sale
                    const d = new Date(s.created_at)
                    return (
                      <div key={key} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <button onClick={toggle} className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors text-left">
                          {s.customers?.photo_url
                            ? <img src={s.customers.photo_url} className="w-9 h-9 rounded-full object-cover shrink-0" alt="" />
                            : <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center font-bold text-green-600 text-sm shrink-0">
                                {(s.customers?.name??'A')[0].toUpperCase()}
                              </div>
                          }
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-gray-800 truncate">{s.customers?.name??'Anônimo'}</p>
                              <span className="text-xs bg-green-100 text-green-600 font-medium px-2 py-0.5 rounded-full shrink-0">Venda</span>
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})} · {s.sale_items.length} item{s.sale_items.length!==1?'ns':''} · {s.units?.name?.replace('Force One - ','')??'—'}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-bold text-gray-800">{fmt(Number(s.total_amount))}</span>
                            {isOpen ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
                          </div>
                        </button>
                        {isOpen && (()=>{
                          const splitPayments: {method:string;amount:number}[] = (() => {
                            try { return s.payment_details ? JSON.parse(s.payment_details) : [] } catch { return [] }
                          })()
                          const hasDiscount = Number(s.discount_amount) > 0
                          const hasSplit = splitPayments.length > 1
                          return (
                            <div className="border-t border-gray-50 px-4 py-3 bg-green-50/40 flex flex-col gap-2">

                              {/* Itens */}
                              {s.sale_items.map(item=>(
                                <div key={item.id} className="flex flex-col gap-0.5 py-1 border-b border-gray-50 last:border-0">
                                  <div className="flex justify-between text-sm">
                                    <span className="font-medium text-gray-800">{item.quantity}× {item.product_name}</span>
                                    <span className="font-semibold text-gray-800">{fmt(Number(item.subtotal))}</span>
                                  </div>
                                  <span className="text-xs text-gray-400">{fmt(Number(item.unit_price))} / un</span>
                                  {item.notes && (()=>{
                                    try {
                                      const arr = JSON.parse(item.notes) as string[]
                                      return arr.filter(Boolean).map((n,i)=>(
                                        <p key={i} className="text-xs text-orange-500">💬 Un.{i+1}: {n}</p>
                                      ))
                                    } catch { return <p className="text-xs text-orange-500">💬 {item.notes}</p> }
                                  })()}
                                </div>
                              ))}

                              {/* Subtotal + desconto + total */}
                              <div className="flex flex-col gap-1 border-t border-green-100 pt-2 mt-1">
                                {hasDiscount && (
                                  <>
                                    <div className="flex justify-between text-sm text-gray-500">
                                      <span>Subtotal</span>
                                      <span>{fmt(Number(s.subtotal ?? s.total_amount))}</span>
                                    </div>
                                    <div className="flex justify-between text-sm text-purple-600 font-medium">
                                      <span>🏷️ Desconto</span>
                                      <span>− {fmt(Number(s.discount_amount))}</span>
                                    </div>
                                  </>
                                )}
                                <div className="flex justify-between text-sm font-bold text-green-600">
                                  <span>Total</span><span>{fmt(Number(s.total_amount))}</span>
                                </div>
                              </div>

                              {/* Pagamento */}
                              <div className="flex flex-col gap-1 border-t border-green-100 pt-2">
                                {hasSplit ? (
                                  splitPayments.map((p,i)=>(
                                    <div key={i} className="flex justify-between text-sm">
                                      <span className="text-gray-500">{pmEmoji(p.method)} {p.method}</span>
                                      <span className="font-medium text-gray-800">{fmt(p.amount)}</span>
                                    </div>
                                  ))
                                ) : (
                                  <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Pagamento</span>
                                    <span className="font-medium text-gray-800">{pmEmoji(s.payment_methods?.name)} {s.payment_methods?.name??'—'}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })()}
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
