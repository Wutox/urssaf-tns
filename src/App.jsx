import { useState } from 'react'
import './index.css'
import styles from './App.module.css'

const PASS = 47100
const ABATTEMENT = 0.26
const PLAFOND_ABT = 1.3
const PLANCHER_ABT = 0.0176

const DEFAULT_COMPT = {
  mal1: 3863, mal2: 0, ij: 288, af: 738,
  ret1: 8360, retc1: 3072, retc2: 1101,
  inv: 612, csgd: 4851, csgnd: 2069, cfp: 118,
}

const ROW_LABELS = {
  mal1:  'Maladie (≤ 235 500 €)',
  mal2:  'Maladie (> 235 500 €)',
  ij:    'IJ',
  af:    'AF',
  ret1:  'Retraite base (≤ PASS)',
  retc1: 'Retraite compl. (≤ PASS)',
  retc2: 'Retraite compl. (1–4 PASS)',
  inv:   'Invalidité',
  csgd:  'CSG déductible',
  csgnd: 'CSG non déductible',
  cfp:   'CFP',
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

function computeOnce(remun, div, cotisB4) {
  const totalBase = remun + div + cotisB4
  let abt = totalBase * ABATTEMENT
  if (abt > PASS * PLAFOND_ABT) abt = PASS * PLAFOND_ABT
  if (abt < PASS * PLANCHER_ABT) abt = PASS * PLANCHER_ABT
  const sb = totalBase - abt

  const malBase1 = sb > PASS*5 ? PASS*5 : sb
  const malTaux1 = getMaladieTaux(sb)
  const malCot1  = malBase1 * malTaux1
  const malBase2 = sb > PASS*3 ? sb - PASS*3 : 0
  const malCot2  = malBase2 * 0.065
  const ijBase = sb < PASS*0.4 ? PASS*0.4 : (sb > PASS*5 ? PASS*5 : sb)
  const ijCot  = ijBase * 0.005
  const afTaux = getAFTaux(remun)
  const afCot  = sb * afTaux
  const retBase1 = sb < PASS*0.1135 ? PASS*0.1135 : (sb > PASS ? PASS : sb)
  const retCot1  = retBase1 * 0.1787
  const retcBase1 = sb > PASS ? PASS : sb
  const retcCot1  = retcBase1 * 0.081
  const retcBase2 = sb > PASS*4 ? PASS*3 : (sb > PASS ? sb - PASS : 0)
  const retcCot2  = retcBase2 * 0.091
  const invBase = sb < PASS*0.115 ? PASS*0.115 : (sb > PASS ? PASS : sb)
  const invCot  = invBase * 0.013
  const csgdCot  = sb * 0.068
  const csgndCot = sb * 0.029
  const cfpCot   = PASS * 0.0025

  const cots = { mal1:malCot1, mal2:malCot2, ij:ijCot, af:afCot, ret1:retCot1, retc1:retcCot1, retc2:retcCot2, inv:invCot, csgd:csgdCot, csgnd:csgndCot, cfp:cfpCot }
  const bases = { mal1:malBase1, mal2:malBase2, ij:ijBase, af:sb, ret1:retBase1, retc1:retcBase1, retc2:retcBase2, inv:invBase, csgd:sb, csgnd:sb, cfp:PASS }
  const taux = { mal1:malTaux1, mal2:0.065, ij:0.005, af:afTaux, ret1:0.1787, retc1:0.081, retc2:0.091, inv:0.013, csgd:0.068, csgnd:0.029, cfp:0.0025 }
  const totalAVerser = Object.values(cots).reduce((a, b) => a + b, 0)
  return { sb, totalBase, totalAVerser, case1gb: remun + csgndCot, caseDsca: malCot1+malCot2+ijCot+afCot+retCot1+retcCot1+retcCot2+invCot, cots, bases, taux }
}

function computeAll(remun, div, comptValues) {
  const totalCompt = Object.values(comptValues).reduce((a, b) => a + b, 0)
  // Calcul itératif : B4 = D26 (cotisations à verser), convergence en ~20 itérations
  let result = computeOnce(remun, div, totalCompt)
  for (let i = 0; i < 100; i++) {
    const next = computeOnce(remun, div, result.totalAVerser)
    if (Math.abs(next.totalAVerser - result.totalAVerser) < 0.01) { result = next; break }
    result = next
  }
  return { ...result, totalCompt, totalBase: remun + div + result.totalAVerser }
}

function Tab1({ remun, div, setRemun, setDiv, compt, setCompt }) {
  const { sb, totalBase, totalCompt, totalAVerser, case1gb, caseDsca, cots, bases, taux } = computeAll(remun, div, compt)
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
            {Object.keys(ROW_LABELS).map(id => {
              const prov = cots[id] - compt[id]
              return (
                <tr key={id}>
                  <td>{ROW_LABELS[id]}</td>
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
            <tr className={styles.totalRow}>
              <td colSpan={3}>Total</td>
              <td className={styles.right}>{Math.round(totalAVerser).toLocaleString('fr-FR')} €</td>
              <td className={styles.right}>{Math.round(totalCompt).toLocaleString('fr-FR')} €</td>
              <td className={totalProv < 0 ? styles.red : styles.green}>{Math.round(totalProv).toLocaleString('fr-FR')} €</td>
            </tr>
          </tbody>
        </table>
      </div>

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

function Tab2() {
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
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Cotisation</th><th>Base de cotisation</th><th className={styles.right}>Taux</th></tr></thead>
            <tbody>
              <tr><td>Maladie</td><td>En fonction du revenu (progressif)</td><td className={styles.right}>—</td></tr>
              <tr><td>Maladie (&gt; 5 PASS)</td><td>Supérieur à 5 × PASS</td><td className={styles.right}>6,50%</td></tr>
              <tr><td>IJ</td><td>Revenu dans la limite de 5 × PASS</td><td className={styles.right}>0,50%</td></tr>
              <tr><td>AF</td><td>Total rémunération</td><td className={styles.right}>3,10%</td></tr>
              <tr><td>Retraite base</td><td>PASS (minimum 40% PASS)</td><td className={styles.right}>17,87%</td></tr>
              <tr><td>Retraite complémentaire</td><td>PASS</td><td className={styles.right}>8,10%</td></tr>
              <tr><td>Retraite complémentaire</td><td>4 × PASS − 1 × PASS</td><td className={styles.right}>9,10%</td></tr>
              <tr><td>Invalidité</td><td>PASS</td><td className={styles.right}>1,30%</td></tr>
              <tr><td>CSG déductible</td><td>Total rémunération + cotisations</td><td className={styles.right}>6,80%</td></tr>
              <tr><td>CSG non déductible</td><td>Total rémunération + cotisations</td><td className={styles.right}>2,90%</td></tr>
              <tr><td>CFP</td><td>PASS</td><td className={styles.right}>0,25%</td></tr>
            </tbody>
          </table>
        </div>
      </div>
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
  const [activeTab, setActiveTab] = useState(0)
  const [remun, setRemun] = useState(30000)
  const [div, setDiv] = useState(0)
  const [compt, setCompt] = useState({ ...DEFAULT_COMPT })

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>Régularisation URSSAF TNS 2025</h1>
        </div>
        <div className={styles.card}>
          <div className={styles.tabs}>
            {['Cotisations TNS — Rémunération RSI', 'Rappel bases de cotisation'].map((t, i) => (
              <button key={i} className={`${styles.tab} ${activeTab === i ? styles.tabActive : ''}`} onClick={() => setActiveTab(i)}>{t}</button>
            ))}
          </div>
          <div className={styles.tabContent}>
            {activeTab === 0
              ? <Tab1 remun={remun} div={div} setRemun={setRemun} setDiv={setDiv} compt={compt} setCompt={setCompt} />
              : <Tab2 />}
          </div>
        </div>
      </div>
    </div>
  )
}



