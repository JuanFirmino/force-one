import { supabase } from '../supabase'
import { insert } from './db'
import { getPending, markSynced, incrementAttempt } from './queue'

export async function initializeFromSupabase() {
  try {
    console.log('Initializing database from Supabase...')

    // Buscar todas as tabelas principais
    const [units, customers, accessTypes, paymentMethods, unitAccessPrices, unitPaymentFees] = await Promise.all([
      supabase.from('units').select('*'),
      supabase.from('customers').select('*'),
      supabase.from('access_types').select('*'),
      supabase.from('payment_methods').select('*'),
      supabase.from('unit_access_prices').select('*'),
      supabase.from('unit_payment_fees').select('*'),
    ])

    // Carregar dados no SQLite local
    ;(units.data ?? []).forEach(row => insert('units', row))
    ;(customers.data ?? []).forEach(row => insert('customers', { ...row, _synced: 1 }))
    ;(accessTypes.data ?? []).forEach(row => insert('access_types', { ...row, _synced: 1 }))
    ;(paymentMethods.data ?? []).forEach(row => insert('payment_methods', { ...row, _synced: 1 }))
    ;(unitAccessPrices.data ?? []).forEach(row => insert('unit_access_prices', { ...row, _synced: 1 }))
    ;(unitPaymentFees.data ?? []).forEach(row => insert('unit_payment_fees', { ...row, _synced: 1 }))

    console.log('Database initialized successfully')
    return true
  } catch (e) {
    console.error('Error initializing database:', e)
    return false
  }
}

export async function syncLocalToRemote() {
  const pending = getPending()
  console.log(`[syncLocalToRemote] Found ${pending.length} pending items`)

  if (pending.length === 0) {
    console.log('[syncLocalToRemote] Nothing to sync')
    return { synced: 0, failed: 0 }
  }

  let synced = 0, failed = 0

  for (const item of pending) {
    try {
      console.log(`[syncLocalToRemote] Syncing ${item.action} for ${item.table_name}:${item.id}`)

      if (item.action === 'INSERT') {
        console.log(`[INSERT] Inserting into ${item.table_name}:`, item.data)
        const result = await supabase.from(item.table_name).insert(item.data)
        if (result.error) {
          console.error(`[INSERT] Supabase error:`, result.error)
          throw result.error
        }
        console.log(`[INSERT] Success for ${item.id}`)
        markSynced(item.id)
        synced++
      } else if (item.action === 'UPDATE') {
        const { id, ...data } = item.data
        console.log(`[UPDATE] Updating ${item.table_name}:${id}:`, data)
        const result = await supabase.from(item.table_name).update(data).eq('id', id)
        if (result.error) {
          console.error(`[UPDATE] Supabase error:`, result.error)
          throw result.error
        }
        console.log(`[UPDATE] Success for ${item.id}`)
        markSynced(item.id)
        synced++
      } else if (item.action === 'DELETE') {
        console.log(`[DELETE] Deleting from ${item.table_name}:`, item.data)
        // Build delete query using all fields in item.data as filters
        let deleteQuery = supabase.from(item.table_name).delete()
        for (const [col, val] of Object.entries(item.data)) {
          deleteQuery = deleteQuery.eq(col, val as any)
        }
        const result = await deleteQuery
        if (result.error) {
          console.error(`[DELETE] Supabase error:`, result.error)
          throw result.error
        }
        console.log(`[DELETE] Success for ${item.id}`)
        markSynced(item.id)
        synced++
      }
    } catch (e) {
      incrementAttempt(item.id, String(e))
      failed++
      console.error(`[syncLocalToRemote] Sync failed for ${item.table_name}:`, e)
    }
  }

  console.log(`[syncLocalToRemote] Complete: ${synced} synced, ${failed} failed`)
  return { synced, failed }
}

export async function syncRemoteToLocal() {
  try {
    const [customers, accessTypes, paymentMethods, unitAccessPrices, unitPaymentFees] = await Promise.all([
      supabase.from('customers').select('*'),
      supabase.from('access_types').select('*'),
      supabase.from('payment_methods').select('*'),
      supabase.from('unit_access_prices').select('*'),
      supabase.from('unit_payment_fees').select('*'),
    ])

    // Atualizar dados locais com dados remotos (em caso de conflito, Supabase ganha)
    ;(customers.data ?? []).forEach(row => insert('customers', { ...row, _synced: 1 }))
    ;(accessTypes.data ?? []).forEach(row => insert('access_types', { ...row, _synced: 1 }))
    ;(paymentMethods.data ?? []).forEach(row => insert('payment_methods', { ...row, _synced: 1 }))
    ;(unitAccessPrices.data ?? []).forEach(row => insert('unit_access_prices', { ...row, _synced: 1 }))
    ;(unitPaymentFees.data ?? []).forEach(row => insert('unit_payment_fees', { ...row, _synced: 1 }))

    return true
  } catch (e) {
    console.error('Error syncing from remote:', e)
    return false
  }
}

export async function fullSync() {
  const toRemote = await syncLocalToRemote()
  const fromRemote = await syncRemoteToLocal()
  return { toRemote, fromRemote }
}
