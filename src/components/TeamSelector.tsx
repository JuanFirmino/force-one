import { useEffect, useState } from 'react'
import { Plus, X, Pencil, Check, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'

export interface Team {
  id: string
  name: string
}

interface Props {
  selectedIds: string[]
  onChange: (ids: string[]) => void
}

export function TeamSelector({ selectedIds, onChange }: Props) {
  const [allTeams, setAllTeams] = useState<Team[]>([])
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  useEffect(() => {
    loadTeams()
  }, [])

  async function loadTeams() {
    const { data } = await supabase.from('teams').select('*').order('name')
    setAllTeams(data ?? [])
  }

  function toggle(id: string) {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter(x => x !== id)
        : [...selectedIds, id]
    )
  }

  async function createTeam() {
    const name = newName.trim()
    if (!name) return
    const { data, error } = await supabase
      .from('teams')
      .insert({ name })
      .select()
      .single()
    if (!error && data) {
      setAllTeams(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      onChange([...selectedIds, data.id])
    }
    setNewName('')
    setCreating(false)
  }

  async function saveEdit(id: string) {
    const name = editName.trim()
    if (!name) return
    const { error } = await supabase
      .from('teams')
      .update({ name })
      .eq('id', id)
    if (!error) {
      setAllTeams(prev =>
        prev.map(t => t.id === id ? { ...t, name } : t)
          .sort((a, b) => a.name.localeCompare(b.name))
      )
    }
    setEditingId(null)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-600 flex items-center gap-1.5">
          <Users size={14} /> Times
        </label>
        <button type="button" onClick={() => setCreating(v => !v)}
          className="text-xs text-green-600 hover:text-green-700 flex items-center gap-1 font-medium">
          <Plus size={13} /> Novo time
        </button>
      </div>

      {/* Campo para criar novo time */}
      {creating && (
        <div className="flex gap-2">
          <input
            autoFocus
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') createTeam(); if (e.key === 'Escape') setCreating(false) }}
            placeholder="Nome do time..."
            className="flex-1 border-2 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-400"
          />
          <button type="button" onClick={createTeam}
            className="px-3 py-2 bg-green-500 text-white rounded-xl text-sm font-medium hover:bg-green-600">
            <Check size={16} />
          </button>
          <button type="button" onClick={() => { setCreating(false); setNewName('') }}
            className="px-3 py-2 border rounded-xl text-gray-500 hover:bg-gray-50">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Lista de times */}
      {allTeams.length === 0 ? (
        <p className="text-xs text-gray-400 italic">Nenhum time cadastrado ainda.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {allTeams.map(team => {
            const selected = selectedIds.includes(team.id)
            const isEditing = editingId === team.id
            return (
              <div key={team.id}
                className={`flex items-center gap-1 rounded-xl border-2 transition-all text-sm
                  ${selected ? 'border-green-400 bg-green-50' : 'border-gray-200 bg-white'}`}>
                {isEditing ? (
                  <div className="flex items-center gap-1 px-2 py-1">
                    <input
                      autoFocus
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveEdit(team.id); if (e.key === 'Escape') setEditingId(null) }}
                      className="w-24 text-sm border-b-2 border-green-400 focus:outline-none bg-transparent"
                    />
                    <button type="button" onClick={() => saveEdit(team.id)} className="text-green-500 hover:text-green-600"><Check size={13} /></button>
                    <button type="button" onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600"><X size={13} /></button>
                  </div>
                ) : (
                  <>
                    <button type="button" onClick={() => toggle(team.id)}
                      className="pl-3 pr-1 py-1.5 font-medium text-gray-700">
                      {team.name}
                    </button>
                    <button type="button"
                      onClick={() => { setEditingId(team.id); setEditName(team.name) }}
                      className="pr-2 py-1.5 text-gray-300 hover:text-green-500 transition-colors">
                      <Pencil size={11} />
                    </button>
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}

      {selectedIds.length > 0 && (
        <p className="text-xs text-gray-400">
          {selectedIds.length} time{selectedIds.length > 1 ? 's' : ''} selecionado{selectedIds.length > 1 ? 's' : ''} · Clique para remover
        </p>
      )}
    </div>
  )
}
