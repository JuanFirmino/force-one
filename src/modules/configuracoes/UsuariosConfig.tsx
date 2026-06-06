import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Check, X, Eye, EyeOff, User, ShieldCheck, ShieldOff, Lock } from 'lucide-react'
import { supabase } from '../../lib/supabase'

const MODULES = [
  { id: 'acesso',        label: 'Entrada' },
  { id: 'venda',         label: 'Venda' },
  { id: 'cozinha',       label: 'Cozinha' },
  { id: 'caixa',         label: 'Caixa' },
  { id: 'estoque',       label: 'Estoque' },
  { id: 'jogo',          label: 'Status dos Campos' },
  { id: 'operadores',    label: 'Operadores' },
  { id: 'ocorrencias',   label: 'Advertências' },
  { id: 'configuracoes', label: 'Configurações' },
]

type Permissions = Record<string, boolean>

interface AppUser {
  id: string
  name: string
  login: string
  password: string
  permissions: Permissions
  active: boolean
  created_at: string
}

const DEFAULT_PERMISSIONS: Permissions = Object.fromEntries(MODULES.map(m => [m.id, false]))

function PermissionGrid({ permissions, onChange }: {
  permissions: Permissions
  onChange: (p: Permissions) => void
}) {
  function toggle(id: string) {
    onChange({ ...permissions, [id]: !permissions[id] })
  }

  function allOn()  { onChange(Object.fromEntries(MODULES.map(m => [m.id, true]))) }
  function allOff() { onChange(Object.fromEntries(MODULES.map(m => [m.id, false]))) }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Módulos permitidos</p>
        <div className="flex gap-2">
          <button onClick={allOn}  className="text-xs text-green-600 hover:underline font-medium">Todos</button>
          <button onClick={allOff} className="text-xs text-gray-400 hover:underline font-medium">Nenhum</button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {MODULES.map(m => (
          <button
            key={m.id}
            type="button"
            onClick={() => toggle(m.id)}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border-2 text-sm font-medium transition-all text-left
              ${permissions[m.id]
                ? 'border-green-400 bg-green-50 text-green-700'
                : 'border-gray-100 bg-white text-gray-400 hover:border-gray-200'}`}
          >
            <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 transition-colors
              ${permissions[m.id] ? 'bg-green-500' : 'bg-gray-200'}`}>
              {permissions[m.id] && <Check size={10} className="text-white" strokeWidth={3} />}
            </div>
            {m.label}
          </button>
        ))}
      </div>
    </div>
  )
}

interface UserFormProps {
  initial?: Partial<AppUser>
  onSave: (data: { name: string; login: string; password: string; permissions: Permissions }) => Promise<void>
  onCancel: () => void
  editMode?: boolean
}

function UserForm({ initial, onSave, onCancel, editMode }: UserFormProps) {
  const [name,        setName]        = useState(initial?.name ?? '')
  const [login,       setLogin]       = useState(initial?.login ?? '')
  const [password,    setPassword]    = useState('')
  const [showPwd,     setShowPwd]     = useState(false)
  const [permissions, setPermissions] = useState<Permissions>(initial?.permissions ?? { ...DEFAULT_PERMISSIONS })
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState('')

  async function handleSave() {
    if (!name.trim())  { setError('Nome é obrigatório.'); return }
    if (!login.trim()) { setError('Login é obrigatório.'); return }
    if (!editMode && !password.trim()) { setError('Senha é obrigatória.'); return }
    setSaving(true); setError('')
    try {
      await onSave({
        name: name.trim(),
        login: login.trim().toLowerCase(),
        password: password.trim() || (initial?.password ?? ''),
        permissions,
      })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar.')
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-500">Nome</label>
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Nome completo"
            className="px-3 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-400 transition-colors"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-500">Login</label>
          <input
            value={login}
            onChange={e => setLogin(e.target.value)}
            placeholder="usuario123"
            className="px-3 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-400 transition-colors"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-gray-500">
          Senha {editMode && <span className="font-normal text-gray-400">(deixe em branco para não alterar)</span>}
        </label>
        <div className="relative">
          <input
            type={showPwd ? 'text' : 'password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder={editMode ? '••••••••' : 'Senha de acesso'}
            className="w-full px-3 py-2.5 pr-10 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-400 transition-colors"
          />
          <button type="button" onClick={() => setShowPwd(s => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
      </div>

      <PermissionGrid permissions={permissions} onChange={setPermissions} />

      {error && <p className="text-red-500 text-xs">{error}</p>}

      <div className="flex gap-2 pt-1">
        <button onClick={onCancel}
          className="flex-1 py-2.5 border-2 border-gray-200 rounded-xl text-sm font-semibold text-gray-500 hover:bg-gray-50 transition-colors">
          Cancelar
        </button>
        <button onClick={handleSave} disabled={saving}
          className="flex-1 py-2.5 bg-green-500 text-white rounded-xl text-sm font-bold hover:bg-green-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
          <Check size={15} /> {saving ? 'Salvando...' : editMode ? 'Atualizar' : 'Criar usuário'}
        </button>
      </div>
    </div>
  )
}

function SenhaConfiguracoes() {
  const [editing,  setEditing]  = useState(false)
  const [current,  setCurrent]  = useState('')
  const [newPwd,   setNewPwd]   = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [showCur,  setShowCur]  = useState(false)
  const [showNew,  setShowNew]  = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')
  const [success,  setSuccess]  = useState(false)

  function cancel() {
    setEditing(false); setCurrent(''); setNewPwd(''); setConfirm('')
    setError(''); setSuccess(false); setShowCur(false); setShowNew(false)
  }

  async function handleSave() {
    setError(''); setSuccess(false)
    if (!current.trim() || !newPwd.trim() || !confirm.trim()) { setError('Preencha todos os campos.'); return }
    if (newPwd !== confirm) { setError('Nova senha e confirmação não coincidem.'); return }
    if (newPwd.length < 4)  { setError('A nova senha deve ter ao menos 4 caracteres.'); return }
    setSaving(true)
    const { data } = await supabase.from('settings').select('value').eq('key', 'config_password').single()
    if (!data || data.value !== current.trim()) { setError('Senha atual incorreta.'); setSaving(false); return }
    await supabase.from('settings').upsert({ key: 'config_password', value: newPwd.trim() })
    setSaving(false); setSuccess(true)
    setCurrent(''); setNewPwd(''); setConfirm('')
    setTimeout(() => { setSuccess(false); setEditing(false) }, 2000)
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-800">Senha de configurações</p>
          <p className="text-xs text-gray-400">Acesso a esta tela</p>
        </div>
        {!editing ? (
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400 font-mono">••••••••</span>
            <button onClick={() => setEditing(true)}
              className="text-xs text-blue-500 hover:text-blue-600 font-medium">Alterar</button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <button onClick={handleSave} disabled={saving}
              className="p-1.5 text-green-500 hover:text-green-600 disabled:opacity-50"><Check size={15} /></button>
            <button onClick={cancel}
              className="p-1.5 text-gray-400 hover:text-gray-600"><X size={15} /></button>
          </div>
        )}
      </div>

      {editing && (
        <div className="flex flex-col gap-2 mt-2">
          {[
            { label: 'Senha atual',          value: current, set: setCurrent, show: showCur, setShow: setShowCur },
            { label: 'Nova senha',           value: newPwd,  set: setNewPwd,  show: showNew, setShow: setShowNew },
            { label: 'Confirmar nova senha', value: confirm, set: setConfirm, show: showNew, setShow: setShowNew },
          ].map(({ label, value, set, show, setShow }) => (
            <div key={label} className="relative">
              <input
                autoFocus={label === 'Senha atual'}
                type={show ? 'text' : 'password'}
                value={value}
                onChange={e => { set(e.target.value); setError('') }}
                placeholder={label}
                className="w-full px-3 py-2 pr-9 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-green-400 bg-gray-50"
              />
              <button type="button" onClick={() => setShow(s => !s)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400">
                {show ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
          ))}
          {error   && <p className="text-xs text-red-500">{error}</p>}
          {success && <p className="text-xs text-green-600 font-medium">Senha alterada com sucesso.</p>}
        </div>
      )}
    </div>
  )
}

export function UsuariosConfig() {
  const [users,     setUsers]     = useState<AppUser[]>([])
  const [loading,   setLoading]   = useState(true)
  const [creating,  setCreating]  = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [saved,     setSaved]     = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('app_users').select('*').order('name')
    setUsers(data ?? [])
    setLoading(false)
  }

  function flash() { setSaved(true); setTimeout(() => setSaved(false), 2000) }

  async function handleCreate(data: { name: string; login: string; password: string; permissions: Permissions }) {
    const { error } = await supabase.from('app_users').insert(data)
    if (error) throw new Error(error.message.includes('unique') ? 'Esse login já está em uso.' : error.message)
    await load(); setCreating(false); flash()
  }

  async function handleUpdate(id: string, data: { name: string; login: string; password: string; permissions: Permissions }) {
    const payload: Record<string, unknown> = { name: data.name, login: data.login, permissions: data.permissions }
    if (data.password) payload.password = data.password
    const { error } = await supabase.from('app_users').update(payload).eq('id', id)
    if (error) throw new Error(error.message.includes('unique') ? 'Esse login já está em uso.' : error.message)
    await load(); setEditingId(null); flash()
  }

  async function toggleActive(user: AppUser) {
    await supabase.from('app_users').update({ active: !user.active }).eq('id', user.id)
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, active: !u.active } : u))
    flash()
  }

  async function deleteUser(id: string) {
    await supabase.from('app_users').delete().eq('id', id)
    setUsers(prev => prev.filter(u => u.id !== id))
    setConfirmDeleteId(null); flash()
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
        <p className="text-xs text-gray-400">{users.length} usuário{users.length !== 1 ? 's' : ''} cadastrado{users.length !== 1 ? 's' : ''}</p>
        <button
          onClick={() => { setCreating(v => !v); setEditingId(null) }}
          className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-xl text-sm font-semibold hover:bg-green-600 transition-colors">
          <Plus size={16} /> Novo Usuário
        </button>
      </div>

      {/* Formulário de criação */}
      {creating && (
        <div className="bg-white rounded-2xl border-2 border-green-300 shadow-sm p-5">
          <p className="font-bold text-gray-800 mb-4">Novo Usuário</p>
          <UserForm onSave={handleCreate} onCancel={() => setCreating(false)} />
        </div>
      )}

      {/* Senha de configurações */}
      <SenhaConfiguracoes />

      {/* Lista de usuários */}
      <div className="flex flex-col gap-3">
        {users.length === 0 && !creating && (
          <div className="text-center py-12 text-gray-400">
            <User size={36} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">Nenhum usuário cadastrado</p>
          </div>
        )}

        {users.map(user => {
          const permCount = Object.values(user.permissions).filter(Boolean).length
          return (
            <div key={user.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

              {/* Header do card */}
              <div className="flex items-center gap-3 px-4 py-3.5">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold text-base
                  ${user.active ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                  {user.name[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-800 truncate">{user.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">@{user.login} · {permCount} módulo{permCount !== 1 ? 's' : ''}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => toggleActive(user)}
                    title={user.active ? 'Desativar' : 'Ativar'}
                    className={`p-2 rounded-lg transition-colors ${user.active ? 'text-green-500 hover:bg-green-50' : 'text-gray-300 hover:bg-gray-50'}`}>
                    {user.active ? <ShieldCheck size={16} /> : <ShieldOff size={16} />}
                  </button>
                  <button
                    onClick={() => { setEditingId(editingId === user.id ? null : user.id); setCreating(false) }}
                    className="p-2 text-gray-300 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors">
                    <Pencil size={15} />
                  </button>
                  {confirmDeleteId === user.id ? (
                    <div className="flex items-center gap-1.5 ml-1">
                      <span className="text-xs text-red-500 font-medium">Excluir?</span>
                      <button onClick={() => deleteUser(user.id)}
                        className="px-2.5 py-1 bg-red-500 text-white text-xs rounded-lg font-semibold hover:bg-red-600">Sim</button>
                      <button onClick={() => setConfirmDeleteId(null)}
                        className="px-2.5 py-1 border text-xs rounded-lg text-gray-500 hover:bg-gray-50">Não</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDeleteId(user.id)}
                      className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>

              {/* Permissões resumidas */}
              {editingId !== user.id && (
                <div className="px-4 pb-3 flex flex-wrap gap-1.5">
                  {MODULES.filter(m => user.permissions[m.id]).map(m => (
                    <span key={m.id} className="text-[11px] px-2 py-0.5 bg-green-50 text-green-600 rounded-full font-medium border border-green-100">
                      {m.label}
                    </span>
                  ))}
                  {permCount === 0 && (
                    <span className="text-[11px] px-2 py-0.5 bg-gray-50 text-gray-400 rounded-full border border-gray-100">
                      Sem permissões
                    </span>
                  )}
                </div>
              )}

              {/* Formulário de edição inline */}
              {editingId === user.id && (
                <div className="px-4 pb-4 pt-1 border-t border-gray-50">
                  <UserForm
                    initial={user}
                    editMode
                    onSave={data => handleUpdate(user.id, data)}
                    onCancel={() => setEditingId(null)}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
