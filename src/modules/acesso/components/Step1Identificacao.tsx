import { useState, useRef, useEffect } from 'react'
import { Search, UserPlus, Camera, RotateCcw, Check, AlertCircle, Sparkles, AlertTriangle } from 'lucide-react'
import Webcam from 'react-webcam'
import { dataService } from '../../../lib/dataService'
import { supabase } from '../../../lib/supabase'
import { TeamSelector } from '../../../components/TeamSelector'
import type { Customer } from '../../../types'

interface Props {
  onCustomerSelected: (customer: Customer) => void
}

type Mode = 'search' | 'new' | 'preview'

function formatCPF(v: string) {
  return v.replace(/\D/g, '').slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}

function formatWhatsApp(v: string) {
  return v.replace(/\D/g, '').slice(0, 11)
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2')
}

const emptyForm = {
  name: '', cpf: '', whatsapp: '', birth_date: '',
  gender: '', email: '', play_style: '', weapon_type: '',
}

export function Step1Identificacao({ onCustomerSelected }: Props) {
  const [mode, setMode] = useState<Mode>('search')
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<Customer[]>([])
  const [isLegacy, setIsLegacy] = useState(false)
  const [isStar, setIsStar] = useState(false)
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([])

  // Enriquecimento de dados incompletos
  const [enrichCustomer, setEnrichCustomer] = useState<Customer | null>(null)
  const [enrichForm, setEnrichForm] = useState({ email: '', gender: '', birth_date: '', play_style: '', weapon_type: '' })
  const [enrichSaving, setEnrichSaving] = useState(false)
  const [enrichPhoto, setEnrichPhoto] = useState<string | null>(null)
  const [enrichShowCam, setEnrichShowCam] = useState(false)
  const enrichWebcamRef = useRef<Webcam>(null)
  const [previewInfractions, setPreviewInfractions] = useState<any[]>([])
  const [preview, setPreview] = useState<Customer | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [photo, setPhoto] = useState<string | null>(null)
  const [showCam, setShowCam] = useState(false)
  const [camError, setCamError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const webcamRef = useRef<Webcam>(null)
  useEffect(() => {
    if (!preview) { setPreviewInfractions([]); return }
    supabase
      .from('infractions')
      .select('*, units(name)')
      .eq('customer_id', preview.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setPreviewInfractions(data ?? []))
  }, [preview?.id])

  useEffect(() => {
    if (!query.trim()) { setResults([]); setSearching(false); return }
    setSearching(true)
    const timer = setTimeout(async () => {
      const q = query.trim()
      console.log('[Step1] Searching for:', q)
      const result = await dataService
        .from('customers')
        .select('*')
        .or(`cpf.ilike.%${q}%,whatsapp.ilike.%${q}%,name.ilike.%${q}%`)
        .limit(10)
        .execute()
      console.log('[Step1] Search result:', result)
      setResults(result.data ?? [])
      setSearching(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [query])


  function capturePhoto() {
    const src = webcamRef.current?.getScreenshot()
    if (src) {
      setPhoto(src)
      setShowCam(false)
      setCamError(false)
    } else {
      setCamError(true)
    }
  }

  function openCamera() {
    setCamError(false)
    setShowCam(true)
  }

  async function handleSave() {
    setError('')
    if (!form.name || !form.cpf || !form.whatsapp) {
      setError('Preencha os campos obrigatórios.')
      return
    }
    if (!photo) { setError('Tire a foto do jogador.'); return }
    setSaving(true)

    const cpfClean = form.cpf.replace(/\D/g, '')
    const waClean = form.whatsapp.replace(/\D/g, '')
    const emailClean = form.email?.trim() || null

    // Check for duplicates
    const existingCustomers = (await dataService.from('customers').select('*').execute()).data ?? []
    const cpfExists = existingCustomers.some(c => c.cpf === cpfClean)
    const waExists = existingCustomers.some(c => c.whatsapp === waClean)
    const emailExists = emailClean && existingCustomers.some(c => c.email === emailClean)

    if (cpfExists) {
      setSaving(false)
      setError('CPF já cadastrado.')
      return
    }
    if (waExists) {
      setSaving(false)
      setError('WhatsApp já cadastrado.')
      return
    }
    if (emailExists) {
      setSaving(false)
      setError('E-mail já cadastrado.')
      return
    }

    const id = crypto.randomUUID()

    const result = await dataService
      .from('customers')
      .insert({
        id,
        name: form.name,
        cpf: cpfClean,
        whatsapp: waClean,
        birth_date: form.birth_date,
        gender: form.gender || null,
        email: emailClean,
        play_style: form.play_style || null,
        weapon_type: form.weapon_type || null,
        photo_url: photo,
        is_legacy: isLegacy,
        is_star: isStar,
        created_at: new Date().toISOString(),
      })

    setSaving(false)
    if (result.error) { setError(String(result.error)); return }

    // Vincula times selecionados
    if (selectedTeamIds.length > 0) {
      await supabase.from('customer_teams').insert(
        selectedTeamIds.map(team_id => ({ customer_id: id, team_id }))
      )
    }

    onCustomerSelected({ id, name: form.name, cpf: cpfClean, whatsapp: waClean, birth_date: form.birth_date, gender: form.gender, email: emailClean, play_style: form.play_style, weapon_type: form.weapon_type, photo_url: photo } as Customer)
  }

  // ── Modal de enriquecimento ────────────────────────────
  if (enrichCustomer) {
    const missing = {
      photo:       !enrichCustomer.photo_url,
      email:       !enrichCustomer.email,
      gender:      !enrichCustomer.gender,
      birth_date:  !enrichCustomer.birth_date,
      play_style:  !enrichCustomer.play_style,
      weapon_type: !enrichCustomer.weapon_type,
    }
    const missingCount = Object.values(missing).filter(Boolean).length

    async function saveEnrich(skip = false) {
      let finalCustomer = enrichCustomer
      if (!skip) {
        setEnrichSaving(true)
        const update: Record<string, any> = {}
        if (missing.email       && enrichForm.email.trim())  update.email       = enrichForm.email.trim()
        if (missing.gender      && enrichForm.gender)        update.gender      = enrichForm.gender
        if (missing.birth_date  && enrichForm.birth_date)    update.birth_date  = enrichForm.birth_date
        if (missing.play_style  && enrichForm.play_style)    update.play_style  = enrichForm.play_style
        if (missing.weapon_type && enrichForm.weapon_type)   update.weapon_type = enrichForm.weapon_type
        if (enrichPhoto) update.photo_url = enrichPhoto
        if (Object.keys(update).length > 0) {
          await supabase.from('customers').update(update).eq('id', enrichCustomer.id)
          finalCustomer = { ...enrichCustomer, ...update }
        }
        setEnrichSaving(false)
      }
      setEnrichCustomer(null)
      setEnrichPhoto(null)
      setEnrichShowCam(false)
      onCustomerSelected(finalCustomer)
    }

    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-green-500 to-green-600 p-5 text-white">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles size={18} />
              <p className="font-bold">Completar Cadastro</p>
            </div>
            <p className="text-green-100 text-sm">
              {missingCount} informação{missingCount > 1 ? 'ões' : ''} faltando para <strong>{enrichCustomer.name}</strong>
            </p>
          </div>

          <div className="p-5 flex flex-col gap-4 overflow-y-auto max-h-[60vh]">

            {/* Foto — sempre solicita se não tiver */}
            {!enrichCustomer.photo_url && (
              <div className="flex flex-col items-center gap-3 pb-2 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-600 self-start flex items-center gap-1.5">
                  <Camera size={14} /> Foto do operador
                </p>
                {enrichShowCam ? (
                  <div className="flex flex-col items-center gap-2 w-full">
                    <Webcam ref={enrichWebcamRef} screenshotFormat="image/jpeg"
                      className="rounded-xl w-full max-w-xs h-48 object-cover bg-black" />
                    <div className="flex gap-2">
                      <button type="button" onClick={() => {
                        const src = enrichWebcamRef.current?.getScreenshot()
                        if (src) { setEnrichPhoto(src); setEnrichShowCam(false) }
                      }} className="px-4 py-2 bg-green-500 text-white rounded-xl text-sm font-semibold flex items-center gap-2">
                        <Camera size={14} /> Capturar
                      </button>
                      <button type="button" onClick={() => setEnrichShowCam(false)}
                        className="px-4 py-2 border rounded-xl text-gray-500 text-sm">Cancelar</button>
                    </div>
                  </div>
                ) : enrichPhoto ? (
                  <div className="flex flex-col items-center gap-2">
                    <img src={enrichPhoto} className="w-24 h-24 rounded-full object-cover border-4 border-green-400" />
                    <button type="button" onClick={() => setEnrichShowCam(true)}
                      className="text-xs text-green-600 hover:text-green-700 font-medium flex items-center gap-1">
                      <RotateCcw size={12} /> Tirar outra
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setEnrichShowCam(true)}
                    className="w-full border-2 border-dashed border-orange-300 bg-orange-50 rounded-xl py-4 flex flex-col items-center gap-2 text-orange-500 hover:border-orange-400 transition-colors">
                    <Camera size={24} />
                    <span className="text-sm font-medium">Tirar foto do operador</span>
                  </button>
                )}
              </div>
            )}

            {missing.email && (
              <div>
                <label className="text-sm font-medium text-gray-600 mb-1 block">E-mail</label>
                <input type="email" value={enrichForm.email} onChange={e => setEnrichForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="email@exemplo.com"
                  className="w-full border-2 rounded-xl px-4 py-2.5 focus:outline-none focus:border-green-400 text-sm" />
              </div>
            )}
            {missing.birth_date && (
              <div>
                <label className="text-sm font-medium text-gray-600 mb-1 block">Data de nascimento</label>
                <input type="date" value={enrichForm.birth_date} onChange={e => setEnrichForm(f => ({ ...f, birth_date: e.target.value }))}
                  className="w-full border-2 rounded-xl px-4 py-2.5 focus:outline-none focus:border-green-400 text-sm" />
              </div>
            )}
            {missing.gender && (
              <div>
                <label className="text-sm font-medium text-gray-600 mb-1 block">Sexo</label>
                <select value={enrichForm.gender} onChange={e => setEnrichForm(f => ({ ...f, gender: e.target.value }))}
                  className="w-full border-2 rounded-xl px-4 py-2.5 focus:outline-none focus:border-green-400 bg-white text-sm">
                  <option value="">Selecionar</option>
                  <option value="M">Masculino</option>
                  <option value="F">Feminino</option>
                  <option value="O">Outro</option>
                </select>
              </div>
            )}
            {missing.play_style && (
              <div>
                <label className="text-sm font-medium text-gray-600 mb-1 block">Estilo de jogo</label>
                <select value={enrichForm.play_style} onChange={e => setEnrichForm(f => ({ ...f, play_style: e.target.value }))}
                  className="w-full border-2 rounded-xl px-4 py-2.5 focus:outline-none focus:border-green-400 bg-white text-sm">
                  <option value="">Selecionar</option>
                  <option value="Milsim">Milsim</option>
                  <option value="Speed">Speed</option>
                  <option value="Indefinido">Indefinido</option>
                </select>
              </div>
            )}
            {missing.weapon_type && (
              <div>
                <label className="text-sm font-medium text-gray-600 mb-1 block">Tipo de arma</label>
                <select value={enrichForm.weapon_type} onChange={e => setEnrichForm(f => ({ ...f, weapon_type: e.target.value }))}
                  className="w-full border-2 rounded-xl px-4 py-2.5 focus:outline-none focus:border-green-400 bg-white text-sm">
                  <option value="">Selecionar</option>
                  <option value="HPA">HPA</option>
                  <option value="AEG">Arma Comum (AEG)</option>
                </select>
              </div>
            )}
          </div>

          <div className="flex gap-3 p-5 border-t border-gray-100">
            <button onClick={() => saveEnrich(true)}
              className="flex-1 py-2.5 border border-gray-300 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50">
              Pular por agora
            </button>
            <button onClick={() => saveEnrich(false)} disabled={enrichSaving}
              className="flex-1 py-2.5 bg-green-500 text-white rounded-xl text-sm font-bold hover:bg-green-600 disabled:opacity-50 flex items-center justify-center gap-2">
              {enrichSaving ? <><span className="animate-spin">⏳</span> Salvando...</> : <><Check size={16} /> Salvar e Continuar</>}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (mode === 'preview' && preview) {
    return (
      <div className="flex flex-col items-center gap-6">
        <h2 className="text-2xl font-bold text-gray-800">Confirmar Cliente</h2>
        <div className="bg-white rounded-2xl shadow-lg p-6 flex gap-6 items-center w-full max-w-md">
          {preview.photo_url
            ? <img src={preview.photo_url} className="w-52 h-52 rounded-full object-cover border-4 border-green-400" />
            : <div className="w-52 h-52 rounded-full bg-gray-200 flex items-center justify-center text-7xl text-gray-400">?</div>
          }
          <div className="flex flex-col gap-1">
            <p className="text-xl font-bold text-gray-800">{preview.name}</p>
            <p className="text-sm text-gray-500">CPF: {preview.cpf}</p>
            <p className="text-sm text-gray-500">WhatsApp: {preview.whatsapp}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={() => { setPreview(null); setMode('search') }}
            className="px-6 py-3 rounded-xl border border-gray-300 text-gray-600 hover:bg-gray-50">
            Voltar
          </button>
          <button onClick={() => {
            const missing = !preview.email || !preview.gender || !preview.birth_date || !preview.play_style || !preview.weapon_type || !preview.photo_url
            if (missing) {
              setEnrichCustomer(preview)
              setEnrichForm({
                email:       preview.email ?? '',
                gender:      preview.gender ?? '',
                birth_date:  preview.birth_date ?? '',
                play_style:  preview.play_style ?? '',
                weapon_type: preview.weapon_type ?? '',
              })
            } else {
              onCustomerSelected(preview)
            }
          }} className="px-6 py-3 rounded-xl bg-green-500 text-white font-semibold hover:bg-green-600 flex items-center gap-2">
            <Check size={18} /> Confirmar
          </button>
        </div>

        {previewInfractions.length > 0 && (
          <div className="w-full max-w-md bg-red-50 border border-red-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={18} className="text-red-500" />
              <span className="font-semibold text-red-700">
                {previewInfractions.length} advertência{previewInfractions.length > 1 ? 's' : ''} registrada{previewInfractions.length > 1 ? 's' : ''}
              </span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-red-500 border-b border-red-200">
                  <th className="pb-2 font-semibold pr-3">Dia</th>
                  <th className="pb-2 font-semibold pr-3">Data</th>
                  <th className="pb-2 font-semibold pr-3">Unidade</th>
                  <th className="pb-2 font-semibold">Descrição</th>
                </tr>
              </thead>
              <tbody>
                {previewInfractions.map(inf => (
                  <tr key={inf.id} className="border-b border-red-100 last:border-0">
                    <td className="py-2 pr-3 text-gray-600 whitespace-nowrap capitalize">
                      {new Date(inf.created_at).toLocaleDateString('pt-BR', { weekday: 'long' })}
                    </td>
                    <td className="py-2 pr-3 text-gray-600 whitespace-nowrap">
                      {new Date(inf.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="py-2 pr-3 text-gray-600 whitespace-nowrap">
                      {inf.units?.name ?? '—'}
                    </td>
                    <td className="py-2 text-gray-800">{inf.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )
  }

  if (mode === 'new') {
    return (
      <div className="flex flex-col gap-5 w-full max-w-lg">
        <div className="flex items-center gap-3">
          <button onClick={() => setMode('search')} className="text-gray-400 hover:text-gray-600">←</button>
          <h2 className="text-2xl font-bold text-gray-800">Novo Cliente</h2>
        </div>

        {/* Photo */}
        <div className="flex flex-col items-center gap-3">
          {showCam ? (
            <div className="flex flex-col items-center gap-3">
              <Webcam
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                className="rounded-xl w-64 h-48 object-cover bg-black"
                videoConstraints={{ facingMode: 'user', width: 640, height: 480 }}
                mirrored={false}
                onUserMediaError={(e) => { console.error('Webcam error:', e); setCamError(true) }}
              />
              {camError && (
                <div className="flex items-center gap-2 text-orange-500 text-sm bg-orange-50 px-3 py-2 rounded-lg">
                  <AlertCircle size={16} />
                  Câmera indisponível. Verifique se outra aba ou programa está usando a câmera.
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={capturePhoto}
                  className="px-4 py-2 bg-green-500 text-white rounded-xl flex items-center gap-2">
                  <Camera size={16} /> Capturar
                </button>
                <button onClick={() => { setShowCam(false); setCamError(false) }}
                  className="px-4 py-2 border rounded-xl text-gray-600">Cancelar</button>
              </div>
            </div>
          ) : photo ? (
            <div className="flex flex-col items-center gap-2">
              <img src={photo} className="w-24 h-24 rounded-full object-cover border-4 border-green-400" />
              <button onClick={openCamera} className="text-sm text-blue-500 flex items-center gap-1">
                <RotateCcw size={14} /> Refazer
              </button>
            </div>
          ) : (
            <button onClick={openCamera}
              className="w-24 h-24 rounded-full border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 hover:border-green-400 hover:text-green-400">
              <Camera size={28} />
              <span className="text-xs mt-1">Foto*</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-sm text-gray-600 mb-1 block">Nome completo *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full border rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-400" />
          </div>
          <div>
            <label className="text-sm text-gray-600 mb-1 block">CPF *</label>
            <input value={form.cpf}
              onChange={e => setForm(f => ({ ...f, cpf: formatCPF(e.target.value) }))}
              placeholder="000.000.000-00"
              className="w-full border rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-400" />
          </div>
          <div>
            <label className="text-sm text-gray-600 mb-1 block">WhatsApp *</label>
            <input value={form.whatsapp}
              onChange={e => setForm(f => ({ ...f, whatsapp: formatWhatsApp(e.target.value) }))}
              placeholder="(00) 00000-0000"
              className="w-full border rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-400" />
          </div>
          <div>
            <label className="text-sm text-gray-600 mb-1 block">Data de nascimento</label>
            <input type="date" value={form.birth_date}
              onChange={e => setForm(f => ({ ...f, birth_date: e.target.value }))}
              className="w-full border rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-400" />
          </div>
          <div>
            <label className="text-sm text-gray-600 mb-1 block">Sexo</label>
            <select value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}
              className="w-full border rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-400 bg-white">
              <option value="">Selecionar</option>
              <option value="M">Masculino</option>
              <option value="F">Feminino</option>
              <option value="O">Outro</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="text-sm text-gray-600 mb-1 block">E-mail</label>
            <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className="w-full border rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-400" />
          </div>
          <div>
            <label className="text-sm text-gray-600 mb-1 block">Estilo de jogo</label>
            <select value={form.play_style} onChange={e => setForm(f => ({ ...f, play_style: e.target.value }))}
              className="w-full border rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-400 bg-white">
              <option value="">Selecionar</option>
              <option value="Milsim">Milsim</option>
              <option value="Speed">Speed</option>
              <option value="Indefinido">Indefinido</option>
            </select>
          </div>
          <div>
            <label className="text-sm text-gray-600 mb-1 block">Tipo de arma</label>
            <select value={form.weapon_type} onChange={e => setForm(f => ({ ...f, weapon_type: e.target.value }))}
              className="w-full border rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-400 bg-white">
              <option value="">Selecionar</option>
              <option value="HPA">HPA</option>
              <option value="AEG">Arma Comum (AEG)</option>
            </select>
          </div>
        </div>

        {/* Times */}
        <TeamSelector selectedIds={selectedTeamIds} onChange={setSelectedTeamIds} />

        {/* Flag cliente legado */}
        <button type="button" onClick={() => setIsLegacy(v => !v)}
          className={`flex items-center gap-3 w-full p-4 rounded-xl border-2 text-left transition-all ${isLegacy ? 'border-amber-400 bg-amber-50' : 'border-gray-200 bg-white'}`}>
          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${isLegacy ? 'bg-amber-400 border-amber-400' : 'border-gray-300'}`}>
            {isLegacy && <svg viewBox="0 0 12 12" className="w-3 h-3 text-white fill-white"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          </div>
          <div>
            <p className={`text-sm font-semibold ${isLegacy ? 'text-amber-700' : 'text-gray-700'}`}>Já visitava o campo antes</p>
            <p className="text-xs text-gray-400">Cliente com histórico anterior ao sistema</p>
          </div>
        </button>

        {/* Flag estrela */}
        <button type="button" onClick={() => setIsStar(v => !v)}
          className={`flex items-center gap-3 w-full p-4 rounded-xl border-2 text-left transition-all ${isStar ? 'border-yellow-400 bg-yellow-50' : 'border-gray-200 bg-white'}`}>
          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${isStar ? 'bg-yellow-400 border-yellow-400' : 'border-gray-300'}`}>
            {isStar && <svg viewBox="0 0 12 12" className="w-3 h-3"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          </div>
          <div>
            <p className={`text-sm font-semibold ${isStar ? 'text-yellow-700' : 'text-gray-700'}`}>⭐ Operador Estrela</p>
            <p className="text-xs text-gray-400">Operador especial do campo</p>
          </div>
        </button>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button onClick={handleSave} disabled={saving}
          className="w-full py-3 bg-green-500 text-white font-semibold rounded-xl hover:bg-green-600 disabled:opacity-50">
          {saving ? 'Salvando...' : 'Cadastrar e Continuar'}
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-lg">
      <h2 className="text-2xl font-bold text-gray-800">Identificação do Cliente</h2>

      <div className="relative w-full">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Buscar por CPF, WhatsApp ou Nome..."
          className="w-full border rounded-xl pl-11 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-400 text-lg"
          autoFocus
        />
        {searching && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gray-400">buscando...</span>
        )}
      </div>

      {searching && <p className="text-gray-400">Buscando...</p>}

      {results.length > 0 && (
        <div className="w-full flex flex-col gap-2">
          {results.map(c => (
            <button key={c.id} onClick={async () => {
                setPreview(c); setMode('preview')
                const { data } = await supabase.from('infractions').select('*, units(name)').eq('customer_id', c.id).order('created_at', { ascending: false })
                setPreviewInfractions(data ?? [])
              }}
              className="flex items-center gap-4 p-4 bg-white rounded-xl shadow hover:shadow-md border border-gray-100 text-left">
              {c.photo_url
                ? <img src={c.photo_url} className="w-16 h-16 rounded-full object-cover" />
                : <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center text-gray-400 font-bold text-xl">
                    {c.name[0]}
                  </div>
              }
              <div>
                <p className="font-semibold text-gray-800">{c.name}</p>
                <p className="text-sm text-gray-400">CPF: {c.cpf} · WA: {c.whatsapp}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {results.length === 0 && query && !searching && (
        <p className="text-gray-400 text-sm">Nenhum cliente encontrado.</p>
      )}

      <div className="flex items-center gap-3 w-full">
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-gray-400 text-sm">ou</span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>

      <button onClick={() => setMode('new')}
        className="flex items-center gap-2 px-6 py-3 border-2 border-green-400 text-green-600 rounded-xl font-semibold hover:bg-green-50">
        <UserPlus size={20} /> Novo Cliente
      </button>
    </div>
  )
}
