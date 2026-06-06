import { useEffect, useState, useRef } from 'react'
import { Pencil, X, Check, ToggleLeft, ToggleRight, CreditCard, ChevronRight, Lock, Eye, EyeOff, MapPin, Plus, Trash2, Upload, ShoppingBag } from 'lucide-react'
import { ImportarClientes } from './ImportarClientes'
import { ProdutosConfig } from './ProdutosConfig'
import { UsuariosConfig } from './UsuariosConfig'
import { dataService } from '../../lib/dataService'
import { supabase, verifyPassword as edgeVerify } from '../../lib/supabase'
import type { AccessType, PaymentMethod, Unit, UnitAccessPrice, UnitPaymentFee } from '../../types'

// ── helpers ────────────────────────────────────────────────
function currency(v: number) {
  return Number(v).toFixed(2).replace('.', ',')
}

function EditableValue({ value, onSave, prefix = 'R$', disabled = false }: {
  value: number; onSave: (v: number) => Promise<void>; prefix?: string; disabled?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [input, setInput] = useState(currency(value))
  const [saving, setSaving] = useState(false)

  async function save() {
    const parsed = parseFloat(input.replace(',', '.'))
    if (isNaN(parsed) || parsed < 0) return
    setSaving(true)
    await onSave(parsed)
    setSaving(false)
    setEditing(false)
  }

  if (disabled) return <span className="text-sm text-gray-300">{prefix} {currency(value)}</span>

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <span className="text-xs text-gray-400">{prefix}</span>
        <input autoFocus value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
          className="w-20 border-b-2 border-green-400 text-right text-sm font-bold focus:outline-none" />
        <button onClick={save} disabled={saving} className="text-green-500 hover:text-green-600"><Check size={14} /></button>
        <button onClick={() => setEditing(false)} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
      </div>
    )
  }

  return (
    <button onClick={() => { setInput(currency(value)); setEditing(true) }} className="flex items-center gap-1 group">
      <span className="text-sm font-bold text-gray-800">{prefix} {currency(value)}</span>
      <Pencil size={12} className="text-gray-300 group-hover:text-green-500 transition-colors" />
    </button>
  )
}

function DefaultToggle({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className={`flex items-center gap-1 text-xs font-medium transition-colors ${active ? 'text-green-500' : 'text-gray-400'}`}>
      {active ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
      <span className="hidden sm:inline">{active ? 'Padrão' : 'Próprio'}</span>
    </button>
  )
}

// ── Pagamento sub-module ───────────────────────────────────
function PagamentoConfig() {
  const [units, setUnits] = useState<Unit[]>([])
  const [accessTypes, setAccessTypes] = useState<AccessType[]>([])
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [unitAccessPrices, setUnitAccessPrices] = useState<UnitAccessPrice[]>([])
  const [unitPaymentFees, setUnitPaymentFees] = useState<UnitPaymentFee[]>([])
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const load = async () => {
      const [u, at, pm, uap, upf] = await Promise.all([
        dataService.from('units').select('*').execute(),
        dataService.from('access_types').select('*').execute(),
        dataService.from('payment_methods').select('*').execute(),
        dataService.from('unit_access_prices').select('*').execute(),
        dataService.from('unit_payment_fees').select('*').execute(),
      ])
      setUnits((u.data ?? []).sort((a: any, b: any) => a.name.localeCompare(b.name)))
      setAccessTypes((at.data ?? []).sort((a: any, b: any) => a.name.localeCompare(b.name)))
      setPaymentMethods((pm.data ?? []).sort((a: any, b: any) => a.name.localeCompare(b.name)))
      setUnitAccessPrices(uap.data ?? [])
      setUnitPaymentFees(upf.data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  function flash() { setSaved(true); setTimeout(() => setSaved(false), 2000) }

  async function updateDefaultAccessPrice(id: string, price: number) {
    await dataService.from('access_types').update({ price }).eq('id', id).execute()
    setAccessTypes(prev => prev.map(a => a.id === id ? { ...a, price } : a))
    flash()
  }

  async function updateUnitAccessPrice(unitId: string, accessTypeId: string, price: number) {
    const current = unitAccessPrices.find(p => p.unit_id === unitId && p.access_type_id === accessTypeId)
    if (current) await dataService.from('unit_access_prices').update({ price }).eq('id', current.id).execute()
    setUnitAccessPrices(prev => prev.map(p =>
      p.unit_id === unitId && p.access_type_id === accessTypeId ? { ...p, price } : p
    ))
    flash()
  }

  async function toggleUnitAccessDefault(unitId: string, accessTypeId: string) {
    const current = unitAccessPrices.find(p => p.unit_id === unitId && p.access_type_id === accessTypeId)
    if (!current) return
    const use_default = !current.use_default
    await dataService.from('unit_access_prices').update({ use_default }).eq('id', current.id).execute()
    setUnitAccessPrices(prev => prev.map(p =>
      p.unit_id === unitId && p.access_type_id === accessTypeId ? { ...p, use_default } : p
    ))
    flash()
  }

  async function updateDefaultFee(id: string, fee_amount: number) {
    await dataService.from('payment_methods').update({ fee_amount }).eq('id', id).execute()
    setPaymentMethods(prev => prev.map(m => m.id === id ? { ...m, fee_amount } : m))
    flash()
  }

  async function updateUnitFee(unitId: string, methodId: string, fee_amount: number) {
    const current = unitPaymentFees.find(f => f.unit_id === unitId && f.payment_method_id === methodId)
    if (current) await dataService.from('unit_payment_fees').update({ fee_amount }).eq('id', current.id).execute()
    setUnitPaymentFees(prev => prev.map(f =>
      f.unit_id === unitId && f.payment_method_id === methodId ? { ...f, fee_amount } : f
    ))
    flash()
  }

  async function toggleUnitFeeDefault(unitId: string, methodId: string) {
    const current = unitPaymentFees.find(f => f.unit_id === unitId && f.payment_method_id === methodId)
    if (!current) return
    const use_default = !current.use_default
    await dataService.from('unit_payment_fees').update({ use_default }).eq('id', current.id).execute()
    setUnitPaymentFees(prev => prev.map(f =>
      f.unit_id === unitId && f.payment_method_id === methodId ? { ...f, use_default } : f
    ))
    flash()
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Carregando...</div>

  const colClass = 'flex-1 text-center'

  return (
    <div className="flex flex-col gap-10 px-4 py-8 max-w-3xl mx-auto">
      {saved && (
        <div className="fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 text-sm font-medium z-50">
          <Check size={16} /> Salvo
        </div>
      )}

      <section>
        <h2 className="text-lg font-bold text-gray-800 mb-1">Tipos de Acesso</h2>
        <p className="text-xs text-gray-400 mb-4">Clique no valor para editar · "Padrão" usa o valor global · "Próprio" permite valor exclusivo por unidade</p>
        <div className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">
          <div className="w-40">Tipo</div>
          <div className={colClass}>Padrão</div>
          {units.map(u => <div key={u.id} className={colClass}>{u.name.replace('Force One - ', '')}</div>)}
        </div>
        <div className="flex flex-col gap-2">
          {accessTypes.map(at => (
            <div key={at.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-2">
              <div className="w-40"><p className="font-semibold text-gray-800 text-sm">{at.name}</p></div>
              <div className={`${colClass} flex justify-center`}>
                <EditableValue value={Number(at.price)} onSave={v => updateDefaultAccessPrice(at.id, v)} />
              </div>
              {units.map(u => {
                const row = unitAccessPrices.find(p => p.unit_id === u.id && p.access_type_id === at.id)
                if (!row) return <div key={u.id} className={colClass} />
                return (
                  <div key={u.id} className={`${colClass} flex flex-col items-center gap-1`}>
                    <EditableValue value={row.use_default ? Number(at.price) : Number(row.price)} onSave={v => updateUnitAccessPrice(u.id, at.id, v)} disabled={row.use_default} />
                    <DefaultToggle active={row.use_default} onToggle={() => toggleUnitAccessDefault(u.id, at.id)} />
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold text-gray-800 mb-1">Meios de Pagamento</h2>
        <p className="text-xs text-gray-400 mb-4">Taxa em R$ cobrada sobre o valor do acesso (0,00 = sem taxa)</p>
        <div className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">
          <div className="w-40">Método</div>
          <div className={colClass}>Padrão</div>
          {units.map(u => <div key={u.id} className={colClass}>{u.name.replace('Force One - ', '')}</div>)}
        </div>
        <div className="flex flex-col gap-2">
          {paymentMethods.map(pm => (
            <div key={pm.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-2">
              <div className="w-40"><p className="font-semibold text-gray-800 text-sm">{pm.name}</p></div>
              <div className={`${colClass} flex justify-center`}>
                <EditableValue value={Number(pm.fee_amount)} onSave={v => updateDefaultFee(pm.id, v)} />
              </div>
              {units.map(u => {
                const row = unitPaymentFees.find(f => f.unit_id === u.id && f.payment_method_id === pm.id)
                if (!row) return <div key={u.id} className={colClass} />
                return (
                  <div key={u.id} className={`${colClass} flex flex-col items-center gap-1`}>
                    <EditableValue value={row.use_default ? Number(pm.fee_amount) : Number(row.fee_amount)} onSave={v => updateUnitFee(u.id, pm.id, v)} disabled={row.use_default} />
                    <DefaultToggle active={row.use_default} onToggle={() => toggleUnitFeeDefault(u.id, pm.id)} />
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </section>

      {/* Senhas */}
      <section>
        <h2 className="text-lg font-bold text-gray-800 mb-1">Senhas</h2>
        <p className="text-xs text-gray-400 mb-4">Configure as senhas de acesso do sistema</p>
        <div className="flex flex-col gap-3">
          <PasswordSetting label="Senha de desconto" settingKey="discount_password"
            description="Usada para liberar descontos na tela de venda" />
          <PasswordSetting label="Senha de configurações" settingKey="config_password"
            description="Acesso a esta tela e ao bloco Atenção Especial" />
          <PasswordSetting label="Senha do sistema" settingKey="app_password"
            description="Login geral do Force One" />
        </div>
      </section>
    </div>
  )
}

// ── PasswordSetting ─────────────────────────────────────────
function PasswordSetting({ label, settingKey, description }: { label: string; settingKey: string; description: string }) {
  const [value, setValue] = useState('')
  const [editing, setEditing] = useState(false)
  const [input, setInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [show, setShow] = useState(false)

  useEffect(() => {
    supabase.from('settings').select('value').eq('key', settingKey).single()
      .then(({ data }) => { if (data) setValue(data.value) })
  }, [settingKey])

  async function save() {
    if (!input.trim()) return
    setSaving(true)
    await supabase.from('settings').upsert({ key: settingKey, value: input.trim() })
    setValue(input.trim()); setEditing(false); setSaving(false)
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-800">{label}</p>
          <p className="text-xs text-gray-400">{description}</p>
        </div>
        {editing ? (
          <div className="flex items-center gap-2">
            <div className="relative">
              <input
                autoFocus type={show ? 'text' : 'password'} value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && save()}
                placeholder="Nova senha"
                className="w-36 px-3 py-1.5 pr-8 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-green-400"
              />
              <button onClick={() => setShow(s => !s)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400">
                {show ? <EyeOff size={12} /> : <Eye size={12} />}
              </button>
            </div>
            <button onClick={save} disabled={saving || !input.trim()}
              className="p-1.5 text-green-500 hover:text-green-600 disabled:opacity-50"><Check size={15} /></button>
            <button onClick={() => { setEditing(false); setInput('') }}
              className="p-1.5 text-gray-400 hover:text-gray-600"><X size={15} /></button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400 font-mono">{'•'.repeat(Math.min(value.length, 8))}</span>
            <button onClick={() => { setInput(''); setEditing(true) }}
              className="text-xs text-blue-500 hover:text-blue-600 font-medium">Alterar</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Password Gate ──────────────────────────────────────────
function PasswordGate({ onUnlock }: { onUnlock: () => void }) {
  const [input, setInput] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim()) return
    setLoading(true)
    setError('')
    const result = await edgeVerify({ type: 'config_password', password: input.trim() })
    setLoading(false)
    if (result.valid) {
      onUnlock()
    } else {
      setError('Senha incorreta.')
      setInput('')
      inputRef.current?.focus()
    }
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm flex flex-col items-center gap-6">
        <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center">
          <Lock size={28} className="text-green-500" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-800">Área Restrita</h2>
          <p className="text-sm text-gray-400 mt-1">Digite a senha para acessar as configurações</p>
        </div>
        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
          <div className="relative">
            <input
              ref={inputRef}
              type={show ? 'text' : 'password'}
              value={input}
              onChange={e => { setInput(e.target.value); setError('') }}
              placeholder="Senha"
              className="w-full border-2 rounded-xl px-4 py-3 pr-12 focus:outline-none focus:border-green-400 text-gray-800"
            />
            <button type="button" onClick={() => setShow(s => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <button type="submit" disabled={loading || !input.trim()}
            className="w-full py-3 bg-green-500 text-white font-semibold rounded-xl hover:bg-green-600 disabled:opacity-50 transition-colors">
            {loading ? 'Verificando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Filiais Config ─────────────────────────────────────────
function FiliaisConfig() {
  const [units, setUnits]       = useState<Unit[]>([])
  const [loading, setLoading]   = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [saving, setSaving]     = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName]   = useState('')
  const [saved, setSaved]       = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('units').select('*').order('name')
    setUnits(data ?? [])
    setLoading(false)
  }

  function flash() { setSaved(true); setTimeout(() => setSaved(false), 2000) }

  async function saveEdit(id: string) {
    const name = editName.trim()
    if (!name) return
    setSaving(true)
    await supabase.from('units').update({ name }).eq('id', id)
    setUnits(prev => prev.map(u => u.id === id ? { ...u, name } : u).sort((a, b) => a.name.localeCompare(b.name)))
    setEditingId(null)
    setSaving(false)
    flash()
  }

  async function createUnit() {
    const name = newName.trim()
    if (!name) return
    setSaving(true)

    const { data: newUnit } = await supabase
      .from('units').insert({ name }).select().single()

    if (newUnit) {
      // Cria unit_access_prices e unit_payment_fees para todos os tipos/métodos existentes
      const [{ data: ats }, { data: pms }] = await Promise.all([
        supabase.from('access_types').select('id, price'),
        supabase.from('payment_methods').select('id, fee_amount'),
      ])
      if (ats?.length) {
        await supabase.from('unit_access_prices').insert(
          ats.map((at: any) => ({ unit_id: newUnit.id, access_type_id: at.id, price: at.price, use_default: true }))
        )
      }
      if (pms?.length) {
        await supabase.from('unit_payment_fees').insert(
          pms.map((pm: any) => ({ unit_id: newUnit.id, payment_method_id: pm.id, fee_amount: pm.fee_amount, use_default: true }))
        )
      }
      setUnits(prev => [...prev, newUnit].sort((a, b) => a.name.localeCompare(b.name)))
    }

    setNewName('')
    setCreating(false)
    setSaving(false)
    flash()
  }

  async function deleteUnit(id: string) {
    await supabase.from('units').delete().eq('id', id)
    setUnits(prev => prev.filter(u => u.id !== id))
    setConfirmDeleteId(null)
    flash()
  }

  if (loading) return <div className="flex items-center justify-center h-32 text-gray-400">Carregando...</div>

  return (
    <div className="flex flex-col gap-4 px-4 py-8 max-w-2xl mx-auto">
      {saved && (
        <div className="fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 text-sm font-medium z-50">
          <Check size={16} /> Salvo
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">Ao renomear, o novo nome será exibido em todo o sistema</p>
        <button onClick={() => setCreating(v => !v)}
          className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-xl text-sm font-semibold hover:bg-green-600 transition-colors">
          <Plus size={16} /> Nova Filial
        </button>
      </div>

      {/* Formulário nova filial */}
      {creating && (
        <div className="flex gap-2">
          <input autoFocus value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') createUnit(); if (e.key === 'Escape') setCreating(false) }}
            placeholder="Nome da filial (ex: Force One - Unidade 3)"
            className="flex-1 border-2 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-green-400" />
          <button onClick={createUnit} disabled={saving || !newName.trim()}
            className="px-4 py-2.5 bg-green-500 text-white rounded-xl text-sm font-semibold hover:bg-green-600 disabled:opacity-50">
            {saving ? '...' : <Check size={16} />}
          </button>
          <button onClick={() => { setCreating(false); setNewName('') }}
            className="px-4 py-2.5 border rounded-xl text-gray-500 hover:bg-gray-50">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Lista de filiais */}
      <div className="flex flex-col gap-3">
        {units.map(u => (
          <div key={u.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center shrink-0">
              <MapPin size={18} className="text-green-500" />
            </div>

            {editingId === u.id ? (
              <div className="flex flex-1 items-center gap-2">
                <input autoFocus value={editName} onChange={e => setEditName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveEdit(u.id); if (e.key === 'Escape') setEditingId(null) }}
                  className="flex-1 border-2 border-green-400 rounded-xl px-3 py-1.5 text-sm focus:outline-none" />
                <button onClick={() => saveEdit(u.id)} disabled={saving}
                  className="p-2 text-green-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors">
                  <Check size={16} />
                </button>
                <button onClick={() => setEditingId(null)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors">
                  <X size={16} />
                </button>
              </div>
            ) : (
              <>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800">{u.name}</p>
                </div>
                <button onClick={() => { setEditingId(u.id); setEditName(u.name) }}
                  className="p-2 text-gray-300 hover:text-green-500 hover:bg-green-50 rounded-lg transition-colors">
                  <Pencil size={15} />
                </button>
                {confirmDeleteId === u.id ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-red-500 font-medium">Confirmar?</span>
                    <button onClick={() => deleteUnit(u.id)}
                      className="px-3 py-1.5 bg-red-500 text-white text-xs rounded-lg font-semibold hover:bg-red-600">
                      Sim
                    </button>
                    <button onClick={() => setConfirmDeleteId(null)}
                      className="px-3 py-1.5 border text-xs rounded-lg text-gray-500 hover:bg-gray-50">
                      Não
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDeleteId(u.id)}
                    className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 size={15} />
                  </button>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Menu de Configurações ──────────────────────────────────
type ConfigPage = null | 'pagamento' | 'filiais' | 'importar' | 'produtos' | 'usuarios'

const MENU_ITEMS = [
  {
    id: 'usuarios' as ConfigPage,
    label: 'Usuários',
    description: 'Cadastro de login, senha e permissões por módulo',
    icon: <Lock size={22} className="text-green-500" />,
  },
  {
    id: 'filiais' as ConfigPage,
    label: 'Filiais',
    description: 'Cadastro e renomeação das unidades do campo',
    icon: <MapPin size={22} className="text-green-500" />,
  },
  {
    id: 'pagamento' as ConfigPage,
    label: 'Pagamento',
    description: 'Preços de acesso e taxas por forma de pagamento',
    icon: <CreditCard size={22} className="text-green-500" />,
  },
  {
    id: 'produtos' as ConfigPage,
    label: 'Produtos',
    description: 'Cadastre e gerencie produtos para venda no campo',
    icon: <ShoppingBag size={22} className="text-green-500" />,
  },
  {
    id: 'importar' as ConfigPage,
    label: 'Importar Clientes',
    description: 'Importe uma base de clientes via planilha .xlsx ou .csv',
    icon: <Upload size={22} className="text-green-500" />,
  },
]

export function ConfiguracoesModule() {
  const [unlocked, setUnlocked] = useState(false)
  const [page, setPage] = useState<ConfigPage>(null)

  if (!unlocked) return <PasswordGate onUnlock={() => setUnlocked(true)} />

  if (page === 'usuarios') {
    return (
      <div className="flex flex-col">
        <div className="px-4 pt-6 pb-2 max-w-2xl mx-auto w-full">
          <button onClick={() => setPage(null)} className="flex items-center gap-2 text-gray-400 hover:text-gray-600 text-sm mb-2">← Configurações</button>
          <h1 className="text-2xl font-bold text-gray-800">Usuários</h1>
        </div>
        <UsuariosConfig />
      </div>
    )
  }

  if (page === 'produtos') {
    return (
      <div className="flex flex-col">
        <div className="px-4 pt-6 pb-2 max-w-2xl mx-auto w-full">
          <button onClick={() => setPage(null)} className="flex items-center gap-2 text-gray-400 hover:text-gray-600 text-sm mb-2">← Configurações</button>
          <h1 className="text-2xl font-bold text-gray-800">Produtos</h1>
        </div>
        <ProdutosConfig />
      </div>
    )
  }

  if (page === 'importar') {
    return (
      <div className="flex flex-col">
        <div className="px-4 pt-6 pb-2 max-w-2xl mx-auto w-full">
          <button onClick={() => setPage(null)} className="flex items-center gap-2 text-gray-400 hover:text-gray-600 text-sm mb-2">
            ← Configurações
          </button>
          <h1 className="text-2xl font-bold text-gray-800">Importar Clientes</h1>
        </div>
        <div className="px-4 max-w-2xl mx-auto w-full">
          <ImportarClientes />
        </div>
      </div>
    )
  }

  if (page === 'filiais') {
    return (
      <div className="flex flex-col">
        <div className="px-4 pt-6 pb-2 max-w-2xl mx-auto w-full">
          <button onClick={() => setPage(null)} className="flex items-center gap-2 text-gray-400 hover:text-gray-600 text-sm mb-2">
            ← Configurações
          </button>
          <h1 className="text-2xl font-bold text-gray-800">Filiais</h1>
        </div>
        <FiliaisConfig />
      </div>
    )
  }

  if (page === 'pagamento') {
    return (
      <div className="flex flex-col">
        <div className="px-4 pt-6 pb-2 max-w-3xl mx-auto w-full">
          <button onClick={() => setPage(null)} className="flex items-center gap-2 text-gray-400 hover:text-gray-600 text-sm mb-2">
            ← Configurações
          </button>
          <h1 className="text-2xl font-bold text-gray-800">Pagamento</h1>
        </div>
        <PagamentoConfig />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 px-4 py-8 max-w-2xl mx-auto w-full">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Configurações</h1>
        <p className="text-sm text-gray-400 mt-1">Gerencie as configurações do sistema</p>
      </div>
      <div className="flex flex-col gap-3">
        {MENU_ITEMS.map(item => (
          <button key={String(item.id)} onClick={() => setPage(item.id)}
            className="flex items-center gap-4 p-4 bg-white rounded-2xl shadow-sm border border-gray-100 hover:border-green-400 hover:shadow-md transition-all text-left">
            <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center shrink-0">
              {item.icon}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-gray-800">{item.label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{item.description}</p>
            </div>
            <ChevronRight size={18} className="text-gray-300" />
          </button>
        ))}
      </div>
    </div>
  )
}
