import React, { useMemo, useState } from 'react'

type TxType = 'expense'|'income'
type Tx = { id:string; type:TxType; amount:number; date:string; description:string }

const APP = 'Tu Control Financiero'
const PIN_KEY = 'tcf_pin'
const TX_KEY = 'tcf_tx'
const BUDGET_KEY = (ym:string)=>`budget_${ym}`
const NOTIFY_KEY = (ym:string)=>`notify_${ym}`
const THRESHOLDS = [75,90,100] as const

function todayISO(){ const d=new Date(); const z=d.getTimezoneOffset()*60000; return new Date(d.getTime()-z).toISOString().slice(0,10) }
function ym(dateISO:string){ return dateISO.slice(0,7) }
function vibrate(){ try{ (navigator as any).vibrate && (navigator as any).vibrate([80]) }catch{} }

export default function App(){
  const [auth,setAuth]=useState(false)
  const [pin,setPin]=useState('')
  const [newPin,setNewPin]=useState('')

  const [amount,setAmount]=useState('')
  const [desc,setDesc]=useState('')
  const [date,setDate]=useState(todayISO())
  const [type,setType]=useState<TxType>('expense')

  const [budget,setBudget]=useState<number>(()=>Number(localStorage.getItem(BUDGET_KEY(ym(todayISO())))||'0'))
  import type { CSSProperties } from 'react'; // asegurate que esté arriba del archivo

const [snackCss, setSnackCss] = useState<CSSProperties | undefined>(undefined);

  const [snackCls,setSnackCls]=useState<string>('background:black;color:white')

  const items:Tx[] = useMemo(()=> JSON.parse(localStorage.getItem(TX_KEY)||'[]'), [auth, snack])

  // Auth
  const hasPin = !!localStorage.getItem(PIN_KEY)
  function savePin(){ if(newPin.length<4){ setSnack('El PIN debe tener al menos 4 dígitos'); return } localStorage.setItem(PIN_KEY,newPin); setSnack('PIN guardado'); setAuth(true) }
  function login(){ const s=localStorage.getItem(PIN_KEY); if(pin===s){ setAuth(true); setSnack('Bienvenido') } else setSnack('PIN incorrecto') }

  // Budget
  function saveBudget(){ localStorage.setItem(BUDGET_KEY(ym(todayISO())), String(budget||0)); setSnack('Presupuesto guardado') }

  // Save TX
  function saveTx(){
    const n = parseFloat((amount||'').replace(',','.'))
    if(!n || n<=0){ setSnack('Monto inválido'); return }
    const tx:Tx = { id:crypto.randomUUID(), type, amount:n, date, description:desc }
    const list:Tx[] = JSON.parse(localStorage.getItem(TX_KEY)||'[]')
    list.unshift(tx); localStorage.setItem(TX_KEY, JSON.stringify(list))
    setAmount(''); setDesc('')
    if(tx.type==='expense') checkThresholds(date)
    setSnack((type==='income'?'Ingreso':'Gasto')+' guardado')
  }

  function checkThresholds(dISO:string){
    const key = ym(dISO)
    const b = Number(localStorage.getItem(BUDGET_KEY(key))||'0')
    if(!b) return
    const list:Tx[] = JSON.parse(localStorage.getItem(TX_KEY)||'[]')
    const total = list.filter(t=>t.type==='expense' && ym(t.date)===key).reduce((s,t)=>s+t.amount,0)
    const pct = Math.floor(total/b*100)
    const last = Number(localStorage.getItem(NOTIFY_KEY(key))||'0')
    let level:number|null=null
    for(const th of THRESHOLDS){ if(pct>=th && th>last) level=th }
    if(level===null) return
    if(level>=100){ setSnack('¡Presupuesto superado! Revisá tus gastos.'); setSnackCls('background:#dc2626;color:white') }
    else if(level>=90){ setSnack('Cuidado: estás por pasarte del presupuesto.'); setSnackCls('background:#ea580c;color:white') }
    else { setSnack('Atención: ya usaste gran parte de tu presupuesto este mes.'); setSnackCls('background:#f59e0b;color:black') }
    localStorage.setItem(NOTIFY_KEY(key), String(level))
    vibrate(); setTimeout(()=>setSnack(null),3000)
  }

  const month = ym(todayISO())
  const list:Tx[] = items.filter(t=> ym(t.date)===month)
  const income = list.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0)
  const expense = list.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0)
  const pct = budget>0 ? Math.min(100, Math.round(expense/budget*100)) : 0

  if(!auth){
    return (
      <div style={{padding:'16px',maxWidth:520,margin:'0 auto'}}>
        <h2>{APP} — Acceso</h2>
        {!hasPin? (
          <div className="card">
            <div>Configurar PIN (mín. 4 dígitos)</div>
            <input className="input" type="password" inputMode="numeric" placeholder="Nuevo PIN" value={newPin} onChange={e=>setNewPin(e.target.value)} />
            <div style={{height:8}}/>
            <button className="btn primary" onClick={savePin}>Guardar PIN</button>
          </div>
        ):(
          <div className="card">
            <div>Ingresar PIN</div>
            <input className="input" type="password" inputMode="numeric" placeholder="PIN" value={pin} onChange={e=>setPin(e.target.value)} />
            <div style={{height:8}}/>
            <button className="btn primary" onClick={login}>Entrar</button>
          </div>
        )}
        {snack && <div className="snack" style={snackCss ?? {}}
>{snack}</div>}
      </div>
    )
  }

  return (
    <div style={{padding:'16px',maxWidth:520,margin:'0 auto'}}>
      <h2>{APP} — Demo de Alertas</h2>

      <div className="card">
        <div>Presupuesto del mes (PYG)</div>
        <div className="row">
          <input className="input" type="number" value={budget} onChange={e=>setBudget(Number(e.target.value))} placeholder="Gs" />
          <button className="btn primary" onClick={saveBudget}>Guardar</button>
        </div>
        <div style={{height:8}}/>
        <div style={{height:8, background:'hsl(0 0% 80% / .4)', borderRadius:999}}>
          <div style={{width:`${pct}%`,height:8, borderRadius:999, background: pct>=100?'#dc2626': pct>=90?'#ea580c': pct>=75?'#f59e0b':'#10b981'}}/>
        </div>
        <div style={{fontSize:12,opacity:.8, marginTop:6}}>Gastado: {Math.round(expense).toLocaleString('es-PY')} PYG {budget>0?`(${pct}% del presupuesto)`:'(sin presupuesto)'}</div>
      </div>

      <div style={{height:12}}/>

      <div className="card">
        <div className="row">
          {(['expense','income'] as TxType[]).map(t=>(
            <button key={t} className={'btn '+(type===t?'primary':'')} onClick={()=>setType(t)}>{t==='expense'?'Gasto':'Ingreso'}</button>
          ))}
        </div>
        <div style={{height:8}}/>
        <div>Monto (PYG)</div>
        <input className="input" inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} />
        <div style={{height:8}}/>
        <div>Descripción</div>
        <input className="input" value={desc} onChange={e=>setDesc(e.target.value)} />
        <div style={{height:8}}/>
        <div>Fecha</div>
        <input className="input" type="date" value={date} max={todayISO()} onChange={e=>setDate(e.target.value)} />
        <div style={{height:12}}/>
        <button className="btn primary" onClick={saveTx}>Guardar movimiento</button>
      </div>

      <div style={{height:12}}/>

      <div className="card">
        <div style={{fontWeight:600, marginBottom:8}}>Últimos movimientos</div>
        {list.length===0? <div style={{opacity:.6,fontSize:14}}>Sin movimientos este mes.</div>:
          list.slice(0,20).map(t=>(
            <div key={t.id} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderTop:'1px solid hsl(0 0% 80% / .3)'}}>
              <div>
                <div style={{fontSize:14,fontWeight:600}}>{t.description||'(sin descripción)'}</div>
                <div style={{fontSize:12,opacity:.7}}>{t.type==='income'?'Ingreso':'Gasto'} • {t.date}</div>
              </div>
              <div style={{textAlign:'right',fontSize:14,fontWeight:700,color:t.type==='income'?'#059669':'#dc2626'}}>
                {(t.type==='income'?'+':'-')}{t.amount.toLocaleString('es-PY')} PYG
              </div>
            </div>
          ))
        }
      </div>

      {snack && <div className="snack" style={snackCss ?? {}}
>{snack}</div>}
    </div>
  )
}
