import { useEffect, useState, useRef, useCallback } from 'react'
import {
  Package, Plus, ArrowLeft, Camera, RotateCcw, Check, X,
  TrendingUp, TrendingDown, SlidersHorizontal, AlertTriangle, History
} from 'lucide-react'
import Webcam from 'react-webcam'
import { supabase } from '../../lib/supabase'
import { ProdutosConfig } from '../configuracoes/ProdutosConfig'

interface Category { id: string; name: string }
interface Product {
  id: string; name: string; description?: string; price: number; quantity: number
  min_stock: number; unit: string; photo_url?: string
  category_id: string | null; active: boolean
  category?: { name: string }
}
interface StockEntry {
  id: string; type: 'entrada' | 'saida' | 'ajuste'; quantity: number
  notes?: string; created_at: string
}

type View = 'list' | 'detail' | 'form' | 'entry'

const UNITS = ['un', 'kg', 'g', 'L', 'ml', 'cx', 'pct', 'par']

function badge(qty: number, min: number) {
  if (qty === 0) return 'bg-red-100 text-red-700'
  if (qty <= min) return 'bg-yellow-100 text-yellow-700'
  return 'bg-green-100 text-green-700'
}

function stockLabel(qty: number, min: number, unit: string) {
  if (qty === 0) return `Sem estoque`
  if (qty <= min) return `${qty} ${unit} — estoque baixo`
  return `${qty} ${unit}`
}

type InnerTab = 'estoque' | 'cadastro'

export function EstoqueModule() {
  const [innerTab, setInnerTab]     = useState<InnerTab>('estoque')
  const [products, setProducts]     = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading]       = useState(true)
  const [view, setView]             = useState<View>('list')
  const [selected, setSelected]     = useState<Product | null>(null)
  const [entries, setEntries]       = useState<StockEntry[]>([])
  const [filterCat, setFilterCat]   = useState<string>('all')
  const [filterLow, setFilterLow]   = useState(false)

  // form
  const [form, setForm] = useState({
    name: '', description: '', price: '', quantity: '0', min_stock: '0',
    unit: 'un', category_id: '', active: true,
  })
  const [formPhoto, setFormPhoto]   = useState<string | null>(null)
  const [showCam, setShowCam]       = useState(false)
  const [formSaving, setFormSaving] = useState(false)
  const [editingId, setEditingId]   = useState<string | null>(null)
  const webcamRef = useRef<Webcam>(null)

  // entry form
  const [entryType, setEntryType]   = useState<'entrada' | 'saida' | 'ajuste'>('entrada')
  const [entryQty, setEntryQty]     = useState('')
  const [entryNotes, setEntryNotes] = useState('')
  const [entrySaving, setEntrySaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [prods, cats] = await Promise.all([
      supabase.from('products').select('*, product_categories(name)').order('name'),
      supabase.from('product_categories').select('*').order('sort_order'),
    ])
    setProducts((prods.data ?? []).map((p: any) => ({
      ...p, category: p.product_categories,
    })))
    setCategories(cats.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function loadEntries(productId: string) {
    const { data } = await supabase
      .from('stock_entries').select('*')
      .eq('product_id', productId).order('created_at', { ascending: false }).limit(20)
    setEntries(data ?? [])
  }

  function openNew() {
    setEditingId(null)
    setForm({ name: '', description: '', price: '', quantity: '0', min_stock: '0', unit: 'un', category_id: '', active: true })
    setFormPhoto(null); setShowCam(false); setView('form')
  }

  function openEdit(p: Product) {
    setEditingId(p.id)
    setForm({
      name: p.name, description: p.description ?? '',
      price: String(p.price).replace('.', ','),
      quantity: String(p.quantity), min_stock: String(p.min_stock),
      unit: p.unit ?? 'un', category_id: p.category_id ?? '', active: p.active,
    })
    setFormPhoto(p.photo_url ?? null); setShowCam(false); setView('form')
  }

  async function saveForm() {
    if (!form.name.trim()) return
    setFormSaving(true)
    const data: any = {
      name:        form.name.trim(),
      description: form.description.trim() || null,
      price:       parseFloat(form.price.replace(',', '.') || '0'),
      quantity:    parseInt(form.quantity) || 0,
      min_stock:   parseInt(form.min_stock) || 0,
      unit:        form.unit,
      category_id: form.category_id || null,
      active:      form.active,
    }
    if (formPhoto) data.photo_url = formPhoto

    if (editingId) {
      await supabase.from('products').update(data).eq('id', editingId)
      setProducts(prev => prev.map(p => p.id === editingId ? { ...p, ...data } : p))
    } else {
      const { data: d } = await supabase.from('products').insert({ ...data, id: crypto.randomUUID() }).select('*, product_categories(name)').single()
      if (d) setProducts(prev => [...prev, { ...d, category: d.product_categories }].sort((a, b) => a.name.localeCompare(b.name)))
    }
    setFormSaving(false); setView('list')
  }

  async function openDetail(p: Product) {
    setSelected(p); setView('detail')
    await loadEntries(p.id)
  }

  async function saveEntry() {
    if (!selected || !entryQty) return
    setEntrySaving(true)
    const qty = parseInt(entryQty)
    const delta = entryType === 'entrada' ? qty : entryType === 'saida' ? -qty : qty - selected.quantity
    const newQty = entryType === 'ajuste' ? qty : Math.max(0, selected.quantity + delta)

    await supabase.from('stock_entries').insert({
      id: crypto.randomUUID(), product_id: selected.id,
      type: entryType, quantity: qty, notes: entryNotes || null,
    })
    await supabase.from('products').update({ quantity: newQty }).eq('id', selected.id)

    const updated = { ...selected, quantity: newQty }
    setSelected(updated)
    setProducts(prev => prev.map(p => p.id === selected.id ? updated : p))
    await loadEntries(selected.id)
    setEntryQty(''); setEntryNotes(''); setEntrySaving(false); setView('detail')
  }

  const filtered = products.filter(p => {
    if (filterCat !== 'all' && p.category_id !== filterCat) return false
    if (filterLow && p.quantity > p.min_stock) return false
    return true
  })

  const lowCount = products.filter(p => p.quantity <= p.min_stock).length

  // ── CADASTRO TAB ─────────────────────────────────────────
  if (innerTab === 'cadastro') return (
    <div className="flex flex-col">
      {/* Sub-nav */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="flex gap-1 max-w-2xl mx-auto">
          <button onClick={() => setInnerTab('estoque')}
            className="px-5 py-3 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700 transition-colors">
            Estoque
          </button>
          <button onClick={() => setInnerTab('cadastro')}
            className="px-5 py-3 text-sm font-medium border-b-2 border-green-500 text-green-600 transition-colors">
            Cadastro
          </button>
        </div>
      </div>
      <ProdutosConfig />
    </div>
  )

  // ── FORM ────────────────────────────────────────────────
  if (view === 'form') return (
    <div className="flex flex-col gap-4 px-4 py-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <button onClick={() => setView('list')} className="p-2 hover:bg-gray-100 rounded-xl"><ArrowLeft size={20} className="text-gray-500" /></button>
        <h2 className="text-xl font-bold text-gray-800">{editingId ? 'Editar Produto' : 'Novo Produto'}</h2>
      </div>

      {/* Foto */}
      <div className="flex flex-col items-center gap-3">
        {showCam ? (
          <div className="flex flex-col items-center gap-3 w-full">
            <Webcam ref={webcamRef} screenshotFormat="image/jpeg" className="rounded-2xl w-full max-w-xs h-48 object-cover bg-black" />
            <div className="flex gap-2">
              <button onClick={() => { const s = webcamRef.current?.getScreenshot(); if (s) { setFormPhoto(s); setShowCam(false) } }}
                className="px-4 py-2 bg-green-500 text-white rounded-xl text-sm font-semibold flex items-center gap-2">
                <Camera size={14} /> Capturar
              </button>
              <button onClick={() => setShowCam(false)} className="px-4 py-2 border rounded-xl text-gray-600 text-sm">Cancelar</button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            {formPhoto
              ? <img src={formPhoto} className="w-28 h-28 rounded-2xl object-cover border-4 border-green-400" />
              : <div className="w-28 h-28 rounded-2xl bg-gray-100 flex flex-col items-center justify-center gap-1 text-gray-400 border-2 border-dashed border-gray-300">
                  <Package size={28} />
                  <span className="text-xs">Sem foto</span>
                </div>
            }
            <button onClick={() => setShowCam(true)} className="flex items-center gap-1.5 text-sm text-green-600 font-medium hover:text-green-700">
              <RotateCcw size={13} /> {formPhoto ? 'Trocar foto' : 'Tirar foto'}
            </button>
          </div>
        )}
      </div>

      <div>
        <label className="text-sm font-medium text-gray-600 mb-1 block">Nome *</label>
        <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          placeholder="Nome do produto" className="w-full border-2 rounded-xl px-4 py-2.5 focus:outline-none focus:border-green-400 text-sm" />
      </div>

      <div>
        <label className="text-sm font-medium text-gray-600 mb-1 block">Descrição</label>
        <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          placeholder="Ingredientes, detalhes..." rows={3}
          className="w-full border-2 rounded-xl px-4 py-2.5 focus:outline-none focus:border-green-400 text-sm resize-none" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium text-gray-600 mb-1 block">Preço (R$)</label>
          <input value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
            placeholder="0,00" className="w-full border-2 rounded-xl px-4 py-2.5 focus:outline-none focus:border-green-400 text-sm" />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-600 mb-1 block">Unidade</label>
          <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
            className="w-full border-2 rounded-xl px-4 py-2.5 focus:outline-none focus:border-green-400 bg-white text-sm">
            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium text-gray-600 mb-1 block">Estoque inicial</label>
          <input type="number" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
            min="0" className="w-full border-2 rounded-xl px-4 py-2.5 focus:outline-none focus:border-green-400 text-sm" />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-600 mb-1 block">Estoque mínimo</label>
          <input type="number" value={form.min_stock} onChange={e => setForm(f => ({ ...f, min_stock: e.target.value }))}
            min="0" className="w-full border-2 rounded-xl px-4 py-2.5 focus:outline-none focus:border-green-400 text-sm" />
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-gray-600 mb-1 block">Categoria</label>
        <select value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
          className="w-full border-2 rounded-xl px-4 py-2.5 focus:outline-none focus:border-green-400 bg-white text-sm">
          <option value="">Sem categoria</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <button onClick={saveForm} disabled={formSaving || !form.name.trim()}
        className="w-full py-3.5 bg-green-500 text-white font-bold rounded-2xl hover:bg-green-600 disabled:opacity-50 flex items-center justify-center gap-2">
        <Check size={18} /> {formSaving ? 'Salvando...' : 'Salvar Produto'}
      </button>
    </div>
  )

  // ── ENTRADA/SAÍDA ────────────────────────────────────────
  if (view === 'entry' && selected) return (
    <div className="flex flex-col gap-5 px-4 py-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <button onClick={() => setView('detail')} className="p-2 hover:bg-gray-100 rounded-xl"><ArrowLeft size={20} className="text-gray-500" /></button>
        <div>
          <h2 className="text-xl font-bold text-gray-800">Movimentação</h2>
          <p className="text-sm text-gray-400">{selected.name} · estoque atual: <strong>{selected.quantity} {selected.unit}</strong></p>
        </div>
      </div>

      {/* Tipo */}
      <div className="grid grid-cols-3 gap-2">
        {([['entrada','Entrada',  'bg-green-500'],
           ['saida',  'Saída',    'bg-red-500'],
           ['ajuste', 'Ajuste',   'bg-blue-500']] as const).map(([t, label, color]) => (
          <button key={t} onClick={() => setEntryType(t)}
            className={`py-3 rounded-xl text-sm font-bold transition-all border-2
              ${entryType === t ? `${color} text-white border-transparent` : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
            {label}
          </button>
        ))}
      </div>

      <div>
        <label className="text-sm font-medium text-gray-600 mb-1 block">
          {entryType === 'ajuste' ? 'Novo total em estoque' : 'Quantidade'} ({selected.unit})
        </label>
        <input type="number" value={entryQty} onChange={e => setEntryQty(e.target.value)}
          min="0" autoFocus placeholder="0"
          className="w-full border-2 rounded-xl px-4 py-3 text-2xl font-bold focus:outline-none focus:border-green-400 text-center" />
        {entryType !== 'ajuste' && entryQty && (
          <p className="text-xs text-gray-400 text-center mt-1">
            Novo estoque: <strong>{entryType === 'entrada'
              ? selected.quantity + (parseInt(entryQty) || 0)
              : Math.max(0, selected.quantity - (parseInt(entryQty) || 0))} {selected.unit}</strong>
          </p>
        )}
      </div>

      <div>
        <label className="text-sm font-medium text-gray-600 mb-1 block">Observação (opcional)</label>
        <input value={entryNotes} onChange={e => setEntryNotes(e.target.value)}
          placeholder="Ex: compra, reposição, brinde..."
          className="w-full border-2 rounded-xl px-4 py-2.5 focus:outline-none focus:border-green-400 text-sm" />
      </div>

      <button onClick={saveEntry} disabled={entrySaving || !entryQty}
        className={`w-full py-3.5 text-white font-bold rounded-2xl disabled:opacity-50 flex items-center justify-center gap-2
          ${entryType === 'saida' ? 'bg-red-500 hover:bg-red-600' : entryType === 'ajuste' ? 'bg-blue-500 hover:bg-blue-600' : 'bg-green-500 hover:bg-green-600'}`}>
        <Check size={18} /> {entrySaving ? 'Salvando...' : 'Confirmar'}
      </button>
    </div>
  )

  // ── DETALHE ──────────────────────────────────────────────
  if (view === 'detail' && selected) return (
    <div className="flex flex-col gap-5 px-4 py-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <button onClick={() => setView('list')} className="p-2 hover:bg-gray-100 rounded-xl"><ArrowLeft size={20} className="text-gray-500" /></button>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-gray-800">{selected.name}</h2>
          {selected.category && <p className="text-xs text-gray-400">{selected.category.name}</p>}
        </div>
        <button onClick={() => openEdit(selected)} className="p-2 text-gray-400 hover:text-green-500 hover:bg-gray-100 rounded-xl transition-colors">
          <SlidersHorizontal size={18} />
        </button>
      </div>

      {/* Card principal */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex">
          {selected.photo_url
            ? <img src={selected.photo_url} className="w-32 h-32 object-cover shrink-0" />
            : <div className="w-32 h-32 bg-gray-50 flex items-center justify-center shrink-0"><Package size={36} className="text-gray-300" /></div>
          }
          <div className="flex-1 p-4 flex flex-col justify-center gap-2">
            <div>
              <p className="text-xs text-gray-400">Estoque atual</p>
              <p className={`text-3xl font-black ${selected.quantity === 0 ? 'text-red-500' : selected.quantity <= selected.min_stock ? 'text-yellow-600' : 'text-green-600'}`}>
                {selected.quantity}
                <span className="text-base font-normal text-gray-400 ml-1">{selected.unit}</span>
              </p>
            </div>
            <div className="flex gap-3 text-xs text-gray-400">
              <span>Mínimo: {selected.min_stock} {selected.unit}</span>
              <span>Preço: R$ {Number(selected.price).toFixed(2).replace('.', ',')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Descrição */}
      {selected.description && (
        <div className="bg-gray-50 rounded-xl px-4 py-3">
          <p className="text-xs text-gray-400 mb-1">Ingredientes</p>
          <p className="text-sm text-gray-700 leading-relaxed">{selected.description}</p>
        </div>
      )}

      {/* Botões de movimentação */}
      <div className="grid grid-cols-3 gap-2">
        <button onClick={() => { setEntryType('entrada'); setEntryQty(''); setEntryNotes(''); setView('entry') }}
          className="flex flex-col items-center gap-1.5 py-4 bg-green-50 border-2 border-green-200 rounded-2xl hover:bg-green-100 transition-colors">
          <TrendingUp size={22} className="text-green-600" />
          <span className="text-xs font-bold text-green-700">Entrada</span>
        </button>
        <button onClick={() => { setEntryType('saida'); setEntryQty(''); setEntryNotes(''); setView('entry') }}
          className="flex flex-col items-center gap-1.5 py-4 bg-red-50 border-2 border-red-200 rounded-2xl hover:bg-red-100 transition-colors">
          <TrendingDown size={22} className="text-red-500" />
          <span className="text-xs font-bold text-red-600">Saída</span>
        </button>
        <button onClick={() => { setEntryType('ajuste'); setEntryQty(''); setEntryNotes(''); setView('entry') }}
          className="flex flex-col items-center gap-1.5 py-4 bg-blue-50 border-2 border-blue-200 rounded-2xl hover:bg-blue-100 transition-colors">
          <SlidersHorizontal size={22} className="text-blue-500" />
          <span className="text-xs font-bold text-blue-600">Ajuste</span>
        </button>
      </div>

      {/* Histórico */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
          <History size={13} /> Últimas movimentações
        </p>
        {entries.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">Nenhuma movimentação registrada</p>
        ) : (
          <div className="flex flex-col gap-2">
            {entries.map(e => (
              <div key={e.id} className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0
                  ${e.type === 'entrada' ? 'bg-green-100' : e.type === 'saida' ? 'bg-red-100' : 'bg-blue-100'}`}>
                  {e.type === 'entrada' ? <TrendingUp size={15} className="text-green-600" />
                    : e.type === 'saida' ? <TrendingDown size={15} className="text-red-500" />
                    : <SlidersHorizontal size={15} className="text-blue-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 capitalize">{e.type}</p>
                  {e.notes && <p className="text-xs text-gray-400 truncate">{e.notes}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-bold ${e.type === 'entrada' ? 'text-green-600' : e.type === 'saida' ? 'text-red-500' : 'text-blue-500'}`}>
                    {e.type === 'saida' ? '-' : e.type === 'entrada' ? '+' : '='}{e.quantity} {selected.unit}
                  </p>
                  <p className="text-xs text-gray-400">
                    {new Date(e.created_at).toLocaleDateString('pt-BR')} {new Date(e.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )

  // ── LISTA ────────────────────────────────────────────────
  return (
    <div className="flex flex-col">
      {/* Sub-nav */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="flex gap-1 max-w-2xl mx-auto">
          <button onClick={() => setInnerTab('estoque')}
            className="px-5 py-3 text-sm font-medium border-b-2 border-green-500 text-green-600 transition-colors">
            Estoque
          </button>
          <button onClick={() => setInnerTab('cadastro')}
            className="px-5 py-3 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700 transition-colors">
            Cadastro
          </button>
        </div>
      </div>

    <div className="flex flex-col gap-4 px-4 py-6 max-w-2xl mx-auto w-full">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Package size={22} className="text-green-500" /> Estoque
          </h2>
          <p className="text-sm text-gray-400 mt-0.5">{products.length} produto{products.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-2 px-4 py-2.5 bg-green-500 text-white rounded-xl text-sm font-semibold hover:bg-green-600">
          <Plus size={16} /> Novo
        </button>
      </div>

      {/* Alertas */}
      {lowCount > 0 && (
        <button onClick={() => setFilterLow(v => !v)}
          className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all
            ${filterLow ? 'border-yellow-400 bg-yellow-50 text-yellow-800' : 'border-yellow-200 bg-yellow-50 text-yellow-700 hover:border-yellow-400'}`}>
          <AlertTriangle size={16} className="text-yellow-500" />
          {lowCount} produto{lowCount > 1 ? 's' : ''} com estoque baixo ou zerado
          {filterLow && <span className="ml-auto text-xs">Clique para ver todos</span>}
        </button>
      )}

      {/* Filtro categorias */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button onClick={() => setFilterCat('all')}
          className={`px-4 py-1.5 rounded-xl text-sm font-semibold shrink-0 border transition-colors
            ${filterCat === 'all' ? 'bg-green-500 text-white border-green-500' : 'bg-white text-gray-600 border-gray-200 hover:border-green-400'}`}>
          Todos
        </button>
        {categories.map(c => (
          <button key={c.id} onClick={() => setFilterCat(c.id)}
            className={`px-4 py-1.5 rounded-xl text-sm font-semibold shrink-0 border transition-colors
              ${filterCat === c.id ? 'bg-green-500 text-white border-green-500' : 'bg-white text-gray-600 border-gray-200 hover:border-green-400'}`}>
            {c.name}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Package size={40} className="mx-auto mb-3 opacity-30" />
          <p>Nenhum produto encontrado</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map(p => (
            <button key={p.id} onClick={() => openDetail(p)}
              className="flex items-center gap-4 bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:border-green-300 hover:shadow-md transition-all text-left">
              {p.photo_url
                ? <img src={p.photo_url} className="w-14 h-14 rounded-xl object-cover shrink-0" />
                : <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                    <Package size={22} className="text-gray-300" />
                  </div>
              }
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800">{p.name}</p>
                <p className="text-xs text-gray-400">{p.category?.name ?? 'Sem categoria'} · R$ {Number(p.price).toFixed(2).replace('.', ',')}</p>
              </div>
              <div className="text-right shrink-0">
                <span className={`inline-block text-xs font-bold px-2.5 py-1 rounded-full ${badge(p.quantity, p.min_stock)}`}>
                  {stockLabel(p.quantity, p.min_stock, p.unit)}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
    </div>
  )
}
