import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Check, X, ToggleLeft, ToggleRight, Barcode } from 'lucide-react'
import { supabase } from '../../lib/supabase'

interface Category { id: string; name: string; sort_order: number }
interface Product  { id: string; name: string; price: number; category_id: string | null; active: boolean; barcode?: string | null }

function currency(v: number) { return Number(v).toFixed(2).replace('.', ',') }

export function ProdutosConfig() {
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts]     = useState<Product[]>([])
  const [loading, setLoading]       = useState(true)
  const [saved, setSaved]           = useState(false)

  // produto form
  const [showForm, setShowForm]     = useState(false)
  const [editingId, setEditingId]   = useState<string | null>(null)
  const [form, setForm]             = useState({ name: '', price: '', category_id: '', barcode: '' })
  const [saving, setSaving]         = useState(false)

  // categoria form
  const [newCatName, setNewCatName] = useState('')
  const [addingCat, setAddingCat]   = useState(false)
  const [editCatId, setEditCatId]   = useState<string | null>(null)
  const [editCatName, setEditCatName] = useState('')

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

  async function saveProduct() {
    if (!form.name.trim() || !form.price) return
    setSaving(true)
    const data = {
      name: form.name.trim(),
      price: parseFloat(form.price.replace(',', '.')),
      category_id: form.category_id || null,
      barcode: form.barcode.trim() || null,
    }
    if (editingId) {
      await supabase.from('products').update(data).eq('id', editingId)
      setProducts(prev => prev.map(p => p.id === editingId ? { ...p, ...data } : p))
    } else {
      const { data: d } = await supabase.from('products').insert({ ...data, active: true }).select().single()
      if (d) setProducts(prev => [...prev, d].sort((a, b) => a.name.localeCompare(b.name)))
    }
    setShowForm(false); setEditingId(null); setForm({ name: '', price: '', category_id: '', barcode: '' })
    setSaving(false); flash()
  }

  async function toggleActive(id: string, active: boolean) {
    await supabase.from('products').update({ active: !active }).eq('id', id)
    setProducts(prev => prev.map(p => p.id === id ? { ...p, active: !active } : p))
    flash()
  }

  async function deleteProduct(id: string) {
    await supabase.from('products').delete().eq('id', id)
    setProducts(prev => prev.filter(p => p.id !== id))
    flash()
  }

  async function addCategory() {
    if (!newCatName.trim()) return
    const { data } = await supabase.from('product_categories')
      .insert({ name: newCatName.trim(), sort_order: categories.length + 1 }).select().single()
    if (data) setCategories(prev => [...prev, data])
    setNewCatName(''); setAddingCat(false); flash()
  }

  async function saveCatEdit(id: string) {
    if (!editCatName.trim()) return
    await supabase.from('product_categories').update({ name: editCatName.trim() }).eq('id', id)
    setCategories(prev => prev.map(c => c.id === id ? { ...c, name: editCatName.trim() } : c))
    setEditCatId(null); flash()
  }

  async function deleteCat(id: string) {
    await supabase.from('product_categories').delete().eq('id', id)
    setCategories(prev => prev.filter(c => c.id !== id))
    flash()
  }

  if (loading) return <div className="flex items-center justify-center h-32 text-gray-400">Carregando...</div>

  return (
    <div className="flex flex-col gap-8 px-4 py-6 max-w-2xl mx-auto">
      {saved && (
        <div className="fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 text-sm z-50">
          <Check size={16} /> Salvo
        </div>
      )}

      {/* Categorias */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-800">Categorias</h2>
          <button onClick={() => setAddingCat(v => !v)}
            className="flex items-center gap-1.5 text-sm text-green-600 font-medium hover:text-green-700">
            <Plus size={15} /> Nova
          </button>
        </div>
        {addingCat && (
          <div className="flex gap-2 mb-3">
            <input autoFocus value={newCatName} onChange={e => setNewCatName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addCategory(); if (e.key === 'Escape') setAddingCat(false) }}
              placeholder="Nome da categoria..." className="flex-1 border-2 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-400" />
            <button onClick={addCategory} className="px-3 py-2 bg-green-500 text-white rounded-xl"><Check size={16} /></button>
            <button onClick={() => { setAddingCat(false); setNewCatName('') }} className="px-3 py-2 border rounded-xl text-gray-500"><X size={16} /></button>
          </div>
        )}
        <div className="flex flex-col gap-2">
          {categories.map(c => (
            <div key={c.id} className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3">
              {editCatId === c.id ? (
                <>
                  <input autoFocus value={editCatName} onChange={e => setEditCatName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveCatEdit(c.id); if (e.key === 'Escape') setEditCatId(null) }}
                    className="flex-1 border-b-2 border-green-400 py-0.5 text-sm focus:outline-none" />
                  <button onClick={() => saveCatEdit(c.id)} className="text-green-500"><Check size={15} /></button>
                  <button onClick={() => setEditCatId(null)} className="text-gray-400"><X size={15} /></button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm font-medium text-gray-800">{c.name}</span>
                  <span className="text-xs text-gray-400">{products.filter(p => p.category_id === c.id).length} produtos</span>
                  <button onClick={() => { setEditCatId(c.id); setEditCatName(c.name) }} className="p-1.5 text-gray-300 hover:text-green-500 rounded-lg transition-colors"><Pencil size={14} /></button>
                  <button onClick={() => deleteCat(c.id)} className="p-1.5 text-gray-300 hover:text-red-500 rounded-lg transition-colors"><Trash2 size={14} /></button>
                </>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Produtos */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-800">Produtos</h2>
          <button onClick={() => { setShowForm(true); setEditingId(null); setForm({ name: '', price: '', category_id: '', barcode: '' }) }}
            className="flex items-center gap-1.5 px-3 py-2 bg-green-500 text-white rounded-xl text-sm font-semibold hover:bg-green-600">
            <Plus size={15} /> Novo produto
          </button>
        </div>

        {/* Form */}
        {showForm && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-4 flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-green-800">{editingId ? 'Editar produto' : 'Novo produto'}</h3>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Nome do produto" className="w-full border-2 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-400" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Preço (R$)</label>
                <input value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                  placeholder="0,00" className="w-full border-2 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-400" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Categoria</label>
                <select value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
                  className="w-full border-2 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-400 bg-white">
                  <option value="">Sem categoria</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 flex items-center gap-1"><Barcode size={12} /> Código de barras (opcional)</label>
              <input value={form.barcode} onChange={e => setForm(f => ({ ...f, barcode: e.target.value }))}
                placeholder="Bipe ou digite o código..." className="w-full border-2 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-400" />
            </div>
            <div className="flex gap-2">
              <button onClick={saveProduct} disabled={saving || !form.name.trim() || !form.price}
                className="flex-1 py-2.5 bg-green-500 text-white rounded-xl text-sm font-semibold hover:bg-green-600 disabled:opacity-50">
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
              <button onClick={() => { setShowForm(false); setEditingId(null) }} className="px-4 border rounded-xl text-gray-500 hover:bg-gray-50">
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Lista agrupada por categoria */}
        {[...categories, { id: 'none', name: 'Sem categoria', sort_order: 999 }].map(cat => {
          const catProds = products.filter(p =>
            cat.id === 'none' ? !p.category_id : p.category_id === cat.id
          )
          if (catProds.length === 0) return null
          return (
            <div key={cat.id} className="mb-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{cat.name}</p>
              <div className="flex flex-col gap-2">
                {catProds.map(p => (
                  <div key={p.id} className={`bg-white rounded-xl border shadow-sm px-4 py-3 flex items-center gap-3 transition-opacity ${!p.active ? 'opacity-50' : ''}`}
                    style={{ borderColor: p.active ? '#f0fdf4' : '#f3f4f6' }}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{p.name}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-green-600 font-bold">R$ {currency(p.price)}</p>
                        {p.barcode && <span className="flex items-center gap-1 text-xs text-gray-400"><Barcode size={11} />{p.barcode}</span>}
                      </div>
                    </div>
                    <button onClick={() => toggleActive(p.id, p.active)}
                      className={`text-xs font-medium flex items-center gap-1 ${p.active ? 'text-green-500' : 'text-gray-400'}`}>
                      {p.active ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                    </button>
                    <button onClick={() => { setEditingId(p.id); setShowForm(true); setForm({ name: p.name, price: currency(p.price), category_id: p.category_id ?? '', barcode: p.barcode ?? '' }) }}
                      className="p-1.5 text-gray-300 hover:text-green-500 rounded-lg transition-colors"><Pencil size={14} /></button>
                    <button onClick={() => deleteProduct(p.id)} className="p-1.5 text-gray-300 hover:text-red-500 rounded-lg transition-colors"><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            </div>
          )
        })}

        {products.length === 0 && (
          <div className="text-center py-10 text-gray-400 text-sm">Nenhum produto cadastrado ainda.</div>
        )}
      </section>
    </div>
  )
}
