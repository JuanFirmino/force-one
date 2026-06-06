// Simple JSON-based local storage instead of SQLite for offline-first
type Table = 'units' | 'customers' | 'access_types' | 'payment_methods' | 'visits' | 'unit_access_prices' | 'unit_payment_fees' | '_sync_queue'

interface StoredData {
  [key: string]: any[]
}

let data: StoredData = {}

const STORAGE_KEY = 'force-one-db'

export async function initializeDatabase() {
  try {
    console.log('Initializing database...')
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      data = JSON.parse(saved)
      console.log('Database loaded from localStorage')
    } else {
      console.log('Creating new database')
      data = {
        units: [],
        customers: [],
        access_types: [],
        payment_methods: [],
        visits: [],
        unit_access_prices: [],
        unit_payment_fees: [],
        _sync_queue: [],
      }
    }
    console.log('Database initialized')
    return data
  } catch (e) {
    console.error('Database initialization error:', e)
    throw e
  }
}

function saveDatabase() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function getDatabase() {
  return data
}

export function query(table: Table, filter?: (row: any) => boolean): any[] {
  const rows = data[table] || []
  return filter ? rows.filter(filter) : rows
}

export function all(table: Table, filter?: (row: any) => boolean): any[] {
  return query(table, filter)
}

export function get(table: Table, filter?: (row: any) => boolean): any | null {
  const rows = query(table, filter)
  return rows.length > 0 ? rows[0] : null
}

export function insert(table: Table, row: any) {
  if (!data[table]) data[table] = []

  // If row has id and already exists, replace it
  if (row.id) {
    const idx = data[table].findIndex((r: any) => r.id === row.id)
    if (idx >= 0) {
      data[table][idx] = { ...data[table][idx], ...row }
    } else {
      data[table].push(row)
    }
  } else {
    data[table].push(row)
  }

  saveDatabase()
  return true
}

export function update(table: Table, where: Record<string, any>, data_: Record<string, any>) {
  if (!data[table]) return false

  data[table] = data[table].map((row: any) => {
    const matches = Object.entries(where).every(([key, val]) => row[key] === val)
    return matches ? { ...row, ...data_ } : row
  })

  saveDatabase()
  return true
}

export function deleteFrom(table: Table, where: Record<string, any>) {
  if (!data[table]) return false

  data[table] = data[table].filter((row: any) => {
    return !Object.entries(where).every(([key, val]) => row[key] === val)
  })

  saveDatabase()
  return true
}

export function clear() {
  localStorage.removeItem(STORAGE_KEY)
  data = {}
}
