import { useState, useRef } from 'react'
import { Upload, Check, AlertCircle, X, FileSpreadsheet, Loader } from 'lucide-react'
import ExcelJS from 'exceljs'
import { supabase } from '../../lib/supabase'

interface Row {
  name: string
  cpf: string
  whatsapp: string
  email: string | null
  birth_date: string | null
}

interface Result { ok: number; skipped: number; errors: string[] }

function cleanCPF(v: any) {
  return String(v ?? '').replace(/\D/g, '').padStart(11, '0').slice(0, 11)
}
function cleanPhone(v: any) {
  return String(v ?? '').replace(/\D/g, '').slice(0, 11)
}
function cleanDate(v: any): string | null {
  if (!v) return null
  if (v instanceof Date) return v.toISOString().split('T')[0]
  const s = String(v).trim()
  if (s.includes('/')) {
    const [d, m, y] = s.split('/')
    return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`
  }
  if (s.match(/^\d{4}-\d{2}-\d{2}/)) return s.slice(0, 10)
  return null
}

export function ImportarClientes() {
  const [rows, setRows]           = useState<Row[]>([])
  const [fileName, setFileName]   = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult]       = useState<Result | null>(null)
  const [step, setStep]           = useState<'upload' | 'preview' | 'done'>('upload')
  const fileRef                   = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setFileName(file.name)
    const buf = await file.arrayBuffer()
    const wb  = new ExcelJS.Workbook()
    await wb.xlsx.load(buf)
    const ws = wb.worksheets[0]

    // Primeira linha como cabeçalho
    const headers: string[] = []
    ws.getRow(1).eachCell(cell => headers.push(String(cell.value ?? '').toLowerCase()))

    const get = (row: ExcelJS.Row, ...keys: string[]) => {
      for (const k of keys) {
        const idx = headers.findIndex(h => h.includes(k))
        if (idx >= 0) {
          const v = row.getCell(idx + 1).value
          if (v != null && v !== '') return v
        }
      }
      return null
    }

    const parsed: Row[] = []
    ws.eachRow((row, rowNum) => {
      if (rowNum === 1) return
      const r: Row = {
        name:       String(get(row, 'nome', 'name') ?? '').trim(),
        cpf:        cleanCPF(get(row, 'cpf', 'documento', 'doc')),
        whatsapp:   cleanPhone(get(row, 'telefone', 'whatsapp', 'celular', 'fone', 'phone')),
        email:      get(row, 'email', 'e-mail') ? String(get(row, 'email', 'e-mail')).trim() : null,
        birth_date: cleanDate(get(row, 'nascimento', 'nasc', 'data', 'birth', 'birthday')),
      }
      if (r.name && r.cpf.length >= 11) parsed.push(r)
    })

    setRows(parsed)
    setStep('preview')
  }

  async function handleImport() {
    setImporting(true)
    const ok_list: Row[] = []
    const errors: string[] = []

    // Busca CPFs já cadastrados de uma vez
    const cpfs = rows.map(r => r.cpf)
    const { data: existing } = await supabase.from('customers').select('cpf').in('cpf', cpfs)
    const existingCPFs = new Set((existing ?? []).map((c: any) => c.cpf))

    const toInsert = rows.filter(r => !existingCPFs.has(r.cpf))
    const skipped  = rows.length - toInsert.length

    // Insere em batches de 50
    const BATCH = 50
    for (let i = 0; i < toInsert.length; i += BATCH) {
      const batch = toInsert.slice(i, i + BATCH).map(r => ({
        id:         crypto.randomUUID(),
        name:       r.name,
        cpf:        r.cpf,
        whatsapp:   r.whatsapp,
        email:      r.email || null,
        birth_date: r.birth_date || null,
        is_legacy:  true,
        is_star:    false,
      }))
      const { error } = await supabase.from('customers').insert(batch)
      if (error) errors.push(`Batch ${i/BATCH + 1}: ${error.message}`)
      else ok_list.push(...batch as any)
    }

    setResult({ ok: ok_list.length, skipped, errors })
    setImporting(false)
    setStep('done')
  }

  function reset() { setRows([]); setFileName(''); setResult(null); setStep('upload') }

  const missing = rows.filter(r => !r.email).length

  // ── UPLOAD ──────────────────────────────────────────────
  if (step === 'upload') return (
    <div className="flex flex-col items-center gap-6 py-8">
      <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center">
        <FileSpreadsheet size={32} className="text-green-500" />
      </div>
      <div className="text-center">
        <h3 className="font-bold text-gray-800 text-lg">Importar Clientes</h3>
        <p className="text-sm text-gray-400 mt-1">Aceita .xlsx ou .csv com colunas: Nome, CPF, Telefone, Email, Nascimento</p>
      </div>
      <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
        onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
      <button onClick={() => fileRef.current?.click()}
        className="flex items-center gap-2 px-6 py-3 bg-green-500 text-white rounded-xl font-semibold hover:bg-green-600 transition-colors">
        <Upload size={18} /> Selecionar arquivo
      </button>
    </div>
  )

  // ── PREVIEW ─────────────────────────────────────────────
  if (step === 'preview') return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-gray-800">{fileName}</p>
          <p className="text-sm text-gray-400">{rows.length} clientes encontrados</p>
        </div>
        <button onClick={reset} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl">
          <X size={18} />
        </button>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-green-50 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-green-600">{rows.length}</p>
          <p className="text-xs text-gray-500">Total</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-blue-600">{rows.length - missing}</p>
          <p className="text-xs text-gray-500">Com email</p>
        </div>
        <div className="bg-yellow-50 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-yellow-600">{missing}</p>
          <p className="text-xs text-gray-500">Sem email</p>
        </div>
      </div>

      {missing > 0 && (
        <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3">
          <AlertCircle size={16} className="text-yellow-500 shrink-0 mt-0.5" />
          <p className="text-sm text-yellow-700">
            <strong>{missing} clientes</strong> estão sem email. Eles serão importados assim mesmo.
            Quando derem entrada no campo, o sistema pedirá para completar os dados.
          </p>
        </div>
      )}

      {/* Preview tabela */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto max-h-64">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                {['Nome','CPF','WhatsApp','Email','Nascimento'].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-gray-500 font-semibold uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.slice(0, 20).map((r, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium text-gray-800">{r.name}</td>
                  <td className="px-3 py-2 text-gray-500">{r.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}</td>
                  <td className="px-3 py-2 text-gray-500">{r.whatsapp}</td>
                  <td className="px-3 py-2">
                    {r.email
                      ? <span className="text-gray-600">{r.email}</span>
                      : <span className="text-yellow-500 font-medium">—</span>}
                  </td>
                  <td className="px-3 py-2 text-gray-500">
                    {r.birth_date ? new Date(r.birth_date + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length > 20 && (
          <div className="px-3 py-2 text-xs text-gray-400 text-center border-t border-gray-100">
            Mostrando 20 de {rows.length} registros
          </div>
        )}
      </div>

      <button onClick={handleImport} disabled={importing}
        className="w-full py-3.5 bg-green-500 text-white font-bold rounded-2xl hover:bg-green-600 disabled:opacity-50 flex items-center justify-center gap-2">
        {importing ? <><Loader size={18} className="animate-spin" /> Importando...</> : <><Upload size={18} /> Importar {rows.length} clientes</>}
      </button>
    </div>
  )

  // ── DONE ────────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center gap-6 py-8">
      <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center">
        <Check size={32} className="text-green-500" />
      </div>
      <div className="text-center">
        <h3 className="font-bold text-gray-800 text-lg">Importação concluída!</h3>
      </div>
      <div className="grid grid-cols-3 gap-3 w-full">
        <div className="bg-green-50 rounded-xl p-4 text-center">
          <p className="text-3xl font-black text-green-600">{result?.ok}</p>
          <p className="text-xs text-gray-500 mt-1">Importados</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-4 text-center">
          <p className="text-3xl font-black text-gray-500">{result?.skipped}</p>
          <p className="text-xs text-gray-500 mt-1">Já existiam</p>
        </div>
        <div className="bg-red-50 rounded-xl p-4 text-center">
          <p className="text-3xl font-black text-red-500">{result?.errors.length}</p>
          <p className="text-xs text-gray-500 mt-1">Erros</p>
        </div>
      </div>
      {result?.errors.length ? (
        <div className="w-full bg-red-50 rounded-xl p-4 text-xs text-red-600">
          {result.errors.map((e, i) => <p key={i}>{e}</p>)}
        </div>
      ) : null}
      <button onClick={reset}
        className="px-6 py-3 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 font-medium">
        Importar outro arquivo
      </button>
    </div>
  )
}
