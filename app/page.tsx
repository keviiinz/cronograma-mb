'use client'

import { useState, useEffect, Fragment } from 'react'

// ── Palette ───────────────────────────────────────────────────────────────────
const P = {
  bg:        '#161616',
  surface:   '#1e1e1e',
  surface2:  '#252525',
  surface3:  '#2c2c2c',
  border:    '#2e2e2e',
  gold:      '#d4af37',
  goldLight: '#f0d060',
  goldDark:  '#a88c25',
  text:      '#e4e4e4',
  textDim:   '#686868',
  textDark:  '#0f0f0f',
  danger:    '#9b2c2c',
  rowEven:   '#1a1a1a',
  rowOdd:    '#1f1f1f',
  mA:        '#191919',
  mAWknd:    '#272727',
  mB:        '#1e1c12',
  mBWknd:    '#2c2a18',
  todayBg:   '#2a2200',
  todayLine: '#d4af3755',
  notesBg:   '#0e0e12',
} as const

// ── Note color themes ─────────────────────────────────────────────────────────
const NC = {
  purple: { bg: '#160f28', border: '#5b21b6', accent: '#7c3aed', text: '#c4b5fd', label: 'General' },
  green:  { bg: '#0a1f0f', border: '#15803d', accent: '#16a34a', text: '#86efac', label: 'Avance' },
  blue:   { bg: '#0a1628', border: '#1d4ed8', accent: '#2563eb', text: '#93c5fd', label: 'Info' },
  yellow: { bg: '#1c1500', border: '#b45309', accent: '#ca8a04', text: '#fde68a', label: 'Alerta' },
  red:    { bg: '#200808', border: '#991b1b', accent: '#dc2626', text: '#fca5a5', label: 'Urgente' },
} as const
type NoteColor = keyof typeof NC

// ── Row heights (px) — MUST be equal in both panels ───────────────────────────
const ROW_H   = 42
const NOTES_H = 260
const HDR1_H  = 24
const DAY_COL = 32

// ── Types ─────────────────────────────────────────────────────────────────────
type NoteEntry = {
  id: string
  taskId: string
  text: string
  color: string
  author: string
  createdAt: string
}
type DayNoteMeta = { id: string; date: string }
type DayNoteFileEntry = { id: string; fileUrl: string; fileType: string; fileName: string }
type DayNoteFull = {
  id: string; taskId: string; date: string
  title: string; text: string
  files: DayNoteFileEntry[]
  author: string; createdAt: string
}
type PendingFile = { fileUrl: string; fileType: string; fileName: string }
type Task = {
  id: string
  name: string
  startDate: string
  duration: number
  notes: string
  completed: boolean
  completedAt: string | null
  noteEntries: NoteEntry[]
  dayNotes: DayNoteMeta[]
}
type PendingNote = { author: string; color: NoteColor; text: string }
const BLANK_PENDING: PendingNote = { author: '', color: 'purple', text: '' }
type Meeting = { id: string; name: string; reason: string; date: string; time: string; createdAt: string }

// ── Date helpers ──────────────────────────────────────────────────────────────
function parseLocal(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d)
}
function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
// Counts business days only (Mon–Fri); day 1 = startDate
function endDateOf(start: string, dur: number): string {
  const d = parseLocal(start)
  let count = 1
  while (count < dur) {
    d.setDate(d.getDate() + 1)
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6) count++
  }
  return toYMD(d)
}
function todayYMD(): string { return toYMD(new Date()) }

const MONTH_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const MONTH_AB = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const DAY_AB   = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']

function fmtCol(ymd: string, fmt: 'short'|'long'): string {
  const d = parseLocal(ymd)
  if (fmt === 'short')
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getFullYear()).slice(2)}`
  return `${DAY_AB[d.getDay()]}/${MONTH_AB[d.getMonth()]}/${d.getFullYear()}`
}
function fmtCell(ymd: string, fmt: 'short'|'long'): string {
  const d = parseLocal(ymd)
  if (fmt === 'short')
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getFullYear()).slice(2)}`
  return `${d.getDate()} ${MONTH_AB[d.getMonth()]} ${d.getFullYear()}`
}
function fmtNoteDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getDate()} ${MONTH_AB[d.getMonth()]} ${String(d.getFullYear()).slice(2)}, ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

const PASSWORD = 'admin123'
const MAX_FILE_SIZE_MB = 50

// ── Left-panel column widths ───────────────────────────────────────────────────
const W = { num: 40, name: 220, start: 100, days: 60, end: 100, actions: 120 }

// ── Shared styles ─────────────────────────────────────────────────────────────
const inp: React.CSSProperties = {
  width:'100%', background:P.bg, border:`1px solid #3a3a3a`,
  borderRadius:'6px', color:P.text, fontSize:'14px',
  padding:'10px 12px', outline:'none', boxSizing:'border-box',
}
const lbl: React.CSSProperties = {
  display:'block', fontSize:'12px', color:P.textDim,
  marginBottom:'5px', textTransform:'uppercase', letterSpacing:'0.5px',
}
const overlay: React.CSSProperties = {
  position:'fixed', inset:0, background:'rgba(0,0,0,0.82)',
  display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000,
}
const modal: React.CSSProperties = {
  background:P.surface2, border:`1px solid ${P.gold}`,
  borderRadius:'12px', padding:'30px 34px', width:'420px', maxWidth:'93vw',
  boxShadow:`0 0 40px rgba(212,175,55,0.10)`,
}
function btnGold(flex?: boolean): React.CSSProperties {
  return {
    background:`linear-gradient(135deg,${P.gold},${P.goldDark})`,
    color:P.textDark, border:'none', borderRadius:'7px',
    padding:'10px 20px', fontSize:'14px', fontWeight:'700',
    cursor:'pointer', flex: flex ? 1 : undefined,
  }
}
function btnGhost(flex?: boolean): React.CSSProperties {
  return {
    background:'transparent', color:P.textDim, border:`1px solid #3a3a3a`,
    borderRadius:'7px', padding:'10px 20px', fontSize:'14px',
    fontWeight:'600', cursor:'pointer', flex: flex ? 1 : undefined,
  }
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function GanttPage() {
  const [tasks,          setTasks]          = useState<Task[]>([])
  const [pendingNotes,   setPendingNotes]   = useState<Record<string, PendingNote>>({})
  const [isLoggedIn,     setIsLoggedIn]     = useState(false)
  const [showLogin,      setShowLogin]      = useState(false)
  const [password,       setPassword]       = useState('')
  const [loginError,     setLoginError]     = useState('')
  const [showTaskModal,  setShowTaskModal]  = useState(false)
  const [editingTask,    setEditingTask]    = useState<Task | null>(null)
  const [form,           setForm]           = useState<{name:string;startDate:string;duration:number|'';notes:string;changeNote:string;completed:boolean;completedAt:string}>({name:'',startDate:'',duration:5,notes:'',changeNote:'',completed:false,completedAt:''})
  const [openNotes,      setOpenNotes]      = useState<Set<string>>(new Set())
  const [mounted,        setMounted]        = useState(false)
  const [dateFormat,     setDateFormat]     = useState<'short'|'long'>('short')
  const [activeDayCell,  setActiveDayCell]  = useState<{ task: Task; date: string } | null>(null)
  const [activeDayNote,  setActiveDayNote]  = useState<DayNoteFull | null>(null)
  const [dayNoteLoading, setDayNoteLoading] = useState(false)
  const [dayNoteMode,    setDayNoteMode]    = useState<'view'|'add'|'edit'>('view')
  const [dayNoteForm,    setDayNoteForm]    = useState<{ title: string; text: string }>({ title: '', text: '' })
  const [pendingFiles,   setPendingFiles]   = useState<PendingFile[]>([])
  const [savingEvidence, setSavingEvidence] = useState(false)
  const [previewFile,    setPreviewFile]    = useState<DayNoteFileEntry | PendingFile | null>(null)
  const [showJuntaModal, setShowJuntaModal] = useState(false)
  const [juntaForm,      setJuntaForm]      = useState<{ name: string; reason: string; date: string; time: string }>({ name:'', reason:'', date:'', time:'' })
  const [juntaSaving,    setJuntaSaving]    = useState(false)
  const [juntaSaved,     setJuntaSaved]     = useState(false)
  const [showJuntasList, setShowJuntasList] = useState(false)
  const [meetings,       setMeetings]       = useState<Meeting[]>([])
  const [meetingsLoading,setMeetingsLoading]= useState(false)

  useEffect(() => {
    setMounted(true)
    if (sessionStorage.getItem('gantt_auth') === '1') setIsLoggedIn(true)
    fetch('/api/tasks')
      .then(r => r.json())
      .then((data: Task[]) => setTasks(data.map(t => ({ ...t, noteEntries: t.noteEntries ?? [], dayNotes: t.dayNotes ?? [] }))))
      .catch(() => setTasks([]))
  }, [])

  // Close the image preview modal with Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPreviewFile(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ── Date columns ────────────────────────────────────────────────────────────
  const allYMDs = tasks.flatMap(t => [t.startDate, endDateOf(t.startDate, t.duration)])
  const minYMD  = allYMDs.length ? allYMDs.reduce((a,b) => a<b?a:b) : todayYMD()
  const maxYMD  = allYMDs.length ? allYMDs.reduce((a,b) => a>b?a:b) : todayYMD()

  const dayColumns: string[] = []
  const cur = parseLocal(minYMD), endD = parseLocal(maxYMD)
  while (cur <= endD) { dayColumns.push(toYMD(cur)); cur.setDate(cur.getDate()+1) }

  // ── Month color helpers ─────────────────────────────────────────────────────
  const monthIndexMap = new Map<string, number>()
  let mSeq = 0, prevMKey = ''
  for (const ymd of dayColumns) {
    const d = parseLocal(ymd)
    const key = `${d.getFullYear()}-${d.getMonth()}`
    if (key !== prevMKey) { monthIndexMap.set(key, mSeq++); prevMKey = key }
  }
  const mKey = (ymd: string) => { const d = parseLocal(ymd); return `${d.getFullYear()}-${d.getMonth()}` }
  const isEvenMonth = (ymd: string) => (monthIndexMap.get(mKey(ymd)) ?? 0) % 2 === 0
  const cellBg = (ymd: string) => {
    if (isToday(ymd)) return P.todayBg
    const even = isEvenMonth(ymd)
    return isWeekend(ymd) ? (even ? P.mAWknd : P.mBWknd) : (even ? P.mA : P.mB)
  }

  // ── Month groups ────────────────────────────────────────────────────────────
  const monthGroups: { label: string; count: number; firstYmd: string }[] = []
  let curMKey = ''
  for (const ymd of dayColumns) {
    const key = mKey(ymd)
    if (key !== curMKey) {
      curMKey = key
      const d = parseLocal(ymd)
      monthGroups.push({ label: `${MONTH_ES[d.getMonth()]} ${d.getFullYear()}`, count: 1, firstYmd: ymd })
    } else {
      monthGroups[monthGroups.length-1].count++
    }
  }

  const isWeekend = (ymd: string) => { const d = parseLocal(ymd); return d.getDay()===0||d.getDay()===6 }
  const isToday   = (ymd: string) => ymd === todayYMD()
  const isActive  = (task: Task, ymd: string) => !isWeekend(ymd) && ymd >= task.startDate && ymd <= endDateOf(task.startDate, task.duration)

  // ── Auth & CRUD ──────────────────────────────────────────────────────────────
  const handleLogin = () => {
    if (password === PASSWORD) {
      setIsLoggedIn(true); sessionStorage.setItem('gantt_auth','1')
      setShowLogin(false); setPassword(''); setLoginError('')
    } else { setLoginError('Contraseña incorrecta.') }
  }
  const handleLogout = () => { setIsLoggedIn(false); sessionStorage.removeItem('gantt_auth') }
  const openAdd = () => { setEditingTask(null); setForm({name:'',startDate:todayYMD(),duration:5 as number|'',notes:'',changeNote:'',completed:false,completedAt:''}); setShowTaskModal(true) }
  const openEdit = (t: Task) => { setEditingTask(t); setForm({name:t.name,startDate:t.startDate,duration:t.duration,notes:t.notes,changeNote:'',completed:t.completed,completedAt:t.completedAt ?? ''}); setShowTaskModal(true) }
  const saveTask = async () => {
    if (!form.name.trim()) return
    const dur = Number(form.duration)
    if (!dur || dur < 1) return
    const payload = { name: form.name, startDate: form.startDate, duration: dur, notes: form.notes, completed: form.completed, completedAt: form.completedAt }
    if (editingTask) {
      await fetch(`/api/tasks/${editingTask.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (form.changeNote.trim()) {
        await fetch(`/api/tasks/${editingTask.id}/notes`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: form.changeNote.trim(), color: 'blue', author: 'Admin' }),
        })
      }
    } else {
      await fetch('/api/tasks', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    }
    const updated: Task[] = await fetch('/api/tasks').then(r => r.json())
    setTasks(updated.map(t => ({ ...t, noteEntries: t.noteEntries ?? [], dayNotes: t.dayNotes ?? [] })))
    setShowTaskModal(false)
  }
  const deleteTask = async (id: string) => {
    if (!confirm('¿Eliminar esta tarea?')) return
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
    setTasks(prev => prev.filter(t => t.id !== id))
  }
  const toggleNotes = (id: string) => { setOpenNotes(prev => { const n=new Set(prev); n.has(id)?n.delete(id):n.add(id); return n }) }

  // ── Juntas ───────────────────────────────────────────────────────────────────
  const openJuntaModal  = () => { setJuntaForm({ name:'', reason:'', date:'', time:'' }); setJuntaSaved(false); setShowJuntaModal(true) }
  const closeJuntaModal = () => { setShowJuntaModal(false); setJuntaSaved(false) }
  const saveJunta = async () => {
    if (juntaSaving || !juntaForm.name.trim() || !juntaForm.reason.trim() || !juntaForm.date || !juntaForm.time) return
    setJuntaSaving(true)
    try {
      await fetch('/api/meetings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(juntaForm),
      })
      setJuntaSaved(true)
    } finally {
      setJuntaSaving(false)
    }
  }
  const openJuntasList = () => {
    setShowJuntasList(true)
    setMeetingsLoading(true)
    fetch('/api/meetings').then(r => r.json()).then((data: Meeting[]) => {
      setMeetings(data)
      setMeetingsLoading(false)
    }).catch(() => setMeetingsLoading(false))
  }
  const deleteMeeting = async (id: string) => {
    if (!confirm('¿Eliminar esta junta?')) return
    const res = await fetch(`/api/meetings/${id}`, { method: 'DELETE' })
    if (res.ok) setMeetings(prev => prev.filter(m => m.id !== id))
  }

  // ── Notes ────────────────────────────────────────────────────────────────────
  const getPending = (id: string): PendingNote => pendingNotes[id] ?? BLANK_PENDING
  const setPending = (id: string, patch: Partial<PendingNote>) =>
    setPendingNotes(prev => ({ ...prev, [id]: { ...getPending(id), ...patch } }))

  const addNote = async (task: Task) => {
    const p = getPending(task.id)
    const text = p.text.trim()
    if (!text) return
    const author = isLoggedIn ? 'Admin' : p.author.trim()
    if (!author) return
    const note: NoteEntry = await fetch(`/api/tasks/${task.id}/notes`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, color: p.color, author }),
    }).then(r => r.json())
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, noteEntries: [...t.noteEntries, note] } : t))
    setPending(task.id, { text: '' })
  }

  const deleteNote = async (taskId: string, noteId: string) => {
    await fetch(`/api/tasks/${taskId}/notes/${noteId}`, { method: 'DELETE' })
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, noteEntries: t.noteEntries.filter(n => n.id !== noteId) } : t))
  }

  // ── Day evidence (DayNote) ──────────────────────────────────────────────────
  const hasDayNote     = (task: Task, ymd: string) => task.dayNotes.some(n => n.date === ymd)
  const getDayNoteMeta = (task: Task, ymd: string) => task.dayNotes.find(n => n.date === ymd)

  const openDayCell = async (task: Task, ymd: string) => {
    const meta = getDayNoteMeta(task, ymd)
    if (!meta && !isLoggedIn) return
    setActiveDayCell({ task, date: ymd })
    setPendingFiles([])
    if (meta) {
      setDayNoteLoading(true)
      setDayNoteMode('view')
      const full: DayNoteFull = await fetch(`/api/daynotes/${meta.id}`).then(r => r.json())
      setActiveDayNote(full)
      setDayNoteForm({ title: full.title, text: full.text })
      setDayNoteLoading(false)
    } else {
      setActiveDayNote(null)
      setDayNoteForm({ title: '', text: '' })
      setDayNoteMode('add')
    }
  }

  const closeDayModal = () => { setActiveDayCell(null); setActiveDayNote(null); setPendingFiles([]) }

  const handleFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    files.forEach(file => {
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) { alert(`"${file.name}" supera el límite de ${MAX_FILE_SIZE_MB} MB`); return }
      const reader = new FileReader()
      reader.onload = () => {
        const type = file.type.startsWith('image/') ? 'image' : 'pdf'
        setPendingFiles(p => [...p, { fileUrl: reader.result as string, fileType: type, fileName: file.name }])
      }
      reader.readAsDataURL(file)
    })
    e.target.value = ''
  }

  const removePendingFile = (idx: number) => setPendingFiles(p => p.filter((_, i) => i !== idx))

  const openFile = (f: DayNoteFileEntry | PendingFile) => {
    // Images open in an inline preview modal; PDFs keep opening in a new tab.
    if (f.fileType === 'image') { setPreviewFile(f); return }
    const [meta, b64] = f.fileUrl.split(',')
    const mime = meta.match(/:(.*?);/)?.[1] ?? (f.fileType === 'pdf' ? 'application/pdf' : 'image/jpeg')
    const bytes = atob(b64)
    const arr = new Uint8Array(bytes.length)
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
    const url = URL.createObjectURL(new Blob([arr], { type: mime }))
    window.open(url, '_blank')
  }

  const removeExistingFile = async (fileId: string) => {
    await fetch(`/api/dayfiles/${fileId}`, { method: 'DELETE' })
    setActiveDayNote(prev => prev ? { ...prev, files: prev.files.filter(f => f.id !== fileId) } : null)
  }

  const saveDayNote = async () => {
    if (!activeDayCell || savingEvidence) return
    setSavingEvidence(true)
    try {
      const { task, date } = activeDayCell
      // Upsert the note (title + text)
      const saved: DayNoteFull = await fetch('/api/daynotes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: task.id, date, title: dayNoteForm.title, text: dayNoteForm.text }),
      }).then(r => r.json())
      // Upload pending files
      if (pendingFiles.length > 0) {
        const newFiles: DayNoteFileEntry[] = await fetch(`/api/daynotes/${saved.id}/files`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ files: pendingFiles }),
        }).then(r => r.json())
        saved.files = [...(saved.files ?? []), ...newFiles]
      }
      // Update tasks list (add meta if new)
      setTasks(prev => prev.map(t => {
        if (t.id !== task.id) return t
        const idx = t.dayNotes.findIndex(n => n.date === date)
        const meta: DayNoteMeta = { id: saved.id, date: saved.date }
        if (idx >= 0) { const dn = [...t.dayNotes]; dn[idx] = meta; return { ...t, dayNotes: dn } }
        return { ...t, dayNotes: [...t.dayNotes, meta] }
      }))
      closeDayModal()
    } finally {
      setSavingEvidence(false)
    }
  }

  const deleteDayNote = async () => {
    if (!activeDayCell || !activeDayNote) return
    if (!confirm('¿Eliminar esta evidencia y todos sus archivos?')) return
    await fetch(`/api/daynotes/${activeDayNote.id}`, { method: 'DELETE' })
    setTasks(prev => prev.map(t => {
      if (t.id !== activeDayCell.task.id) return t
      return { ...t, dayNotes: t.dayNotes.filter(n => n.date !== activeDayCell.date) }
    }))
    closeDayModal()
  }

  if (!mounted) return null

  const juntaInvalid = juntaSaving || !juntaForm.name.trim() || !juntaForm.reason.trim() || !juntaForm.date || !juntaForm.time

  // Derived widths
  const hdr2H = dateFormat === 'long' ? 90 : 64
  const leftW = W.num + W.name + W.start + W.days + W.end + (isLoggedIn ? W.actions : 0)

  // Header cell style for left panel
  const lHdr = (extra?: React.CSSProperties): React.CSSProperties => ({
    background: '#181600', color: P.gold, fontSize: '12px', fontWeight: '700',
    borderBottom: `2px solid ${P.gold}`, borderRight: `1px solid #2a2a2a`,
    padding: '0 10px', whiteSpace: 'nowrap', userSelect: 'none',
    verticalAlign: 'middle',
    ...extra,
  })
  const lCell = (rowBg: string, extra?: React.CSSProperties): React.CSSProperties => ({
    background: rowBg, height: `${ROW_H}px`,
    borderBottom: `1px solid #242424`, borderRight: `1px solid #2a2a2a`,
    verticalAlign: 'middle', padding: '0 10px',
    ...extra,
  })

  return (
    <div style={{ background:P.bg, minHeight:'100vh', fontFamily:"'Segoe UI',Arial,sans-serif", color:P.text }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header style={{
        background:'linear-gradient(180deg,#1c190a 0%,#161616 100%)',
        borderBottom:`2px solid ${P.gold}`,
        padding:'0 28px',
        display:'flex', alignItems:'center', justifyContent:'space-between',
        minHeight:'68px', gap:'12px',
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:'16px' }}>
          <div style={{ width:'4px', height:'40px', background:`linear-gradient(180deg,${P.goldLight},${P.goldDark})`, borderRadius:'2px', flexShrink:0 }} />
          <div>
            <h1 style={{ fontSize:'21px', fontWeight:'800', color:P.gold, letterSpacing:'3px', textTransform:'uppercase', lineHeight:1.2 }}>
              Cronograma
            </h1>
            <p style={{ fontSize:'11px', color:P.textDim, letterSpacing:'2px', textTransform:'uppercase', marginTop:'3px' }}>
              Equipo de TI · MB Signature Properties
            </p>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          {isLoggedIn && (
            <button onClick={openJuntasList} style={{
              background:'transparent', color:P.textDim, border:'1px solid #3a3a3a',
              borderRadius:'7px', padding:'9px 18px', fontSize:'13px', fontWeight:'700', cursor:'pointer',
            }}>Ver juntas</button>
          )}
          {isLoggedIn && (
            <button onClick={openAdd} style={{
              background:`linear-gradient(135deg,${P.gold},${P.goldDark})`,
              color:P.textDark, border:'none', borderRadius:'7px',
              padding:'9px 18px', fontSize:'13px', fontWeight:'700', cursor:'pointer',
            }}>+ Nueva tarea</button>
          )}
          <button onClick={openJuntaModal} style={{
            background:'transparent', color:NC.blue.text, border:`1px solid ${NC.blue.border}`,
            borderRadius:'7px', padding:'9px 18px', fontSize:'13px', fontWeight:'700', cursor:'pointer',
          }}>Agendar junta</button>
          <button onClick={isLoggedIn ? handleLogout : ()=>setShowLogin(true)} style={{
            background: isLoggedIn ? 'transparent' : `linear-gradient(135deg,${P.gold},${P.goldDark})`,
            color: isLoggedIn ? P.textDim : P.textDark,
            border: isLoggedIn ? '1px solid #3a3a3a' : 'none',
            borderRadius:'7px', padding:'9px 18px', fontSize:'13px', fontWeight:'700', cursor:'pointer',
          }}>
            {isLoggedIn ? 'Cerrar sesión' : 'Iniciar sesión'}
          </button>
        </div>
      </header>

      {/* ── Legend / info bar ──────────────────────────────────────────────── */}
      <div style={{
        background:P.surface, borderBottom:`1px solid ${P.border}`,
        padding:'9px 28px', display:'flex', flexWrap:'wrap',
        gap:'6px 22px', alignItems:'center',
      }}>
        <span style={{ fontSize:'12px', color:P.textDim, marginRight:'6px' }}>
          {tasks.length} {tasks.length===1?'tarea':'tareas'}
          {dayColumns.length > 0 && ` · ${fmtCell(minYMD,'short')} → ${fmtCell(maxYMD,'short')}`}
        </span>
        <div style={{ width:'1px', height:'14px', background:'#333', flexShrink:0 }} />
        {([
          { color:`linear-gradient(90deg,${P.goldLight},${P.goldDark})`, label:'Período activo' },
          { color:P.todayBg, label:'Hoy', border:`1px solid ${P.goldDark}` },
          { color:P.mAWknd,  label:'Fin de semana', border:`1px solid ${P.border}` },
        ] as const).map(it => (
          <div key={it.label} style={{ display:'flex', alignItems:'center', gap:'6px', fontSize:'12px', color:P.textDim }}>
            <div style={{ width:'18px', height:'11px', background:it.color, borderRadius:'2px', border:(it as {border?:string}).border, flexShrink:0 }} />
            {it.label}
          </div>
        ))}
        <div style={{ display:'flex', alignItems:'center', gap:'4px', marginLeft:'4px' }}>
          {Object.entries(NC).map(([key, nc]) => (
            <div key={key} title={nc.label} style={{ width:'10px', height:'10px', borderRadius:'50%', background:nc.accent }} />
          ))}
          <span style={{ fontSize:'11px', color:P.textDim, marginLeft:'3px' }}>Tipos de nota</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'7px', marginLeft:'auto' }}>
          <span style={{ fontSize:'11px', color: dateFormat==='short' ? P.gold : P.textDim, fontWeight:'600' }}>28/07/26</span>
          <button
            onClick={() => setDateFormat(f => f==='short'?'long':'short')}
            style={{ position:'relative', width:'36px', height:'19px', background: dateFormat==='long' ? '#7c3aed' : '#3a3a3a', border:'none', borderRadius:'10px', cursor:'pointer', flexShrink:0 }}
          >
            <span style={{ position:'absolute', top:'2.5px', left: dateFormat==='long'?'19px':'2.5px', width:'14px', height:'14px', background:'#fff', borderRadius:'50%', display:'block' }} />
          </button>
          <span style={{ fontSize:'11px', color: dateFormat==='long' ? '#7c3aed' : P.textDim, fontWeight:'600' }}>Mar/Jul/2026</span>
          {!isLoggedIn && (
            <button onClick={()=>setShowLogin(true)} style={{ marginLeft:'12px', background:'none', border:'none', cursor:'pointer', color:P.textDim, fontSize:'12px', textDecoration:'underline' }}>
              Inicia sesión para editar
            </button>
          )}
        </div>
      </div>

      {/* ── Two-panel Gantt ────────────────────────────────────────────────── */}
      <div style={{ padding:'16px 20px 32px' }}>
        <div style={{
          display:'flex',
          border:`1px solid #2a2a2a`,
          borderRadius:'6px',
          overflow:'hidden',
        }}>

          {/* ══ LEFT PANEL — task info (no scroll) ══════════════════════════ */}
          <div style={{
            flexShrink: 0,
            width: `${leftW}px`,
            borderRight: `2px solid ${P.gold}`,
            overflow: 'hidden',
          }}>
            <table style={{ borderCollapse:'separate', borderSpacing:0, tableLayout:'fixed', width:`${leftW}px` }}>
              <colgroup>
                <col style={{ width:`${W.num}px` }} />
                <col style={{ width:`${W.name}px` }} />
                <col style={{ width:`${W.start}px` }} />
                <col style={{ width:`${W.days}px` }} />
                <col style={{ width:`${W.end}px` }} />
                {isLoggedIn && <col style={{ width:`${W.actions}px` }} />}
              </colgroup>
              <thead>
                <tr style={{ height:`${HDR1_H}px` }}>
                  <th colSpan={isLoggedIn ? 6 : 5} style={{ background:'#181600', borderBottom:`1px solid #252500`, borderRight:`1px solid #2a2a2a`, padding:0 }} />
                </tr>
                <tr style={{ height:`${hdr2H}px` }}>
                  <th style={lHdr({ textAlign:'center', fontSize:'11px', color:P.textDim })}>#</th>
                  <th style={lHdr({ textAlign:'left', paddingLeft:'14px' })}>Actividad / Tarea</th>
                  <th style={lHdr({ textAlign:'center' })}>Inicio</th>
                  <th style={lHdr({ textAlign:'center', fontSize:'11px' })}>Días H.</th>
                  <th style={lHdr({ textAlign:'center', borderRight: isLoggedIn ? `1px solid #2a2a2a` : 'none' })}>Fin</th>
                  {isLoggedIn && <th style={lHdr({ textAlign:'center', borderRight:'none' })}>Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {tasks.map((task, idx) => {
                  const notesOpen = openNotes.has(task.id)
                  const rowBg = idx % 2 === 0 ? P.rowEven : P.rowOdd
                  const endYMD = endDateOf(task.startDate, task.duration)
                  const num = String(idx+1).padStart(2,'0')
                  const pending = getPending(task.id)
                  const noteCount = task.noteEntries.length
                  return (
                    <Fragment key={task.id}>
                      <tr style={{ height:`${ROW_H}px` }}>
                        {/* # */}
                        <td style={lCell(rowBg, { textAlign:'center', fontSize:'12px', color:P.textDim })}>{num}</td>

                        {/* Task name + notes button */}
                        <td style={lCell(rowBg, { padding:0 })}>
                          <div style={{ display:'flex', alignItems:'center', height:`${ROW_H}px` }}>
                            <div style={{ width:'3px', height:'100%', background:`linear-gradient(180deg,${P.gold}99,${P.goldDark}33)`, flexShrink:0 }} />
                            <span
                              title={task.name}
                              style={{ fontSize:'14px', fontWeight:'600', color:P.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1, padding:'0 8px' }}
                            >
                              {task.name}
                            </span>
                            {task.completed && (
                              <span
                                title={task.completedAt ? `Completada el ${fmtCell(task.completedAt, 'long')}` : 'Completada'}
                                style={{
                                  flexShrink:0, marginRight:'8px',
                                  background:'#16a34a12', border:'1px solid #16a34a88',
                                  borderRadius:'10px', padding:'2px 7px',
                                  color:'#4ade80', fontSize:'10px', fontWeight:'600', whiteSpace:'nowrap',
                                }}
                              >
                                ✓ Completada
                              </span>
                            )}
                            <button
                              onClick={() => toggleNotes(task.id)}
                              style={{
                                flexShrink:0, marginRight:'8px',
                                background: notesOpen ? '#7c3aed25' : noteCount>0 ? '#7c3aed12' : 'transparent',
                                border:`1px solid ${notesOpen||noteCount>0 ? '#7c3aed88' : '#333'}`,
                                borderRadius:'10px', padding:'2px 7px',
                                color: notesOpen||noteCount>0 ? '#7c3aed' : P.textDim,
                                fontSize:'10px', fontWeight:'600', cursor:'pointer', whiteSpace:'nowrap',
                              }}
                            >
                              {notesOpen ? '▼' : '▶'} {noteCount > 0 ? noteCount : ''} Notas
                            </button>
                          </div>
                        </td>

                        {/* Start */}
                        <td style={lCell(rowBg, { textAlign:'center', fontSize: dateFormat==='long'?'11px':'13px', color:P.textDim, whiteSpace:'nowrap' })}>
                          {fmtCell(task.startDate, dateFormat)}
                        </td>

                        {/* Days */}
                        <td style={lCell(rowBg, { textAlign:'center', fontSize:'13px', color:P.gold, fontWeight:'700' })}>
                          {task.duration}
                        </td>

                        {/* End */}
                        <td style={lCell(rowBg, { textAlign:'center', fontSize: dateFormat==='long'?'11px':'13px', color:P.textDim, whiteSpace:'nowrap', borderRight: isLoggedIn ? `1px solid #2a2a2a` : 'none' })}>
                          {fmtCell(endYMD, dateFormat)}
                        </td>

                        {/* Actions */}
                        {isLoggedIn && (
                          <td style={lCell(rowBg, { textAlign:'center', borderRight:'none' })}>
                            <div style={{ display:'flex', gap:'6px', justifyContent:'center' }}>
                              <button onClick={()=>openEdit(task)} style={{ background:P.surface3, color:P.text, border:`1px solid #3a3a3a`, borderRadius:'4px', padding:'4px 10px', fontSize:'12px', cursor:'pointer' }}>
                                Editar
                              </button>
                              <button onClick={()=>deleteTask(task.id)} style={{ background:P.danger, color:'#fff', border:'none', borderRadius:'4px', padding:'4px 10px', fontSize:'12px', cursor:'pointer' }}>
                                Eliminar
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>

                      {/* Notes row */}
                      {notesOpen && (
                        <tr style={{ height:`${NOTES_H}px` }}>
                          <td colSpan={isLoggedIn ? 6 : 5} style={{
                            background: P.notesBg,
                            height:`${NOTES_H}px`,
                            borderBottom:`1px solid #2a2a2a`,
                            borderLeft:`3px solid #7c3aed`,
                            padding:0, verticalAlign:'top', overflow:'hidden',
                          }}>
                            <div style={{ display:'flex', flexDirection:'column', height:`${NOTES_H}px`, padding:'8px 12px 6px', boxSizing:'border-box' }}>

                              {/* Task description (from edit form) */}
                              {task.notes && (
                                <div style={{ flexShrink:0, fontSize:'11px', color:'#888', borderBottom:'1px solid #222', paddingBottom:'5px', marginBottom:'5px', overflow:'hidden', maxHeight:'32px', display:'flex', gap:'6px', alignItems:'flex-start' }}>
                                  <span style={{ flexShrink:0, color:'#555' }}>📋</span>
                                  <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{task.notes}</span>
                                </div>
                              )}

                              {/* Note entries */}
                              <div style={{ flex:1, overflowY:'auto', display:'flex', flexDirection:'column', gap:'4px', paddingRight:'2px' }}>
                                {task.noteEntries.length === 0 && !task.notes && (
                                  <p style={{ margin:'6px 0', fontSize:'12px', color:'#404040', fontStyle:'italic' }}>
                                    Sin notas aún. Sé el primero en dejar una.
                                  </p>
                                )}
                                {task.noteEntries.map(n => {
                                  const nc = NC[n.color as NoteColor] ?? NC.purple
                                  return (
                                    <div key={n.id} style={{
                                      borderLeft:`3px solid ${nc.accent}`,
                                      background: nc.bg,
                                      borderRadius:'0 4px 4px 0',
                                      padding:'4px 8px',
                                      position:'relative',
                                      flexShrink:0,
                                    }}>
                                      <div style={{ fontSize:'10px', color:'#555', marginBottom:'2px', paddingRight:'20px' }}>
                                        <span style={{ color: nc.accent, fontWeight:'700' }}>{n.author}</span>
                                        {' · '}{fmtNoteDate(n.createdAt)}
                                        <span style={{ marginLeft:'5px', fontSize:'9px', color:'#3a3a3a', fontStyle:'italic' }}>{nc.label}</span>
                                      </div>
                                      <div style={{ fontSize:'12px', color: nc.text, lineHeight:1.4 }}>{n.text}</div>
                                      {isLoggedIn && (
                                        <button
                                          onClick={() => deleteNote(task.id, n.id)}
                                          style={{ position:'absolute', top:'4px', right:'6px', background:'none', border:'none', color:'#444', cursor:'pointer', fontSize:'11px', lineHeight:1, padding:'0 2px' }}
                                          title="Eliminar nota"
                                        >✕</button>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>

                              {/* Add note form */}
                              <div style={{ flexShrink:0, borderTop:'1px solid #222', paddingTop:'6px', display:'flex', gap:'5px', alignItems:'center' }}>
                                {!isLoggedIn && (
                                  <input
                                    placeholder="Tu nombre *"
                                    value={pending.author}
                                    onChange={e => setPending(task.id, { author: e.target.value })}
                                    style={{ width:'86px', background:'#0c0c10', border:'1px solid #333', borderRadius:'4px', color:P.text, fontSize:'11px', padding:'4px 6px', outline:'none', flexShrink:0 }}
                                  />
                                )}
                                {/* Color picker dots */}
                                <div style={{ display:'flex', gap:'3px', flexShrink:0 }}>
                                  {(Object.keys(NC) as NoteColor[]).map(key => (
                                    <button
                                      key={key}
                                      onClick={() => setPending(task.id, { color: key })}
                                      title={NC[key].label}
                                      style={{
                                        width:'13px', height:'13px', borderRadius:'50%',
                                        background: NC[key].accent,
                                        border: pending.color === key ? '2px solid #fff' : '2px solid transparent',
                                        cursor:'pointer', padding:0, flexShrink:0,
                                      }}
                                    />
                                  ))}
                                </div>
                                <input
                                  placeholder={isLoggedIn ? 'Escribe una nota...' : 'Escribe una nota... (Enter para enviar)'}
                                  value={pending.text}
                                  onChange={e => setPending(task.id, { text: e.target.value })}
                                  onKeyDown={e => e.key === 'Enter' && addNote(task)}
                                  style={{ flex:1, background:'#0c0c10', border:'1px solid #333', borderRadius:'4px', color:P.text, fontSize:'11px', padding:'4px 7px', outline:'none', minWidth:0 }}
                                />
                                <button
                                  onClick={() => addNote(task)}
                                  title="Agregar nota"
                                  style={{ background:'#7c3aed', color:'#fff', border:'none', borderRadius:'4px', padding:'4px 10px', fontSize:'12px', fontWeight:'700', cursor:'pointer', flexShrink:0 }}
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>

            {tasks.length === 0 && (
              <div style={{ padding:'50px 20px', textAlign:'center', color:P.textDim }}>
                <p style={{ fontSize:'15px', marginBottom:'18px' }}>No hay tareas.</p>
                {isLoggedIn && <button onClick={openAdd} style={btnGold()}>+ Agregar tarea</button>}
              </div>
            )}
          </div>

          {/* ══ RIGHT PANEL — gantt (scrollable) ════════════════════════════ */}
          <div style={{ flex:1, overflowX:'auto', minWidth:0 }}>
            <table style={{ borderCollapse:'separate', borderSpacing:0, tableLayout:'fixed' }}>
              <colgroup>
                {dayColumns.map(y => <col key={y} style={{ width:`${DAY_COL}px`, minWidth:`${DAY_COL}px` }} />)}
              </colgroup>
              <thead>
                <tr style={{ height:`${HDR1_H}px` }}>
                  {monthGroups.map(grp => {
                    const even = isEvenMonth(grp.firstYmd)
                    return (
                      <th key={grp.firstYmd} colSpan={grp.count} style={{
                        background: even ? '#1f1f1f' : '#231f10',
                        color: even ? '#7a7a7a' : '#b09840',
                        fontSize:'10px', fontWeight:'700', textAlign:'center',
                        padding:'3px 4px', letterSpacing:'1.2px', textTransform:'uppercase',
                        borderBottom:`1px solid #2a2a2a`, borderRight:`1px solid #2a2a2a`,
                        whiteSpace:'nowrap',
                      }}>
                        {grp.label}
                      </th>
                    )
                  })}
                </tr>
                <tr style={{ height:`${hdr2H}px` }}>
                  {dayColumns.map(ymd => {
                    const today   = isToday(ymd)
                    const weekend = isWeekend(ymd)
                    const even    = isEvenMonth(ymd)
                    return (
                      <th key={ymd} style={{
                        background: today ? P.todayBg : weekend
                          ? (even ? P.mAWknd : P.mBWknd)
                          : (even ? P.mA     : P.mB),
                        color:      today ? P.gold : weekend ? '#555' : '#4a4a4a',
                        fontSize:   '10px', fontWeight: today ? '700' : '400',
                        padding:    '4px 0', textAlign:'center', verticalAlign:'bottom',
                        borderBottom:`2px solid ${today ? P.gold : P.border}`,
                        borderRight:`1px solid #222`,
                        userSelect:'none',
                      }}>
                        <div style={{ writingMode:'vertical-rl', transform:'rotate(180deg)', display:'inline-block', paddingBottom:'3px' }}>
                          {fmtCol(ymd, dateFormat)}
                        </div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {tasks.map((task, idx) => {
                  const notesOpen = openNotes.has(task.id)
                  const rowBg     = idx % 2 === 0 ? P.rowEven : P.rowOdd
                  return (
                    <Fragment key={task.id}>
                      <tr style={{ height:`${ROW_H}px` }}>
                        {dayColumns.map((ymd, i) => {
                          const active    = isActive(task, ymd)
                          const today     = isToday(ymd)
                          const hasNote   = hasDayNote(task, ymd)
                          const isFirst   = active && (i===0 || !isActive(task, dayColumns[i-1]))
                          const isLast    = active && (i===dayColumns.length-1 || !isActive(task, dayColumns[i+1]))
                          const clickable = active && (isLoggedIn || hasNote)
                          return (
                            <td key={ymd}
                              onClick={() => clickable && openDayCell(task, ymd)}
                              style={{
                                height:`${ROW_H}px`, padding:0,
                                background: cellBg(ymd),
                                borderBottom:`1px solid #222`,
                                borderRight:`1px solid #222`,
                                position:'relative', overflow:'hidden',
                                cursor: clickable ? 'pointer' : 'default',
                              }}>
                              {active && (
                                <div style={{
                                  position:'absolute', top:'8px', bottom:'8px',
                                  left: isFirst ? '2px' : 0,
                                  right: isLast  ? '2px' : 0,
                                  background: task.completed
                                    ? 'linear-gradient(135deg,#4ade80,#16a34a 50%,#15803d)'
                                    : `linear-gradient(135deg,${P.goldLight},${P.gold} 50%,${P.goldDark})`,
                                  borderRadius:`${isFirst?'4px':'0'} ${isLast?'4px':'0'} ${isLast?'4px':'0'} ${isFirst?'4px':'0'}`,
                                  boxShadow: task.completed ? '0 1px 6px rgba(22,163,74,0.35)' : `0 1px 6px rgba(212,175,55,0.3)`,
                                }} />
                              )}
                              {/* Red border + dot for cells with evidence */}
                              {hasNote && (
                                <>
                                  <div style={{ position:'absolute', inset:0, boxShadow:'inset 0 0 0 2px #ef4444', zIndex:2, pointerEvents:'none' }} />
                                  <div style={{ position:'absolute', top:3, right:3, width:5, height:5, borderRadius:'50%', background:'#ef4444', zIndex:3 }} />
                                </>
                              )}
                              {today && (
                                <div style={{ position:'absolute', top:0, bottom:0, left:'50%', width:'1px', background:P.todayLine, zIndex:1 }} />
                              )}
                            </td>
                          )
                        })}
                      </tr>

                      {notesOpen && (
                        <tr style={{ height:`${NOTES_H}px` }}>
                          <td colSpan={dayColumns.length} style={{
                            height:`${NOTES_H}px`,
                            background: P.notesBg,
                            borderBottom:`1px solid #222`,
                          }} />
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>

        </div>
      </div>

      {/* ── Login modal ────────────────────────────────────────────────────── */}
      {showLogin && (
        <div style={overlay} onClick={()=>{setShowLogin(false);setLoginError('');setPassword('')}}>
          <div style={modal} onClick={e=>e.stopPropagation()}>
            <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'24px' }}>
              <div style={{ width:'3px', height:'26px', background:`linear-gradient(180deg,${P.goldLight},${P.goldDark})`, borderRadius:'2px' }} />
              <h2 style={{ color:P.gold, fontSize:'18px', fontWeight:'700', letterSpacing:'1px' }}>INICIAR SESIÓN</h2>
            </div>
            <label style={lbl}>Contraseña</label>
            <input type="password" value={password}
              onChange={e=>setPassword(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&handleLogin()}
              placeholder="••••••••" style={inp} autoFocus />
            {loginError && <p style={{ color:'#e05555', fontSize:'13px', marginTop:'8px' }}>{loginError}</p>}
            <div style={{ display:'flex', gap:'10px', marginTop:'22px' }}>
              <button onClick={handleLogin} style={btnGold(true)}>Entrar</button>
              <button onClick={()=>{setShowLogin(false);setLoginError('');setPassword('')}} style={btnGhost(true)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Agendar junta modal (público) ────────────────────────────────────── */}
      {showJuntaModal && (
        <div style={overlay} onClick={closeJuntaModal}>
          <div style={modal} onClick={e=>e.stopPropagation()}>
            <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'24px' }}>
              <div style={{ width:'3px', height:'26px', background:`linear-gradient(180deg,${NC.blue.text},${NC.blue.border})`, borderRadius:'2px' }} />
              <h2 style={{ color:NC.blue.text, fontSize:'18px', fontWeight:'700', letterSpacing:'1px' }}>AGENDAR JUNTA</h2>
            </div>
            {juntaSaved ? (
              <>
                <p style={{ color:'#4ade80', fontSize:'14px', fontWeight:'600' }}>✓ Junta agendada correctamente.</p>
                <div style={{ display:'flex', gap:'10px', marginTop:'22px' }}>
                  <button onClick={closeJuntaModal} style={btnGold(true)}>Cerrar</button>
                </div>
              </>
            ) : (
              <>
                <label style={lbl}>Nombre</label>
                <input value={juntaForm.name} onChange={e=>setJuntaForm(p=>({...p,name:e.target.value}))}
                  placeholder="Tu nombre" style={inp} autoFocus />
                <label style={{...lbl,marginTop:'14px'}}>Motivo</label>
                <textarea value={juntaForm.reason} onChange={e=>setJuntaForm(p=>({...p,reason:e.target.value}))}
                  placeholder="¿De qué trata la junta?"
                  style={{...inp,minHeight:'60px',resize:'vertical',fontFamily:'inherit'}} />
                <label style={{...lbl,marginTop:'14px'}}>Fecha</label>
                <input type="date" value={juntaForm.date} onChange={e=>setJuntaForm(p=>({...p,date:e.target.value}))} style={inp} />
                <label style={{...lbl,marginTop:'14px'}}>Hora</label>
                <input type="time" value={juntaForm.time} onChange={e=>setJuntaForm(p=>({...p,time:e.target.value}))} style={inp} />
                <div style={{ display:'flex', gap:'10px', marginTop:'22px' }}>
                  <button
                    onClick={saveJunta}
                    disabled={juntaInvalid}
                    style={{
                      ...btnGold(true),
                      opacity: juntaInvalid ? 0.4 : 1,
                      cursor: juntaInvalid ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {juntaSaving ? 'Agendando…' : 'Agendar'}
                  </button>
                  <button onClick={closeJuntaModal} disabled={juntaSaving} style={{ ...btnGhost(true), opacity: juntaSaving?0.4:1, cursor: juntaSaving?'not-allowed':'pointer' }}>Cancelar</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Ver juntas modal (admin) ─────────────────────────────────────────── */}
      {showJuntasList && (
        <div style={overlay} onClick={()=>setShowJuntasList(false)}>
          <div style={{ ...modal, width:'500px', maxHeight:'80vh', overflowY:'auto' }} onClick={e=>e.stopPropagation()}>
            <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'20px' }}>
              <div style={{ width:'3px', height:'26px', background:`linear-gradient(180deg,${NC.blue.text},${NC.blue.border})`, borderRadius:'2px' }} />
              <h2 style={{ color:NC.blue.text, fontSize:'18px', fontWeight:'700', letterSpacing:'1px' }}>JUNTAS AGENDADAS</h2>
            </div>
            {meetingsLoading ? (
              <p style={{ color:P.textDim, fontSize:'13px' }}>Cargando…</p>
            ) : meetings.length === 0 ? (
              <p style={{ color:P.textDim, fontSize:'13px' }}>No hay juntas agendadas.</p>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                {meetings.map(m => (
                  <div key={m.id} style={{ background:P.surface3, border:'1px solid #333', borderRadius:'8px', padding:'12px 14px', display:'flex', justifyContent:'space-between', gap:'10px' }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ color:P.text, fontSize:'14px', fontWeight:'700' }}>{m.name}</p>
                      <p style={{ color:P.textDim, fontSize:'12px', marginTop:'2px' }}>{m.reason}</p>
                      <p style={{ color:NC.blue.text, fontSize:'12px', marginTop:'4px', fontWeight:'600' }}>{fmtCell(m.date,'long')} · {m.time}</p>
                    </div>
                    <button onClick={()=>deleteMeeting(m.id)} style={{ background:P.danger, color:'#fff', border:'none', borderRadius:'4px', padding:'4px 10px', fontSize:'12px', cursor:'pointer', height:'fit-content', flexShrink:0 }}>
                      Eliminar
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display:'flex', marginTop:'20px' }}>
              <button onClick={()=>setShowJuntasList(false)} style={btnGhost(true)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── DayNote / Evidence modal ───────────────────────────────────────── */}
      {activeDayCell && (
        <div style={overlay} onClick={closeDayModal}>
          <div style={{
            background:'#140c0c', border:'1px solid #dc2626',
            borderRadius:'12px', padding:'28px 32px', width:'560px', maxWidth:'96vw',
            maxHeight:'90vh', overflowY:'auto',
            boxShadow:'0 0 50px rgba(220,38,38,0.18)',
          }} onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div style={{ display:'flex', alignItems:'flex-start', gap:'12px', marginBottom:'20px' }}>
              <div style={{ width:'3px', height:'32px', background:'linear-gradient(180deg,#f87171,#991b1b)', borderRadius:'2px', flexShrink:0, marginTop:'2px' }} />
              <div style={{ flex:1 }}>
                <h2 style={{ color:'#f87171', fontSize:'15px', fontWeight:'800', letterSpacing:'1.5px', textTransform:'uppercase' }}>
                  {dayNoteMode === 'view' ? 'Evidencia' : dayNoteMode === 'add' ? 'Añadir Evidencia' : 'Editar Evidencia'}
                </h2>
                <p style={{ fontSize:'12px', color:'#555', marginTop:'3px' }}>
                  {activeDayCell.task.name} <span style={{ color:'#333' }}>·</span> {fmtCell(activeDayCell.date, 'long')}
                </p>
              </div>
              <button onClick={closeDayModal} style={{ background:'none', border:'none', color:'#555', cursor:'pointer', fontSize:'20px', lineHeight:1, padding:'0 2px', flexShrink:0 }}>✕</button>
            </div>

            {dayNoteLoading && (
              <p style={{ color:'#444', textAlign:'center', padding:'28px 0', fontSize:'13px' }}>Cargando evidencia...</p>
            )}

            {/* VIEW MODE */}
            {!dayNoteLoading && dayNoteMode === 'view' && activeDayNote && (
              <div>
                {activeDayNote.title && (
                  <h3 style={{ fontSize:'19px', fontWeight:'700', color:P.text, marginBottom:'8px', lineHeight:1.3 }}>
                    {activeDayNote.title}
                  </h3>
                )}
                {activeDayNote.text && (
                  <p style={{ fontSize:'14px', color:'#999', lineHeight:1.7, marginBottom:'16px', whiteSpace:'pre-wrap' }}>
                    {activeDayNote.text}
                  </p>
                )}

                {/* File gallery */}
                {activeDayNote.files.length > 0 && (
                  <div style={{ display:'flex', flexDirection:'column', gap:'10px', marginBottom:'14px' }}>
                    {/* Image grid */}
                    {activeDayNote.files.filter(f => f.fileType === 'image').length > 0 && (
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))', gap:'8px' }}>
                        {activeDayNote.files.filter(f => f.fileType === 'image').map(f => (
                          <div key={f.id} onClick={() => openFile(f)} title="Ver imagen"
                            style={{ display:'block', borderRadius:'6px', overflow:'hidden', border:'1px solid #2a2a2a', background:'#0d0d0d', aspectRatio:'4/3', cursor:'pointer' }}>
                            <img src={f.fileUrl} alt={f.fileName} style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} />
                          </div>
                        ))}
                      </div>
                    )}
                    {/* PDF links */}
                    {activeDayNote.files.filter(f => f.fileType === 'pdf').map(f => (
                      <button key={f.id} onClick={() => openFile(f)}
                        style={{ display:'inline-flex', alignItems:'center', gap:'8px', padding:'10px 16px', background:'#1f0f0f', border:'1px solid #7f1d1d', borderRadius:'8px', color:'#f87171', fontSize:'13px', fontWeight:'600', cursor:'pointer' }}>
                        📄 {f.fileName || 'Abrir PDF'}
                      </button>
                    ))}
                  </div>
                )}

                <p style={{ fontSize:'11px', color:'#3a3a3a', marginTop:'10px' }}>
                  {activeDayNote.author} · {fmtNoteDate(activeDayNote.createdAt)}
                  {activeDayNote.files.length > 0 && ` · ${activeDayNote.files.length} archivo${activeDayNote.files.length > 1 ? 's' : ''}`}
                </p>
                {isLoggedIn && (
                  <div style={{ display:'flex', gap:'10px', marginTop:'20px' }}>
                    <button onClick={() => { setDayNoteMode('edit'); setPendingFiles([]) }} style={btnGhost(true)}>Editar</button>
                    <button onClick={deleteDayNote} style={{ ...btnGhost(true), color:'#f87171', borderColor:'#7f1d1d' }}>Eliminar evidencia</button>
                  </div>
                )}
              </div>
            )}

            {/* ADD / EDIT MODE */}
            {!dayNoteLoading && (dayNoteMode === 'add' || dayNoteMode === 'edit') && (
              <div>
                <label style={lbl}>Título</label>
                <input
                  value={dayNoteForm.title}
                  onChange={e => setDayNoteForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="Ej. Actualización entregada al cliente"
                  style={inp} autoFocus
                />
                <label style={{ ...lbl, marginTop:'14px' }}>Descripción</label>
                <textarea
                  value={dayNoteForm.text}
                  onChange={e => setDayNoteForm(p => ({ ...p, text: e.target.value }))}
                  placeholder="Describe lo que se realizó..."
                  style={{ ...inp, minHeight:'68px', resize:'vertical', fontFamily:'inherit' }}
                />

                {/* Existing files (edit mode) */}
                {dayNoteMode === 'edit' && activeDayNote && activeDayNote.files.length > 0 && (
                  <div style={{ marginTop:'16px' }}>
                    <label style={lbl}>Archivos actuales</label>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:'8px' }}>
                      {activeDayNote.files.map(f => (
                        <div key={f.id} style={{ position:'relative', borderRadius:'6px', overflow:'visible' }}>
                          {f.fileType === 'image' ? (
                            <div style={{ width:'90px', height:'70px', borderRadius:'6px', overflow:'hidden', border:'1px solid #333', background:'#0d0d0d' }}>
                              <img src={f.fileUrl} alt={f.fileName} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                            </div>
                          ) : (
                            <div style={{ width:'90px', height:'70px', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', border:'1px solid #333', borderRadius:'6px', background:'#1f0f0f', gap:'4px' }}>
                              <span style={{ fontSize:'22px' }}>📄</span>
                              <span style={{ fontSize:'9px', color:'#888', textAlign:'center', padding:'0 4px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', width:'82px' }}>{f.fileName}</span>
                            </div>
                          )}
                          <button
                            onClick={() => removeExistingFile(f.id)}
                            title="Eliminar archivo"
                            style={{ position:'absolute', top:'-6px', right:'-6px', width:'18px', height:'18px', borderRadius:'50%', background:'#dc2626', border:'none', color:'#fff', fontSize:'10px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:'700', zIndex:10 }}
                          >✕</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* New files picker */}
                <div style={{ marginTop:'16px' }}>
                  <label style={lbl}>
                    {dayNoteMode === 'edit' ? 'Añadir más archivos' : 'Fotos o PDFs de evidencia'}
                    <span style={{ marginLeft:'6px', color:'#3a3a3a', textTransform:'none', letterSpacing:0 }}>(múltiples · máx. {MAX_FILE_SIZE_MB} MB c/u)</span>
                  </label>
                  <input
                    type="file" multiple accept="image/*,.pdf"
                    onChange={handleFilesChange}
                    style={{ display:'block', color:'#888', fontSize:'13px', marginBottom:'10px', cursor:'pointer' }}
                  />
                  {/* Pending files preview */}
                  {pendingFiles.length > 0 && (
                    <div style={{ display:'flex', flexWrap:'wrap', gap:'8px', marginTop:'6px' }}>
                      {pendingFiles.map((f, i) => (
                        <div key={i} style={{ position:'relative' }}>
                          {f.fileType === 'image' ? (
                            <div onClick={() => openFile(f)} title="Ver imagen" style={{ width:'90px', height:'70px', borderRadius:'6px', overflow:'hidden', border:'1px solid #444', background:'#0d0d0d', cursor:'pointer' }}>
                              <img src={f.fileUrl} alt={f.fileName} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                            </div>
                          ) : (
                            <div style={{ width:'90px', height:'70px', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', border:'1px solid #444', borderRadius:'6px', background:'#1f0f0f', gap:'4px' }}>
                              <span style={{ fontSize:'22px' }}>📄</span>
                              <span style={{ fontSize:'9px', color:'#888', textAlign:'center', padding:'0 4px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', width:'82px' }}>{f.fileName}</span>
                            </div>
                          )}
                          <button
                            onClick={() => removePendingFile(i)}
                            title="Quitar"
                            style={{ position:'absolute', top:'-6px', right:'-6px', width:'18px', height:'18px', borderRadius:'50%', background:'#555', border:'none', color:'#fff', fontSize:'10px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:'700', zIndex:10 }}
                          >✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ display:'flex', gap:'10px', marginTop:'22px' }}>
                  <button
                    onClick={saveDayNote}
                    disabled={!dayNoteForm.title.trim() || savingEvidence}
                    style={{
                      ...btnGold(true),
                      background:'linear-gradient(135deg,#ef4444,#991b1b)',
                      opacity: !dayNoteForm.title.trim() || savingEvidence ? 0.4 : 1,
                      cursor: !dayNoteForm.title.trim() || savingEvidence ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {savingEvidence
                      ? 'Guardando…'
                      : `Guardar evidencia${pendingFiles.length > 0 ? ` (${pendingFiles.length} archivo${pendingFiles.length > 1 ? 's' : ''})` : ''}`}
                  </button>
                  <button
                    onClick={() => dayNoteMode === 'edit' ? setDayNoteMode('view') : closeDayModal()}
                    style={btnGhost(true)}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Task modal ─────────────────────────────────────────────────────── */}
      {showTaskModal && (
        <div style={overlay} onClick={()=>setShowTaskModal(false)}>
          <div style={{ ...modal, width:'460px', maxHeight:'92vh', overflowY:'auto' }} onClick={e=>e.stopPropagation()}>
            <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'24px' }}>
              <div style={{ width:'3px', height:'26px', background:`linear-gradient(180deg,${P.goldLight},${P.goldDark})`, borderRadius:'2px' }} />
              <h2 style={{ color:P.gold, fontSize:'18px', fontWeight:'700', letterSpacing:'1px' }}>
                {editingTask ? 'EDITAR TAREA' : 'NUEVA TAREA'}
              </h2>
            </div>
            <label style={lbl}>Nombre de la tarea</label>
            <input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))}
              placeholder="Descripción de la tarea..." style={inp} autoFocus />
            <label style={{...lbl,marginTop:'14px'}}>Fecha de inicio</label>
            <input type="date" value={form.startDate}
              onChange={e=>setForm(p=>({...p,startDate:e.target.value}))} style={inp} />
            <label style={{...lbl,marginTop:'14px'}}>Duración (días hábiles)</label>
            <input type="number" min={1} value={form.duration}
              onChange={e=>{const v=e.target.value;setForm(p=>({...p,duration:v===''?'':parseInt(v)}))}}
              style={inp} />
            <label style={{...lbl,marginTop:'14px'}}>Descripción / Contexto</label>
            <textarea value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))}
              placeholder="Notas o comentarios generales..."
              style={{...inp,minHeight:'60px',resize:'vertical',fontFamily:'inherit'}} />
            {editingTask && (
              <>
                <label style={{...lbl,marginTop:'14px'}}>Nota del cambio <span style={{ color:'#555', textTransform:'none', letterSpacing:0 }}>(opcional — se guardará en el historial)</span></label>
                <input
                  value={form.changeNote}
                  onChange={e=>setForm(p=>({...p,changeNote:e.target.value}))}
                  placeholder="¿Qué cambió y por qué?"
                  style={{...inp, borderColor:'#1d4ed8'}}
                />
                <label style={{ display:'flex', alignItems:'center', gap:'8px', marginTop:'16px', cursor:'pointer' }}>
                  <input
                    type="checkbox"
                    checked={form.completed}
                    onChange={e => {
                      const checked = e.target.checked
                      setForm(p => ({ ...p, completed: checked, completedAt: checked ? (p.completedAt || todayYMD()) : '' }))
                    }}
                    style={{ width:'16px', height:'16px', accentColor:'#16a34a', cursor:'pointer' }}
                  />
                  <span style={{ fontSize:'13px', color:P.text, fontWeight:'600' }}>Marcar como completada</span>
                </label>
                {form.completed && (
                  <>
                    <label style={{...lbl,marginTop:'10px'}}>Fecha de finalización</label>
                    <input type="date" value={form.completedAt}
                      onChange={e=>setForm(p=>({...p,completedAt:e.target.value}))}
                      style={{...inp, borderColor:'#16a34a'}} />
                  </>
                )}
              </>
            )}
            <div style={{ display:'flex', gap:'10px', marginTop:'22px' }}>
              <button
                onClick={saveTask}
                disabled={!form.name.trim()||!form.duration||Number(form.duration)<1}
                style={{
                  ...btnGold(true),
                  opacity:(!form.name.trim()||!form.duration||Number(form.duration)<1)?0.4:1,
                  cursor:(!form.name.trim()||!form.duration||Number(form.duration)<1)?'not-allowed':'pointer',
                }}
              >
                {editingTask ? 'Guardar cambios' : 'Agregar tarea'}
              </button>
              <button onClick={()=>setShowTaskModal(false)} style={btnGhost(true)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Image preview modal ─────────────────────────────────────────────── */}
      {previewFile && (
        <div
          onClick={() => setPreviewFile(null)}
          style={{
            position:'fixed', inset:0, zIndex:1000,
            background:'rgba(0,0,0,0.88)',
            display:'flex', alignItems:'center', justifyContent:'center',
            cursor:'zoom-out', padding:'24px',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position:'relative', maxWidth:'95vw', maxHeight:'92vh',
              display:'flex', flexDirection:'column', alignItems:'center', gap:'12px',
            }}
          >
            <div style={{ display:'flex', alignItems:'center', gap:'12px', maxWidth:'95vw' }}>
              <span style={{ color:'#ddd', fontSize:'13px', fontWeight:'600', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {previewFile.fileName || 'Imagen'}
              </span>
              <button
                onClick={() => setPreviewFile(null)}
                title="Cerrar (Esc)"
                style={{
                  background:'#222', border:'1px solid #555', borderRadius:'6px',
                  color:'#eee', fontSize:'16px', lineHeight:1, padding:'6px 10px', cursor:'pointer', flexShrink:0,
                }}
              >
                ✕
              </button>
            </div>
            <img
              src={previewFile.fileUrl}
              alt={previewFile.fileName || 'Imagen'}
              style={{ maxWidth:'95vw', maxHeight:'82vh', objectFit:'contain', borderRadius:'8px', boxShadow:'0 8px 40px rgba(0,0,0,0.6)' }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
