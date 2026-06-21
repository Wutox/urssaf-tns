import { useState, useEffect, useCallback } from 'react'
import './index.css'
import styles from './App.module.css'


const SUPABASE_URL = 'https://hydzvtcfgryrxfwfnnca.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5ZHp2dGNmZ3J5cnhmd2ZubmNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwMjU2NTAsImV4cCI6MjA5NzYwMTY1MH0.xzhwOqlozQNy61zEEQ9wenpld4fbyBkDOijIfGrL6N4'

async function fetchTaux() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/taux_cotisations?select=*&order=id`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
  })
  const rows = await res.json()
  return rows.map(r => ({ ...r, taux: parseFloat(r.taux) }))
}

async function updateTaux(id, taux) {
  await fetch(`${SUPABASE_URL}/rest/v1/taux_cotisations?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal'
    },
    body: JSON.stringify({ taux, updated_at: new Date().toISOString() })
  })
}

const PASS = 47100
const ABATTEMENT = 0.26
const PLAFOND_ABT = 1.3
const PLANCHER_ABT = 0.0176

const DEFAULT_COMPT = {
  mal1: 3863, mal2: 0, ij: 288, af: 738,
  ret1: 8360, ret2: 63, retc1: 3072, retc2: 1101,
  inv: 612, csgd: 4851, csgnd: 2069, cfp: 118,
}

const ROW_LABELS_URSSAF = {
  mal1:  'Maladie (≤ 235 500 €)',
  mal2:  'Maladie (> 235 500 €)',
  ij:    'IJ',
  af:    'AF',
  ret1:  'Retraite base (≤ PASS)',
  ret2:  'Retraite base (> PASS)',
  retc1: 'Retraite compl. (≤ PASS)',
  retc2: 'Retraite compl. (1–4 PASS)',
  inv:   'Invalidité',
  csgd:  'CSG déductible',
  csgnd: 'CSG non déductible',
  cfp:   'CFP',
}

const ROW_LABELS_RSI = {
  mal1:  'Maladie (≤ 235 500 €)',
  mal2:  'Maladie (> 235 500 €)',
  ij:    'IJ',
  af:    'AF',
  csgd:  'CSG déductible',
  csgnd: 'CSG non déductible',
  cfp:   'CFP',
}

const ROW_LABELS_CAVEC = {
  ret1:  'Retraite base (≤ PASS)',
  ret2:  'Retraite base (> PASS)',
  retc1: 'Retraite compl. (≤ PASS)',
  retc2: 'Retraite compl. (1–4 PASS)',
  inv:   'Invalidité',
}

function fmt(n) {
  return Math.round(n).toLocaleString('fr-FR') + ' €'
}

function getMaladieTaux(sb) {
  const p = PASS
  if (sb < p * 0.2) return 0
  if (sb < p * 0.4) return (sb - p*0.2)/(p*0.4 - p*0.2) * 0.015
  if (sb < p * 0.6) return (sb - p*0.4)/(p*0.6 - p*0.4) * (0.04-0.015) + 0.015
  if (sb < p * 1.1) return (sb - p*0.6)/(p*1.1 - p*0.6) * (0.065-0.04) + 0.04
  if (sb < p * 2)   return (sb - p*1.1)/(p*2 - p*1.1) * (0.077-0.065) + 0.065
  if (sb < p * 3)   return (sb - p*2)/(p*3 - p*2) * (0.085-0.077) + 0.077
  return 0.085
}

function getAFTaux(remun) {
  if (remun < 1.1*PASS) return 0
  if (remun < 1.4*PASS) return (remun - PASS*1.1)*0.031/(PASS*1.4 - PASS*1.1)
  return 0.031
}

function computeOnce(remun, div, cotisB4, T) {
  const totalBase = remun + div + cotisB4
  let abt = totalBase * ABATTEMENT
  if (abt > PASS * PLAFOND_ABT) abt = PASS * PLAFOND_ABT
  if (abt < PASS * PLANCHER_ABT) abt = PASS * PLANCHER_ABT
  const sb = totalBase - abt

  const malBase1 = sb > PASS*5 ? PASS*5 : sb
  const malTaux1 = getMaladieTaux(sb)
  const malCot1  = malBase1 * malTaux1
  const malBase2 = sb > PASS*3 ? sb - PASS*3 : 0
  const malCot2  = malBase2 * (T.mal2/100)
  const ijBase = sb < PASS*0.4 ? PASS*0.4 : (sb > PASS*5 ? PASS*5 : sb)
  const ijCot  = ijBase * (T.ij/100)
  const afTaux = getAFTaux(remun)
  const afCot  = sb * afTaux
  const retBase1 = sb < PASS*0.1135 ? PASS*0.1135 : (sb > PASS ? PASS : sb)
  const retCot1  = retBase1 * (T.ret1/100)
  const retBase2 = sb > retBase1 ? sb - retBase1 : 0
  const retCot2  = retBase2 * (T.ret2/100)
  const retcBase1 = sb > PASS ? PASS : sb
  const retcCot1  = retcBase1 * (T.retc1/100)
  const retcBase2 = sb > PASS*4 ? PASS*3 : (sb > PASS ? sb - PASS : 0)
  const retcCot2  = retcBase2 * (T.retc2/100)
  const invBase = sb < PASS*0.115 ? PASS*0.115 : (sb > PASS ? PASS : sb)
  const invCot  = invBase * (T.inv/100)
  const csgdCot  = sb * (T.csgd/100)
  const csgndCot = sb * (T.csgnd/100)
  const cfpCot   = PASS * (T.cfp/100)

  const cots = { mal1:malCot1, mal2:malCot2, ij:ijCot, af:afCot, ret1:retCot1, ret2:retCot2, retc1:retcCot1, retc2:retcCot2, inv:invCot, csgd:csgdCot, csgnd:csgndCot, cfp:cfpCot }
  const bases = { mal1:malBase1, mal2:malBase2, ij:ijBase, af:sb, ret1:retBase1, ret2:retBase2, retc1:retcBase1, retc2:retcBase2, inv:invBase, csgd:sb, csgnd:sb, cfp:PASS }
  const taux = { mal1:malTaux1, mal2:0.065, ij:0.005, af:afTaux, ret1:0.1787, ret2:0.0072, retc1:0.081, retc2:0.091, inv:0.013, csgd:0.068, csgnd:0.029, cfp:0.0025 }
  const totalAVerser = Object.values(cots).reduce((a, b) => a + b, 0)
  return { sb, totalBase, totalAVerser, case1gb: remun + csgndCot, caseDsca: malCot1+malCot2+ijCot+afCot+retCot1+retCot2+retcCot1+retcCot2+invCot, cots, bases, taux }
}

function computeAll(remun, div, comptValues, T) {
  const totalCompt = Object.values(comptValues).reduce((a, b) => a + b, 0)
  // Calcul itératif : B4 = D26 (cotisations à verser), convergence en ~20 itérations
  let result = computeOnce(remun, div, totalCompt, T)
  for (let i = 0; i < 100; i++) {
    const next = computeOnce(remun, div, result.totalAVerser, T)
    if (Math.abs(next.totalAVerser - result.totalAVerser) < 0.01) { result = next; break }
    result = next
  }
  return { ...result, totalCompt, totalBase: remun + div + result.totalAVerser }
}

function CotisTable({ rows, cots, bases, taux, compt, setCompt, totalAVerser, totalCompt, totalProv, showTotal, styles }) {
  const ids = Object.keys(rows)
  const subtotalAVerser = ids.reduce((s, id) => s + cots[id], 0)
  const subtotalCompt = ids.reduce((s, id) => s + compt[id], 0)
  const subtotalProv = subtotalAVerser - subtotalCompt
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Libellé</th>
            <th className={styles.right}>Base</th>
            <th className={styles.right}>Taux</th>
            <th className={styles.right}>À verser</th>
            <th className={styles.right}>Comptabilisé</th>
            <th className={styles.right}>Provision</th>
          </tr>
        </thead>
        <tbody>
          {ids.map(id => {
            const prov = cots[id] - compt[id]
            return (
              <tr key={id}>
                <td>{rows[id]}</td>
                <td className={styles.right}>{Math.round(bases[id]).toLocaleString('fr-FR')} €</td>
                <td className={styles.right}>{(taux[id]*100).toFixed(2)}%</td>
                <td className={styles.right}>{Math.round(cots[id]).toLocaleString('fr-FR')} €</td>
                <td className={styles.right}>
                  <input
                    className={styles.comptInput}
                    type="number"
                    value={compt[id]}
                    onChange={e => setCompt(prev => ({ ...prev, [id]: parseFloat(e.target.value) || 0 }))}
                  />
                </td>
                <td className={prov < 0 ? styles.red : styles.green}>
                  {Math.round(prov).toLocaleString('fr-FR')} €
                </td>
              </tr>
            )
          })}
          {showTotal && (
            <tr className={styles.totalRow}>
              <td colSpan={3}>Total</td>
              <td className={styles.right}>{Math.round(totalAVerser).toLocaleString('fr-FR')} €</td>
              <td className={styles.right}>{Math.round(totalCompt).toLocaleString('fr-FR')} €</td>
              <td className={totalProv < 0 ? styles.red : styles.green}>{Math.round(totalProv).toLocaleString('fr-FR')} €</td>
            </tr>
          )}
          {!showTotal && (
            <tr className={styles.totalRow}>
              <td colSpan={3}>Sous-total</td>
              <td className={styles.right}>{Math.round(subtotalAVerser).toLocaleString('fr-FR')} €</td>
              <td className={styles.right}>{Math.round(subtotalCompt).toLocaleString('fr-FR')} €</td>
              <td className={subtotalProv < 0 ? styles.red : styles.green}>{Math.round(subtotalProv).toLocaleString('fr-FR')} €</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function Tab1({ remun, div, setRemun, setDiv, compt, setCompt, regime, tauxDB }) {
  const { sb, totalBase, totalCompt, totalAVerser, case1gb, caseDsca, cots, bases, taux } = computeAll(remun, div, compt, tauxDB)
  const totalProv = totalAVerser - totalCompt

  return (
    <div>
      <div className={styles.inputsCard}>
        <div className={styles.inputRow}>
          <label className={styles.inputLabel}>Base rémunération</label>
          <div className={styles.inputField}>
            <input type="number" value={remun} onChange={e => setRemun(parseFloat(e.target.value) || 0)} />
            <span>€</span>
          </div>
        </div>
        <div className={styles.inputRow}>
          <label className={styles.inputLabel}>Dividende</label>
          <div className={styles.inputField}>
            <input type="number" value={div} onChange={e => setDiv(parseFloat(e.target.value) || 0)} />
            <span>€</span>
          </div>
        </div>
      </div>

      <div className={styles.metricsGrid}>
        <div className={styles.metric}>
          <div className={styles.metricLabel}>Cotisations comptabilisées</div>
          <div className={`${styles.metricValue} ${styles.blue}`}>{fmt(totalCompt)}</div>
        </div>
        <div className={styles.metric}>
          <div className={styles.metricLabel}>Total base (rémun + cot)</div>
          <div className={styles.metricValue}>{fmt(totalBase)}</div>
        </div>
        <div className={styles.metric}>
          <div className={styles.metricLabel}>Revenu super brut</div>
          <div className={styles.metricValue}>{fmt(sb)}</div>
        </div>
        <div className={styles.metric}>
          <div className={styles.metricLabel}>Cotisations à verser</div>
          <div className={`${styles.metricValue} ${styles.red}`}>{fmt(totalAVerser)}</div>
        </div>
      </div>

      <div className={styles.sectionTitle}>Détail des cotisations</div>
      <CotisTable
        rows={regime === 'URSSAF CAVEC' ? ROW_LABELS_RSI : ROW_LABELS_URSSAF}
        cots={cots} bases={bases} taux={taux} compt={compt} setCompt={setCompt}
        totalAVerser={totalAVerser} totalCompt={totalCompt} totalProv={totalProv}
        showTotal={regime !== 'URSSAF CAVEC'}
        styles={styles}
      />
      {regime === 'URSSAF CAVEC' && (
        <>
          <div className={styles.sectionTitle} style={{marginTop: '1.5rem'}}>Cotisations CAVEC</div>
          <CotisTable
            rows={ROW_LABELS_CAVEC}
            cots={cots} bases={bases} taux={taux} compt={compt} setCompt={setCompt}
            totalAVerser={totalAVerser} totalCompt={totalCompt} totalProv={totalProv}
            showTotal={true}
            styles={styles}
          />
        </>
      )}

      <div className={styles.divider} />

      <div className={styles.sectionTitle}>Données déclaratives</div>
      <div className={styles.caseGrid}>
        <div className={styles.caseItem}><div className={styles.caseLabel}>RAPPEL PASS</div><div className={styles.caseValue}>{fmt(PASS)}</div></div>
        <div className={styles.caseItem}><div className={styles.caseLabel}>CASE 1GB</div><div className={styles.caseValue}>{fmt(case1gb)}</div></div>
        <div className={styles.caseItem}><div className={styles.caseLabel}>CASE DSCA</div><div className={styles.caseValue}>{fmt(caseDsca)}</div></div>
        <div className={styles.caseItem}><div className={styles.caseLabel}>COCHER CASE DSAE</div><div className={styles.caseValue}>X</div></div>
      </div>
    </div>
  )
}

function Tab2({ regime, tauxDB, setTauxDB }) {
  const [localTaux, setLocalTaux] = useState(null)
  const [pending, setPending] = useState({})   // valeurs modifiées pas encore sauvées
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchTaux().then(rows => {
      const map = {}
      rows.forEach(r => { map[r.id] = { ...r, taux: parseFloat(r.taux) } })
      setLocalTaux(map)
      // Mettre à jour tauxDB parent avec les vrais taux de la base
      const t = {}
      rows.forEach(r => { t[r.id] = parseFloat(r.taux) })
      setTauxDB(prev => ({ ...prev, ...t }))
    })
  }, [])

  const handleChange = (id, val) => {
    const num = parseFloat(val)
    if (isNaN(num)) return
    setLocalTaux(prev => ({ ...prev, [id]: { ...prev[id], taux: num } }))
    setPending(prev => ({ ...prev, [id]: num }))
  }

  const handleValider = async (id) => {
    const num = pending[id]
    if (num === undefined) return
    setSaving(true)
    await updateTaux(id, num)
    setTauxDB(prev => ({ ...prev, [id]: num }))
    setPending(prev => { const n = { ...prev }; delete n[id]; return n })
    setSaving(false)
  }

  if (!localTaux) return <div style={{padding:'2rem', color:'var(--text-secondary)'}}>Chargement des taux...</div>

  const allRows = Object.values(localTaux).filter(r => r.id !== 'mal1')
  const rsiRows = allRows.filter(r => !['ret1','ret2','retc1','retc2','inv'].includes(r.id))
  const cavecRows = allRows.filter(r => ['ret1','ret2','retc1','retc2','inv'].includes(r.id))
  const displayRows = regime === 'URSSAF CAVEC' ? rsiRows : allRows

  const TauxRow = ({ row }) => {
    const isDirty = pending[row.id] !== undefined
    return (
      <tr>
        <td>{row.label}</td>
        <td>{row.base}</td>
        <td className={styles.right}>
          <div style={{display:'flex', alignItems:'center', gap:'6px', justifyContent:'flex-end'}}>
            <input
              className={styles.comptInput}
              type="number"
              step="0.01"
              value={row.taux}
              onChange={e => handleChange(row.id, e.target.value)}
              style={{width:'80px', borderColor: isDirty ? 'var(--blue)' : undefined}}
            />
            <span style={{fontSize:'12px', color:'var(--text-muted)', minWidth:'14px'}}>%</span>
            {isDirty && (
              <button
                onClick={() => handleValider(row.id)}
                disabled={saving}
                style={{
                  fontSize:'11px', fontWeight:'500', padding:'3px 8px',
                  background:'var(--blue)', color:'white', border:'none',
                  borderRadius:'4px', cursor:'pointer', whiteSpace:'nowrap'
                }}
              >
                {saving ? '...' : 'Valider'}
              </button>
            )}
          </div>
        </td>
      </tr>
    )
  }

  const RefTable = ({ rows }) => (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead><tr><th>Cotisation</th><th>Base de cotisation</th><th className={styles.right}>Taux</th></tr></thead>
        <tbody>
          <tr><td>Maladie</td><td>En fonction du revenu (progressif)</td><td className={styles.right}>—</td></tr>
          {rows.map(row => <TauxRow key={row.id} row={row} />)}
        </tbody>
      </table>
    </div>
  )

  return (
    <div>
      <div className={styles.refSection}>
        <div className={styles.sectionTitle}>Paramètres généraux</div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Paramètre</th><th>Base de calcul</th><th className={styles.right}>Taux / Valeur</th></tr></thead>
            <tbody>
              <tr><td>PASS</td><td>—</td><td className={styles.right}>47 100 €</td></tr>
              <tr><td>Abattement</td><td>—</td><td className={styles.right}>26,00%</td></tr>
              <tr><td>Plafond abattement</td><td>130% PASS</td><td className={styles.right}>130,00%</td></tr>
              <tr><td>Plancher abattement</td><td>1,76% PASS</td><td className={styles.right}>1,76%</td></tr>
            </tbody>
          </table>
        </div>
      </div>
      <div className={styles.refSection}>
        <div className={styles.sectionTitle}>Taux de cotisation par type</div>
        <RefTable rows={displayRows} />
      </div>
      {regime === 'URSSAF CAVEC' && (
        <div className={styles.refSection}>
          <div className={styles.sectionTitle}>Cotisations CAVEC</div>
          <RefTable rows={cavecRows} />
        </div>
      )}
      <div className={styles.refSection}>
        <div className={styles.sectionTitle}>Barème progressif maladie</div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Tranche de revenu</th><th className={styles.right}>Taux cotisation maladie</th></tr></thead>
            <tbody>
              <tr><td>&lt; 20% PASS (&lt; 9 420 €)</td><td className={styles.right}>0,00%</td></tr>
              <tr><td>&gt; 20% PASS et &lt; 40% PASS</td><td className={styles.right}>1,50% (progressif)</td></tr>
              <tr><td>&gt; 40% PASS et &lt; 60% PASS</td><td className={styles.right}>4,00% (progressif)</td></tr>
              <tr><td>&gt; 60% PASS et &lt; 110% PASS</td><td className={styles.right}>6,50% (progressif)</td></tr>
              <tr><td>&gt; 110% PASS et &lt; 200% PASS</td><td className={styles.right}>7,70% (progressif)</td></tr>
              <tr><td>&gt; 200% PASS et &lt; 300% PASS</td><td className={styles.right}>8,50%</td></tr>
              <tr><td>&gt; 300% PASS (235 500 €)</td><td className={styles.right}>6,50% (palier supérieur)</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}


export default function App() {
  const [page, setPage] = useState('home')
  const [dossier, setDossier] = useState('')
  const [regime, setRegime] = useState('')
  const [activeTab, setActiveTab] = useState(0)
  const [remun, setRemun] = useState(30000)
  const [div, setDiv] = useState(0)
  const [compt, setCompt] = useState({ ...DEFAULT_COMPT })
  const [tauxDB, setTauxDB] = useState({ ...DEFAULT_TAUX_DB })

  useEffect(() => {
    fetchTaux().then(rows => {
      const map = {}
      rows.forEach(r => { map[r.id] = parseFloat(r.taux) })
      setTauxDB(prev => ({ ...prev, ...map }))
    })
  }, [])

  if (page === 'home') {
    return <HomePage onStart={(d, r) => { setDossier(d); setRegime(r); setPage('app') }} />
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Régularisation URSSAF 2025</h1>
            <div className={styles.headerMeta}>
              <span className={styles.metaItem}>{dossier}</span>
              <span className={styles.metaDot}>·</span>
              <span className={styles.metaItem}>{regime}</span>
            </div>
          </div>
          <button className={styles.backBtn} onClick={() => setPage('home')}>← Retour</button>
        </div>
        <div className={styles.card}>
          <div className={styles.tabs}>
            {['Cotisations TNS — Rémunération RSI', 'Rappel bases de cotisation'].map((t, i) => (
              <button key={i} className={`${styles.tab} ${activeTab === i ? styles.tabActive : ''}`} onClick={() => setActiveTab(i)}>{t}</button>
            ))}
          </div>
          <div className={styles.tabContent}>
            {activeTab === 0
              ? <Tab1 remun={remun} div={div} setRemun={setRemun} setDiv={setDiv} compt={compt} setCompt={setCompt} regime={regime} tauxDB={tauxDB} />
              : <Tab2 regime={regime} tauxDB={tauxDB} setTauxDB={setTauxDB} />}
          </div>
        </div>
      </div>
    </div>
  )
}





