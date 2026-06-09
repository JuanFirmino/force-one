import { useEffect, useState } from 'react'
import {
  Plus, Pencil, Trash2, Check, X,
  ToggleLeft, ToggleRight, Barcode, ArrowLeft, Tag, ShoppingBag,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'

interface Category { id: string; name: string; sort_order: number }
interface Product  { id: string; name: string; price: number; category_id: string | null; active: boolean; barcode?: string | null }
interface ProductCount { id: string; category_id: string | null }

function currency(v: number) { return Number(v).toFixed(2).replace('.', ',') }

type InnerView = 'list' | 'form'
type SubTab    = 'produtos' | 'categorias'

// ── Categorias ────────────────────────────────────────────
function CategoriasTab() {
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts]     = useState<ProductCount[]>([])
  const [loading, setLoading]       = useState(true)
  const [newCatName, setNewCatName] = useState('')
  const [adding, setAdding]         = useState(false)
  const [editCatId, setEditCatId]   = useState<string | null>(null)
  const [editCatName, setEditCatName] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [saved, setSaved]           = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [cats, prods] = await Promise.all([
      supabase.from('product_categories').select('*').order('sort_order'),
      supabase.from('products').select('id, category_id').order('name'),
    ])
    setCategories(cats.data ?? [])
    setProducts(prods.data ?? [])
    setLoading(false)
  }

  function flash() { setSaved(true); setTimeout(() => setSaved(false), 2000) }

  async function addCategory() {
    if (!newCatName.trim()) return
    const { data } = await supabase.from('product_categories')
      .insert({ name: newCatName.trim(), sort_order: categories.length + 1 })
      .select().single()
    if (data) setCategories(prev => [...prev, data])
    setNewCatName(''); setAdding(false); flash()
  }

  async function saveCatEdit(id: string) {
    if (!editCatName.trim()) return
    await supabase.from('product_categories').update({ name: editCatName.trim() }).eq('id', id)
    setCategories(prev => prev.map(c => c.id === id ? { ...c, name: editCatName.trim() } : c))
    setEditCatId(null); flash()
  }

  async function deleteCategory(id: string) {
    await supabase.from('product_categories').delete().eq('id', id)
    setCategories(prev => prev.filter(c => c.id !== id))
    setConfirmDeleteId(null); flash()
  }

  if (loading) return <div className="flex items-center justify-center h-32 text-gray-400 text-sm">Carregando...</div>

  return (
    <div className="flex flex-col gap-4 px-4 py-6 max-w-2xl mx-auto w-full">
      {saved && (
        <div className="fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 text-sm z-50">
          <Check size={16} /> Salvo
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-700">{categories.length} categoria{categories.length !== 1 ? 's' : ''}</p>
          <p className="text-xs text-gray-400 mt-0.5">Organize os produtos por categoria</p>
        </div>
        <button onClick={() => { setAdding(true); setEditCatId(null) }}
          className="flex items-center gap-2 px-4 py-2.5 bg-green-500 text-white rounded-xl text-sm font-semibold hover:bg-green-600 transition-colors">
          <Plus size={15} /> Nova
        </button>
      </div>

      {/* Form nova categoria */}
      {adding && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex gap-2">
          <input
            autoFocus
            value={newCatName}
            onChange={e => setNewCatName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addCategory(); if (e.key === 'Escape') setAdding(false) }}
            placeholder="Nome da categoria..."
            className="flex-1 border-2 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-400 bg-white"
          />
          <button onClick={addCategory} disabled={!newCatName.trim()}
            className="px-3 py-2 bg-green-500 text-white rounded-xl disabled:opacity-50">
            <Check size={16} />
          </button>
          <button onClick={() => { setAdding(false); setNewCatName('') }}
            className="px-3 py-2 border rounded-xl text-gray-400 hover:bg-gray-50">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Lista */}
      {categories.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Tag size={36} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhuma categoria cadastrada</p>
          <p className="text-xs mt-1">Crie categorias para organizar os produtos</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {categories.map(c => {
            const count = products.filter(p => p.category_id === c.id).length
            return (
              <div key={c.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3.5 flex items-center gap-3">
                <div className="w-9 h-9 bg-green-50 rounded-xl flex items-center justify-center shrink-0">
                  <Tag size={16} className="text-green-500" />
                </div>

                {editCatId === c.id ? (
                  <div className="flex flex-1 items-center gap-2">
                    <input
                      autoFocus value={editCatName}
                      onChange={e => setEditCatName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveCatEdit(c.id); if (e.key === 'Escape') setEditCatId(null) }}
                      className="flex-1 border-2 border-green-400 rounded-xl px-3 py-1.5 text-sm focus:outline-none"
                    />
                    <button onClick={() => saveCatEdit(c.id)} className="p-1.5 text-green-500 hover:text-green-600"><Check size={15} /></button>
                    <button onClick={() => setEditCatId(null)} className="p-1.5 text-gray-400 hover:text-gray-600"><X size={15} /></button>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800">{c.name}</p>
                      <p className="text-xs text-gray-400">{count} produto{count !== 1 ? 's' : ''}</p>
                    </div>
                    <button onClick={() => { setEditCatId(c.id); setEditCatName(c.name) }}
                      className="p-2 text-gray-300 hover:text-green-500 hover:bg-green-50 rounded-xl transition-colors">
                      <Pencil size={14} />
                    </button>
                    {confirmDeleteId === c.id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-red-500 font-medium">Excluir?</span>
                        <button onClick={() => deleteCategory(c.id)}
                          className="px-3 py-1.5 bg-red-500 text-white text-xs rounded-lg font-semibold hover:bg-red-600">
                          Sim
                        </button>
                        <button onClick={() => setConfirmDeleteId(null)}
                          className="px-3 py-1.5 border text-xs rounded-lg text-gray-500 hover:bg-gray-50">
                          Não
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmDeleteId(c.id)}
                        className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Produtos ──────────────────────────────────────────────
function ProdutosTab() {
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts]     = useState<Product[]>([])
  const [loading, setLoading]       = useState(true)
  const [view, setView]             = useState<InnerView>('list')
  const [editingId, setEditingId]   = useState<string | null>(null)
  const [form, setForm]             = useState({ name: '', price: '', category_id: '', barcode: '' })
  const [saving, setSaving]         = useState(false)
  const [saved, setSaved]           = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [filterCat, setFilterCat]   = useState<string>('all')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [cats, prods] = await Promise.all([
      supabase.from('product_categories').select('*').order('sort_order'),
      supabase.from('products').select('*').order('name'),
    ])
    setCategories(cats.data ?? [])
    setProducts(prods.data ?? [])
    setLoading(false)
  }

  function flash() { setSaved(true); setTimeout(() => setSaved(false), 2000) }

  function openNew() {
    setEditingId(null)
    setForm({ name: '', price: '', category_id: '', barcode: '' })
    setView('form')
  }

  function openEdit(p: Product) {
    setEditingId(p.id)
    setForm({ name: p.name, price: currency(p.price), category_id: p.category_id ?? '', barcode: p.barcode ?? '' })
    setView('form')
  }

  async function saveProduct() {
    if (!form.name.trim() || !form.price) return
    setSaving(true)
    const data = {
      name:        form.name.trim(),
      price:       parseFloat(form.price.replace(',', '.')),
      category_id: form.category_id || null,
      barcode:     form.barcode.trim() || null,
    }
    if (editingId) {
      await supabase.from('products').update(data).eq('id', editingId)
      setProducts(prev => prev.map(p => p.id === editingId ? { ...p, ...data } : p))
    } else {
      const { data: d } = await supabase.from('products').insert({ ...data, active: true }).select().single()
      if (d) setProducts(prev => [...prev, d].sort((a, b) => a.name.localeCompare(b.name)))
    }
    setSaving(false); setView('list'); flash()
  }

  async function toggleActive(id: string, active: boolean) {
    await supabase.from('products').update({ active: !active }).eq('id', id)
    setProducts(prev => prev.map(p => p.id === id ? { ...p, active: !active } : p))
    flash()
  }

  async function deleteProduct(id: string) {
    await supabase.from('products').delete().eq('id', id)
    setProducts(prev => prev.filter(p => p.id !== id))
    setConfirmDeleteId(null); flash()
  }

  // ── Formulário ────────────────────────────────────────
  if (view === 'form') return (
    <div className="flex flex-col gap-5 px-4 py-6 max-w-2xl mx-auto w-full">
      <div className="flex items-center gap-3">
        <button onClick={() => setView('list')} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
          <ArrowLeft size={20} className="text-gray-500" />
        </button>
        <div>
          <h2 className="text-xl font-bold text-gray-800">{editingId ? 'Editar produto' : 'Novo produto'}</h2>
          <p className="text-xs text-gray-400 mt-0.5">{editingId ? 'Altere os dados do produto' : 'Preencha os dados do produto'}</p>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {/* Nome */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1.5 block">Nome *</label>
          <input
            autoFocus
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Ex: Água mineral 500ml"
            className="w-full border-2 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-green-400 transition-colors"
          />
        </div>

        {/* Preço + Categoria */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">Preço (R$) *</label>
            <input
              value={form.price}
              onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
              placeholder="0,00"
              className="w-full border-2 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-green-400 transition-colors"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">Categoria</label>
            <select
              value={form.category_id}
              onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
              className="w-full border-2 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-green-400 bg-white transition-colors"
            >
              <option value="">Sem categoria</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>

        {/* Código de barras */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
            <Barcode size={14} className="text-gray-400" /> Código de barras
            <span className="text-xs text-gray-400 font-normal">(opcional)</span>
          </label>
          <input
            value={form.barcode}
            onChange={e => setForm(f => ({ ...f, barcode: e.target.value }))}
            placeholder="Bipe ou digite o código..."
            className="w-full border-2 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-green-400 transition-colors"
          />
          <p className="text-xs text-gray-400 mt-1.5">Ao bipar qualquer produto na tela de Venda, ele será adicionado automaticamente ao carrinho.</p>
        </div>
      </div>

      {/* Ações */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={() => setView('list')}
          className="px-5 py-3 border-2 border-gray-200 text-gray-600 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors">
          Cancelar
        </button>
        <button
          onClick={saveProduct}
          disabled={saving || !form.name.trim() || !form.price}
          className="flex-1 py-3 bg-green-500 text-white rounded-xl text-sm font-bold hover:bg-green-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
          <Check size={16} /> {saving ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Cadastrar produto'}
        </button>
      </div>
    </div>
  )

  // ── Lista ────────────────────────────────────────────
  const filtered = filterCat === 'all'
    ? products
    : products.filter(p => p.category_id === filterCat)

  return (
    <div className="flex flex-col gap-4 px-4 py-6 max-w-2xl mx-auto w-full">
      {saved && (
        <div className="fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 text-sm z-50">
          <Check size={16} /> Salvo
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-700">{products.length} produto{products.length !== 1 ? 's' : ''}</p>
          <p className="text-xs text-gray-400 mt-0.5">{products.filter(p => p.active).length} ativo{products.filter(p => p.active).length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-2 px-4 py-2.5 bg-green-500 text-white rounded-xl text-sm font-semibold hover:bg-green-600 transition-colors">
          <Plus size={15} /> Novo produto
        </button>
      </div>

      {/* Filtro por categoria */}
      {categories.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button onClick={() => setFilterCat('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold shrink-0 border transition-colors
              ${filterCat === 'all' ? 'bg-green-500 text-white border-green-500' : 'bg-white text-gray-600 border-gray-200 hover:border-green-300'}`}>
            Todos
          </button>
          {categories.map(c => (
            <button key={c.id} onClick={() => setFilterCat(c.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold shrink-0 border transition-colors
                ${filterCat === c.id ? 'bg-green-500 text-white border-green-500' : 'bg-white text-gray-600 border-gray-200 hover:border-green-300'}`}>
              {c.name}
            </button>
          ))}
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <ShoppingBag size={36} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">Nenhum produto encontrado</p>
          {products.length === 0 && (
            <button onClick={openNew} className="mt-3 text-sm text-green-600 font-semibold hover:text-green-700">
              Cadastrar primeiro produto →
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map(p => {
            const catName = categories.find(c => c.id === p.category_id)?.name
            return (
              <div key={p.id}
                className={`bg-white rounded-2xl border shadow-sm px-4 py-3.5 flex items-center gap-3 transition-all
                  ${!p.active ? 'opacity-50 border-gray-100' : 'border-gray-100 hover:border-green-200'}`}>
                {/* Ativo toggle */}
                <button onClick={() => toggleActive(p.id, p.active)}
                  className={`shrink-0 transition-colors ${p.active ? 'text-green-500' : 'text-gray-300'}`}
                  title={p.active ? 'Desativar' : 'Ativar'}>
                  {p.active ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                </button>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{p.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-sm font-bold text-green-600">R$ {currency(p.price)}</span>
                    {catName && (
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Tag size={10} /> {catName}
                      </span>
                    )}
                    {p.barcode && (
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Barcode size={10} /> {p.barcode}
                      </span>
                    )}
                  </div>
                </div>

                {/* Ações */}
                <button onClick={() => openEdit(p)}
                  className="p-2 text-gray-300 hover:text-green-500 hover:bg-green-50 rounded-xl transition-colors shrink-0">
                  <Pencil size={15} />
                </button>
                {confirmDeleteId === p.id ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-red-500 font-medium">Excluir?</span>
                    <button onClick={() => deleteProduct(p.id)}
                      className="px-2.5 py-1 bg-red-500 text-white text-xs rounded-lg font-semibold hover:bg-red-600">
                      Sim
                    </button>
                    <button onClick={() => setConfirmDeleteId(null)}
                      className="px-2.5 py-1 border text-xs rounded-lg text-gray-500 hover:bg-gray-50">
                      Não
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDeleteId(p.id)}
                    className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors shrink-0">
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── ProdutosConfig (exportado) ────────────────────────────
export function ProdutosConfig() {
  const [subTab, setSubTab] = useState<SubTab>('produtos')

  return (
    <div className="flex flex-col">
      {/* Sub-nav */}
      <div className="bg-gray-50 border-b border-gray-200 px-6">
        <div className="flex gap-1 max-w-2xl mx-auto">
          <button
            onClick={() => setSubTab('produtos')}
            className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2
              ${subTab === 'produtos' ? 'border-green-500 text-green-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            <ShoppingBag size={14} /> Produtos
          </button>
          <button
            onClick={() => setSubTab('categorias')}
            className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2
              ${subTab === 'categorias' ? 'border-green-500 text-green-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            <Tag size={14} /> Categorias
          </button>
        </div>
      </div>

      {subTab === 'produtos'    && <ProdutosTab />}
      {subTab === 'categorias'  && <CategoriasTab />}
    </div>
  )
}
