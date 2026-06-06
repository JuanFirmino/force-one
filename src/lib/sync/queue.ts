import { insert, all, deleteFrom } from './db'

export interface SyncQueueItem {
  id: string
  table_name: string
  action: 'INSERT' | 'UPDATE' | 'DELETE'
  data: Record<string, any>
  created_at: string
  synced: number
  attempt_count: number
  last_error?: string
}

export function enqueue(table: string, action: 'INSERT' | 'UPDATE' | 'DELETE', data: Record<string, any>) {
  const id = `${table}-${action}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  const now = new Date().toISOString()

  insert('_sync_queue', {
    id,
    table_name: table,
    action,
    data: JSON.stringify(data),
    created_at: now,
    synced: 0,
    attempt_count: 0,
  })

  return id
}

export function getPending(): SyncQueueItem[] {
  const rows = all('_sync_queue', (row: any) => row.synced === 0).sort((a: any, b: any) =>
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )
  return rows.map(row => ({
    ...row,
    data: JSON.parse(row.data),
  }))
}

export function markSynced(id: string) {
  const now = new Date().toISOString()
  insert('_sync_queue', {
    id,
    synced: 1,
    last_error: null,
    _last_modified: now,
  })
}

export function incrementAttempt(id: string, error?: string) {
  const rows = all('_sync_queue', (row: any) => row.id === id)
  const row = rows[0]
  const newCount = (row?.attempt_count ?? 0) + 1

  insert('_sync_queue', {
    id,
    attempt_count: newCount,
    last_error: error || null,
    _last_modified: new Date().toISOString(),
  })

  return newCount
}

export function clearQueue() {
  deleteFrom('_sync_queue', {})
}

export function removeSynced() {
  deleteFrom('_sync_queue', { synced: 1 })
}
