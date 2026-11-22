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
async function fetchGroupsDirectory() {
  if (!supabase) {
    throw new Error('Connexion Supabase indisponible.')
  }

  const { data, error } = await supabase.functions.invoke(
    'google-sheets-groups'
  )

  if (error) {
    throw new Error(`Erreur de connexion au répertoire : ${error.message}`)
  }

  if (!data?.success || !Array.isArray(data.groups)) {
    throw new Error('Le répertoire Google Sheets a renvoyé des données invalides.')
  }

  return data.groups
}

const emptyEvent = {
  title: '', event_date: format(new Date(), 'yyyy-MM-dd'), start_time: '', end_time: '',
  notes: '',
  production: { stso_people: '', timeline: [] },
  staffing: {}, groups: [],
  catering: { people: '', format: 'snack', formats: [], time_type: 'slot', time: '', vegetarian: '', vegan: '', no_pork: '', allergies: '', comments: '' },
  bar: { meal_tokens: '', drink_tokens: '', loges_open: '', loges_close: '', meal_time: '', drinks: '', requests: '', comments: '' }
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

const timelineTypes = ['Arrivée / get in', 'Installation + balances', 'Préparations', 'Set', 'Pause', 'Changement de plateau', 'Couvre-feu son', 'Évacuation public', 'Fermeture site', 'Balances']
const teamKinds = ['Artistes', 'Technicien·ne·s son', 'Technicien·ne·s lumière', 'Technicien·ne·s vidéo/photo', 'Autres technicien·ne·s', 'Merch', 'Autres']
const dietKinds = ['Végétarien', 'Végan', 'Sans porc', 'Sans gluten', 'Sans lactose', 'Arachides', 'Fruits à coque', 'Œufs', 'Poisson', 'Crustacés', 'Soja', 'Moutarde', 'Autre']
const makeGroup = () => ({ id: crypto.randomUUID(), name: '', contact: '', technical_contact: '', tech_sheet: '', timing: '', merch: '', vehicles: '', notes: '', headcounts: Object.fromEntries(teamKinds.map(k => [k, ''])) })
const number = v => Math.max(0, Number.parseInt(v, 10) || 0)


function AdminForm({ initial, onSave, onCancel, busy }) {
  const source = initial || structuredClone(emptyEvent)

  const [form, setForm] = useState(() => ({
    ...structuredClone(emptyEvent),
    ...source,
    production: { ...emptyEvent.production, ...(source.production || {}) },
    catering: { ...emptyEvent.catering, ...(source.catering || {}) },
    bar: { ...emptyEvent.bar, ...(source.bar || {}) },
    groups: Array.isArray(source.groups) ? source.groups : []
  }))

  const [section, setSection] = useState('general')
  const [directoryGroups, setDirectoryGroups] = useState([])
  const [directoryLoading, setDirectoryLoading] = useState(false)
  const [directoryError, setDirectoryError] = useState('')
  const [directorySearch, setDirectorySearch] = useState('')
  const [directoryLoaded, setDirectoryLoaded] = useState(false)

  const set = (key, value) =>
    setForm(f => ({ ...f, [key]: value }))

  const setObj = (obj, key, value) =>
    setForm(f => ({ ...f, [obj]: { ...f[obj], [key]: value } }))

  const groups = form.groups || []

  const groupTotal = groups.reduce(
    (sum, g) =>
      sum + teamKinds.reduce(
        (n, k) => n + number(g.headcounts?.[k]),
        0
      ),
    0
  )

  const stsoTotal = number(form.production.stso_people)
  const eventTotal = groupTotal + stsoTotal

  const updateGroup = (id, patch) =>
    set('groups', groups.map(g => g.id === id ? { ...g, ...patch } : g))

  const updateHeadcount = (id, kind, value) =>
    set('groups', groups.map(g =>
      g.id === id
        ? { ...g, headcounts: { ...g.headcounts, [kind]: value } }
        : g
    ))

  const updateTimeline = (id, patch) =>
    setObj(
      'production',
      'timeline',
      (form.production.timeline || []).map(t =>
        t.id === id ? { ...t, ...patch } : t
      )
    )

  const addTimeline = () =>
    setObj('production', 'timeline', [
      ...(form.production.timeline || []),
      {
        id: crypto.randomUUID(),
        type: timelineTypes[0],
        team: 'Tous',
        start: '',
        end: '',
        comment: ''
      }
    ])

  // Correspondance entre les colonnes Google Sheets et la fiche événement.
  const mapDirectoryGroup = (group) => {
    const data = group.data || {}

    return {
      name: group.name || data['NOM DU PROJET'] || '',
      contact: data['CONTACT ORGA'] || '',
      technical_contact: data['CONTACT TECHNIQUE'] || '',
      tech_sheet: data['FICHE TECHNIQUE'] || '',
      timing: data['TIMING'] || '',
      merch: data['MERCH'] || '',
      vehicles: data['VEHICULES'] || '',
      notes: [
        data['REGIMES ALIMENTAIRES SPECIFIQUES']
          ? `Régimes alimentaires : ${data['REGIMES ALIMENTAIRES SPECIFIQUES']}`
          : '',
        data['DECOR / BACKDROP']
          ? `Décor / backdrop : ${data['DECOR / BACKDROP']}`
          : '',
        data['AUTRE'] || ''
      ].filter(Boolean).join('\n'),
      headcounts: {
        'Artistes': data['TEAM [Artistes, Danseur/Danseuses, Animateurs/Animatrices]'] ?? '',
        'Technicien·ne·s son': data['TEAM [Technicien.ne.s son]'] ?? '',
        'Technicien·ne·s lumière': data['TEAM [Technicien.ne.s lumière]'] ?? '',
        'Technicien·ne·s vidéo/photo': data['TEAM [Technicien.ne.s vidéo/photo]'] ?? '',
        'Autres technicien·ne·s': data['TEAM [Autres technicien.ne.s]'] ?? '',
        'Merch': data['TEAM [Merch-guy / Merch-girl]'] ?? '',
        'Autres': data['TEAM [Autre]'] ?? ''
      }
    }
  }

  // Représentation des champs importés pour comparer les modifications.
  const getGroupSnapshot = (group) => ({
    name: group.name || '',
    contact: group.contact || '',
    technical_contact: group.technical_contact || '',
    tech_sheet: group.tech_sheet || '',
    timing: group.timing || '',
    merch: group.merch || '',
    vehicles: group.vehicles || '',
    notes: group.notes || '',
    headcounts: Object.fromEntries(
      teamKinds.map(k => [k, String(group.headcounts?.[k] ?? '')])
    )
  })

  const isLocallyModified = (group) => {
    if (!group.sourceId || !group.sourceSnapshot) return false

    return JSON.stringify(getGroupSnapshot(group)) !==
      JSON.stringify(group.sourceSnapshot)
  }

  const isSourceUpdated = (group) => {
    if (!group.sourceId || !group.sourceSnapshot) return false

    const currentSource = directoryGroups.find(
      item => String(item.id) === String(group.sourceId)
    )

    if (!currentSource) return false

    return JSON.stringify(mapDirectoryGroup(currentSource)) !==
      JSON.stringify(group.sourceSnapshot)
  }

  async function loadGroupsDirectory() {
    setDirectoryLoading(true)
    setDirectoryError('')

    try {
      const loadedGroups = await fetchGroupsDirectory()
      setDirectoryGroups(loadedGroups)
      setDirectoryLoaded(true)
    } catch (error) {
      setDirectoryError(
        error.message || 'Erreur lors du chargement du répertoire.'
      )
    } finally {
      setDirectoryLoading(false)
    }
  }

  function addDirectoryGroup(directoryGroup) {
    const alreadyAdded = groups.some(
      g => String(g.sourceId) === String(directoryGroup.id)
    )

    if (alreadyAdded) return

    const mapped = mapDirectoryGroup(directoryGroup)

    const newGroup = {
      ...makeGroup(),
      ...mapped,
      id: crypto.randomUUID(),
      sourceId: String(directoryGroup.id),
      sourceSnapshot: structuredClone(mapped),
      sourceData: directoryGroup.data || {}
    }

    set('groups', [...groups, newGroup])
  }

  function refreshGroupFromSource(group) {
    const currentSource = directoryGroups.find(
      item => String(item.id) === String(group.sourceId)
    )

    if (!currentSource) return

    const mapped = mapDirectoryGroup(currentSource)

    updateGroup(group.id, {
      ...mapped,
      sourceSnapshot: structuredClone(mapped),
      sourceData: currentSource.data || {}
    })
  }

  const filteredDirectoryGroups = directoryGroups.filter(group =>
    (group.name || '').toLowerCase().includes(directorySearch.toLowerCase())
  )

  const tabs = [
    ['general', 'Général'],
    ['production', 'Technique / production'],
    ['staffing', 'Effectifs'],
    ['catering', 'Catering'],
    ['bar', 'Bar / loges']
  ]

  const tab = key => (
    <button
      type="button"
      className={`form-tab ${section === key ? 'active' : ''}`}
      onClick={() => setSection(key)}
    >
      {tabs.find(t => t[0] === key)?.[1]}
    </button>
  )

  return (
    <div className="modal-backdrop">
      <form
        className="modal admin-form expanded-form"
        onSubmit={e => {
          e.preventDefault()
          onSave({
            ...form,
            catering: {
              ...form.catering,
              people: form.catering.people === ''
                ? String(eventTotal)
                : form.catering.people
            },
            bar: {
              ...form.bar,
              meal_tokens: form.bar.meal_tokens === ''
                ? String(eventTotal)
                : form.bar.meal_tokens
            }
          })
        }}
      >
        <div className="form-head">
          <div>
            <div className="eyebrow">ADMINISTRATION · FICHE ÉVÉNEMENT</div>
            <h2>{initial?.id ? 'Modifier l’événement' : 'Nouvel événement'}</h2>
          </div>
          <button type="button" className="icon-btn" onClick={onCancel}>
            <X />
          </button>
        </div>

        <nav className="form-tabs">
          {tabs.map(([k]) => (
            <React.Fragment key={k}>{tab(k)}</React.Fragment>
          ))}
        </nav>

        {section === 'general' && (
          <div className="form-section">
            <h3>Informations générales</h3>
            <div className="form-grid">
              <Input label="Nom de l'événement *" value={form.title}
                onChange={v => set('title', v)}
                required placeholder="Ex. Concert, privatisation…" />
              <Input label="Date *" type="date" value={form.event_date}
                onChange={v => set('event_date', v)} required />
              <Input label="Heure de début" type="time" value={form.start_time}
                onChange={v => set('start_time', v)} />
              <Input label="Heure de fin" type="time" value={form.end_time}
                onChange={v => set('end_time', v)} />
            </div>
            <Textarea label="Informations générales / contexte"
              value={form.notes} onChange={v => set('notes', v)}
              placeholder="Contexte, organisation générale, points de vigilance…" />
          </div>
        )}

        {section === 'production' && (
          <div className="form-section">
            <h3>Technique / production</h3>

            <div className="directory-import">
              <div className="subsection-head">
                <h4>Répertoire des groupes</h4>
                <button
                  type="button"
                  className="btn secondary small"
                  onClick={loadGroupsDirectory}
                  disabled={directoryLoading}
                >
                  <RefreshCw size={14} />
                  {directoryLoading ? 'Chargement…' : directoryLoaded ? 'Actualiser le répertoire' : 'Charger le répertoire'}
                </button>
              </div>

              <p className="section-intro">
                Recherche un groupe dans le répertoire Google Sheets pour
                préremplir sa fiche. Les modifications faites ici restent
                propres à cet événement.
              </p>

              {directoryError && (
                <p className="error-message">{directoryError}</p>
              )}

              {directoryLoaded && (
                <>
                  <input
                    type="search"
                    className="directory-search"
                    placeholder="Rechercher un groupe…"
                    value={directorySearch}
                    onChange={e => setDirectorySearch(e.target.value)}
                  />

                  <div className="directory-results">
                    {filteredDirectoryGroups.length === 0 ? (
                      <p className="empty-inline">
                        Aucun groupe correspondant.
                      </p>
                    ) : (
                      filteredDirectoryGroups.map(group => {
                        const alreadyAdded = groups.some(
                          g => String(g.sourceId) === String(group.id)
                        )

                        return (
                          <button
                            key={group.id}
                            type="button"
                            className="directory-result"
                            disabled={alreadyAdded}
                            onClick={() => addDirectoryGroup(group)}
                          >
                            <span>
                              {group.name || 'Équipe sans nom'}
                            </span>
                            <span>
                              {alreadyAdded ? '✓ Déjà ajouté' : '+ Ajouter'}
                            </span>
                          </button>
                        )
                      })
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="subsection-head">
              <h4>Fiches groupes / équipes</h4>
              <button
                type="button"
                className="btn secondary small"
                onClick={() => set('groups', [...groups, makeGroup()])}
              >
                <Plus size={14} /> Ajouter une équipe manuellement
              </button>
            </div>

            {!groups.length && (
              <p className="empty-inline">
                Aucune équipe ajoutée pour le moment.
              </p>
            )}

            {groups.map((g, i) => (
              <article className="group-editor" key={g.id || i}>
                <div className="subsection-head">
                  <b>{g.name || `Équipe ${i + 1}`}</b>

                  <div className="group-status">
                    {g.sourceId ? (
                      <>
                        <span className="status-badge synced">
                          Répertoire
                        </span>
                        {isLocallyModified(g) && (
                          <span className="status-badge modified">
                            Modifié localement
                          </span>
                        )}
                        {isSourceUpdated(g) && (
                          <span className="status-badge updated">
                            Source actualisée
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="status-badge manual">
                        Saisie manuelle
                      </span>
                    )}

                    {g.sourceId && isSourceUpdated(g) && (
                      <button
                        type="button"
                        className="btn secondary small"
                        onClick={() => refreshGroupFromSource(g)}
                      >
                        Reprendre les données source
                      </button>
                    )}

                    <button
                      type="button"
                      className="icon-btn danger"
                      title="Supprimer cette équipe"
                      onClick={() => set(
                        'groups',
                        groups.filter(x => x.id !== g.id)
                      )}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="form-grid">
                  <Input label="Nom du groupe / équipe" value={g.name}
                    onChange={v => updateGroup(g.id, { name: v })}
                    placeholder="Nom du groupe" />
                  <Input label="Contact organisation" value={g.contact}
                    onChange={v => updateGroup(g.id, { contact: v })} />
                  <Input label="Contact technique" value={g.technical_contact}
                    onChange={v => updateGroup(g.id, { technical_contact: v })} />
                  <Input label="Lien fiche technique" value={g.tech_sheet}
                    onChange={v => updateGroup(g.id, { tech_sheet: v })}
                    placeholder="https://…" />
                  <Input label="Timing / contraintes horaires" value={g.timing}
                    onChange={v => updateGroup(g.id, { timing: v })} />
                  <Input label="Merch" value={g.merch}
                    onChange={v => updateGroup(g.id, { merch: v })} />
                  <Input label="Véhicules" value={g.vehicles}
                    onChange={v => updateGroup(g.id, { vehicles: v })} />
                </div>

                <h5>Effectif de cette équipe</h5>
                <div className="form-grid compact-grid">
                  {teamKinds.map(k => (
                    <Input
                      key={k}
                      label={k}
                      type="number"
                      min="0"
                      value={g.headcounts?.[k] ?? ''}
                      onChange={v => updateHeadcount(g.id, k, v)}
                    />
                  ))}
                </div>

                <Textarea
                  label="Notes / demandes particulières"
                  value={g.notes}
                  onChange={v => updateGroup(g.id, { notes: v })}
                />

                <div className="group-total">
                  Total équipe : <b>
                    {teamKinds.reduce(
                      (n, k) => n + number(g.headcounts?.[k]),
                      0
                    )} personne(s)
                  </b>
                </div>
              </article>
            ))}

            <div className="subsection-head timeline-title">
              <h4>Déroulé / conduite</h4>
              <button type="button" className="btn secondary small"
                onClick={addTimeline}>
                <Plus size={14} /> Ajouter une ligne
              </button>
            </div>

            {(form.production.timeline || []).map((t, i) => (
              <div className="timeline-row" key={t.id || i}>
                <div className="timeline-index">{i + 1}</div>

                <Field label="Description">
                  <select value={t.type}
                    onChange={e => updateTimeline(t.id, { type: e.target.value })}>
                    {timelineTypes.map(x => <option key={x}>{x}</option>)}
                  </select>
                </Field>

                <Field label="Équipe concernée">
                  <select value={t.team}
                    onChange={e => updateTimeline(t.id, { team: e.target.value })}>
                    <option>Tous</option>
                    <option>Tech StSo</option>
                    {groups.map((g, j) => (
                      <option key={g.id} value={g.name || `Équipe ${j + 1}`}>
                        {g.name || `Équipe ${j + 1}`}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Début">
                  <input type="time" value={t.start || ''}
                    onChange={e => updateTimeline(t.id, { start: e.target.value })} />
                </Field>

                <Field label="Fin">
                  <input type="time" value={t.end || ''}
                    onChange={e => updateTimeline(t.id, { end: e.target.value })} />
                </Field>

                <Field label="Commentaires">
                  <input value={t.comment || ''}
                    onChange={e => updateTimeline(t.id, { comment: e.target.value })}
                    placeholder="Précisions…" />
                </Field>

                <div className="timeline-actions">
                  <button type="button" className="icon-btn" title="Monter"
                    disabled={i === 0}
                    onClick={() => {
                      const a = [...(form.production.timeline || [])]
                      ;[a[i - 1], a[i]] = [a[i], a[i - 1]]
                      setObj('production', 'timeline', a)
                    }}>↑</button>

                  <button type="button" className="icon-btn" title="Descendre"
                    disabled={i === (form.production.timeline || []).length - 1}
                    onClick={() => {
                      const a = [...(form.production.timeline || [])]
                      ;[a[i + 1], a[i]] = [a[i], a[i + 1]]
                      setObj('production', 'timeline', a)
                    }}>↓</button>

                  <button type="button" className="icon-btn danger"
                    title="Supprimer la ligne"
                    onClick={() => setObj(
                      'production',
                      'timeline',
                      (form.production.timeline || []).filter(x => x.id !== t.id)
                    )}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {section === 'staffing' && (
          <div className="form-section">
            <h3>Effectifs</h3>
            <p className="section-intro">
              Les effectifs des équipes sont additionnés automatiquement.
              L'effectif StSo est renseigné séparément.
            </p>

            <div className="staffing-cards">
              <div><span>Équipes / groupes</span><strong>{groupTotal}</strong></div>
              <div><span>Équipe StSo</span><strong>{stsoTotal}</strong></div>
              <div className="total"><span>Total événement</span><strong>{eventTotal}</strong></div>
            </div>

            <Input
              label="Effectif StSo (salariés, régie, accueil, sécurité…)"
              type="number"
              min="0"
              value={form.production.stso_people}
              onChange={v => setObj('production', 'stso_people', v)}
              placeholder="Nombre de personnes"
            />

            {groups.map((g, i) => (
              <div className="staff-line" key={g.id || i}>
                <span>{g.name || `Équipe ${i + 1}`}</span>
                <b>
                  {teamKinds.reduce(
                    (n, k) => n + number(g.headcounts?.[k]),
                    0
                  )} pers.
                </b>
              </div>
            ))}
          </div>
        )}

        {section === 'catering' && (
          <div className="form-section">
            <h3><Utensils /> Catering / repas</h3>
            <p className="section-intro">
              Le nombre de repas proposé reprend le total des effectifs.
              Tu peux saisir un nombre différent si nécessaire.
            </p>

            <Input label="Nombre de repas à prévoir" type="number" min="0"
              value={form.catering.people || String(eventTotal)}
              onChange={v => setObj('catering', 'people', v)}
              placeholder={String(eventTotal)} />

            <Field label="Organisation des repas">
              <div className="choice-list">
                {[
                  ['snack', 'Commande au snack le jour J'],
                  ['bac', 'Bac gastro commun / chacun se sert et réchauffe'],
                  ['portions', 'Portions individuelles à récupérer ou envoyer en loges']
                ].map(([v, l]) => (
                  <Check key={v}
                    checked={(form.catering.formats || []).includes(v)}
                    onChange={on => setObj(
                      'catering',
                      'formats',
                      on
                        ? [...(form.catering.formats || []), v]
                        : (form.catering.formats || []).filter(x => x !== v)
                    )}>
                    {l}
                  </Check>
                ))}
              </div>
            </Field>

            {(form.catering.formats || []).includes('snack') && (
              <div className="form-grid">
                <Input label="Début des commandes" type="time"
                  value={form.catering.order_start}
                  onChange={v => setObj('catering', 'order_start', v)} />
                <Input label="Fin des commandes" type="time"
                  value={form.catering.order_end}
                  onChange={v => setObj('catering', 'order_end', v)} />
              </div>
            )}

            {(form.catering.formats || []).some(x => x === 'bac' || x === 'portions') && (
              <div className="form-grid">
                <Input label="Heure de préparation cuisine" type="time"
                  value={form.catering.prep_time}
                  onChange={v => setObj('catering', 'prep_time', v)} />
                <Input label="Heure de mise à disposition / envoi" type="time"
                  value={form.catering.time}
                  onChange={v => setObj('catering', 'time', v)} />
              </div>
            )}

            {(form.catering.formats || []).includes('portions') && (
              <Field label="Distribution des portions">
                <select value={form.catering.distribution || 'pickup'}
                  onChange={e => setObj('catering', 'distribution', e.target.value)}>
                  <option value="pickup">Les artistes récupèrent au bar quand ils veulent</option>
                  <option value="loges">Le bar envoie en loges, les artistes se servent</option>
                </select>
              </Field>
            )}

            <h4>Régimes alimentaires et allergies</h4>
            <div className="diet-grid">
              {dietKinds.map(k => (
                <div className="diet-item" key={k}>
                  <Check
                    checked={!!form.catering.diet_counts?.[k]?.enabled}
                    onChange={v => setObj(
                      'catering',
                      'diet_counts',
                      {
                        ...form.catering.diet_counts,
                        [k]: {
                          ...form.catering.diet_counts?.[k],
                          enabled: v
                        }
                      }
                    )}>
                    {k}
                  </Check>

                  {form.catering.diet_counts?.[k]?.enabled && (
                    <input aria-label={`Nombre ${k}`} type="number" min="0"
                      placeholder="Nb"
                      value={form.catering.diet_counts?.[k]?.count || ''}
                      onChange={e => setObj(
                        'catering',
                        'diet_counts',
                        {
                          ...form.catering.diet_counts,
                          [k]: {
                            ...form.catering.diet_counts?.[k],
                            count: e.target.value
                          }
                        }
                      )} />
                  )}
                </div>
              ))}
            </div>

            {form.catering.diet_counts?.Autre?.enabled && (
              <Input label="Préciser autre régime / allergie"
                value={form.catering.other_diet || ''}
                onChange={v => setObj('catering', 'other_diet', v)} />
            )}

            <Textarea label="Détails allergies / intolérances"
              value={form.catering.allergies}
              onChange={v => setObj('catering', 'allergies', v)} />
            <Textarea label="Commentaires catering"
              value={form.catering.comments}
              onChange={v => setObj('catering', 'comments', v)} />
          </div>
        )}

        {section === 'bar' && (
          <div className="form-section">
            <h3><Wine /> Bar / loges</h3>

            <div className="form-grid">
              <Input label="Jetons repas" type="number" min="0"
                value={form.bar.meal_tokens || String(eventTotal)}
                onChange={v => setObj('bar', 'meal_tokens', v)}
                placeholder={String(eventTotal)} />
              <Input label="Jetons boissons" type="number" min="0"
                value={form.bar.drink_tokens}
                onChange={v => setObj('bar', 'drink_tokens', v)} />
              <Input label="Ouverture / installation loges" type="time"
                value={form.bar.loges_open}
                onChange={v => setObj('bar', 'loges_open', v)} />
              <Input label="Fermeture / libération loges" type="time"
                value={form.bar.loges_close}
                onChange={v => setObj('bar', 'loges_close', v)} />
              <Input label="Heure d'envoi des repas en loges" type="time"
                value={form.bar.meal_time}
                onChange={v => setObj('bar', 'meal_time', v)} />
              <Input label="Heure de retour des bacs / contenants" type="time"
                value={form.bar.return_time}
                onChange={v => setObj('bar', 'return_time', v)} />
            </div>

            <Field label="Organisation au bar">
              <select value={form.bar.meal_service || 'snack'}
                onChange={e => setObj('bar', 'meal_service', e.target.value)}>
                <option value="snack">Jetons repas : commande au bar, transmise au snack</option>
                <option value="bac">Bacs gastro : le bar amène les bacs en loges</option>
                <option value="portions_pickup">Portions : les artistes récupèrent au bar</option>
                <option value="portions_loges">Portions : le bar envoie en loges</option>
              </select>
            </Field>

            <Input label="Boissons prévues" value={form.bar.drinks}
              onChange={v => setObj('bar', 'drinks', v)}
              placeholder="Eau, softs…" />
            <Textarea label="Demandes spécifiques / loges"
              value={form.bar.requests}
              onChange={v => setObj('bar', 'requests', v)} />
            <Textarea label="Commentaires bar"
              value={form.bar.comments}
              onChange={v => setObj('bar', 'comments', v)} />
          </div>
        )}

        <div className="form-actions">
          <button type="button" className="btn secondary" onClick={onCancel}>
            Annuler
          </button>

          {section !== 'general' && (
            <button type="button" className="btn secondary"
              onClick={() => setSection(
                tabs[Math.max(0, tabs.findIndex(t => t[0] === section) - 1)][0]
              )}>
              Précédent
            </button>
          )}

          {section !== 'bar' && (
            <button type="button" className="btn secondary"
              onClick={() => setSection(
                tabs[Math.min(tabs.length - 1, tabs.findIndex(t => t[0] === section) + 1)][0]
              )}>
              Suivant
            </button>
          )}

          <button className="btn primary"
            disabled={busy || !form.title.trim() || !form.event_date}>
            <Save size={16} />
            {busy ? 'Enregistrement…' : 'Enregistrer l’événement'}
          </button>
        </div>
      </form>
    </div>
  )
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
    const payload = { title: data.title.trim(), event_date: data.event_date, start_time: data.start_time || null, end_time: data.end_time || null, notes: data.notes || '', catering: data.catering, bar: data.bar, production: data.production || {}, staffing: data.staffing || {}, groups: data.groups || [] }
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
