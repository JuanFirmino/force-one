import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
})

export const EDGE_URL = `${url}/functions/v1`

/** Chama a Edge Function verify-password sem expor senhas ao client */
export async function verifyPassword(payload: {
  type: 'login' | 'config_password' | 'discount_password'
  password: string
  login?: string
}): Promise<{ valid: boolean; token?: string; permissions?: Record<string, boolean>; name?: string }> {
  const res = await fetch(`${EDGE_URL}/verify-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: key },
    body: JSON.stringify(payload),
  })
  return res.json()
}

/** Ativa o JWT retornado pelo Edge Function em todas as chamadas ao Supabase */
export function setSession(token: string) {
  supabase.auth.setSession({ access_token: token, refresh_token: 'none' })
}
