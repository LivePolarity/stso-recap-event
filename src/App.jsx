import React, { useEffect, useMemo, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import {
  addDays, addMonths, endOfMonth, endOfWeek, format, isSameDay, isSameMonth,
  isToday, parseISO, startOfMonth, startOfWeek, subMonths
} from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  CalendarDays, ChevronLeft, ChevronRight, Clock3, Utensils, Wine,
  LockKeyhole, LogOut, Plus, Pencil, Trash2, X, Save, RefreshCw, Settings, ArrowLeft, ExternalLink
} from 'lucide-react'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null

const emptyEvent = {
  title: '', event_date: format(new Date(), 'yyyy-MM-dd'), start_time: '', end_time: '',
  notes: '',
  catering: {
    people: '', format: 'snack', formats: [], time_type: 'slot', time: '',
    vegetarian: '', vegan: '', no_pork: '', allergies: '', comments: ''
  },
  bar: {
    meal_tokens: '', drink_tokens: '', loges_open: '', loges_close: '',
    meal_time: '', drinks: '', requests: '', comments: ''
  }
}

const fmtDate = (d, pattern = 'EEEE d MMMM') => format(typeof d === 'string' ? parseISO(d) : d, pattern, { locale: fr })
const short = d => format(typeof d === 'string' ? parseISO(d) : d, 'dd/MM', { locale: fr })
const weekStart = d => startOfWeek(d, { weekStartsOn: 1 })
const weekEnd = d => endOfWeek(d, { weekStartsOn: 1 })

function setupError() {
  return <div className="setup"><div className="setup-icon"><LockKeyhole /></div><h2>Configuration nécessaire</h2><p>Le site est prêt, mais il faut le relier à sa base de données Supabase pour partager les événements entre les appareils.</p><p>Ouvre le fichier <code>README.md</code> inclus dans le projet : les étapes de configuration y sont détaillées.</p></div>
}

function Field({ label, children, hint }) {
  return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>
}
function Input({ label, value, onChange, type = 'text', placeholder = '', ...props }) {
  return <Field label={label}><input type={type} value={value ?? ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} {...props} /></Field>
}
function Textarea({ label, value, onChange, placeholder = '' }) {
  return <Field label={label}><textarea value={value ?? ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows="3" /></Field>
}
function Check({ checked, onChange, children }) {
  return <label className="check"><input type="checkbox" checked={!!checked} onChange={e => onChange(e.target.checked)} /><span>{children}</span></label>
}
function Summary({ event, onClick }) {
  const c = event.catering || {}, b = event.bar || {}
  const hasC = c.people || c.time || c.comments || c.allergies
  const hasB = b.meal_tokens || b.drink_tokens || b.loges_open || b.loges_close
  return <button className="summary-row" onClick={onClick}>
    <div className="summary-date"><b>{format(parseISO(event.event_date), 'dd')}</b><span>{format(parseISO(event.event_date), 'MMM', { locale: fr })}</span></div>
    <div className="summary-main"><strong>{event.title}</strong><small>{event.start_time ? `Début ${event.start_time}` : 'Horaire à préciser'}</small></div>
    <div className="summary-info">
      <span><Utensils size={14} /> {hasC ? `${c.people || '—'} pers.` : 'Catering —'}</span>
      <span><Wine size={14} /> {hasB ? `${b.meal_tokens || '0'} repas · ${b.drink_tokens || '0'} boissons` : 'Bar —'}</span>
    </div>
    <ChevronRight className="row-arrow" size={18} />
  </button>
}
function EventDetail({ event, onClose }) {
  if (!event) return null
  const c = event.catering || {}, b = event.bar || {}
  const lines = (obj, keys) => keys.filter(([k]) => obj[k] !== '' && obj[k] != null).map(([k, label]) => <p key={k}><b>{label} :</b> {obj[k]}</p>)
  return <div className="modal-backdrop" onClick={onClose}><section className="modal detail-modal" onClick={e => e.stopPropagation()}>
    <button className="icon-btn close" onClick={onClose}><X /></button>
    <div className="eyebrow">{fmtDate(event.event_date)} {event.start_time && `· ${event.start_time}`}</div>
    <h2>{event.title}</h2>
    {event.notes && <p className="notes">{event.notes}</p>}
    <div className="detail-grid">
      <section className="detail-card"><h3><Utensils /> Catering</h3>
        {lines(c, [['people','Nombre de personnes'],['format','Organisation'],['time','Horaire'],['vegetarian','Végétariens'],['vegan','Végans'],['no_pork','Sans porc'],['allergies','Allergies / intolérances'],['comments','Commentaires']])}
        {!Object.values(c).some(v => v !== '' && v != null && (!Array.isArray(v) || v.length)) && <p className="muted">Aucune consigne renseignée.</p>}
      </section>
      <section className="detail-card"><h3><Wine /> Bar & loges</h3>
        {lines(b, [['meal_tokens','Jetons repas'],['drink_tokens','Jetons boissons'],['loges_open','Installation / ouverture loges'],['loges_close','Fermeture loges'],['meal_time','Envoi des repas'],['drinks','Boissons prévues'],['requests','Demandes spécifiques'],['comments','Commentaires']])}
        {!Object.values(b).some(v => v !== '' && v != null) && <p className="muted">Aucune consigne renseignée.</p>}
      </section>
    </div>
  </section></div>
}

function Calendar({ events, selectedMonth, setSelectedMonth, onSelect }) {
  const start = startOfWeek(startOfMonth(selectedMonth), { weekStartsOn: 1 })
  const end = endOfWeek(endOfMonth(selectedMonth), { weekStartsOn: 1 })
  const days = []
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d)
  return <section className="calendar-card">
    <div className="calendar-head"><div><h2>Agenda</h2><p>Consulter les événements à venir</p></div>
      <div className="month-nav"><button className="icon-btn" onClick={() => setSelectedMonth(subMonths(selectedMonth, 1))}><ChevronLeft /></button><b>{format(selectedMonth, 'MMMM yyyy', { locale: fr })}</b><button className="icon-btn" onClick={() => setSelectedMonth(addMonths(selectedMonth, 1))}><ChevronRight /></button></div>
    </div>
    <div className="calendar-grid">
      {['lun.','mar.','mer.','jeu.','ven.','sam.','dim.'].map((d,i)=><div className="weekday" key={i}>{d}</div>)}
      {days.map(d => {
        const matches = events.filter(e => isSameDay(parseISO(e.event_date), d))
        return <button key={d.toISOString()} className={`calendar-day ${!isSameMonth(d, selectedMonth) ? 'outside' : ''} ${isToday(d) ? 'today' : ''} ${matches.length ? 'has-events' : ''}`} onClick={() => matches[0] && onSelect(matches[0])}>
          <span>{format(d,'d')}</span>{matches.length > 0 && <i title={`${matches.length} événement(s)`} />}
          {matches.length > 0 && <small>{matches.length} év.</small>}
        </button>
      })}
    </div>
    <p className="calendar-hint">Sélectionne une date avec un point pour ouvrir la fiche de l'événement.</p>
  </section>
}

function PublicPage({ events, loading, refresh }) {
  const [selected, setSelected] = useState(null)
  const [month, setMonth] = useState(new Date())
  const now = new Date(), start = weekStart(now), end = weekEnd(now)
  const nextStart = addDays(start, 7), nextEnd = addDays(end, 7)
  const thisWeek = events.filter(e => { const d = parseISO(e.event_date); return d >= start && d <= end })
  const nextWeek = events.filter(e => { const d = parseISO(e.event_date); return d >= nextStart && d <= nextEnd })
  return <main className="public-shell">
    <header className="hero"><div className="brand"><span className="brand-mark">S</span><div><b>BISTROT SAINT SAUVEUR</b><small>GARE SAINT SAUVEUR · LILLE</small></div></div>
      <div className="hero-title"><div className="eyebrow light">OUTIL INTERNE · ÉQUIPES</div><h1>Planning & consignes</h1><p>Les informations catering et bar, au même endroit.</p></div>
      <button className="refresh-btn" onClick={refresh}><RefreshCw size={15}/> Actualiser</button>
    </header>
    <div className="content">
      <div className="section-title"><div><div className="eyebrow">VUE PRINCIPALE</div><h2>Cette semaine</h2><p>{fmtDate(start, 'd MMMM')} – {fmtDate(end, 'd MMMM yyyy')}</p></div><span className="count-pill">{thisWeek.length} événement{thisWeek.length > 1 ? 's' : ''}</span></div>
      <section className="week-card">
        {loading ? <p className="empty">Chargement du planning…</p> : thisWeek.length ? thisWeek.map(e => <Summary key={e.id} event={e} onClick={() => setSelected(e)} />) : <p className="empty">Aucun événement programmé cette semaine.</p>}
      </section>
      <section className="next-section"><div className="section-title compact"><div><div className="eyebrow">ANTICIPATION</div><h2>Semaine prochaine</h2><p>{fmtDate(nextStart, 'd MMMM')} – {fmtDate(nextEnd, 'd MMMM yyyy')}</p></div><span className="count-pill">{nextWeek.length} événement{nextWeek.length > 1 ? 's' : ''}</span></div>
        <div className="next-card">{nextWeek.length ? nextWeek.map(e => <Summary key={e.id} event={e} onClick={() => setSelected(e)} />) : <p className="empty">Aucun événement programmé la semaine prochaine.</p>}</div>
      </section>
      <Calendar events={events} selectedMonth={month} setSelectedMonth={setMonth} onSelect={setSelected} />
    </div>
    <footer>STSO · PLANNING ÉQUIPES <span>Informations mises à jour par l'administration</span></footer>
    {selected && <EventDetail event={selected} onClose={() => setSelected(null)} />}
  </main>
}

function AdminForm({ initial, onSave, onCancel, busy }) {
  const [form, setForm] = useState(initial || structuredClone(emptyEvent))
  const set = (key, value) => setForm(f => ({ ...f, [key]: value }))
  const setC = (key, value) => setForm(f => ({ ...f, catering: { ...f.catering, [key]: value } }))
  const setB = (key, value) => setForm(f => ({ ...f, bar: { ...f.bar, [key]: value } }))
  return <div className="modal-backdrop"><form className="modal admin-form" onSubmit={e => { e.preventDefault(); onSave(form) }}>
    <div className="form-head"><div><div className="eyebrow">ADMINISTRATION</div><h2>{initial?.id ? 'Modifier l’événement' : 'Nouvel événement'}</h2></div><button type="button" className="icon-btn" onClick={onCancel}><X /></button></div>
    <div className="form-section"><h3>Événement</h3><div className="form-grid">
      <Input label="Nom de l'événement *" value={form.title} onChange={v=>set('title',v)} required placeholder="Ex. Concert, privatisation…" />
      <Input label="Date *" type="date" value={form.event_date} onChange={v=>set('event_date',v)} required />
      <Input label="Heure de début" type="time" value={form.start_time} onChange={v=>set('start_time',v)} />
      <Input label="Heure de fin" type="time" value={form.end_time} onChange={v=>set('end_time',v)} />
    </div><Textarea label="Informations générales" value={form.notes} onChange={v=>set('notes',v)} placeholder="Contexte, organisation générale…" /></div>
    <div className="form-section"><h3><Utensils /> Catering / repas</h3><div className="form-grid">
      <Input label="Nombre de personnes" value={form.catering.people} onChange={v=>setC('people',v)} placeholder="Ex. 24" />
      <Field label="Organisation des repas"><div className="choice-list">
        {[['snack','Commande au snack le jour J'],['bac','Bac commun / chacun se sert et réchauffe'],['lunchbox','Assiettes ou lunch box individuelles']].map(([value,label])=><Check key={value} checked={(form.catering.formats || []).includes(value)} onChange={v=>setC('formats',v?[...(form.catering.formats || []),value]:(form.catering.formats || []).filter(x=>x!==value))}>{label}</Check>)}
      </div></Field>
      <Field label="Type d'horaire"><select value={form.catering.time_type} onChange={e=>setC('time_type',e.target.value)}><option value="slot">Créneau</option><option value="exact">Horaire précis</option><option value="free">Libre</option></select></Field>
      <Input label="Horaire / créneau" value={form.catering.time} onChange={v=>setC('time',v)} placeholder="Ex. 19h–20h ou 19h30" />
      <Field label="Régimes alimentaires"><div className="choice-list">
        {['Végétarien','Végan','Sans porc'].map(label=><Check key={label} checked={(form.catering.diets || []).includes(label)} onChange={v=>setC('diets',v?[...(form.catering.diets || []),label]:(form.catering.diets || []).filter(x=>x!==label))}>{label}</Check>)}
      </div></Field>
      <Input label="Nombre de végétariens" value={form.catering.vegetarian} onChange={v=>setC('vegetarian',v)} />
      <Input label="Nombre de végans" value={form.catering.vegan} onChange={v=>setC('vegan',v)} />
      <Input label="Nombre sans porc" value={form.catering.no_pork} onChange={v=>setC('no_pork',v)} />
    </div><Textarea label="Allergies / intolérances" value={form.catering.allergies} onChange={v=>setC('allergies',v)} /><Textarea label="Autres commentaires catering" value={form.catering.comments} onChange={v=>setC('comments',v)} /></div>
    <div className="form-section"><h3><Wine /> Bar / loges</h3><div className="form-grid">
      <Input label="Nombre de jetons repas" value={form.bar.meal_tokens} onChange={v=>setB('meal_tokens',v)} />
      <Input label="Nombre de jetons boissons" value={form.bar.drink_tokens} onChange={v=>setB('drink_tokens',v)} />
      <Input label="Installation / ouverture loges" value={form.bar.loges_open} onChange={v=>setB('loges_open',v)} placeholder="Ex. 16h" />
      <Input label="Fermeture / libération loges" value={form.bar.loges_close} onChange={v=>setB('loges_close',v)} placeholder="Ex. 01h" />
      <Input label="Envoi des repas en loges" value={form.bar.meal_time} onChange={v=>setB('meal_time',v)} placeholder="Si nécessaire" />
      <Input label="Boissons prévues" value={form.bar.drinks} onChange={v=>setB('drinks',v)} placeholder="Eau, softs…" />
    </div><Textarea label="Demandes spécifiques" value={form.bar.requests} onChange={v=>setB('requests',v)} /><Textarea label="Autres commentaires bar" value={form.bar.comments} onChange={v=>setB('comments',v)} /></div>
    <div className="form-actions"><button type="button" className="btn secondary" onClick={onCancel}>Annuler</button><button className="btn primary" disabled={busy || !form.title.trim() || !form.event_date}><Save size={16}/>{busy ? 'Enregistrement…' : 'Enregistrer l’événement'}</button></div>
  </form></div>
}

function AdminSettings({ onBack }) {
  const [sheetUrl, setSheetUrl] = useState('')
  const [busy, setBusy] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const load = async () => {
      const { data, error } = await supabase.from('app_settings').select('value').eq('key', 'google_sheet_url').maybeSingle()
      if (!active) return
      if (error) setError(`Impossible de charger les paramètres : ${error.message}`)
      else setSheetUrl(data?.value?.url || '')
      setBusy(false)
    }
    load()
    return () => { active = false }
  }, [])

  const save = async e => {
    e.preventDefault()
    setSaving(true); setMessage(''); setError('')
    const payload = { key: 'google_sheet_url', value: { url: sheetUrl.trim() }, updated_at: new Date().toISOString() }
    const { error } = await supabase.from('app_settings').upsert(payload, { onConflict: 'key' })
    setSaving(false)
    if (error) setError(`Enregistrement impossible : ${error.message}`)
    else setMessage('Lien enregistré. Il sera utilisé pour préparer la connexion aux fiches groupes.')
  }

  return <section className="settings-page">
    <div className="settings-head"><button className="btn secondary small" onClick={onBack}><ArrowLeft size={14}/> Retour aux événements</button><div className="eyebrow">CONFIGURATION DU SITE</div><h1>Paramètres</h1><p>Les réglages communs à toutes les fiches événement.</p></div>
    <form className="settings-card" onSubmit={save}>
      <div className="settings-card-title"><span className="settings-icon"><ExternalLink size={18}/></span><div><h2>Fiches groupes · Google Sheets</h2><p>Document source des informations des groupes et de leurs équipes.</p></div></div>
      {busy ? <p className="muted">Chargement des paramètres…</p> : <>
        <Input label="Lien du Google Sheet" type="url" value={sheetUrl} onChange={setSheetUrl} placeholder="https://docs.google.com/spreadsheets/d/..." />
        <p className="settings-help">Colle ici le lien du document qui contient une ligne par groupe. Tu pourras le remplacer à tout moment sans modifier les fiches événement.</p>
        <div className="settings-note"><b>À savoir</b><br/>Enregistrer le lien ne donne pas automatiquement accès à son contenu. Pour que le site puisse lire les lignes, le document devra être partagé avec les droits adaptés ou exposé via une connexion Google Sheets gratuite. Cette étape sera configurée après validation du vrai tableau.</div>
      </>}
      {error && <div className="error-box">{error}</div>}{message && <div className="success-box">{message}</div>}
      <div className="form-actions"><button className="btn primary" disabled={busy || saving}><Save size={15}/>{saving ? 'Enregistrement…' : 'Enregistrer les paramètres'}</button></div>
    </form>
  </section>
}

function AdminPage({ events, reload, user, signOut }) {
  const [editing, setEditing] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState(''), [showSettings, setShowSettings] = useState(false)
  const upcoming = events.filter(e => e.event_date >= format(new Date(), 'yyyy-MM-dd')).sort((a,b)=>a.event_date.localeCompare(b.event_date))
  const save = async data => {
    setBusy(true); setError('')
    const payload = { title: data.title.trim(), event_date: data.event_date, start_time: data.start_time || null, end_time: data.end_time || null, notes: data.notes || '', catering: data.catering, bar: data.bar }
    const result = data.id ? await supabase.from('events').update(payload).eq('id',data.id) : await supabase.from('events').insert(payload)
    setBusy(false)
    if (result.error) { setError(result.error.message); return }
    setEditing(null); reload()
  }
  const remove = async e => {
    if (!confirm(`Supprimer « ${e.title} » ? Cette action est définitive.`)) return
    const { error } = await supabase.from('events').delete().eq('id',e.id)
    if (error) setError(error.message); else reload()
  }
  return <main className="admin-shell"><header className="admin-top"><div className="brand dark-brand"><span className="brand-mark">S</span><div><b>BISTROT SAINT SAUVEUR</b><small>ADMINISTRATION</small></div></div><div className="admin-user">{user.email}<button className="btn secondary small" onClick={()=>setShowSettings(v=>!v)}><Settings size={14}/> Paramètres</button><button className="btn secondary small" onClick={signOut}><LogOut size={14}/> Déconnexion</button></div></header>
    {showSettings ? <div className="admin-content"><AdminSettings onBack={()=>setShowSettings(false)}/></div> : <div className="admin-content"><div className="admin-heading"><div><div className="eyebrow">GESTION DU PLANNING</div><h1>Événements à venir</h1><p>Crée, modifie ou supprime les fiches de tous les événements futurs.</p></div><button className="btn primary" onClick={()=>setEditing(structuredClone(emptyEvent))}><Plus size={17}/> Nouvel événement</button></div>
      {error && <div className="error-box">{error}</div>}
      <div className="admin-list">{upcoming.length ? upcoming.map(e=><article className="admin-event" key={e.id}><div className="admin-date"><b>{format(parseISO(e.event_date),'dd')}</b><span>{format(parseISO(e.event_date),'MMM yyyy',{locale:fr})}</span></div><div className="admin-event-main"><strong>{e.title}</strong><small>{fmtDate(e.event_date)} {e.start_time && `· ${e.start_time}`}</small><div className="admin-tags"><span><Utensils size={13}/> {e.catering?.people || 'Effectif non précisé'} pers.</span><span><Wine size={13}/> {e.bar?.meal_tokens || 0} jetons repas</span></div></div><div className="admin-actions"><button className="icon-btn" title="Modifier" onClick={()=>setEditing(structuredClone(e))}><Pencil /></button><button className="icon-btn danger" title="Supprimer" onClick={()=>remove(e)}><Trash2 /></button></div></article>) : <p className="empty">Aucun événement à venir. Tu peux créer le premier.</p>}</div>
      <p className="admin-footnote">{upcoming.length} événement{upcoming.length>1?'s':''} à venir · Les modifications sont publiées immédiatement.</p>
    </div>}{editing && <AdminForm initial={editing} onSave={save} onCancel={()=>setEditing(null)} busy={busy}/>}
  </main>
}

function Login({ onLogin }) {
  const [email,setEmail]=useState(''), [password,setPassword]=useState(''), [busy,setBusy]=useState(false), [error,setError]=useState('')
  const submit = async e => { e.preventDefault(); setBusy(true); setError(''); const {error}=await supabase.auth.signInWithPassword({email,password}); setBusy(false); if(error) setError('Connexion impossible. Vérifie tes identifiants et les droits administrateur.'); else onLogin() }
  return <main className="login-shell"><form className="login-card" onSubmit={submit}><div className="brand dark-brand"><span className="brand-mark">S</span><div><b>BISTROT SAINT SAUVEUR</b><small>ESPACE ADMINISTRATION</small></div></div><h1>Connexion</h1><p>Accès réservé à l'administration.</p><Input label="Adresse e-mail" type="email" value={email} onChange={setEmail} required/><Input label="Mot de passe" type="password" value={password} onChange={setPassword} required/>{error&&<div className="error-box">{error}</div>}<button className="btn primary full" disabled={busy}>{busy?'Connexion…':'Se connecter'}</button><a href="/" className="back-link">← Retour au planning</a></form></main>
}

export default function App() {
  const [events,setEvents]=useState([]), [loading,setLoading]=useState(true), [user,setUser]=useState(null), [adminMode,setAdminMode]=useState(location.pathname==='/admin')
  const reload = async () => { if(!supabase){setLoading(false);return} setLoading(true); const {data,error}=await supabase.from('events').select('*').order('event_date'); if(!error)setEvents(data||[]); setLoading(false) }
  useEffect(()=>{ if(!supabase){setLoading(false);return} supabase.auth.getSession().then(({data})=>setUser(data.session?.user||null)); const {data:{subscription}}=supabase.auth.onAuthStateChange((_e,session)=>setUser(session?.user||null)); return ()=>subscription.unsubscribe() },[])
  useEffect(()=>{reload()},[])
  useEffect(()=>{const fn=()=>setAdminMode(location.pathname==='/admin');window.addEventListener('popstate',fn);return()=>window.removeEventListener('popstate',fn)},[])
  const goAdmin=()=>{history.pushState({},'', '/admin');setAdminMode(true)}
  const goHome=()=>{history.pushState({},'', '/');setAdminMode(false)}
  if(!supabase) return setupError()
  if(adminMode) return user ? <AdminPage events={events} reload={reload} user={user} signOut={async()=>{await supabase.auth.signOut();goHome()}}/> : <Login onLogin={async()=>{const {data}=await supabase.auth.getSession();setUser(data.session?.user||null);}} />
  return <><PublicPage events={events} loading={loading} refresh={reload}/><button className="admin-link" onClick={goAdmin}><LockKeyhole size={14}/> Administration</button></>
}
