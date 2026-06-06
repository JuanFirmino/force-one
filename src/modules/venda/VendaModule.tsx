import { useEffect, useState, useCallback } from 'react'
import { Search, ShoppingCart, Plus, Minus, Check, User, UserX, RotateCcw, CheckCircle, X, MessageSquare, Lock, Tag, Eye, EyeOff, AlertTriangle } from 'lucide-react'
import { supabase, verifyPassword as edgeVerify } from '../../lib/supabase'
import { useUnitStore } from '../../stores/unitStore'
import type { Customer, PaymentMethod } from '../../types'

interface Category { id: string; name: string; sort_order: number }
interface Product  { id: string; name: string; description?: string; price: number; category_id: string | null; active: boolean }
interface CartItem  { product: Product; qty: number; obs: string[] }

function currency(v: number) { return `R$ ${Number(v).toFixed(2).replace('.', ',')}` }

interface RejectedAlert {
  id: string
  product_name: string
  quantity: number
  kitchen_rejection_reason: string | null
  customer_name: string | null
}

function RejectionBanner({ alerts, onAcknowledge }: { alerts: RejectedAlert[]; onAcknowledge: (ids: string[]) => void }) {
  if (alerts.length === 0) return null
  return (
    <div className="fixed top-0 inset-x-0 z-50 flex flex-col gap-2 p-3 pointer-events-none">
      {alerts.map(a => (
        <div key={a.id} className="pointer-events-auto bg-red-600 text-white rounded-2xl shadow-xl px-4 py-3 flex items-start gap-3 max-w-lg mx-auto w-full animate-in slide-in-from-top-2">
          <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
            <AlertTriangle size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm">Pedido recusado pela cozinha</p>
            <p className="text-xs text-red-100 mt-0.5">
              {a.quantity}x {a.product_name}
              {a.customer_name ? ` — ${a.customer_name}` : ''}
            </p>
            {a.kitchen_rejection_reason && (
              <p className="text-xs text-red-200 mt-0.5">Motivo: {a.kitchen_rejection_reason}</p>
            )}
          </div>
          <button
            onClick={() => onAcknowledge([a.id])}
            className="shrink-0 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-xl text-xs font-semibold transition-colors">
            OK
          </button>
        </div>
      ))}
      {alerts.length > 1 && (
        <div className="pointer-events-auto flex justify-center">
          <button
            onClick={() => onAcknowledge(alerts.map(a => a.id))}
            className="px-4 py-2 bg-red-700 hover:bg-red-800 text-white text-xs font-semibold rounded-xl shadow transition-colors">
            Confirmar todos ({alerts.length})
          </button>
        </div>
      )}
    </div>
  )
}

export function VendaModule() {
  const currentUnit = useUnitStore(s => s.currentUnit)
  const [rejectedAlerts, setRejectedAlerts] = useState<RejectedAlert[]>([])

  useEffect(() => {
    async function loadRejected() {
      const { data } = await supabase
        .from('sale_items')
        .select('id, product_name, quantity, kitchen_rejection_reason, sales(customers(name))')
        .eq('kitchen_status', 'rejected')
        .eq('rejection_acknowledged', false)
      if (data) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setRejectedAlerts((data as any[]).map((r) => ({
          id: r.id,
          product_name: r.product_name,
          quantity: r.quantity,
          kitchen_rejection_reason: r.kitchen_rejection_reason,
          customer_name: r.sales?.customers?.name ?? null,
        })))
      }
    }
    loadRejected()
    const ch = supabase.channel('venda-rejections')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sale_items' }, loadRejected)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  async function acknowledgeRejections(ids: string[]) {
    await supabase.from('sale_items').update({ rejection_acknowledged: true }).in('id', ids)
    setRejectedAlerts(prev => prev.filter(a => !ids.includes(a.id)))
  }

  const [categories, setCategories]         = useState<Category[]>([])
  const [products, setProducts]             = useState<Product[]>([])
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [loading, setLoading]               = useState(true)

  const [step, setStep]                     = useState(1)
  const [cart, setCart]                     = useState<CartItem[]>([])
  const [customer, setCustomer]             = useState<Customer | null>(null)
  const [showCustomerSearch, setShowCustomerSearch] = useState(false)
  const [showQuickName, setShowQuickName]   = useState(false)
  const [quickName, setQuickName]           = useState('')
  const [showNamePrompt, setShowNamePrompt] = useState(false)
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null)
  const [promptName, setPromptName]         = useState('')
  const [searchQuery, setSearchQuery]       = useState('')
  const [searchResults, setSearchResults]   = useState<Customer[]>([])
  const [searching, setSearching]           = useState(false)
  // Pagamento múltiplo (até 2 métodos)
  interface PaymentEntry { method: PaymentMethod; amount: number }
  const [payments, setPayments]             = useState<PaymentEntry[]>([])
  // Desconto
  const [discount, setDiscount]             = useState(0)
  const [discountUnlocked, setDiscountUnlocked] = useState(false)
  const [discountPwdInput, setDiscountPwdInput] = useState('')
  const [discountPwdError, setDiscountPwdError] = useState('')
  const [showDiscountPwd, setShowDiscountPwd] = useState(false)
  const [discountInput, setDiscountInput]   = useState('')
  const [checkingPwd, setCheckingPwd]       = useState(false)
  const [saving, setSaving]                 = useState(false)
  const [done, setDone]                     = useState(false)
  const [error, setError]                   = useState('')
  const [activeCat, setActiveCat]           = useState<string>('all')
  const [productSearch, setProductSearch]   = useState('')

  useEffect(() => {
    async function load() {
      const [cats, prods, pms] = await Promise.all([
        supabase.from('product_categories').select('*').order('sort_order'),
        supabase.from('products').select('*').eq('active', true).order('name'),
        supabase.from('payment_methods').select('*').eq('active', true).order('name'),
      ])
      setCategories(cats.data ?? [])
      setProducts(prods.data ?? [])
      setPaymentMethods(pms.data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setSearchResults([]); return }
    setSearching(true)
    const clean = q.replace(/\D/g, '')
    const filter = clean.length >= 3
      ? `cpf.ilike.%${clean}%,whatsapp.ilike.%${clean}%,name.ilike.%${q.trim()}%`
      : `name.ilike.%${q.trim()}%`
    const { data } = await supabase.from('customers').select('*').or(filter).limit(8)
    setSearchResults(data ?? [])
    setSearching(false)
  }, [])

  const COMIDA_CATEGORY_ID = '7b2e9e0c-66eb-4971-a074-06c64c97725a'

  function doAddToCart(p: Product) {
    setCart(prev => {
      const idx = prev.findIndex(i => i.product.id === p.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...next[idx], qty: next[idx].qty + 1, obs: [...next[idx].obs, ''] }
        return next
      }
      return [...prev, { product: p, qty: 1, obs: [''] }]
    })
  }

  function addToCart(p: Product) {
    const isFood = p.category_id === COMIDA_CATEGORY_ID
    const isAnonymous = !customer || (customer.id === '' && customer.name === 'Anônimo')
    if (isFood && isAnonymous) {
      setPendingProduct(p)
      setPromptName('')
      setShowNamePrompt(true)
      return
    }
    doAddToCart(p)
  }

  function changeQty(id: string, delta: number) {
    setCart(prev => prev
      .map(i => {
        if (i.product.id !== id) return i
        const newQty = i.qty + delta
        const newObs = delta > 0 ? [...i.obs, ''] : i.obs.slice(0, newQty)
        return { ...i, qty: newQty, obs: newObs }
      })
      .filter(i => i.qty > 0)
    )
  }

  function setObsUnit(id: string, unitIdx: number, value: string) {
    setCart(prev => prev.map(i => {
      if (i.product.id !== id) return i
      const obs = [...i.obs]; obs[unitIdx] = value
      return { ...i, obs }
    }))
  }

  const subtotal = cart.reduce((s, i) => s + i.product.price * i.qty, 0)
  const fee = 0
  const total = Math.max(0, subtotal - discount)
  const totalItems = cart.reduce((s, i) => s + i.qty, 0)

  // Helpers de pagamento
  const paymentTotal = payments.reduce((s, p) => s + p.amount, 0)
  const paymentValid = payments.length > 0 && Math.abs(paymentTotal - total) < 0.01

  function togglePaymentMethod(m: PaymentMethod) {
    setPayments(prev => {
      const exists = prev.find(p => p.method.id === m.id)
      if (exists) return prev.filter(p => p.method.id !== m.id)
      if (prev.length >= 2) return prev
      const remaining = total - prev.reduce((s, p) => s + p.amount, 0)
      return [...prev, { method: m, amount: Math.max(0, remaining) }]
    })
  }

  function setPaymentAmount(methodId: string, amount: number) {
    setPayments(prev => prev.map(p => p.method.id === methodId ? { ...p, amount } : p))
  }

  async function unlockDiscount() {
    if (!discountPwdInput.trim()) return
    setCheckingPwd(true); setDiscountPwdError('')
    const result = await edgeVerify({ type: 'discount_password', password: discountPwdInput.trim() })
    setCheckingPwd(false)
    if (result.valid) {
      setDiscountUnlocked(true); setDiscountPwdError('')
    } else {
      setDiscountPwdError('Senha incorreta'); setDiscountPwdInput('')
    }
  }

  function applyDiscount() {
    const val = parseFloat(discountInput.replace(',', '.'))
    if (!isNaN(val) && val >= 0 && val <= subtotal) setDiscount(val)
  }

  async function handleConfirm() {
    if (!currentUnit) { setError('Unidade não selecionada.'); return }
    if (!paymentValid) { setError('Valores de pagamento inválidos.'); return }
    setSaving(true); setError('')
    const saleId = crypto.randomUUID()
    const primaryPm = payments[0]
    const quickNameValue = customer && !customer.id && customer.name !== 'Anônimo' ? customer.name : null
    const { error: saleErr } = await supabase.from('sales').insert({
      id: saleId,
      customer_id: customer?.id || null,
      customer_name: quickNameValue,
      unit_id: currentUnit.id,
      payment_method_id: primaryPm.method.id,
      subtotal,
      fee_amount: fee,
      total_amount: total,
      discount_amount: discount,
      payment_details: payments.length > 1
        ? JSON.stringify(payments.map(p => ({ method: p.method.name, amount: p.amount })))
        : null,
    })
    if (saleErr) { setError(saleErr.message); setSaving(false); return }
    await supabase.from('sale_items').insert(
      cart.map(i => ({
        id:           crypto.randomUUID(),
        sale_id:      saleId,
        product_id:   i.product.id,
        product_name: i.product.name,
        unit_price:   i.product.price,
        quantity:     i.qty,
        subtotal:     i.product.price * i.qty,
        notes:        i.obs.filter(Boolean).length > 0 ? JSON.stringify(i.obs) : null,
      }))
    )
    setSaving(false); setDone(true)
    setTimeout(reset, 3000)
  }

  function reset() {
    setStep(1); setCart([]); setCustomer(null)
    setPayments([]); setDiscount(0); setDiscountUnlocked(false)
    setDiscountInput(''); setDiscountPwdInput(''); setDiscountPwdError('')
    setDone(false); setError(''); setSearchQuery(''); setSearchResults([])
    setShowCustomerSearch(false); setShowQuickName(false); setQuickName('')
    setShowNamePrompt(false); setPendingProduct(null); setPromptName('')
  }

  if (done) return (
    <div className="flex flex-col items-center gap-6 px-4 py-16 max-w-lg mx-auto text-center">
      <div className="w-20 h-20 bg-green-100 rounded-2xl flex items-center justify-center">
        <CheckCircle size={48} className="text-green-500" />
      </div>
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Venda Registrada!</h2>
        <p className="text-gray-400 text-sm mt-1">{cart.length} item{cart.length > 1 ? 'ns' : ''} · {currency(total)}</p>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 w-full text-left flex flex-col gap-2">
        {cart.map(i => (
          <div key={i.product.id} className="flex flex-col gap-0.5">
            <div className="flex justify-between text-sm">
              <span className="text-gray-700">{i.qty}x {i.product.name}</span>
              <span className="font-medium text-gray-800">{currency(i.product.price * i.qty)}</span>
            </div>
            {i.obs.map((ob, idx) => ob ? <p key={idx} className="text-xs text-orange-500 pl-3">Un.{idx+1}: {ob}</p> : null)}
          </div>
        ))}
        {fee > 0 && (
          <div className="flex justify-between text-sm text-gray-400 border-t pt-2 mt-1">
            <span>Taxa {payments[0]?.method?.name}</span>
            <span>{currency(fee)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-green-600 border-t pt-2 mt-1">
          <span>Total</span><span>{currency(total)}</span>
        </div>
      </div>
      <button onClick={reset}
        className="flex items-center gap-2 px-8 py-3 bg-green-500 text-white rounded-xl font-semibold hover:bg-green-600">
        <RotateCcw size={16} /> Nova Venda
      </button>
    </div>
  )

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Carregando...</div>

  return (
    <div className="px-4 py-6">
      <RejectionBanner alerts={rejectedAlerts} onAcknowledge={acknowledgeRejections} />

      {/* ── STEP 1 — Produtos ── */}
      {step === 1 && (
        <div className="flex gap-6 items-start max-w-6xl mx-auto w-full">

          {/* Coluna esquerda: produtos */}
          <div className="flex-1 flex flex-col gap-6 min-w-0">

            {/* Botão Zerar */}
            {(cart.length > 0 || customer) && (
              <button
                onClick={() => { setCart([]); setCustomer(null) }}
                className="flex items-center gap-2 px-4 py-2.5 w-full bg-red-500 hover:bg-red-600 active:scale-95 text-white font-semibold text-sm rounded-2xl transition-all shadow-sm shadow-red-200 justify-center">
                <RotateCcw size={15} /> Zerar pedido
              </button>
            )}

            {/* Bloco de cliente */}
            <div className={`bg-white rounded-2xl shadow-sm overflow-hidden transition-all
              ${!customer && cart.length > 0 ? 'border-2 border-orange-400 ring-2 ring-orange-100' : 'border border-gray-100'}`}>
              {!customer && cart.length > 0 && (
                <div className="flex items-center gap-2 px-4 py-2 bg-orange-50 border-b border-orange-100">
                  <span className="text-orange-500 text-xs font-semibold">⚠ Selecione o tipo de cliente para continuar</span>
                </div>
              )}
              {customer ? (
                /* ── Cliente selecionado ── */
                <div className="flex items-center gap-4 px-5 py-5">
                  {customer.id && customer.photo_url
                    ? <img src={customer.photo_url} className="w-12 h-12 rounded-full object-cover shrink-0 ring-2 ring-green-200" alt="" />
                    : <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-base shrink-0 bg-green-100 text-green-600">
                        {customer.name[0].toUpperCase()}
                      </div>
                  }
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-800 truncate">{customer.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{customer.id ? 'Cliente identificado' : customer.name === 'Anônimo' ? 'Sem identificação' : 'Nome rápido'}</p>
                  </div>
                  <button onClick={() => setCustomer(null)}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-500 bg-red-50 hover:bg-red-100 border border-red-100 rounded-xl transition-colors">
                    <X size={14} /> Trocar
                  </button>
                </div>
              ) : showCustomerSearch ? (
                /* ── Busca de cliente ── */
                <div className="p-4 flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input autoFocus value={searchQuery}
                        onChange={e => { setSearchQuery(e.target.value); search(e.target.value) }}
                        placeholder="Nome, CPF ou WhatsApp..."
                        className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-400 bg-gray-50 focus:bg-white transition-colors" />
                    </div>
                    <button onClick={() => { setShowCustomerSearch(false); setSearchQuery('') }}
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">
                      <X size={16} />
                    </button>
                  </div>
                  {searching && (
                    <p className="text-xs text-gray-400 text-center py-1">Buscando...</p>
                  )}
                  {searchResults.length > 0 && (
                    <div className="flex flex-col divide-y divide-gray-50 border border-gray-100 rounded-xl overflow-hidden">
                      {searchResults.map(c => (
                        <button key={c.id} onClick={() => { setCustomer(c); setShowCustomerSearch(false); setSearchQuery('') }}
                          className="flex items-center gap-3 px-3 py-2.5 hover:bg-green-50 transition-colors text-left">
                          {c.photo_url
                            ? <img src={c.photo_url} className="w-8 h-8 rounded-full object-cover shrink-0" alt="" />
                            : <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 shrink-0">{c.name[0]}</div>
                          }
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{c.name}</p>
                            {c.cpf && <p className="text-xs text-gray-400">{c.cpf}</p>}
                          </div>
                          <Check size={14} className="text-green-400 opacity-0 group-hover:opacity-100 shrink-0" />
                        </button>
                      ))}
                    </div>
                  )}
                  {searchQuery.length > 1 && !searching && searchResults.length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-1">Nenhum cliente encontrado</p>
                  )}
                </div>
              ) : showQuickName ? (
                /* ── Nome rápido ── */
                <div className="p-4 flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        autoFocus
                        value={quickName}
                        onChange={e => setQuickName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && quickName.trim()) {
                            setCustomer({ id: '', name: quickName.trim() } as Customer)
                            setShowQuickName(false); setQuickName('')
                          }
                          if (e.key === 'Escape') { setShowQuickName(false); setQuickName('') }
                        }}
                        placeholder="Nome do cliente..."
                        className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-400 bg-gray-50 focus:bg-white transition-colors"
                      />
                    </div>
                    <button
                      onClick={() => {
                        if (quickName.trim()) {
                          setCustomer({ id: '', name: quickName.trim() } as Customer)
                          setShowQuickName(false); setQuickName('')
                        }
                      }}
                      disabled={!quickName.trim()}
                      className="px-4 py-2 bg-green-500 text-white text-sm font-semibold rounded-xl hover:bg-green-600 disabled:opacity-40 transition-colors">
                      OK
                    </button>
                    <button onClick={() => { setShowQuickName(false); setQuickName('') }}
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">
                      <X size={16} />
                    </button>
                  </div>
                </div>
              ) : (
                /* ── Seleção inicial ── */
                <div className="flex h-20">
                  <button onClick={() => setShowCustomerSearch(true)}
                    className="flex-1 flex items-center justify-center gap-3 hover:bg-green-50 transition-colors border-r border-gray-100 group">
                    <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center group-hover:bg-green-100 transition-colors shrink-0">
                      <User size={18} className="text-green-500" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-gray-700">Identificar cliente</p>
                      <p className="text-xs text-gray-400">Buscar por nome ou CPF</p>
                    </div>
                  </button>
                  <button onClick={() => setCustomer({ id: '', name: 'Anônimo' } as Customer)}
                    className="flex-1 flex items-center justify-center gap-3 hover:bg-gray-50 transition-colors group">
                    <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center group-hover:bg-gray-200 transition-colors shrink-0">
                      <UserX size={18} className="text-gray-500" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-gray-600">Anônimo</p>
                      <p className="text-xs text-gray-400">Sem identificação</p>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* Produtos com abas por categoria */}
            {products.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <ShoppingCart size={40} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">Nenhum produto cadastrado</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Busca */}
                <div className="px-4 pt-3 pb-2 border-b border-gray-100">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    <input
                      type="text"
                      value={productSearch}
                      onChange={e => { setProductSearch(e.target.value); setActiveCat('all') }}
                      placeholder="Buscar produto..."
                      className="w-full pl-8 pr-8 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-green-400 bg-gray-50 focus:bg-white transition-colors"
                    />
                    {productSearch && (
                      <button onClick={() => setProductSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>
                {/* Abas */}
                <div className="flex border-b border-gray-100 overflow-x-auto">
                  <button
                    onClick={() => setActiveCat('all')}
                    className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px
                      ${activeCat === 'all' ? 'border-green-500 text-green-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                    Todos
                  </button>
                  {categories.filter(cat => products.some(p => p.category_id === cat.id)).map(cat => (
                    <button key={cat.id}
                      onClick={() => setActiveCat(cat.id)}
                      className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px
                        ${activeCat === cat.id ? 'border-green-500 text-green-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                      {cat.name}
                    </button>
                  ))}
                  {products.some(p => !p.category_id) && (
                    <button
                      onClick={() => setActiveCat('sem-cat')}
                      className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px
                        ${activeCat === 'sem-cat' ? 'border-green-500 text-green-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                      Outros
                    </button>
                  )}
                </div>

                {/* Lista de produtos */}
                <div className="divide-y divide-gray-50">
                  {products
                    .filter(p => {
                      const matchCat = activeCat === 'all' ? true : activeCat === 'sem-cat' ? !p.category_id : p.category_id === activeCat
                      const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
                      const matchSearch = productSearch.trim() === '' ? true : normalize(p.name).includes(normalize(productSearch))
                      return matchCat && matchSearch
                    })
                    .map(p => {
                      const item = cart.find(i => i.product.id === p.id)
                      return (
                        <div key={p.id} className={`px-4 py-3 transition-colors ${item ? 'bg-green-50/50' : 'hover:bg-gray-50'}`}>
                          <div className="flex items-center gap-4">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-800">{p.name}</p>
                              {p.description && <p className="text-xs text-gray-400 truncate">{p.description}</p>}
                              <p className="text-sm font-bold text-green-600 mt-0.5">{currency(p.price)}</p>
                            </div>
                            {item ? (
                              <div className="flex items-center gap-2 shrink-0">
                                <button onClick={() => changeQty(p.id, -1)}
                                  className="w-7 h-7 rounded-full bg-white border border-gray-200 flex items-center justify-center hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors">
                                  <Minus size={13} />
                                </button>
                                <span className="font-bold text-gray-800 w-5 text-center">{item.qty}</span>
                                <button onClick={() => changeQty(p.id, 1)}
                                  className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center hover:bg-green-600 text-white transition-colors">
                                  <Plus size={13} />
                                </button>
                              </div>
                            ) : (
                              <button onClick={() => addToCart(p)}
                                className="shrink-0 flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-600 rounded-xl text-sm font-semibold hover:bg-green-100 transition-colors">
                                <Plus size={14} /> Add
                              </button>
                            )}
                          </div>
                          {/* Observação por unidade — aparece só quando o produto está no carrinho */}
                          {item && (
                            <div className="mt-2 flex flex-col gap-1.5">
                              {item.obs.map((ob, idx) => (
                                <div key={idx} className="relative flex items-center gap-2">
                                  <span className="text-xs text-gray-400 font-medium w-14 shrink-0">
                                    Unid. {idx + 1}
                                  </span>
                                  <div className="relative flex-1">
                                    <MessageSquare size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
                                    <input
                                      type="text"
                                      value={ob}
                                      onChange={e => setObsUnit(p.id, idx, e.target.value)}
                                      placeholder="sem cebola, sem maionese..."
                                      className="w-full pl-7 pr-3 py-1.5 text-xs border border-green-100 rounded-lg bg-white focus:outline-none focus:border-green-300 placeholder-gray-300 transition-colors"
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })
                  }
                </div>
              </div>
            )}
          </div>

          {/* Coluna direita: painel do pedido */}
          <div className="w-80 shrink-0 sticky top-6 self-start">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden">

              {/* Header do painel */}
              <div className="flex items-center gap-2 px-4 py-3.5 border-b border-gray-100 bg-gray-50">
                <ShoppingCart size={16} className="text-green-500" />
                <span className="font-bold text-gray-800">Pedido</span>
                {totalItems > 0 && (
                  <span className="ml-1 bg-green-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {totalItems}
                  </span>
                )}
              </div>

              {/* Conteúdo */}
              {cart.length === 0 ? (
                <div className="px-4 py-10 text-center text-gray-400">
                  <ShoppingCart size={32} className="mx-auto mb-3 opacity-20" />
                  <p className="text-sm">Nenhum item adicionado</p>
                  <p className="text-xs text-gray-300 mt-1">Selecione os produtos ao lado</p>
                </div>
              ) : (
                <div className="flex flex-col">
                  <div className="flex flex-col divide-y divide-gray-50 max-h-[420px] overflow-y-auto">
                    {cart.flatMap(i =>
                      Array.from({ length: i.qty }, (_, idx) => (
                        <div key={`${i.product.id}-${idx}`} className="flex items-center gap-2 px-4 py-2.5">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{i.product.name}</p>
                            {i.obs[idx] && (
                              <p className="text-xs text-orange-500 mt-0.5 truncate">{i.obs[idx]}</p>
                            )}
                          </div>
                          <span className="text-sm font-semibold text-gray-700 shrink-0">
                            {currency(i.product.price)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Rodapé com total e botão */}
                  <div className="border-t border-gray-100 px-4 pt-3 pb-4 flex flex-col gap-3 bg-gray-50">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">
                        {totalItems} {totalItems === 1 ? 'item' : 'itens'}
                      </span>
                      <span className="font-bold text-lg text-gray-800">{currency(subtotal)}</span>
                    </div>
                    <button onClick={() => setStep(2)} disabled={!customer}
                      className="w-full py-3.5 bg-green-500 text-white font-bold rounded-xl hover:bg-green-600 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all shadow-sm">
                      <Check size={18} /> Fechar Pedido
                    </button>
                    {!customer && (
                      <p className="text-xs text-center text-orange-500">Identifique o cliente antes de fechar</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 2 — Pagamento + Confirmação ── */}
      {step === 2 && (
        <div className="flex flex-col gap-4 max-w-lg mx-auto w-full">
          <div className="flex items-center gap-3">
            <button onClick={() => setStep(1)} className="text-gray-400 hover:text-gray-600 text-xl">←</button>
            <h2 className="text-xl font-bold text-gray-800">Pagamento</h2>
          </div>

          {/* Cliente */}
          {customer && customer.id && (
            <div className="flex items-center gap-3 bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3">
              {customer.photo_url
                ? <img src={customer.photo_url} className="w-9 h-9 rounded-full object-cover shrink-0" alt="" />
                : <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center font-bold text-green-600 text-sm shrink-0">{customer.name[0]}</div>
              }
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800 text-sm truncate">{customer.name}</p>
                <p className="text-xs text-gray-400">Cliente identificado</p>
              </div>
            </div>
          )}

          {/* Resumo do pedido */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col gap-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Resumo</p>
            {cart.map(i => (
              <div key={i.product.id} className="flex flex-col gap-0.5">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-700">{i.qty}x {i.product.name}</span>
                  <span className="font-medium text-gray-800">{currency(i.product.price * i.qty)}</span>
                </div>
                {i.obs.map((ob, idx) => ob ? <p key={idx} className="text-xs text-orange-500 pl-3">Un.{idx+1}: {ob}</p> : null)}
              </div>
            ))}
            <div className="border-t pt-2 mt-1 flex flex-col gap-1">
              <div className="flex justify-between text-sm text-gray-500">
                <span>Subtotal</span><span>{currency(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-sm text-green-600 font-medium">
                  <span>Desconto</span><span>− {currency(discount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-gray-800 text-base border-t pt-1 mt-0.5">
                <span>Total</span><span>{currency(total)}</span>
              </div>
            </div>
          </div>

          {/* Desconto */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-50">
              <Tag size={15} className="text-purple-500" />
              <p className="text-sm font-semibold text-gray-700 flex-1">Desconto</p>
              {!discountUnlocked ? (
                <span className="text-xs text-gray-400 flex items-center gap-1"><Lock size={12} /> protegido por senha</span>
              ) : discount > 0 ? (
                <span className="text-sm font-bold text-green-600">− {currency(discount)}</span>
              ) : null}
            </div>
            {!discountUnlocked ? (
              <div className="px-4 py-3 flex flex-col gap-2">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Lock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type={showDiscountPwd ? 'text' : 'password'}
                      value={discountPwdInput}
                      onChange={e => setDiscountPwdInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && unlockDiscount()}
                      placeholder="Senha de desconto"
                      className="w-full pl-8 pr-8 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-purple-400 bg-gray-50"
                    />
                    <button onClick={() => setShowDiscountPwd(s => !s)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400">
                      {showDiscountPwd ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  </div>
                  <button onClick={unlockDiscount} disabled={checkingPwd || !discountPwdInput}
                    className="px-4 py-2 bg-purple-500 text-white text-sm font-semibold rounded-xl hover:bg-purple-600 disabled:opacity-50 transition-colors">
                    {checkingPwd ? '...' : 'OK'}
                  </button>
                </div>
                {discountPwdError && <p className="text-xs text-red-500">{discountPwdError}</p>}
              </div>
            ) : (
              <div className="px-4 py-3 flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</span>
                  <input
                    type="number"
                    min="0"
                    max={subtotal}
                    step="0.01"
                    value={discountInput}
                    onChange={e => setDiscountInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && applyDiscount()}
                    placeholder="0,00"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-purple-400 bg-gray-50"
                  />
                </div>
                <button onClick={applyDiscount}
                  className="px-4 py-2 bg-purple-500 text-white text-sm font-semibold rounded-xl hover:bg-purple-600 transition-colors">
                  Aplicar
                </button>
                {discount > 0 && (
                  <button onClick={() => { setDiscount(0); setDiscountInput('') }}
                    className="px-3 py-2 text-gray-400 hover:text-red-500 rounded-xl hover:bg-red-50 transition-colors">
                    <X size={15} />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Formas de pagamento — até 2 */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1 mb-2">
              Forma de pagamento
              <span className="ml-2 normal-case font-normal text-gray-300">(selecione até 2)</span>
            </p>
            <div className="flex flex-col gap-2">
              {paymentMethods.map(m => {
                const entry = payments.find(p => p.method.id === m.id)
                const selected = !!entry
                const n = m.name.toLowerCase()
                const emoji = n.includes('crédito') ? '💳' : n.includes('débito') ? '🏧' : n.includes('dinheiro') || n.includes('espécie') ? '💵' : n.includes('pix') ? '⚡' : '💰'
                const disabled = !selected && payments.length >= 2
                return (
                  <div key={m.id} className={`bg-white rounded-2xl border-2 shadow-sm overflow-hidden transition-all
                    ${selected ? 'border-green-400' : disabled ? 'border-gray-100 opacity-40' : 'border-gray-100 hover:border-green-300'}`}>
                    <button onClick={() => !disabled && togglePaymentMethod(m)}
                      className="w-full flex items-center gap-4 p-4 text-left">
                      <span className="text-2xl">{emoji}</span>
                      <p className="flex-1 font-semibold text-gray-800">{m.name}</p>
                      {selected && payments.length === 1 && (
                        <span className="text-sm font-bold text-green-600">{currency(total)}</span>
                      )}
                      {selected && <Check size={18} className="text-green-500 shrink-0" />}
                    </button>
                    {/* Input de valor para pagamento dividido */}
                    {selected && payments.length === 2 && (
                      <div className="px-4 pb-3 flex items-center gap-2">
                        <span className="text-xs text-gray-400 shrink-0">Valor:</span>
                        <div className="relative flex-1">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">R$</span>
                          <input
                            type="number" min="0" max={total} step="0.01"
                            value={entry.amount || ''}
                            onChange={e => {
                              const val = parseFloat(e.target.value) || 0
                              setPaymentAmount(m.id, val)
                              // ajusta o outro método automaticamente
                              setPayments(prev => prev.map(p =>
                                p.method.id !== m.id ? { ...p, amount: Math.max(0, total - val) } : { ...p, amount: val }
                              ))
                            }}
                            className="w-full pl-8 pr-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-green-400 bg-gray-50"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Validação de pagamento dividido */}
            {payments.length === 2 && (
              <div className={`mt-2 px-3 py-2 rounded-xl text-sm flex justify-between
                ${paymentValid ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-600'}`}>
                <span>Total distribuído</span>
                <span className="font-bold">{currency(paymentTotal)} / {currency(total)}</span>
              </div>
            )}
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button onClick={handleConfirm} disabled={!paymentValid || saving}
            className="w-full py-4 bg-green-500 text-white font-bold rounded-2xl hover:bg-green-600 disabled:opacity-50 active:scale-95 flex items-center justify-center gap-2 transition-all">
            <Check size={20} /> {saving ? 'Registrando...' : 'Finalizar Venda'}
          </button>
        </div>
      )}

      {/* ── Modal: pedir nome para pedido de comida ── */}
      {showNamePrompt && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4"
          onClick={e => { if (e.target === e.currentTarget) { setShowNamePrompt(false); if (pendingProduct) doAddToCart(pendingProduct); setPendingProduct(null) } }}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-2xl flex items-center justify-center shrink-0">
                <User size={20} className="text-orange-500" />
              </div>
              <div>
                <p className="font-bold text-gray-800">Qual o nome do cliente?</p>
                <p className="text-xs text-gray-400 mt-0.5">Pedido de comida precisa de um nome para a cozinha</p>
              </div>
            </div>
            <input
              autoFocus
              value={promptName}
              onChange={e => setPromptName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && promptName.trim()) {
                  setCustomer({ id: '', name: promptName.trim() } as Customer)
                  if (pendingProduct) doAddToCart(pendingProduct)
                  setPendingProduct(null); setShowNamePrompt(false); setPromptName('')
                }
              }}
              placeholder="Nome do cliente..."
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-400 transition-colors"
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (pendingProduct) doAddToCart(pendingProduct)
                  setPendingProduct(null); setShowNamePrompt(false); setPromptName('')
                }}
                className="flex-1 py-2.5 border-2 border-gray-200 rounded-xl text-sm font-semibold text-gray-500 hover:bg-gray-50 transition-colors">
                Pular
              </button>
              <button
                onClick={() => {
                  if (promptName.trim()) setCustomer({ id: '', name: promptName.trim() } as Customer)
                  if (pendingProduct) doAddToCart(pendingProduct)
                  setPendingProduct(null); setShowNamePrompt(false); setPromptName('')
                }}
                disabled={!promptName.trim()}
                className="flex-1 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-bold hover:bg-orange-600 disabled:opacity-40 transition-colors">
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
