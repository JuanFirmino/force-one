import { useEffect, useState, useCallback } from 'react'
import { ChefHat, Clock, Flame, CheckCircle2, X, AlertTriangle, ChevronRight, RotateCcw, ShoppingBag } from 'lucide-react'
import { supabase } from '../../lib/supabase'

type KitchenStatus = 'pending' | 'accepted' | 'ready' | 'done' | 'rejected'

interface KitchenItem {
  id: string
  product_name: string
  quantity: number
  notes: string | null
  kitchen_status: KitchenStatus
  kitchen_rejection_reason: string | null
  kitchen_updated_at: string | null
}

interface KitchenOrder {
  sale_id: string
  customer_name: string | null
  created_at: string
  items: KitchenItem[]
}

type Tab = 'fila' | 'preparo' | 'retirada' | 'concluido'

const REJECTION_REASONS = [
  'Ingrediente em falta',
  'Equipamento com problema',
  'Produto indisponível',
  'Outro',
]

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60) return `${diff}s`
  if (diff < 3600) return `${Math.floor(diff / 60)}min`
  return `${Math.floor(diff / 3600)}h`
}

function parseNotes(notes: string | null): string[] {
  if (!notes) return []
  try { return JSON.parse(notes) } catch { return [notes] }
}

export function CozinhaModule() {
  const [orders, setOrders] = useState<KitchenOrder[]>([])
  const [tab, setTab] = useState<Tab>('fila')
  const [loading, setLoading] = useState(true)

  // Reject modal state
  const [rejectTarget, setRejectTarget] = useState<KitchenOrder | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectCustom, setRejectCustom] = useState('')
  const [rejecting, setRejecting] = useState(false)

  const loadOrders = useCallback(async () => {
    const { data } = await supabase
      .from('sale_items')
      .select(`
        id, product_name, quantity, notes,
        kitchen_status, kitchen_rejection_reason, kitchen_updated_at,
        sales (id, created_at, customer_name, customers (name)),
        products!inner (category_id)
      `)
      .in('kitchen_status', ['pending', 'accepted', 'ready', 'done', 'rejected'])
      .eq('products.category_id', '7b2e9e0c-66eb-4971-a074-06c64c97725a')
      .order('created_at', { referencedTable: 'sales', ascending: true })

    if (!data) return

    const map = new Map<string, KitchenOrder>()
    for (const row of data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sale = (row.sales as any) as { id: string; created_at: string; customer_name: string | null; customers: { name: string } | null } | null
      if (!sale) continue
      if (!map.has(sale.id)) {
        map.set(sale.id, {
          sale_id: sale.id,
          customer_name: sale.customers?.name ?? sale.customer_name ?? null,
          created_at: sale.created_at,
          items: [],
        })
      }
      map.get(sale.id)!.items.push({
        id: row.id,
        product_name: row.product_name,
        quantity: row.quantity,
        notes: row.notes,
        kitchen_status: row.kitchen_status as KitchenStatus,
        kitchen_rejection_reason: row.kitchen_rejection_reason,
        kitchen_updated_at: row.kitchen_updated_at,
      })
    }
    setOrders(Array.from(map.values()))
    setLoading(false)
  }, [])

  useEffect(() => {
    loadOrders()
    const channel = supabase
      .channel('kitchen-items')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sale_items' }, loadOrders)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [loadOrders])

  async function acceptOrder(order: KitchenOrder) {
    const ids = order.items.map(i => i.id)
    await supabase.from('sale_items')
      .update({ kitchen_status: 'accepted', kitchen_updated_at: new Date().toISOString() })
      .in('id', ids)
    loadOrders()
  }

  async function confirmReject() {
    if (!rejectTarget) return
    const reason = rejectReason === 'Outro' ? rejectCustom : rejectReason
    if (!reason.trim()) return
    setRejecting(true)
    const ids = rejectTarget.items.map(i => i.id)
    await supabase.from('sale_items')
      .update({
        kitchen_status: 'rejected',
        kitchen_rejection_reason: reason,
        kitchen_updated_at: new Date().toISOString(),
        rejection_acknowledged: false,
      })
      .in('id', ids)
    setRejecting(false)
    setRejectTarget(null)
    setRejectReason('')
    setRejectCustom('')
    loadOrders()
  }

  async function readyOrder(order: KitchenOrder) {
    const ids = order.items.map(i => i.id)
    await supabase.from('sale_items')
      .update({ kitchen_status: 'ready', kitchen_updated_at: new Date().toISOString() })
      .in('id', ids)
    loadOrders()
  }

  async function completeOrder(order: KitchenOrder) {
    const ids = order.items.map(i => i.id)
    await supabase.from('sale_items')
      .update({ kitchen_status: 'done', kitchen_updated_at: new Date().toISOString() })
      .in('id', ids)
    loadOrders()
  }

  const statusForTab: Record<Tab, KitchenStatus> = {
    fila:     'pending',
    preparo:  'accepted',
    retirada: 'ready',
    concluido:'done',
  }

  const visibleOrders = orders.filter(o =>
    o.items.some(i => i.kitchen_status === statusForTab[tab])
  )

  const countFila     = orders.filter(o => o.items.some(i => i.kitchen_status === 'pending')).length
  const countPreparo  = orders.filter(o => o.items.some(i => i.kitchen_status === 'accepted')).length
  const countRetirada = orders.filter(o => o.items.some(i => i.kitchen_status === 'ready')).length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <ChefHat size={32} className="animate-pulse" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col max-w-sm mx-auto relative">

      {/* Header */}
      <div className="bg-orange-500 text-white px-5 pt-6 pb-4 flex items-center gap-3 shadow-md">
        <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center">
          <ChefHat size={22} />
        </div>
        <div>
          <h1 className="text-lg font-bold leading-tight">Cozinha</h1>
          <p className="text-xs text-orange-100">
            {countFila > 0 ? `${countFila} pedido${countFila > 1 ? 's' : ''} na fila` : 'Nenhum pedido pendente'}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 flex">
        {([
          { id: 'fila',     label: 'Fila',      icon: Clock,        count: countFila,     color: 'text-orange-500 border-orange-500' },
          { id: 'preparo',  label: 'Preparo',   icon: Flame,        count: countPreparo,  color: 'text-blue-500 border-blue-500' },
          { id: 'retirada', label: 'Retirada',  icon: ShoppingBag,  count: countRetirada, color: 'text-purple-500 border-purple-500' },
          { id: 'concluido',label: 'Concluído', icon: CheckCircle2, count: 0,             color: 'text-green-500 border-green-500' },
        ] as const).map(({ id, label, icon: Icon, count, color }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 flex flex-col items-center gap-1 h-14 justify-center text-xs font-semibold border-b-2 transition-colors relative whitespace-nowrap
              ${tab === id ? color : 'text-gray-400 border-transparent'}`}
          >
            <Icon size={18} />
            {label}
            {count > 0 && (
              <span className="badge-pulse absolute top-1.5 right-[calc(50%-16px)] w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Order list */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3 pb-6">
        {visibleOrders.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-gray-400">
            {tab === 'fila' && <Clock size={40} className="opacity-30" />}
            {tab === 'preparo' && <Flame size={40} className="opacity-30" />}
            {tab === 'retirada' && <ShoppingBag size={40} className="opacity-30" />}
            {tab === 'concluido' && <CheckCircle2 size={40} className="opacity-30" />}
            <p className="text-sm">Nenhum pedido aqui</p>
          </div>
        ) : visibleOrders.map(order => {
          const tabItems = order.items.filter(i => i.kitchen_status === statusForTab[tab])
          return (
            <div key={order.sale_id} className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">

              {/* Order header */}
              <div className={`flex items-center justify-between px-4 py-3 border-b border-gray-50
                ${tab === 'fila' ? 'bg-orange-50' : tab === 'preparo' ? 'bg-blue-50' : tab === 'retirada' ? 'bg-purple-50' : 'bg-green-50'}`}>
                <div>
                  <p className="font-bold text-gray-800 text-sm">
                    {order.customer_name ?? 'Anônimo'}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                    <Clock size={10} /> há {timeAgo(order.created_at)}
                  </p>
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full
                  ${tab === 'fila'     ? 'bg-orange-100 text-orange-600'
                  : tab === 'preparo'  ? 'bg-blue-100 text-blue-600'
                  : tab === 'retirada' ? 'bg-purple-100 text-purple-600'
                  :                     'bg-green-100 text-green-600'}`}>
                  {tab === 'fila' ? 'Na fila' : tab === 'preparo' ? 'Preparando' : tab === 'retirada' ? 'Aguardando retirada' : 'Pronto'}
                </span>
              </div>

              {/* Items */}
              <div className="divide-y divide-gray-100">
                {tabItems.map(item => {
                  const allObs = parseNotes(item.notes)
                  const hasAnyObs = allObs.some(Boolean)
                  return (
                    <div key={item.id} className="px-4 py-3 flex flex-col gap-2">

                      {/* Nome + badge de quantidade */}
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-gray-800 text-[15px] leading-snug">{item.product_name}</p>
                        <span className={`shrink-0 text-sm font-extrabold px-2.5 py-0.5 rounded-lg
                          ${item.quantity > 1 ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-500'}`}>
                          ×{item.quantity}
                        </span>
                      </div>

                      {/* Observações — sempre visíveis */}
                      {item.quantity === 1 && (
                        <div className="flex items-center gap-1.5">
                          <span className="w-1 h-1 rounded-full bg-orange-400 shrink-0" />
                          <p className="text-xs font-medium text-orange-600">
                            {allObs[0] || 'sem observação'}
                          </p>
                        </div>
                      )}

                      {item.quantity > 1 && (
                        <div className="flex flex-col gap-1.5 ml-1 border-l-2 border-orange-100 pl-3">
                          {allObs.map((ob, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0
                                bg-orange-100 text-orange-500">
                                {i + 1}
                              </span>
                              <p className="text-xs text-orange-600 font-medium">{ob || 'sem observação'}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Actions */}
              {tab === 'fila' && (
                <div className="flex gap-2 px-4 pb-4 pt-2">
                  <button
                    onClick={() => setRejectTarget(order)}
                    className="flex-1 py-2.5 rounded-xl border-2 border-red-200 text-red-500 text-sm font-semibold hover:bg-red-50 active:scale-95 transition-all flex items-center justify-center gap-1.5">
                    <X size={15} /> Recusar
                  </button>
                  <button
                    onClick={() => acceptOrder(order)}
                    className="flex-1 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-bold hover:bg-orange-600 active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-sm shadow-orange-200">
                    <ChefHat size={15} /> Aceitar
                  </button>
                </div>
              )}

              {tab === 'preparo' && (
                <div className="px-4 pb-4 pt-2">
                  <button
                    onClick={() => readyOrder(order)}
                    className="w-full py-3 rounded-xl bg-purple-500 text-white text-sm font-bold hover:bg-purple-600 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-sm shadow-purple-200">
                    <ShoppingBag size={16} /> Pronto para Retirada
                  </button>
                </div>
              )}

              {tab === 'retirada' && (
                <div className="px-4 pb-4 pt-2">
                  <button
                    onClick={() => completeOrder(order)}
                    className="w-full py-3 rounded-xl bg-green-500 text-white text-sm font-bold hover:bg-green-600 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-sm shadow-green-200">
                    <CheckCircle2 size={16} /> Confirmar Retirada
                  </button>
                </div>
              )}

              {tab === 'concluido' && (
                <div className="px-4 pb-3 pt-1">
                  <p className="text-xs text-gray-400 text-center">
                    Concluído {order.items[0]?.kitchen_updated_at ? timeAgo(order.items[0].kitchen_updated_at) + ' atrás' : ''}
                  </p>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Reject confirmation modal */}
      {rejectTarget && (
        <div className="absolute inset-0 bg-black/50 flex items-end z-50" onClick={e => { if (e.target === e.currentTarget) setRejectTarget(null) }}>
          <div className="bg-white rounded-t-3xl w-full px-5 pt-5 pb-8 flex flex-col gap-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-2xl flex items-center justify-center shrink-0">
                <AlertTriangle size={20} className="text-red-500" />
              </div>
              <div>
                <h3 className="font-bold text-gray-800">Recusar pedido?</h3>
                <p className="text-xs text-gray-400">
                  {rejectTarget.customer_name ?? 'Anônimo'} será notificado na tela de Venda
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Motivo</p>
              {REJECTION_REASONS.map(r => (
                <button
                  key={r}
                  onClick={() => setRejectReason(r)}
                  className={`flex items-center justify-between px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all
                    ${rejectReason === r ? 'border-red-400 bg-red-50 text-red-700' : 'border-gray-100 text-gray-600 hover:border-gray-200'}`}>
                  {r}
                  {rejectReason === r && <ChevronRight size={16} className="text-red-400" />}
                </button>
              ))}

              {rejectReason === 'Outro' && (
                <input
                  autoFocus
                  value={rejectCustom}
                  onChange={e => setRejectCustom(e.target.value)}
                  placeholder="Descreva o motivo..."
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-red-300 bg-gray-50"
                />
              )}
            </div>

            <div className="flex gap-2 mt-1">
              <button
                onClick={() => { setRejectTarget(null); setRejectReason(''); setRejectCustom('') }}
                className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-gray-500 text-sm font-semibold hover:bg-gray-50 transition-colors flex items-center justify-center gap-1.5">
                <RotateCcw size={14} /> Cancelar
              </button>
              <button
                onClick={confirmReject}
                disabled={rejecting || !rejectReason || (rejectReason === 'Outro' && !rejectCustom.trim())}
                className="flex-1 py-3 rounded-xl bg-red-500 text-white text-sm font-bold hover:bg-red-600 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5 active:scale-95">
                <X size={14} /> Confirmar Recusa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
