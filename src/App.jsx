import React, { useEffect, useMemo, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import {
  addDays, addMonths, endOfMonth, endOfWeek, format, isSameDay, isSameMonth,
  isToday, parseISO, startOfMonth, startOfWeek, subMonths
} from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  CalendarDays, ChevronLeft, ChevronRight, Clock3, Utensils, Wine,
  LockKeyhole, LogOut, Plus, Pencil, Trash2, X, Save, RefreshCw,
  Settings, ArrowLeft, ExternalLink, Users, Contact, FileText, Wrench
} from 'lucide-react'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null

async function fetchGroupsDirectory() {
  if (!supabase) throw new Error('Connexion Supabase indisponible.')
  const { data, error } = await supabase.functions.invoke('google-sheets-groups')
  if (error) throw new Error(`Erreur de connexion au répertoire : ${error.message}`)
  if (!data?.success || !Array.isArray(data.groups)) throw new Error('Le répertoire Google Sheets a renvoyé des données invalides.')
  return data.groups
}

const missions = [
  ['orga', 'Orga'], ['catering', 'Catering'], ['bar_loges', 'Bar / loges'],
  ['technique', 'Technique'], ['artistes', 'Artistes']
]
const mealFormats = [
  ['snack', 'COMMANDE AU BAR AVEC JETONS'],
  ['bac', 'GASTROS COMMUN'],
  ['portions_pickup', 'PORTIONS INDIVIDUELLES à récupérer au bar'],
  ['portions_loges', 'PORTIONS INDIVIDUELLES envoyées en loge à l’heure indiquée']
]
const emptyEvent = {
  title: '', event_date: format(new Date(), 'yyyy-MM-dd'), start_time: '', end_time: '', notes: '',
  production: { stso_people: '', timeline: [], get_in_tech: '', roadmap_url: '', wristbands: '' },
  staffing: {}, groups: [],
  catering: { people: '', formats: [], order_start: '', order_end: '', prep_time: '', time: '', diet_counts: {}, other_diet: '', allergies: '', comments: '' },
  bar: { meal_tokens: '', drink_tokens: '', loges_open: '', loges_close: '', meal_time: '', return_time: '', meal_service: '', drinks: '', requests: '', comments: '' },
  contacts: Object.fromEntries(missions.map(([key]) => [key, []]))
}
const fmtDate = (d, pattern = 'EEEE d MMMM') => format(typeof d === 'string' ? parseISO(d) : d, pattern, { locale: fr })
const weekStart = d => startOfWeek(d, { weekStartsOn: 1 })
const weekEnd = d => endOfWeek(d, { weekStartsOn: 1 })
const number = v => Math.max(0, Number.parseInt(v, 10) || 0)
const teamKinds = ['Artistes', 'Technicien·ne·s son', 'Technicien·ne·s lumière', 'Technicien·ne·s vidéo/photo', 'Autres technicien·ne·s', 'Merch', 'Autres']
const dietKinds = ['Végétarien', 'Végan', 'Sans porc', 'Sans gluten', 'Sans lactose', 'Arachides', 'Fruits à coque', 'Œufs', 'Poisson', 'Crustacés', 'Soja', 'Moutarde', 'Autre']
const timelineTypes = ['Arrivée / get in', 'Installation + balances', 'Préparations', 'Set', 'Pause', 'Changement de plateau', 'Couvre-feu son', 'Évacuation public', 'Fermeture site', 'Balances']
const makeGroup = () => ({ id: crypto.randomUUID(), name: '', contact: '', technical_contact: '', tech_sheet: '', timing: '', merch: '', vehicles: '', notes: '', headcounts: Object.fromEntries(teamKinds.map(k => [k, ''])) })

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
function setupError() {
  return <div className="setup"><div className="setup-icon"><LockKeyhole /></div><h2>Configuration nécessaire</h2><p>Le site doit être relié à sa base de données Supabase.</p><p>Vérifie les variables VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans le fichier .env.</p></div>
}
function Summary({ event, onClick }) {
  const total = number(event.production?.stso_people) + (event.groups || []).reduce((sum, g) => sum + teamKinds.reduce((n, k) => n + number(g.headcounts?.[k]), 0), 0)
  return <button className="summary-row" onClick={onClick}>
    <div className="summary-date"><b>{format(parseISO(event.event_date), 'dd')}</b><span>{format(parseISO(event.event_date), 'MMM', { locale: fr })}</span></div>
    <div className="summary-main"><strong>{event.title}</strong><small>{event.start_time || 'Horaire à préciser'}{event.end_time ? ` – ${event.end_time}` : ''}</small></div>
    <div className="summary-info"><span><Users size={14} /> {total} personnes</span><span><Utensils size={14} /> {event.catering?.people || '—'} repas</span></div>
    <ChevronRight className="row-arrow" size={18} />
  </button>
}
function DetailLines({ obj, fields }) {
  return fields.filter(([key]) => obj?.[key] !== '' && obj?.[key] != null).map(([key, label]) => <p key={key}><b>{label} :</b> {obj[key]}</p>)
}
function EventDetail({ event, onClose }) {
  if (!event) return null
  const c = event.catering || {}, b = event.bar || {}, p = event.production || {}, contacts = event.contacts || {}
  const total = number(p.stso_people) + (event.groups || []).reduce((sum, g) => sum + teamKinds.reduce((n, k) => n + number(g.headcounts?.[k]), 0), 0)
  const formatLabels = (c.formats || []).map(v => mealFormats.find(x => x[0] === v)?.[1] || v)
  return <div className="modal-backdrop" onClick={onClose}><section className="modal detail-modal" onClick={e => e.stopPropagation()}>
    <button className="icon-btn close" onClick={onClose}><X /></button>
    <div className="eyebrow">{fmtDate(event.event_date)} · {event.start_time || 'Horaire à préciser'}{event.end_time ? ` – ${event.end_time}` : ''}</div>
    <h2>{event.title}</h2>
    {event.notes && <p className="notes">{event.notes}</p>}
    <div className="detail-grid">
      <section className="detail-card"><h3><Utensils /> Catering</h3>
        <p><b>Nombre de repas :</b> {c.people || 'Non renseigné'}</p>
        {formatLabels.map(x => <p key={x}>{x}</p>)}
        <DetailLines obj={c} fields={[['order_start','Début des commandes'],['order_end','Fin des commandes'],['prep_time','Préparation cuisine'],['time','Mise à disposition']]} />
        <h4>Régimes alimentaires</h4>
        {dietKinds.some(k => c.diet_counts?.[k]?.enabled) ? dietKinds.map(k => {
          const item = c.diet_counts?.[k]
          if (!item?.enabled) return null
          return <p key={k}><b>{k} :</b> {item.count !== '' && item.count != null ? item.count : 'N/A'}</p>
        }) : <p><b>Régimes / allergies :</b> N/A</p>}
        {c.other_diet && <p><b>Autre :</b> {c.other_diet}</p>}
        <DetailLines obj={c} fields={[['allergies','Allergies / intolérances'],['comments','Commentaires']]} />
      </section>
      <section className="detail-card"><h3><Wine /> Bar & loges</h3>
        <DetailLines obj={b} fields={[['meal_tokens','Jetons repas'],['drink_tokens','Jetons boissons'],['loges_open','Ouverture loges'],['loges_close','Fermeture loges'],['meal_time','Envoi des repas'],['return_time','Retour des bacs'],['drinks','Boissons prévues'],['requests','Demandes spécifiques'],['comments','Commentaires']]} />
        {b.meal_service && <p><b>Organisation repas :</b> {mealFormats.find(x => x[0] === b.meal_service)?.[1] || b.meal_service}</p>}
      </section>
      <section className="detail-card"><h3><Wrench /> Technique</h3>
        <DetailLines obj={p} fields={[['get_in_tech','Get-in technique'],['wristbands','Nombre de bracelets']]} />
        {p.roadmap_url && <p><b>Feuille de route :</b> <a href={p.roadmap_url} target="_blank" rel="noreferrer">Ouvrir le PDF <ExternalLink size={13}/></a></p>}
        {(p.timeline || []).length > 0 && <><h4>Déroulé / conduite</h4>{p.timeline.map((t,i)=><p key={t.id || i}><b>{t.start || '—'}{t.end ? `–${t.end}` : ''} · {t.type}</b>{t.team ? ` · ${t.team}` : ''}{t.comment ? ` : ${t.comment}` : ''}</p>)}</>}
        <p><b>Effectif total :</b> {total} personnes</p>
      </section>
      <section className="detail-card"><h3><Contact /> Contacts</h3>
        {missions.map(([key,label]) => {
          const list = contacts[key] || []
          const artistGroups = key === 'artistes' ? (event.groups || []).flatMap(g => [
            ...(g.contact ? [{ name: g.name, role: 'Organisation', details: g.contact }] : []),
            ...(g.technical_contact ? [{ name: g.name, role: 'Technique', details: g.technical_contact }] : [])
          ]) : []
          if (!list.length && !artistGroups.length) return null
          return <div className="public-contact-group" key={key}><h4>{label}</h4>
            {list.map((c,i)=><div className="public-contact" key={c.id || i}><b>{c.name}</b>{c.organization && <span>{c.organization}</span>}{c.role && <span>{c.role}</span>}{c.phone && <span>Tél. : {c.phone}</span>}{c.email && <span><a href={`mailto:${c.email}`}>{c.email}</a></span>}{c.details && <span>{c.details}</span>}</div>)}
            {artistGroups.map((c,i)=><div className="public-contact" key={`${c.name}-${c.role}-${i}`}><b>{c.name}</b><span>{c.role} : {c.details}</span></div>)}
          </div>
        })}
      </section>
    </div>
  </section></div>
}
function Calendar({ events, selectedMonth, setSelectedMonth, onSelect }) {
  const start = startOfWeek(startOfMonth(selectedMonth), { weekStartsOn: 1 })
  const end = endOfWeek(endOfMonth(selectedMonth), { weekStartsOn: 1 })
  const days = []
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d)
  return <section className="calendar-card"><div className="calendar-head"><div><h2>Agenda</h2><p>Consulter les événements à venir</p></div><div className="month-nav"><button className="icon-btn" onClick={() => setSelectedMonth(subMonths(selectedMonth, 1))}><ChevronLeft /></button><b>{format(selectedMonth, 'MMMM yyyy', { locale: fr })}</b><button className="icon-btn" onClick={() => setSelectedMonth(addMonths(selectedMonth, 1))}><ChevronRight /></button></div></div>
    <div className="calendar-grid">{['lun.','mar.','mer.','jeu.','ven.','sam.','dim.'].map((d,i)=><div className="weekday" key={i}>{d}</div>)}{days.map(d => { const matches = events.filter(e => isSameDay(parseISO(e.event_date), d)); return <button key={d.toISOString()} className={`calendar-day ${!isSameMonth(d, selectedMonth) ? 'outside' : ''} ${isToday(d) ? 'today' : ''} ${matches.length ? 'has-events' : ''}`} onClick={() => matches[0] && onSelect(matches[0])}><span>{format(d,'d')}</span>{matches.length > 0 && <i title={`${matches.length} événement(s)`} />}{matches.length > 0 && <small>{matches.length} év.</small>}</button>})}</div>
    <p className="calendar-hint">Sélectionne une date avec un point pour ouvrir la fiche de l'événement.</p>
  </section>
}
function PublicPage({ events, loading, refresh }) {
  const [selected,setSelected] = useState(null), [month,setMonth] = useState(new Date())
  const now = new Date(), start = weekStart(now), end = weekEnd(now), nextStart = addDays(start,7), nextEnd = addDays(end,7)
  const thisWeek = events.filter(e => { const d = parseISO(e.event_date); return d >= start && d <= end })
  const nextWeek = events.filter(e => { const d = parseISO(e.event_date); return d >= nextStart && d <= nextEnd })
  return <main className="public-shell"><header className="hero"><div className="brand"><span className="brand-mark">S</span><div><b>BISTROT SAINT SAUVEUR</b><small>GARE SAINT SAUVEUR · LILLE</small></div></div><div className="hero-title"><div className="eyebrow light">OUTIL INTERNE · ÉQUIPES</div><h1>Planning & consignes</h1><p>Les informations des événements, au même endroit.</p></div><button className="refresh-btn" onClick={refresh}><RefreshCw size={15}/> Actualiser</button></header>
    <div className="content"><div className="section-title"><div><div className="eyebrow">VUE PRINCIPALE</div><h2>Cette semaine</h2><p>{fmtDate(start,'d MMMM')} – {fmtDate(end,'d MMMM yyyy')}</p></div><span className="count-pill">{thisWeek.length} événement{thisWeek.length>1?'s':''}</span></div>
      <section className="week-card">{loading ? <p className="empty">Chargement du planning…</p> : thisWeek.length ? thisWeek.map(e=><Summary key={e.id} event={e} onClick={()=>setSelected(e)}/>) : <p className="empty">Aucun événement programmé cette semaine.</p>}</section>
      <section className="next-section"><div className="section-title compact"><div><div className="eyebrow">ANTICIPATION</div><h2>Semaine prochaine</h2><p>{fmtDate(nextStart,'d MMMM')} – {fmtDate(nextEnd,'d MMMM yyyy')}</p></div><span className="count-pill">{nextWeek.length} événement{nextWeek.length>1?'s':''}</span></div><div className="next-card">{nextWeek.length ? nextWeek.map(e=><Summary key={e.id} event={e} onClick={()=>setSelected(e)}/>) : <p className="empty">Aucun événement programmé la semaine prochaine.</p>}</div></section>
      <Calendar events={events} selectedMonth={month} setSelectedMonth={setMonth} onSelect={setSelected}/>
    </div><footer>STSO · PLANNING ÉQUIPES <span>Informations mises à jour par l'administration</span></footer>{selected && <EventDetail event={selected} onClose={()=>setSelected(null)}/>}
  </main>
}

function GroupEditor({ groups, setGroups, directoryGroups, directoryLoading, directoryError, directoryLoaded, loadGroupsDirectory }) {
  const [search,setSearch] = useState('')
  const mapDirectoryGroup = group => {
    const d = group.data || {}
    return {
      name: group.name || d['NOM DU PROJET'] || '', contact: d['CONTACT ORGA'] || '',
      technical_contact: d['CONTACT TECHNIQUE'] || '', tech_sheet: d['FICHE TECHNIQUE'] || '',
      timing: d['TIMING'] || '', merch: d['MERCH'] || '', vehicles: d['VEHICULES'] || '',
      notes: [d['REGIMES ALIMENTAIRES SPECIFIQUES'] ? `Régimes alimentaires : ${d['REGIMES ALIMENTAIRES SPECIFIQUES']}` : '', d['DECOR / BACKDROP'] ? `Décor / backdrop : ${d['DECOR / BACKDROP']}` : '', d['AUTRE'] || ''].filter(Boolean).join('\n'),
      headcounts: {
        'Artistes': d['TEAM [Artistes, Danseur/Danseuses, Animateurs/Animatrices]'] ?? '',
        'Technicien·ne·s son': d['TEAM [Technicien.ne.s son]'] ?? '',
        'Technicien·ne·s lumière': d['TEAM [Technicien.ne.s lumière]'] ?? '',
        'Technicien·ne·s vidéo/photo': d['TEAM [Technicien.ne.s vidéo/photo]'] ?? '',
        'Autres technicien·ne·s': d['TEAM [Autres technicien.ne.s]'] ?? '',
        'Merch': d['TEAM [Merch-guy / Merch-girl]'] ?? '', 'Autres': d['TEAM [Autre]'] ?? ''
      }
    }
  }
  const addDirectory = source => {
    if (groups.some(g => String(g.sourceId) === String(source.id))) return
    const mapped = mapDirectoryGroup(source)
    const snapshot = { ...mapped, headcounts: Object.fromEntries(teamKinds.map(k=>[k,String(mapped.headcounts?.[k] ?? '')])) }
    setGroups([...groups,{...makeGroup(),...mapped,id:crypto.randomUUID(),sourceId:String(source.id),sourceSnapshot:snapshot,sourceData:source.data||{}}])
  }
  const update = (id,patch) => setGroups(groups.map(g=>g.id===id?{...g,...patch}:g))
  const filtered = directoryGroups.filter(g=>(g.name||'').toLowerCase().includes(search.toLowerCase()))
  return <>
    <div className="directory-import"><div className="subsection-head"><h4>Répertoire des groupes</h4><button type="button" className="btn secondary small" onClick={loadGroupsDirectory} disabled={directoryLoading}><RefreshCw size={14}/>{directoryLoading?'Chargement…':directoryLoaded?'Actualiser le répertoire':'Charger le répertoire'}</button></div>
      <p className="section-intro">Recherche un groupe dans Google Sheets pour préremplir sa fiche. Les modifications ici restent propres à cet événement.</p>{directoryError && <p className="error-message">{directoryError}</p>}
      {directoryLoaded && <><input className="directory-search" placeholder="Rechercher un groupe…" value={search} onChange={e=>setSearch(e.target.value)}/><div className="directory-results">{filtered.map(g=><button type="button" className="directory-result" key={g.id} disabled={groups.some(x=>String(x.sourceId)===String(g.id))} onClick={()=>addDirectory(g)}><span>{g.name||'Équipe sans nom'}</span><span>{groups.some(x=>String(x.sourceId)===String(g.id))?'✓ Déjà ajouté':'+ Ajouter'}</span></button>)}</div></>}
    </div>
    <div className="subsection-head"><h4>Fiches groupes / équipes</h4><button type="button" className="btn secondary small" onClick={()=>setGroups([...groups,makeGroup()])}><Plus size={14}/> Ajouter manuellement</button></div>
    {groups.map((g,i)=><article className="group-editor" key={g.id||i}><div className="subsection-head"><b>{g.name||`Équipe ${i+1}`}</b><div className="group-status">{g.sourceId&&<span className="status-badge synced">Répertoire</span>}<button type="button" className="icon-btn danger" onClick={()=>setGroups(groups.filter(x=>x.id!==g.id))}><Trash2 size={16}/></button></div></div>
      <div className="form-grid"><Input label="Nom du groupe / équipe" value={g.name} onChange={v=>update(g.id,{name:v})}/><Input label="Contact organisation" value={g.contact} onChange={v=>update(g.id,{contact:v})}/><Input label="Contact technique" value={g.technical_contact} onChange={v=>update(g.id,{technical_contact:v})}/><Input label="Lien fiche technique" value={g.tech_sheet} onChange={v=>update(g.id,{tech_sheet:v})}/><Input label="Timing / contraintes horaires" value={g.timing} onChange={v=>update(g.id,{timing:v})}/><Input label="Merch" value={g.merch} onChange={v=>update(g.id,{merch:v})}/><Input label="Véhicules" value={g.vehicles} onChange={v=>update(g.id,{vehicles:v})}/></div>
      <h5>Effectif de cette équipe</h5><div className="form-grid compact-grid">{teamKinds.map(k=><Input key={k} label={k} type="number" min="0" value={g.headcounts?.[k]??''} onChange={v=>update(g.id,{headcounts:{...g.headcounts,[k]:v}})}/>)}</div><Textarea label="Notes / demandes particulières" value={g.notes} onChange={v=>update(g.id,{notes:v})}/><div className="group-total">Total équipe : <b>{teamKinds.reduce((n,k)=>n+number(g.headcounts?.[k]),0)} personne(s)</b></div>
    </article>)}
  </>
}

function AdminForm({ initial, onSave, onCancel, busy, contacts }) {
  const source = initial || structuredClone(emptyEvent)
  const [form,setForm] = useState(()=>({...structuredClone(emptyEvent),...source,production:{...emptyEvent.production,...(source.production||{})},catering:{...emptyEvent.catering,...(source.catering||{})},bar:{...emptyEvent.bar,...(source.bar||{})},contacts:{...emptyEvent.contacts,...(source.contacts||{})},groups:Array.isArray(source.groups)?source.groups:[]}))
  const [section,setSection] = useState('general')
  const [directoryGroups,setDirectoryGroups] = useState([]), [directoryLoading,setDirectoryLoading] = useState(false), [directoryError,setDirectoryError] = useState(''), [directoryLoaded,setDirectoryLoaded] = useState(false)
  const set = (key,value) => setForm(f=>({...f,[key]:value}))
  const setObj = (obj,key,value) => setForm(f=>({...f,[obj]:{...f[obj],[key]:value}}))
  const groups = form.groups || []
  const groupTotal = groups.reduce((sum,g)=>sum+teamKinds.reduce((n,k)=>n+number(g.headcounts?.[k]),0),0)
  const stsoTotal = number(form.production.stso_people), eventTotal = groupTotal + stsoTotal
  const updateTimeline = (id,patch) => setObj('production','timeline',(form.production.timeline||[]).map(t=>t.id===id?{...t,...patch}:t))
  const addTimeline = () => setObj('production','timeline',[...(form.production.timeline||[]),{id:crypto.randomUUID(),type:timelineTypes[0],team:'Tous',start:'',end:'',comment:''}])
  async function loadGroupsDirectory(){setDirectoryLoading(true);setDirectoryError('');try{setDirectoryGroups(await fetchGroupsDirectory());setDirectoryLoaded(true)}catch(e){setDirectoryError(e.message||'Erreur de chargement.')}finally{setDirectoryLoading(false)}}
  const tabs=[['general','Général'],['production','Technique / production'],['staffing','Effectifs'],['catering','Catering'],['bar','Bar / loges'],['contacts','Contacts']]
  const selectedContactIds = key => (form.contacts[key]||[]).map(c=>c.id).filter(Boolean)
  const toggleContact = (key,contact,checked) => {
    const current=form.contacts[key]||[]
    const next=checked?[...current.filter(c=>c.id!==contact.id),{id:contact.id,name:contact.name,organization:contact.organization||'',role:contact.role||'',phone:contact.phone||'',email:contact.email||''}]:current.filter(c=>c.id!==contact.id)
    setObj('contacts',key,next)
  }
  return <div className="modal-backdrop"><form className="modal admin-form expanded-form" onSubmit={e=>{e.preventDefault();onSave({...form,contacts:form.contacts||{},catering:{...form.catering,people:form.catering.people},bar:{...form.bar}})}}>
    <div className="form-head"><div><div className="eyebrow">ADMINISTRATION · FICHE ÉVÉNEMENT</div><h2>{initial?.id?'Modifier l’événement':'Nouvel événement'}</h2></div><button type="button" className="icon-btn" onClick={onCancel}><X/></button></div>
    <nav className="form-tabs">{tabs.map(([k,label])=><button type="button" key={k} className={`form-tab ${section===k?'active':''}`} onClick={()=>setSection(k)}>{label}</button>)}</nav>
    {section==='general'&&<div className="form-section"><h3>Informations générales</h3><div className="form-grid"><Input label="Nom de l'événement *" value={form.title} onChange={v=>set('title',v)} required/><Input label="Date *" type="date" value={form.event_date} onChange={v=>set('event_date',v)} required/><Input label="Heure de début" type="time" value={form.start_time} onChange={v=>set('start_time',v)}/><Input label="Heure de fin" type="time" value={form.end_time} onChange={v=>set('end_time',v)}/></div><Textarea label="Informations générales / contexte" value={form.notes} onChange={v=>set('notes',v)}/></div>}
    {section==='production'&&<div className="form-section"><h3><Wrench/> Technique / production</h3><div className="form-grid"><Input label="Get-in technique" value={form.production.get_in_tech} onChange={v=>setObj('production','get_in_tech',v)} placeholder="Ex. 14h00 équipe technique"/><Input label="Nombre de bracelets" type="number" min="0" value={form.production.wristbands} onChange={v=>setObj('production','wristbands',v)}/><Input label="Lien PDF de la feuille de route" type="url" value={form.production.roadmap_url} onChange={v=>setObj('production','roadmap_url',v)} placeholder="https://…"/></div>
      <GroupEditor groups={groups} setGroups={v=>set('groups',v)} directoryGroups={directoryGroups} directoryLoading={directoryLoading} directoryError={directoryError} directoryLoaded={directoryLoaded} loadGroupsDirectory={loadGroupsDirectory}/>
      <div className="subsection-head timeline-title"><h4>Déroulé / conduite</h4><button type="button" className="btn secondary small" onClick={addTimeline}><Plus size={14}/> Ajouter une ligne</button></div>
      {(form.production.timeline||[]).map((t,i)=><div className="timeline-row" key={t.id||i}><div className="timeline-index">{i+1}</div><Field label="Description"><select value={t.type} onChange={e=>updateTimeline(t.id,{type:e.target.value})}>{timelineTypes.map(x=><option key={x}>{x}</option>)}</select></Field><Field label="Équipe"><select value={t.team} onChange={e=>updateTimeline(t.id,{team:e.target.value})}><option>Tous</option><option>Tech StSo</option>{groups.map((g,j)=><option key={g.id}>{g.name||`Équipe ${j+1}`}</option>)}</select></Field><Field label="Début"><input type="time" value={t.start||''} onChange={e=>updateTimeline(t.id,{start:e.target.value})}/></Field><Field label="Fin"><input type="time" value={t.end||''} onChange={e=>updateTimeline(t.id,{end:e.target.value})}/></Field><Field label="Commentaires"><input value={t.comment||''} onChange={e=>updateTimeline(t.id,{comment:e.target.value})}/></Field><div className="timeline-actions"><button type="button" className="icon-btn danger" onClick={()=>setObj('production','timeline',(form.production.timeline||[]).filter(x=>x.id!==t.id))}><Trash2 size={15}/></button></div></div>)}
    </div>}
    {section==='staffing'&&<div className="form-section"><h3>Effectifs</h3><p className="section-intro">Les effectifs des groupes sont additionnés automatiquement. L'effectif StSo est renseigné séparément.</p><div className="staffing-cards"><div><span>Équipes / groupes</span><strong>{groupTotal}</strong></div><div><span>Équipe StSo</span><strong>{stsoTotal}</strong></div><div className="total"><span>Total événement</span><strong>{eventTotal}</strong></div></div><Input label="Effectif StSo" type="number" min="0" value={form.production.stso_people} onChange={v=>setObj('production','stso_people',v)}/>{groups.map((g,i)=><div className="staff-line" key={g.id}><span>{g.name||`Équipe ${i+1}`}</span><b>{teamKinds.reduce((n,k)=>n+number(g.headcounts?.[k]),0)} pers.</b></div>)}</div>}
    {section==='catering'&&<div className="form-section"><h3><Utensils/> Catering / repas</h3><p className="section-intro">Le nombre de repas est indépendant du nombre total de personnes.</p><Input label="Nombre de repas à prévoir" type="number" min="0" value={form.catering.people} onChange={v=>setObj('catering','people',v)}/><Field label="Organisation des repas"><div className="choice-list">{mealFormats.map(([v,l])=><Check key={v} checked={(form.catering.formats||[]).includes(v)} onChange={on=>setObj('catering','formats',on?[...(form.catering.formats||[]),v]:(form.catering.formats||[]).filter(x=>x!==v))}>{l}</Check>)}</div></Field>
      {(form.catering.formats||[]).includes('snack')&&<div className="form-grid"><Input label="Début des commandes" type="time" value={form.catering.order_start} onChange={v=>setObj('catering','order_start',v)}/><Input label="Fin des commandes" type="time" value={form.catering.order_end} onChange={v=>setObj('catering','order_end',v)}/></div>}
      {(form.catering.formats||[]).some(x=>x!=='snack')&&<div className="form-grid"><Input label="Heure de préparation cuisine" type="time" value={form.catering.prep_time} onChange={v=>setObj('catering','prep_time',v)}/><Input label="Heure de mise à disposition / envoi" type="time" value={form.catering.time} onChange={v=>setObj('catering','time',v)}/></div>}
      <h4>Régimes alimentaires et allergies</h4><div className="diet-grid">{dietKinds.map(k=><div className="diet-item" key={k}><Check checked={!!form.catering.diet_counts?.[k]?.enabled} onChange={v=>setObj('catering','diet_counts',{...form.catering.diet_counts,[k]:{...form.catering.diet_counts?.[k],enabled:v}})}>{k}</Check>{form.catering.diet_counts?.[k]?.enabled&&<input aria-label={`Nombre ${k}`} type="number" min="0" placeholder="Nb" value={form.catering.diet_counts?.[k]?.count??''} onChange={e=>setObj('catering','diet_counts',{...form.catering.diet_counts,[k]:{...form.catering.diet_counts?.[k],count:e.target.value}})}/>}</div>)}</div>{form.catering.diet_counts?.Autre?.enabled&&<Input label="Préciser autre régime / allergie" value={form.catering.other_diet} onChange={v=>setObj('catering','other_diet',v)}/>}<Textarea label="Détails allergies / intolérances" value={form.catering.allergies} onChange={v=>setObj('catering','allergies',v)}/><Textarea label="Commentaires catering" value={form.catering.comments} onChange={v=>setObj('catering','comments',v)}/></div>}
    {section==='bar'&&<div className="form-section"><h3><Wine/> Bar / loges</h3><div className="form-grid"><Input label="Jetons repas" type="number" min="0" value={form.bar.meal_tokens} onChange={v=>setObj('bar','meal_tokens',v)}/><Input label="Jetons boissons" type="number" min="0" value={form.bar.drink_tokens} onChange={v=>setObj('bar','drink_tokens',v)}/><Input label="Ouverture / installation loges" type="time" value={form.bar.loges_open} onChange={v=>setObj('bar','loges_open',v)}/><Input label="Fermeture / libération loges" type="time" value={form.bar.loges_close} onChange={v=>setObj('bar','loges_close',v)}/><Input label="Heure d'envoi des repas en loges" type="time" value={form.bar.meal_time} onChange={v=>setObj('bar','meal_time',v)}/><Input label="Retour des bacs / contenants" type="time" value={form.bar.return_time} onChange={v=>setObj('bar','return_time',v)}/></div><Field label="Organisation repas"><select value={form.bar.meal_service||''} onChange={e=>setObj('bar','meal_service',e.target.value)}><option value="">Non précisée</option>{mealFormats.map(([v,l])=><option value={v} key={v}>{l}</option>)}</select></Field><Input label="Boissons prévues" value={form.bar.drinks} onChange={v=>setObj('bar','drinks',v)} placeholder="Eau, softs…"/><Textarea label="Demandes spécifiques / loges" value={form.bar.requests} onChange={v=>setObj('bar','requests',v)}/><Textarea label="Commentaires bar" value={form.bar.comments} onChange={v=>setObj('bar','comments',v)}/></div>}
    {section==='contacts'&&<div className="form-section"><h3><Contact/> Contacts par mission</h3><p className="section-intro">Coche un ou plusieurs contacts de la bibliothèque pour chaque mission. Les coordonnées seront copiées dans la fiche événement.</p>{missions.map(([key,label])=><section className="contact-assignment" key={key}><h4>{label}</h4>{contacts.length?contacts.map(c=><Check key={c.id} checked={selectedContactIds(key).includes(c.id)} onChange={v=>toggleContact(key,c,v)}><span><b>{c.name}</b>{c.organization?` · ${c.organization}`:''}{c.role?` · ${c.role}`:''}</span></Check>):<p className="muted">La bibliothèque de contacts est vide. Ajoute des contacts dans l'onglet Contacts de l'administration.</p>}{key==='artistes'&&groups.some(g=>g.contact||g.technical_contact)&&<p className="settings-help">Les contacts organisation et technique importés des fiches groupes seront également affichés automatiquement dans la fiche publique.</p>}</section>)}</div>}
    <div className="form-actions"><button type="button" className="btn secondary" onClick={onCancel}>Annuler</button>{section!=='general'&&<button type="button" className="btn secondary" onClick={()=>setSection(tabs[Math.max(0,tabs.findIndex(t=>t[0]===section)-1)][0])}>Précédent</button>}{section!=='contacts'&&<button type="button" className="btn secondary" onClick={()=>setSection(tabs[Math.min(tabs.length-1,tabs.findIndex(t=>t[0]===section)+1)][0])}>Suivant</button>}<button className="btn primary" disabled={busy||!form.title.trim()||!form.event_date}><Save size={16}/>{busy?'Enregistrement…':'Enregistrer l’événement'}</button></div>
  </form></div>
}

function ContactManager({ onBack, contacts, reloadContacts }) {
  const blank={name:'',organization:'',role:'',phone:'',email:'',categories:[],notes:''}
  const [editing,setEditing]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('')
  const save=async e=>{e.preventDefault();setBusy(true);setError('');const payload={...editing,name:editing.name.trim()};const result=editing.id?await supabase.from('contacts').update(payload).eq('id',editing.id):await supabase.from('contacts').insert(payload);setBusy(false);if(result.error)setError(result.error.message);else{setEditing(null);reloadContacts()}}
  const remove=async c=>{if(!confirm(`Supprimer le contact « ${c.name} » de la bibliothèque ? Les copies déjà enregistrées dans les événements ne seront pas modifiées.`))return;const {error}=await supabase.from('contacts').delete().eq('id',c.id);if(error)setError(error.message);else reloadContacts()}
  return <section className="settings-page"><div className="settings-head"><button className="btn secondary small" onClick={onBack}><ArrowLeft size={14}/> Retour aux événements</button><div className="eyebrow">ADMINISTRATION</div><h1>Bibliothèque de contacts</h1><p>Contacts réutilisables pour les cinq missions des événements.</p></div>{error&&<div className="error-box">{error}</div>}<div className="contact-library-head"><button className="btn primary" onClick={()=>setEditing({...blank,categories:[]})}><Plus size={16}/> Ajouter un contact</button></div><div className="contact-library">{contacts.map(c=><article className="contact-library-card" key={c.id}><div><b>{c.name}</b>{c.organization&&<span>{c.organization}</span>}{c.role&&<span>{c.role}</span>}{c.phone&&<span>{c.phone}</span>}{c.email&&<span>{c.email}</span>}<div className="contact-categories">{(c.categories||[]).map(x=><small key={x}>{missions.find(m=>m[0]===x)?.[1]||x}</small>)}</div></div><div className="admin-actions"><button className="icon-btn" title="Modifier" onClick={()=>setEditing({...c,categories:c.categories||[]})}><Pencil/></button><button className="icon-btn danger" title="Supprimer" onClick={()=>remove(c)}><Trash2/></button></div></article>)}{!contacts.length&&<p className="empty">Aucun contact dans la bibliothèque.</p>}</div>{editing&&<div className="modal-backdrop"><form className="modal contact-edit-modal" onSubmit={save}><div className="form-head"><h2>{editing.id?'Modifier le contact':'Nouveau contact'}</h2><button type="button" className="icon-btn" onClick={()=>setEditing(null)}><X/></button></div><Input label="Nom *" value={editing.name} onChange={v=>setEditing(x=>({...x,name:v}))} required/><Input label="Structure / organisation" value={editing.organization} onChange={v=>setEditing(x=>({...x,organization:v}))}/><Input label="Fonction / rôle" value={editing.role} onChange={v=>setEditing(x=>({...x,role:v}))}/><div className="form-grid"><Input label="Téléphone" value={editing.phone} onChange={v=>setEditing(x=>({...x,phone:v}))}/><Input label="E-mail" type="email" value={editing.email} onChange={v=>setEditing(x=>({...x,email:v}))}/></div><Field label="Missions associées"><div className="choice-list">{missions.map(([key,label])=><Check key={key} checked={(editing.categories||[]).includes(key)} onChange={v=>setEditing(x=>({...x,categories:v?[...(x.categories||[]),key]:(x.categories||[]).filter(y=>y!==key)}))}>{label}</Check>)}</div></Field><Textarea label="Notes" value={editing.notes} onChange={v=>setEditing(x=>({...x,notes:v}))}/><div className="form-actions"><button type="button" className="btn secondary" onClick={()=>setEditing(null)}>Annuler</button><button className="btn primary" disabled={busy||!editing.name.trim()}><Save size={15}/>{busy?'Enregistrement…':'Enregistrer'}</button></div></form></div>}</section>
}

function AdminSettings({onBack}) {
  const [sheetUrl,setSheetUrl]=useState(''),[busy,setBusy]=useState(true),[saving,setSaving]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('')
  useEffect(()=>{let active=true;(async()=>{const {data,error}=await supabase.from('app_settings').select('value').eq('key','google_sheet_url').maybeSingle();if(!active)return;if(error)setError(`Impossible de charger les paramètres : ${error.message}`);else setSheetUrl(data?.value?.url||'');setBusy(false)})();return()=>{active=false}},[])
  const save=async e=>{e.preventDefault();setSaving(true);setMessage('');setError('');const {error}=await supabase.from('app_settings').upsert({key:'google_sheet_url',value:{url:sheetUrl.trim()},updated_at:new Date().toISOString()},{onConflict:'key'});setSaving(false);if(error)setError(`Enregistrement impossible : ${error.message}`);else setMessage('Lien enregistré. Le chargement des groupes continue de passer par la connexion Google Sheets déjà configurée.')}
  return <section className="settings-page"><div className="settings-head"><button className="btn secondary small" onClick={onBack}><ArrowLeft size={14}/> Retour aux événements</button><div className="eyebrow">CONFIGURATION DU SITE</div><h1>Paramètres</h1><p>Les réglages communs à toutes les fiches événement.</p></div><form className="settings-card" onSubmit={save}><div className="settings-card-title"><span className="settings-icon"><ExternalLink size={18}/></span><div><h2>Fiches groupes · Google Sheets</h2><p>Document source des informations des groupes et de leurs équipes.</p></div></div>{busy?<p className="muted">Chargement…</p>:<><Input label="Lien du Google Sheet" type="url" value={sheetUrl} onChange={setSheetUrl} placeholder="https://docs.google.com/spreadsheets/d/..."/><p className="settings-help">Le lien est conservé dans les paramètres. La lecture des données utilise la fonction Google Sheets déjà installée.</p></>}{error&&<div className="error-box">{error}</div>}{message&&<div className="success-box">{message}</div>}<div className="form-actions"><button className="btn primary" disabled={busy||saving}><Save size={15}/>{saving?'Enregistrement…':'Enregistrer les paramètres'}</button></div></form></section>
}

function AdminPage({events,reload,user,signOut}) {
  const [editing,setEditing]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[view,setView]=useState('events'),[contacts,setContacts]=useState([])
  const allEvents=[...events].sort((a,b)=>b.event_date.localeCompare(a.event_date))
  const reloadContacts=async()=>{const {data,error}=await supabase.from('contacts').select('*').order('name');if(error)setError(`Chargement des contacts impossible : ${error.message}`);else setContacts(data||[])}
  useEffect(()=>{reloadContacts()},[])
  const save=async data=>{setBusy(true);setError('');const payload={title:data.title.trim(),event_date:data.event_date,start_time:data.start_time||null,end_time:data.end_time||null,notes:data.notes||'',catering:data.catering,bar:data.bar,production:data.production||{},staffing:data.staffing||{},groups:data.groups||[],contacts:data.contacts||{}};const result=data.id?await supabase.from('events').update(payload).eq('id',data.id):await supabase.from('events').insert(payload);setBusy(false);if(result.error){setError(result.error.message);return}setEditing(null);reload()}
  const remove=async e=>{if(!confirm(`Supprimer « ${e.title} » ? Cette action est définitive.`))return;const {error}=await supabase.from('events').delete().eq('id',e.id);if(error)setError(error.message);else reload()}
  return <main className="admin-shell"><header className="admin-top"><div className="brand dark-brand"><span className="brand-mark">S</span><div><b>BISTROT SAINT SAUVEUR</b><small>ADMINISTRATION</small></div></div><div className="admin-user"><span>{user.email}</span><button className="btn secondary small" onClick={()=>setView(view==='settings'?'events':'settings')}><Settings size={14}/> Paramètres</button><button className="btn secondary small" onClick={()=>setView(view==='contacts'?'events':'contacts')}><Contact size={14}/> Contacts</button><button className="btn secondary small" onClick={signOut}><LogOut size={14}/> Déconnexion</button></div></header>
    <div className="admin-content">{view==='settings'?<AdminSettings onBack={()=>setView('events')}/>:view==='contacts'?<ContactManager onBack={()=>setView('events')} contacts={contacts} reloadContacts={reloadContacts}/>:<><div className="admin-heading"><div><div className="eyebrow">GESTION DU PLANNING</div><h1>Événements à venir</h1><p>Crée, modifie ou supprime les fiches de tous les événements futurs.</p></div><button className="btn primary" onClick={()=>setEditing(structuredClone(emptyEvent))}><Plus size={17}/> Nouvel événement</button></div>{error&&<div className="error-box">{error}</div>}<div className="admin-list">{upcoming.length?upcoming.map(e=><article className="admin-event" key={e.id}><div className="admin-date"><b>{format(parseISO(e.event_date),'dd')}</b><span>{format(parseISO(e.event_date),'MMM yyyy',{locale:fr})}</span></div><div className="admin-event-main"><strong>{e.title}</strong><small>{fmtDate(e.event_date)} · {e.start_time||'Horaire à préciser'}{e.end_time?` – ${e.end_time}`:''}</small><div className="admin-tags"><span><Utensils size={13}/> {e.catering?.people||'Repas non précisés'} repas</span><span><Wine size={13}/> {e.bar?.meal_tokens||0} jetons repas</span></div></div><div className="admin-actions"><button className="icon-btn" title="Modifier" onClick={()=>setEditing(structuredClone(e))}><Pencil/></button><button className="icon-btn danger" title="Supprimer" onClick={()=>remove(e)}><Trash2/></button></div></article>):<p className="empty">Aucun événement à venir. Tu peux créer le premier.</p>}</div><p className="admin-footnote">{upcoming.length} événement{upcoming.length>1?'s':''} à venir · Les modifications sont publiées immédiatement.</p></>}</div>
    {editing&&<AdminForm initial={editing} onSave={save} onCancel={()=>setEditing(null)} busy={busy} contacts={contacts}/>}
  </main>
}
function Login({onLogin}) {
  const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('')
  const submit=async e=>{e.preventDefault();setBusy(true);setError('');const {error}=await supabase.auth.signInWithPassword({email,password});setBusy(false);if(error)setError('Connexion impossible. Vérifie tes identifiants et les droits administrateur.');else onLogin()}
  return <main className="login-shell"><form className="login-card" onSubmit={submit}><div className="brand dark-brand"><span className="brand-mark">S</span><div><b>BISTROT SAINT SAUVEUR</b><small>ESPACE ADMINISTRATION</small></div></div><h1>Connexion</h1><p>Accès réservé à l'administration.</p><Input label="Adresse e-mail" type="email" value={email} onChange={setEmail} required/><Input label="Mot de passe" type="password" value={password} onChange={setPassword} required/>{error&&<div className="error-box">{error}</div>}<button className="btn primary full" disabled={busy}>{busy?'Connexion…':'Se connecter'}</button><a href="/" className="back-link">← Retour au planning</a></form></main>
}
export default function App() {
  const [events,setEvents]=useState([]),[loading,setLoading]=useState(true),[user,setUser]=useState(null),[adminMode,setAdminMode]=useState(location.pathname==='/admin')
  const reload=async()=>{if(!supabase){setLoading(false);return}setLoading(true);const {data,error}=await supabase.from('events').select('*').order('event_date');if(!error)setEvents(data||[]);else console.error(error);setLoading(false)}
  useEffect(()=>{if(!supabase){setLoading(false);return}supabase.auth.getSession().then(({data})=>setUser(data.session?.user||null));const {data:{subscription}}=supabase.auth.onAuthStateChange((_e,session)=>setUser(session?.user||null));return()=>subscription.unsubscribe()},[])
  useEffect(()=>{reload()},[])
  useEffect(()=>{const fn=()=>setAdminMode(location.pathname==='/admin');window.addEventListener('popstate',fn);return()=>window.removeEventListener('popstate',fn)},[])
  const goAdmin=()=>{history.pushState({},'','/admin');setAdminMode(true)}
  const goHome=()=>{history.pushState({},'','/');setAdminMode(false)}
  if(!supabase)return setupError()
  if(adminMode)return user?<AdminPage events={events} reload={reload} user={user} signOut={async()=>{await supabase.auth.signOut();goHome()}}/>:<Login onLogin={async()=>{const {data}=await supabase.auth.getSession();setUser(data.session?.user||null)}}/>
  return <><PublicPage events={events} loading={loading} refresh={reload}/><button className="admin-link" onClick={goAdmin}><LockKeyhole size={14}/> Administration</button></>
}
