import { supabase } from './supabase'

class Query {
  private _q: any
  private _table: string

  constructor(table: string) {
    this._table = table
    this._q = null
  }

  select(cols = '*') {
    this._q = supabase.from(this._table).select(cols)
    return this
  }

  eq(col: string, val: any) { this._q = this._q.eq(col, val); return this }
  or(filter: string) { this._q = this._q.or(filter); return this }
  gte(col: string, val: any) { this._q = this._q.gte(col, val); return this }
  lte(col: string, val: any) { this._q = this._q.lte(col, val); return this }
  in(col: string, vals: any[]) { this._q = this._q.in(col, vals); return this }
  ilike(col: string, val: any) { this._q = this._q.ilike(col, val); return this }
  limit(n: number) { this._q = this._q.limit(n); return this }
  order(col: string, opts?: { ascending?: boolean }) { this._q = this._q.order(col, opts); return this }

  insert(data: any): Promise<{ data?: any; error?: any }> {
    return supabase.from(this._table).insert(data) as unknown as Promise<{ data?: any; error?: any }>
  }

  update(data: any) {
    this._q = supabase.from(this._table).update(data)
    return this
  }

  delete() {
    this._q = supabase.from(this._table).delete()
    return this
  }

  single(): Promise<{ data?: any; error?: any }> {
    return this._q.single()
  }

  execute(): Promise<{ data?: any; error?: any }> {
    return this._q
  }
}

export const dataService = {
  from(table: string) {
    return new Query(table) as any
  },
}
