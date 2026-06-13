import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
})

export const EDGE_URL = `${url}/functions/v1`

export interface VerifyResult {
  valid: boolean
  permissions?: Record<string, boolean>
  name?: string
  rateLimited?: boolean
  error?: string
}

/** Chama a Edge Function verify-password sem expor senhas ao client */
export async function verifyPassword(payload: {
  type: 'login' | 'config_password' | 'discount_password' | 'set_password' | 'kitchen_pin' | 'ninja_password'
  password: string
  login?: string
  key?: string
  current?: string
  newPassword?: string
}): Promise<VerifyResult> {
  const res = await fetch(`${EDGE_URL}/verify-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: key },
    body: JSON.stringify(payload),
  })
  return res.json()
}
