import React, { useEffect, useMemo, useState } from "react";

type TxType = "expense" | "income";
type Tx = { id: string; type: TxType; amount: number; date: string; description: string };

const APP = "Tu Control Financiero";
const PIN_KEY = "tcf_pin";
const TX_KEY = "tcf_tx";
const BUDGET_KEY = "tcf_budget";
const NOTIFY_KEY = "tcf_notify";
const THRESHOLDS = [75, 90, 100] as const;

/* ---------- Helpers seguros ---------- */
function safeParse<T>(raw: string | null, fallback: T): T {
  try {
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function todayISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}
function ym(dateISO: string): string {
  return (dateISO || todayISO()).slice(0, 7);
}
function readNumber(key: string, def = 0): number {
  const v = Number(localStorage.getItem(key) || "0");
  return Number.isFinite(v) ? v : def;
}
function write(key: string, value: any) {
  localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
}

/* ---------- Estilos simples ---------- */
const pageBox: React.CSSProperties = { padding: 16, maxWidth: 520, margin: "0 auto" };
const card: React.CSSProperties = { background: "#fff", borderRadius: 8, padding: 12, boxShadow: "0 1px 4px rgba(0,0,0,.08)", margin: "12px 0" };
const row: React.CSSProperties = { display: "flex", gap: 8, alignItems: "center" };
const input: React.CSSProperties = { flex: 1, height: 36, border: "1px solid #ddd", borderRadius: 6, padding: "0 10px" };
const btn: React.CSSProperties = { height: 36, padding: "0 14px", border: "0", borderRadius: 6, background: "#3b82f6", color: "#fff", cursor: "pointer" };
const spacer = (h: number): React.CSSProperties => ({ height: h });

export default function App() {
  /* ---------- Auth / PIN ---------- */
  const [auth, setAuth] = useState(false);
  const [pin, setPin] = useState("");
  const [newPin, setNewPin] = useState("");

  /* ---------- Presupuesto & formulario ---------- */
  const [budget, setBudget] = useState<number>(0);
  const [type, setType] = useState<TxType>("expense");
  const [amount, setAmount] = useState<number>(0);
  const [desc, setDesc] = useState("");
  const [date, setDate] = useState<string>(todayISO());
  const [snack, setSnack] = useState<string>("");

  /* ---------- Lista segura desde storage ---------- */
  const items = useMemo<Tx[]>(
    () => safeParse<Tx[]>(localStorage.getItem(TX_KEY), []),
    [auth, snack] // se recalcula cuando autenticás o guardás
  );

  /* ---------- Carga inicial segura ---------- */
  useEffect(() => {
    setBudget(readNumber(BUDGET_KEY, 0));
    // Si había PIN guardado, pedimos login
    setAuth(!localStorage.getItem(PIN_KEY)); // true si no hay PIN (primera vez)
  }, []);

  /* ---------- Util ---------- */
  function vibrate(ms = 40) {
    try {
      if ("vibrate" in navigator) (navigator as any).vibrate([ms]);
    } catch {}
  }
  function toast(msg: string) {
    setSnack(msg);
    vibrate(60);
    setTimeout(() => setSnack(""), 2000);
  }

  /* ---------- Auth handlers ---------- */
  function savePin() {
    if (newPin.length < 4) return toast("El PIN debe tener al menos 4 dígitos");
    write(PIN_KEY, newPin);
    setNewPin("");
    setAuth(true);
    toast("PIN guardado");
  }
  function login() {
    const saved = localStorage.getItem(PIN_KEY) || "";
    if (!saved) return toast("Primero define un PIN");
    if (pin === saved) {
      setPin("");
      setAuth(true);
      toast("Bienvenido");
    } else {
      toast("PIN incorrecto");
    }
  }

  /* ---------- Guardados ---------- */
  function saveBudget() {
    const v = Number(amount);
    if (!Number.isFinite(v) || v <= 0) return toast("Presupuesto inválido");
    write(BUDGET_KEY, v.toString());
    setBudget(v);
    setAmount(0);
    toast("Presupuesto actualizado");
  }

  function saveTx() {
    const v = Number(amount);
    if (!Number.isFinite(v) || v <= 0) return toast("Monto inválido");
    if (!desc.trim()) return toast("Descripción requerida");
    const d = date || todayISO();
    const next: Tx = {
      id: `${Date.now()}`,
      type,
      amount: v,
      date: d,
      description: desc.trim(),
    };
    const nextList = [next, ...items].slice(0, 2000);
    write(TX_KEY, nextList);
    setAmount(0);
    setDesc("");
    setDate(todayISO());
    toast("Movimiento guardado");
  }

  /* ---------- Métricas rápidas ---------- */
  const month = ym(todayISO());
  const monthItems = items.filter((t) => ym(t.date) === month);
  const spent = monthItems.filter((t) => t.type === "expense").reduce((a, b) => a + b.amount, 0);
  const earned = monthItems.filter((t) => t.type === "income").reduce((a, b) => a + b.amount, 0);
  const net = earned - spent;
  const pct = budget > 0 ? Math.round((spent / budget) * 100) : 0;

  /* ---------- Aviso (opcional) ---------- */
  useEffect(() => {
    const last = Number(localStorage.getItem(NOTIFY_KEY) || "0");
    if (budget > 0 && pct >= THRESHOLDS[0] && Date.now() - last > 3 * 60 * 60 * 1000) {
      toast(`Atención: llevas gastado ${pct}% del presupuesto del mes`);
      write(NOTIFY_KEY, Date.now().toString());
    }
  }, [pct, budget]);

  /* ---------- UI ---------- */
  if (!auth) {
    const hasPin = !!localStorage.getItem(PIN_KEY);
    return (
      <div style={pageBox}>
        <h2>{APP} – Acceso</h2>
        {!hasPin ? (
          <div style={card}>
            <div>Configurar PIN (mín. 4 dígitos)</div>
            <div style={spacer(8)} />
            <div style={row}>
              <input style={input} type="password" placeholder="Nuevo PIN" value={newPin} onChange={(e) => setNewPin(e.target.value)} />
              <button style={btn} onClick={savePin}>Guardar PIN</button>
            </div>
          </div>
        ) : (
          <div style={card}>
            <div>Ingresar PIN</div>
            <div style={spacer(8)} />
            <div style={row}>
              <input style={input} type="password" placeholder="PIN" value={pin} onChange={(e) => setPin(e.target.value)} />
              <button style={btn} onClick={login}>Entrar</button>
            </div>
          </div>
        )}
        {snack && <div style={{ marginTop: 8, color: "#2563eb" }}>{snack}</div>}
      </div>
    );
  }

  return (
    <div style={pageBox}>
      <h2>{APP}</h2>

      {/* Presupuesto */}
      <div style={card}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Presupuesto del mes (PYG)</div>
        <div style={row}>
          <input
            style={input}
            type="number"
            placeholder="Gs"
            value={amount || ""}
            onChange={(e) => setAmount(Number(e.target.value))}
          />
          <button style={btn} onClick={saveBudget}>Guardar presupuesto</button>
        </div>
        <div style={{ marginTop: 8, fontSize: 14, color: "#555" }}>
          Presupuesto: {budget.toLocaleString("es-PY")} — Gastado: {spent.toLocaleString("es-PY")} ({pct}%)
        </div>
      </div>

      {/* Movimiento */}
      <div style={card}>
        <div style={row}>
          {(["expense", "income"] as TxType[]).map((t) => (
            <button
              key={t}
              style={{ ...btn, background: t === "expense" ? "#ef4444" : "#10b981" }}
              onClick={() => setType(t)}
            >
              {t === "expense" ? "Gasto" : "Ingreso"}
            </button>
          ))}
        </div>
        <div style={spacer(8)} />
        <div style={row}>
          <input
            style={input}
            type="number"
            placeholder="Monto"
            value={amount || ""}
            onChange={(e) => setAmount(Number(e.target.value))}
          />
        </div>
        <div style={spacer(8)} />
        <div style={row}>
          <input
            style={input}
            placeholder="Descripción"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
          />
        </div>
        <div style={spacer(8)} />
        <div style={row}>
          <input
            style={input}
            type="date"
            value={date}
            max={todayISO()}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div style={spacer(8)} />
        <button style={btn} onClick={saveTx}>Guardar movimiento</button>
      </div>

      {/* Lista */}
      <div style={card}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Últimos movimientos</div>
        {items.length === 0 ? (
          <div style={{ opacity: 0.6, fontSize: 14 }}>Sin movimientos este mes.</div>
        ) : (
          items.slice(0, 20).map((t) => (
            <div key={t.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderTop: "1px solid rgba(0,0,0,.08)" }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{t.description}</div>
              <div style={{ fontSize: 14 }}>
                {t.type === "income" ? "+" : "-"}
                {t.amount.toLocaleString("es-PY")}
                {" · "}
                {t.date}
              </div>
            </div>
          ))
        )}
        <div style={{ marginTop: 8, fontSize: 14 }}>
          <strong>PYG neto:</strong> {net.toLocaleString("es-PY")}
        </div>
      </div>

      {snack && <div style={{ marginTop: 8, color: "#2563eb" }}>{snack}</div>}
    </div>
  );
}
