import { useEffect, useRef, useCallback } from 'react'

const MIN_LENGTH   = 4     // mínimo de caracteres para ser um código válido
const MAX_INTERVAL = 50    // ms máximo entre teclas (scanner é muito rápido)

interface Options {
  onScan: (code: string) => void
  enabled?: boolean
}

/**
 * Detecta leitura de código de barras via scanner USB/Bluetooth.
 * Scanners enviam caracteres muito rápido (< 50ms entre cada um) + Enter no final.
 * Humanos digitam bem mais devagar.
 */
export function useBarcodeScanner({ onScan, enabled = true }: Options) {
  const bufferRef   = useRef<string>('')
  const lastKeyRef  = useRef<number>(0)
  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flush = useCallback(() => {
    const code = bufferRef.current.trim()
    bufferRef.current = ''
    if (code.length >= MIN_LENGTH) onScan(code)
  }, [onScan])

  useEffect(() => {
    if (!enabled) return

    function handleKeyDown(e: KeyboardEvent) {
      // Ignora se foco está em input/textarea/select
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return

      const now = Date.now()
      const delta = now - lastKeyRef.current
      lastKeyRef.current = now

      if (e.key === 'Enter') {
        if (timerRef.current) clearTimeout(timerRef.current)
        flush()
        return
      }

      // Se demorou muito desde a última tecla, reseta o buffer
      if (delta > MAX_INTERVAL && bufferRef.current.length > 0) {
        bufferRef.current = ''
      }

      // Só acumula caracteres imprimíveis
      if (e.key.length === 1) {
        bufferRef.current += e.key

        // Timer de segurança: flush automático se não vier Enter em 100ms
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(flush, 100)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [enabled, flush])
}
