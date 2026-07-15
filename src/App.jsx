import { useState, useEffect } from "react";
import { storage } from "./storage.js";
import * as XLSX from "xlsx";

/* ------------------------------------------------------------------ */
/*  InternDesk — a lightweight HRIS for student interns                */
/*  Roles: HR admin (adds interns, reviews filings) and Intern         */
/*  (clocks in/out, files leave, lodges concerns).                     */
/* ------------------------------------------------------------------ */

/* Feature switches — flip internLeaveFiling to true to restore leave filing for interns. */
const FEATURES = { internLeaveFiling: false };
const LOGO_SQUARE = import.meta.env.BASE_URL + "logo-square.jpg";
const LOGO_WIDE = import.meta.env.BASE_URL + "logo-horizontal.jpg";

const T = {
  blue: "#3E7CE0",
  bg: "#EEF1F4",
  surface: "#FFFFFF",
  ink: "#16233A",
  muted: "#64748B",
  faint: "#93A0B4",
  border: "#DFE4EA",
  green: "#0E7C66",
  greenSoft: "#E2F2EE",
  red: "#C1443C",
  redSoft: "#F9E9E7",
  amber: "#B97E00",
  amberSoft: "#FBF1DA",
  navySoft: "#E7ECF3",
};

const FONT_LINK = "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap";
const DISPLAY = "'Space Grotesk', system-ui, sans-serif";
const BODY = "'IBM Plex Sans', system-ui, sans-serif";
const MONO = "'IBM Plex Mono', ui-monospace, monospace";

const LEAVE_TYPES = ["Sick leave", "Academic (exams / requirements)", "Personal", "Emergency", "Other"];
const CONCERN_CATS = ["Workload", "Supervisor / mentor", "Schedule", "Facilities / equipment", "Allowance / stipend", "Harassment or safety", "Other"];

const uid = () => Math.random().toString(36).slice(2, 10);
const todayKey = () => new Date().toISOString().slice(0, 10);
const fmtTime = (iso) => (iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—");
const fmtDate = (d) => new Date(d + (d.length === 10 ? "T00:00:00" : "")).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });

/* ---------------------------- storage ----------------------------- */

async function loadKey(key, fallback) {
  try {
    const r = await storage.get(key);
    return r ? JSON.parse(r.value) : fallback;
  } catch {
    return fallback;
  }
}
async function saveKey(key, value) {
  try {
    await storage.set(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

const SEED_ADMIN = {
  id: "admin-1",
  role: "admin",
  name: "HR Administrator",
  email: "philhr@new-wave.com.au",
  password: "admin123",
  active: true,
};

/* ---------------------------- shared UI --------------------------- */

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 12px",
  border: `1px solid ${T.border}`,
  borderRadius: 8,
  fontFamily: BODY,
  fontSize: 14,
  color: T.ink,
  background: "#FDFDFC",
  outline: "none",
};

function Field({ label, children }) {
  return (
    <label style={{ display: "block", marginBottom: 12 }}>
      <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: T.muted, marginBottom: 5, letterSpacing: "0.02em" }}>{label}</span>
      {children}
    </label>
  );
}

function Btn({ children, kind = "primary", ...props }) {
  const styles = {
    primary: { background: T.ink, color: "#fff", border: "1px solid " + T.ink },
    green: { background: T.green, color: "#fff", border: "1px solid " + T.green },
    blue: { background: T.blue, color: "#fff", border: "1px solid " + T.blue },
    red: { background: T.red, color: "#fff", border: "1px solid " + T.red },
    ghost: { background: "transparent", color: T.ink, border: `1px solid ${T.border}` },
  }[kind];
  return (
    <button
      {...props}
      style={{
        ...styles,
        padding: "9px 16px",
        borderRadius: 8,
        fontFamily: BODY,
        fontSize: 14,
        fontWeight: 600,
        cursor: props.disabled ? "not-allowed" : "pointer",
        opacity: props.disabled ? 0.5 : 1,
        ...props.style,
      }}
    >
      {children}
    </button>
  );
}

function Badge({ status }) {
  const map = {
    Pending: { bg: T.amberSoft, fg: T.amber },
    Approved: { bg: T.greenSoft, fg: T.green },
    Denied: { bg: T.redSoft, fg: T.red },
    Open: { bg: T.amberSoft, fg: T.amber },
    Resolved: { bg: T.greenSoft, fg: T.green },
    Active: { bg: T.greenSoft, fg: T.green },
    Deactivated: { bg: T.redSoft, fg: T.red },
  }[status] || { bg: T.navySoft, fg: T.muted };
  return (
    <span style={{ background: map.bg, color: map.fg, fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 99, letterSpacing: "0.03em", whiteSpace: "nowrap" }}>
      {status}
    </span>
  );
}

function Card({ title, right, children, style }) {
  return (
    <section style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20, ...style }}>
      {(title || right) && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontFamily: DISPLAY, fontSize: 16, color: T.ink }}>{title}</h3>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

function Empty({ text }) {
  return <p style={{ color: T.faint, fontSize: 13, margin: "6px 0", fontStyle: "italic" }}>{text}</p>;
}

/* ---------------------------- punch card --------------------------- */

function PunchCard({ user, attendance, onPunch, busy }) {
  const rec = attendance.find((a) => a.userId === user.id && a.date === todayKey());
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const state = !rec ? "in" : !rec.timeOut ? "out" : "done";

  return (
    <div
      style={{
        background: "#FFFDF6",
        border: `1px solid ${T.border}`,
        borderRadius: 12,
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* perforated edge */}
      <div style={{ height: 10, background: `repeating-linear-gradient(90deg, ${T.bg} 0 8px, transparent 8px 20px)`, borderBottom: `1px dashed ${T.border}` }} />
      <div style={{ padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: "0.14em", color: T.faint, fontWeight: 600 }}>DAILY TIME RECORD</div>
            <div style={{ fontFamily: DISPLAY, fontSize: 18, color: T.ink, marginTop: 2 }}>{user.name}</div>
          </div>
          <div style={{ fontFamily: MONO, fontSize: 22, color: T.ink, fontWeight: 600 }}>
            {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </div>
        </div>

        <div style={{ display: "flex", gap: 24, margin: "18px 0", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 11, color: T.faint, fontWeight: 600, letterSpacing: "0.08em" }}>TIME IN</div>
            <div style={{ fontFamily: MONO, fontSize: 20, fontWeight: 600, color: rec?.timeIn ? T.green : T.faint }}>{fmtTime(rec?.timeIn)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: T.faint, fontWeight: 600, letterSpacing: "0.08em" }}>TIME OUT</div>
            <div style={{ fontFamily: MONO, fontSize: 20, fontWeight: 600, color: rec?.timeOut ? T.red : T.faint }}>{fmtTime(rec?.timeOut)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: T.faint, fontWeight: 600, letterSpacing: "0.08em" }}>DATE</div>
            <div style={{ fontFamily: MONO, fontSize: 20, fontWeight: 600, color: T.ink }}>{fmtDate(todayKey())}</div>
          </div>
        </div>

        {state === "in" && <Btn kind="green" disabled={busy} onClick={() => onPunch("in")}>Clock in</Btn>}
        {state === "out" && <Btn kind="red" disabled={busy} onClick={() => onPunch("out")}>Clock out</Btn>}
        {state === "done" && (
          <div style={{ display: "inline-block", border: `2px solid ${T.green}`, color: T.green, fontFamily: MONO, fontWeight: 600, fontSize: 13, padding: "6px 12px", borderRadius: 6, transform: "rotate(-2deg)" }}>
            SHIFT COMPLETE
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------- main app ----------------------------- */

export default function App() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [users, setUsers] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [concerns, setConcerns] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [tab, setTab] = useState("home");
  const [toast, setToast] = useState(null);

  const me = users.find((u) => u.id === sessionId) || null;

  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = FONT_LINK;
    document.head.appendChild(link);
  }, []);

  useEffect(() => {
    (async () => {
      let u = await loadKey("hris:users", null);
      if (!u || !u.length) {
        u = [SEED_ADMIN];
        await saveKey("hris:users", u);
      } else if (u.some((x) => x.email === "admin@company.com")) {
        /* one-time migration: admin email changed to philhr@new-wave.com.au */
        u = u.map((x) => (x.email === "admin@company.com" ? { ...x, email: "philhr@new-wave.com.au" } : x));
        await saveKey("hris:users", u);
      }
      setUsers(u);
      setAttendance(await loadKey("hris:attendance", []));
      setLeaves(await loadKey("hris:leaves", []));
      setConcerns(await loadKey("hris:concerns", []));
      try {
        const s = await storage.get("hris:session");
        if (s) setSessionId(JSON.parse(s.value));
      } catch {}
      setLoading(false);
    })();
  }, []);

  const notify = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };

  async function persist(kind, next) {
    setBusy(true);
    const setters = { users: setUsers, attendance: setAttendance, leaves: setLeaves, concerns: setConcerns };
    setters[kind](next);
    const ok = await saveKey("hris:" + kind, next);
    if (!ok) notify("Couldn't save — check your connection and try again.");
    setBusy(false);
    return ok;
  }

  async function login(email, password) {
    const u = users.find((x) => x.email.toLowerCase() === email.trim().toLowerCase() && x.password === password);
    if (!u) return "Email or password doesn't match any account.";
    if (u.active === false) return "This account has been deactivated. Contact HR.";
    setSessionId(u.id);
    setTab("home");
    try { await storage.set("hris:session", JSON.stringify(u.id)); } catch {}
    return null;
  }

  async function logout() {
    setSessionId(null);
    try { await storage.delete("hris:session"); } catch {}
  }

  async function changePassword(userId, newPassword) {
    const next = users.map((u) => (u.id === userId ? { ...u, password: newPassword, pwChangedAt: new Date().toISOString() } : u));
    if (await persist("users", next)) {
      notify("Password updated.");
      return true;
    }
    return false;
  }

  /* The seeded admin ships with a known default password — force a change before use. */
  const mustChangePassword = me && me.email === "philhr@new-wave.com.au" && me.password === "admin123";

  async function punch(kind) {
    const key = todayKey();
    let next;
    if (kind === "in") {
      next = [...attendance, { id: uid(), userId: me.id, date: key, timeIn: new Date().toISOString(), timeOut: null }];
    } else {
      next = attendance.map((a) => (a.userId === me.id && a.date === key ? { ...a, timeOut: new Date().toISOString() } : a));
    }
    if (await persist("attendance", next)) notify(kind === "in" ? "Clocked in — have a good shift." : "Clocked out. See you tomorrow!");
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, display: "grid", placeItems: "center", fontFamily: BODY, color: T.muted }}>
        Opening InternDesk…
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: BODY, color: T.ink }}>
      {toast && (
        <div style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", background: T.ink, color: "#fff", padding: "10px 18px", borderRadius: 10, fontSize: 13, zIndex: 50, boxShadow: "0 6px 20px rgba(22,35,58,.25)" }}>
          {toast}
        </div>
      )}
      {!me ? (
        <LoginScreen onLogin={login} />
      ) : mustChangePassword ? (
        <ForcePasswordChange me={me} onChange={changePassword} onLogout={logout} />
      ) : (
        <Shell me={me} tab={tab} setTab={setTab} onLogout={logout} onChangePassword={changePassword}>
          {me.role === "admin" ? (
            <AdminView tab={tab} users={users} attendance={attendance} leaves={leaves} concerns={concerns} persist={persist} notify={notify} busy={busy} />
          ) : (
            <InternView tab={tab} me={me} attendance={attendance} leaves={leaves} concerns={concerns} persist={persist} punch={punch} notify={notify} busy={busy} />
          )}
        </Shell>
      )}
    </div>
  );
}

/* ---------------------------- login -------------------------------- */

function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState(null);

  async function submit() {
    setErr(null);
    const e = await onLogin(email, password);
    if (e) setErr(e);
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <img src={LOGO_SQUARE} alt="Freedom Outsourcing" style={{ width: 150, height: 150, objectFit: "contain" }} />
          <h1 style={{ fontFamily: DISPLAY, fontSize: 28, margin: "4px 0 4px" }}>Freedom Outsourcing</h1>
          <p style={{ color: T.muted, fontSize: 14, margin: 0 }}>Intern HRIS — time records and concerns.</p>
        </div>
        <Card>
          <Field label="Email">
            <input style={inputStyle} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" onKeyDown={(e) => e.key === "Enter" && submit()} />
          </Field>
          <Field label="Password">
            <input style={inputStyle} type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
          </Field>
          {err && <p style={{ color: T.red, fontSize: 13, margin: "0 0 10px" }}>{err}</p>}
          <Btn kind="blue" style={{ width: "100%" }} onClick={submit}>Sign in</Btn>
          <p style={{ fontSize: 12, color: T.faint, marginTop: 14, marginBottom: 0, textAlign: "center" }}>
            No account yet? Ask HR to set one up for you.
          </p>
        </Card>
      </div>
    </div>
  );
}

/* ------------------------ password screens ------------------------- */

function PasswordFields({ onSubmit, submitLabel, requireCurrent, currentPassword }) {
  const [cur, setCur] = useState("");
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState(null);

  async function submit() {
    setErr(null);
    if (requireCurrent && cur !== currentPassword) return setErr("Current password is incorrect.");
    if (pw1.length < 8) return setErr("New password must be at least 8 characters.");
    if (pw1 === "admin123") return setErr("Pick something other than the default password.");
    if (pw1 !== pw2) return setErr("The two entries don't match.");
    const ok = await onSubmit(pw1);
    if (ok) { setCur(""); setPw1(""); setPw2(""); }
  }

  return (
    <>
      {requireCurrent && (
        <Field label="Current password">
          <input style={inputStyle} type="password" value={cur} onChange={(e) => setCur(e.target.value)} />
        </Field>
      )}
      <Field label="New password">
        <input style={inputStyle} type="password" value={pw1} onChange={(e) => setPw1(e.target.value)} placeholder="At least 8 characters" />
      </Field>
      <Field label="Confirm new password">
        <input style={inputStyle} type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
      </Field>
      {err && <p style={{ color: T.red, fontSize: 13, margin: "0 0 10px" }}>{err}</p>}
      <Btn kind="blue" style={{ width: "100%" }} onClick={submit}>{submitLabel}</Btn>
    </>
  );
}

function ForcePasswordChange({ me, onChange, onLogout }) {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <img src={LOGO_SQUARE} alt="Freedom Outsourcing" style={{ width: 110, height: 110, objectFit: "contain" }} />
          <h1 style={{ fontFamily: DISPLAY, fontSize: 22, margin: "6px 0 4px" }}>Set a new admin password</h1>
          <p style={{ color: T.muted, fontSize: 13, margin: 0 }}>This account is still using the default password. Choose a new one to continue.</p>
        </div>
        <Card>
          <PasswordFields submitLabel="Save new password" onSubmit={(pw) => onChange(me.id, pw)} />
          <button onClick={onLogout} style={{ background: "none", border: "none", color: T.faint, fontSize: 12, cursor: "pointer", marginTop: 12, width: "100%", fontFamily: BODY }}>Sign out instead</button>
        </Card>
      </div>
    </div>
  );
}

/* ---------------------------- shell -------------------------------- */

function Shell({ me, tab, setTab, onLogout, onChangePassword, children }) {
  const [showPw, setShowPw] = useState(false);
  const tabs =
    me.role === "admin"
      ? [["home", "Overview"], ["interns", "Interns"], ["leaves", "Leave requests"], ["concerns", "Concerns"], ["attendance", "Attendance"]]
      : [["home", "My day"], ...(FEATURES.internLeaveFiling ? [["leave", "File leave"]] : []), ["concern", "Lodge concern"], ["records", "My records"]];

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: "20px 16px 60px" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img src={LOGO_WIDE} alt="Freedom Outsourcing" style={{ height: 40, objectFit: "contain" }} />
          <span style={{ fontFamily: MONO, fontSize: 11, color: T.blue, fontWeight: 600, letterSpacing: "0.1em" }}>
            {me.role === "admin" ? "HR CONSOLE" : "INTERN"}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, color: T.muted }}>{me.name}</span>
          <Btn kind="ghost" onClick={() => setShowPw(true)} style={{ padding: "7px 12px", fontSize: 13 }}>Change password</Btn>
          <Btn kind="ghost" onClick={onLogout} style={{ padding: "7px 14px" }}>Sign out</Btn>
        </div>
      </header>

      {showPw && (
        <div onClick={() => setShowPw(false)} style={{ position: "fixed", inset: 0, background: "rgba(22,35,58,.45)", display: "grid", placeItems: "center", zIndex: 40, padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 380 }}>
            <Card title="Change password" right={<button onClick={() => setShowPw(false)} style={{ background: "none", border: "none", fontSize: 18, color: T.muted, cursor: "pointer" }}>×</button>}>
              <PasswordFields
                requireCurrent
                currentPassword={me.password}
                submitLabel="Update password"
                onSubmit={async (pw) => { const ok = await onChangePassword(me.id, pw); if (ok) setShowPw(false); return ok; }}
              />
            </Card>
          </div>
        </div>
      )}

      <nav style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
        {tabs.map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            style={{
              padding: "8px 14px",
              borderRadius: 99,
              border: `1px solid ${tab === k ? T.ink : T.border}`,
              background: tab === k ? T.ink : T.surface,
              color: tab === k ? "#fff" : T.muted,
              fontFamily: BODY,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {label}
          </button>
        ))}
      </nav>
      {children}
    </div>
  );
}

/* ---------------------------- intern views ------------------------- */

function InternView({ tab, me, attendance, leaves, concerns, persist, punch, notify, busy }) {
  const myLeaves = leaves.filter((l) => l.userId === me.id).sort((a, b) => b.filedAt.localeCompare(a.filedAt));
  const myConcerns = concerns.filter((c) => c.userId === me.id).sort((a, b) => b.filedAt.localeCompare(a.filedAt));
  const myAttendance = attendance.filter((a) => a.userId === me.id).sort((a, b) => b.date.localeCompare(a.date));

  if (tab === "home") {
    return (
      <div style={{ display: "grid", gap: 16 }}>
        <PunchCard user={me} attendance={attendance} onPunch={punch} busy={busy} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
          {FEATURES.internLeaveFiling && <Card title="Pending leave requests">
            {myLeaves.filter((l) => l.status === "Pending").length === 0 ? (
              <Empty text="Nothing pending. File leave from the tab above when you need it." />
            ) : (
              myLeaves.filter((l) => l.status === "Pending").map((l) => (
                <div key={l.id} style={{ fontSize: 13, padding: "8px 0", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span>{l.type} · {fmtDate(l.from)} → {fmtDate(l.to)}</span>
                  <Badge status={l.status} />
                </div>
              ))
            )}
          </Card>}
          <Card title="Open concerns">
            {myConcerns.filter((c) => c.status === "Open").length === 0 ? (
              <Empty text="No open concerns. If something's off, lodge it — HR reads every one." />
            ) : (
              myConcerns.filter((c) => c.status === "Open").map((c) => (
                <div key={c.id} style={{ fontSize: 13, padding: "8px 0", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span>{c.subject}</span>
                  <Badge status={c.status} />
                </div>
              ))
            )}
          </Card>
        </div>
      </div>
    );
  }

  if (tab === "leave") return <LeaveForm me={me} leaves={leaves} persist={persist} notify={notify} busy={busy} myLeaves={myLeaves} />;
  if (tab === "concern") return <ConcernForm me={me} concerns={concerns} persist={persist} notify={notify} busy={busy} myConcerns={myConcerns} />;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Card title="My attendance">
        {myAttendance.length === 0 ? <Empty text="No time records yet. Clock in from My day to start your first one." /> : (
          <Table
            head={["Date", "Time in", "Time out"]}
            rows={myAttendance.map((a) => [fmtDate(a.date), fmtTime(a.timeIn), fmtTime(a.timeOut)])}
          />
        )}
      </Card>
      {FEATURES.internLeaveFiling && <Card title="My leave history">
        {myLeaves.length === 0 ? <Empty text="No leave filed yet." /> : (
          <Table
            head={["Filed", "Type", "Dates", "Status"]}
            rows={myLeaves.map((l) => [fmtDate(l.filedAt.slice(0, 10)), l.type, `${fmtDate(l.from)} → ${fmtDate(l.to)}`, <Badge key={l.id} status={l.status} />])}
          />
        )}
      </Card>}
      <Card title="My concerns">
        {myConcerns.length === 0 ? <Empty text="No concerns lodged yet." /> : (
          <Table
            head={["Filed", "Category", "Subject", "Status"]}
            rows={myConcerns.map((c) => [fmtDate(c.filedAt.slice(0, 10)), c.category, c.subject, <Badge key={c.id} status={c.status} />])}
          />
        )}
      </Card>
    </div>
  );
}

function LeaveForm({ me, leaves, persist, notify, busy, myLeaves }) {
  const [type, setType] = useState(LEAVE_TYPES[0]);
  const [from, setFrom] = useState(todayKey());
  const [to, setTo] = useState(todayKey());
  const [reason, setReason] = useState("");
  const [err, setErr] = useState(null);

  async function submit() {
    setErr(null);
    if (!from || !to) return setErr("Pick both a start and end date.");
    if (to < from) return setErr("End date can't be before the start date.");
    if (!reason.trim()) return setErr("Add a short reason so HR can act on it.");
    const next = [...leaves, { id: uid(), userId: me.id, type, from, to, reason: reason.trim(), status: "Pending", filedAt: new Date().toISOString() }];
    if (await persist("leaves", next)) {
      setReason("");
      notify("Leave request filed. HR will review it.");
    }
  }

  return (
    <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
      <Card title="File a leave request">
        <Field label="Leave type">
          <select style={inputStyle} value={type} onChange={(e) => setType(e.target.value)}>
            {LEAVE_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="From"><input style={inputStyle} type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="To"><input style={inputStyle} type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        </div>
        <Field label="Reason">
          <textarea style={{ ...inputStyle, minHeight: 80, resize: "vertical" }} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g., Final exams on these dates" />
        </Field>
        {err && <p style={{ color: T.red, fontSize: 13, margin: "0 0 10px" }}>{err}</p>}
        <Btn kind="green" disabled={busy} onClick={submit}>File leave request</Btn>
      </Card>
      <Card title="Recent filings">
        {myLeaves.length === 0 ? <Empty text="Your filed requests will appear here with their status." /> : (
          myLeaves.slice(0, 6).map((l) => (
            <div key={l.id} style={{ padding: "10px 0", borderBottom: `1px solid ${T.border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13, fontWeight: 600 }}>
                <span>{l.type}</span><Badge status={l.status} />
              </div>
              <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{fmtDate(l.from)} → {fmtDate(l.to)} · {l.reason}</div>
              {l.note && <div style={{ fontSize: 12, color: T.amber, marginTop: 2 }}>HR note: {l.note}</div>}
            </div>
          ))
        )}
      </Card>
    </div>
  );
}

function ConcernForm({ me, concerns, persist, notify, busy, myConcerns }) {
  const [category, setCategory] = useState(CONCERN_CATS[0]);
  const [subject, setSubject] = useState("");
  const [details, setDetails] = useState("");
  const [err, setErr] = useState(null);

  async function submit() {
    setErr(null);
    if (!subject.trim()) return setErr("Give your concern a short subject line.");
    if (!details.trim()) return setErr("Describe what happened so HR can help.");
    const next = [...concerns, { id: uid(), userId: me.id, category, subject: subject.trim(), details: details.trim(), status: "Open", filedAt: new Date().toISOString() }];
    if (await persist("concerns", next)) {
      setSubject(""); setDetails("");
      notify("Concern lodged. HR has been notified.");
    }
  }

  return (
    <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
      <Card title="Lodge a concern">
        <Field label="Category">
          <select style={inputStyle} value={category} onChange={(e) => setCategory(e.target.value)}>
            {CONCERN_CATS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Subject">
          <input style={inputStyle} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="One line summary" />
        </Field>
        <Field label="Details">
          <textarea style={{ ...inputStyle, minHeight: 100, resize: "vertical" }} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="What happened, when, and who's involved (if relevant)" />
        </Field>
        {err && <p style={{ color: T.red, fontSize: 13, margin: "0 0 10px" }}>{err}</p>}
        <Btn kind="green" disabled={busy} onClick={submit}>Lodge concern</Btn>
      </Card>
      <Card title="Your lodged concerns">
        {myConcerns.length === 0 ? <Empty text="Concerns you lodge show up here so you can track their status." /> : (
          myConcerns.slice(0, 6).map((c) => (
            <div key={c.id} style={{ padding: "10px 0", borderBottom: `1px solid ${T.border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13, fontWeight: 600 }}>
                <span>{c.subject}</span><Badge status={c.status} />
              </div>
              <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{c.category} · {fmtDate(c.filedAt.slice(0, 10))}</div>
              {c.resolution && <div style={{ fontSize: 12, color: T.green, marginTop: 2 }}>HR: {c.resolution}</div>}
            </div>
          ))
        )}
      </Card>
    </div>
  );
}

/* ---------------------------- admin views -------------------------- */

function AdminView({ tab, users, attendance, leaves, concerns, persist, notify, busy }) {
  const [dtrFrom, setDtrFrom] = useState("");
  const [dtrTo, setDtrTo] = useState("");
  const interns = users.filter((u) => u.role === "intern");
  const nameOf = (id) => users.find((u) => u.id === id)?.name || "Unknown";

  const hoursOf = (a) => (a.timeIn && a.timeOut ? ((new Date(a.timeOut) - new Date(a.timeIn)) / 3600000).toFixed(2) : "");
  const filteredAtt = attendance
    .filter((a) => (!dtrFrom || a.date >= dtrFrom) && (!dtrTo || a.date <= dtrTo))
    .sort((a, b) => a.date.localeCompare(b.date) || nameOf(a.userId).localeCompare(nameOf(b.userId)));

  function exportDTR() {
    if (filteredAtt.length === 0) return notify("No records in that date range to export.");
    const rows = filteredAtt.map((a) => ({
      Date: a.date,
      Intern: nameOf(a.userId),
      "Time In": fmtTime(a.timeIn),
      "Time Out": fmtTime(a.timeOut),
      "Hours Rendered": hoursOf(a),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{ wch: 12 }, { wch: 26 }, { wch: 10 }, { wch: 10 }, { wch: 14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "DTR");
    const label = `${dtrFrom || "start"}_to_${dtrTo || "today"}`;
    XLSX.writeFile(wb, `Freedom_Outsourcing_DTR_${label}.xlsx`);
    notify("DTR exported to Excel.");
  }

  if (tab === "home") {
    const stats = [
      ["Interns", interns.filter((i) => i.active !== false).length],
      ["Clocked in today", attendance.filter((a) => a.date === todayKey() && !a.timeOut).length],
      ["Pending leaves", leaves.filter((l) => l.status === "Pending").length],
      ["Open concerns", concerns.filter((c) => c.status === "Open").length],
    ];
    return (
      <div style={{ display: "grid", gap: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
          {stats.map(([label, n]) => (
            <div key={label} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: "16px 18px" }}>
              <div style={{ fontFamily: MONO, fontSize: 28, fontWeight: 600, color: T.ink }}>{n}</div>
              <div style={{ fontSize: 12, color: T.muted, fontWeight: 600 }}>{label}</div>
            </div>
          ))}
        </div>
        <Card title="Today's attendance">
          {attendance.filter((a) => a.date === todayKey()).length === 0 ? <Empty text="No one has clocked in yet today." /> : (
            <Table
              head={["Intern", "Time in", "Time out"]}
              rows={attendance.filter((a) => a.date === todayKey()).map((a) => [nameOf(a.userId), fmtTime(a.timeIn), fmtTime(a.timeOut)])}
            />
          )}
        </Card>
      </div>
    );
  }

  if (tab === "interns") return <ManageInterns users={users} interns={interns} persist={persist} notify={notify} busy={busy} />;

  if (tab === "leaves") {
    const sorted = [...leaves].sort((a, b) => b.filedAt.localeCompare(a.filedAt));
    async function decide(id, status) {
      const next = leaves.map((l) => (l.id === id ? { ...l, status } : l));
      if (await persist("leaves", next)) notify(`Leave request ${status.toLowerCase()}.`);
    }
    return (
      <Card title="Leave requests">
        {sorted.length === 0 ? <Empty text="No leave requests filed yet." /> : sorted.map((l) => (
          <div key={l.id} style={{ padding: "12px 0", borderBottom: `1px solid ${T.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{nameOf(l.userId)} — {l.type}</div>
                <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{fmtDate(l.from)} → {fmtDate(l.to)} · {l.reason}</div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <Badge status={l.status} />
                {l.status === "Pending" && (
                  <>
                    <Btn kind="green" disabled={busy} style={{ padding: "6px 12px", fontSize: 12 }} onClick={() => decide(l.id, "Approved")}>Approve</Btn>
                    <Btn kind="red" disabled={busy} style={{ padding: "6px 12px", fontSize: 12 }} onClick={() => decide(l.id, "Denied")}>Deny</Btn>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </Card>
    );
  }

  if (tab === "concerns") {
    const sorted = [...concerns].sort((a, b) => b.filedAt.localeCompare(a.filedAt));
    async function resolve(id) {
      const note = prompt("Add a short resolution note for the intern (optional):") || "";
      const next = concerns.map((c) => (c.id === id ? { ...c, status: "Resolved", resolution: note } : c));
      if (await persist("concerns", next)) notify("Concern marked resolved.");
    }
    return (
      <Card title="Lodged concerns">
        {sorted.length === 0 ? <Empty text="No concerns lodged. Quiet is good." /> : sorted.map((c) => (
          <div key={c.id} style={{ padding: "12px 0", borderBottom: `1px solid ${T.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <div style={{ maxWidth: "70%" }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{c.subject}</div>
                <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{nameOf(c.userId)} · {c.category} · {fmtDate(c.filedAt.slice(0, 10))}</div>
                <div style={{ fontSize: 13, marginTop: 6 }}>{c.details}</div>
                {c.resolution && <div style={{ fontSize: 12, color: T.green, marginTop: 4 }}>Resolution: {c.resolution}</div>}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <Badge status={c.status} />
                {c.status === "Open" && <Btn kind="green" disabled={busy} style={{ padding: "6px 12px", fontSize: 12 }} onClick={() => resolve(c.id)}>Resolve</Btn>}
              </div>
            </div>
          </div>
        ))}
      </Card>
    );
  }

  /* attendance tab */
  return (
    <Card
      title="Daily time records"
      right={<Btn kind="blue" disabled={busy} style={{ padding: "7px 14px", fontSize: 13 }} onClick={exportDTR}>Export to Excel</Btn>}
    >
      <div style={{ display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap", marginBottom: 14 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: T.muted }}>
          From<br />
          <input style={{ ...inputStyle, width: 160, marginTop: 4 }} type="date" value={dtrFrom} onChange={(e) => setDtrFrom(e.target.value)} />
        </label>
        <label style={{ fontSize: 12, fontWeight: 600, color: T.muted }}>
          To<br />
          <input style={{ ...inputStyle, width: 160, marginTop: 4 }} type="date" value={dtrTo} onChange={(e) => setDtrTo(e.target.value)} />
        </label>
        {(dtrFrom || dtrTo) && <Btn kind="ghost" style={{ padding: "8px 14px", fontSize: 13 }} onClick={() => { setDtrFrom(""); setDtrTo(""); }}>Clear filter</Btn>}
        <span style={{ fontSize: 12, color: T.faint, paddingBottom: 10 }}>{filteredAtt.length} record{filteredAtt.length === 1 ? "" : "s"}</span>
      </div>
      {filteredAtt.length === 0 ? <Empty text="No time records in this range." /> : (
        <Table head={["Date", "Intern", "Time in", "Time out", "Hours"]} rows={filteredAtt.map((a) => [fmtDate(a.date), nameOf(a.userId), fmtTime(a.timeIn), fmtTime(a.timeOut), hoursOf(a)])} />
      )}
    </Card>
  );
}

function ManageInterns({ users, interns, persist, notify, busy }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [school, setSchool] = useState("");
  const [dept, setDept] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState(null);

  async function addIntern() {
    setErr(null);
    if (!name.trim() || !email.trim() || !password.trim()) return setErr("Name, email, and a starting password are required.");
    if (users.some((u) => u.email.toLowerCase() === email.trim().toLowerCase())) return setErr("That email is already registered.");
    const next = [...users, { id: uid(), role: "intern", name: name.trim(), email: email.trim(), school: school.trim(), dept: dept.trim(), password, active: true, addedAt: new Date().toISOString() }];
    if (await persist("users", next)) {
      setName(""); setEmail(""); setSchool(""); setDept(""); setPassword("");
      notify("Intern account created. Share their login details with them.");
    }
  }

  async function resetPassword(id, name) {
    const pw = prompt(`New password for ${name} (at least 8 characters):`);
    if (pw === null) return;
    if (pw.length < 8) return notify("Password not changed — it must be at least 8 characters.");
    const next = users.map((u) => (u.id === id ? { ...u, password: pw, pwChangedAt: new Date().toISOString() } : u));
    if (await persist("users", next)) notify(`Password reset for ${name}. Share it with them securely.`);
  }

  async function toggleActive(id) {
    const next = users.map((u) => (u.id === id ? { ...u, active: u.active === false } : u));
    if (await persist("users", next)) notify("Account status updated.");
  }

  return (
    <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
      <Card title="Add an intern">
        <Field label="Full name"><input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="Juan Dela Cruz" /></Field>
        <Field label="Email"><input style={inputStyle} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="juan@school.edu.ph" /></Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="School"><input style={inputStyle} value={school} onChange={(e) => setSchool(e.target.value)} /></Field>
          <Field label="Department"><input style={inputStyle} value={dept} onChange={(e) => setDept(e.target.value)} /></Field>
        </div>
        <Field label="Starting password"><input style={inputStyle} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="They can be given this to sign in" /></Field>
        {err && <p style={{ color: T.red, fontSize: 13, margin: "0 0 10px" }}>{err}</p>}
        <Btn kind="green" disabled={busy} onClick={addIntern}>Create intern account</Btn>
      </Card>
      <Card title={`Intern roster (${interns.length})`}>
        {interns.length === 0 ? <Empty text="No interns yet. Add your first one on the left." /> : interns.map((i) => (
          <div key={i.id} style={{ padding: "10px 0", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{i.name}</div>
              <div style={{ fontSize: 12, color: T.muted }}>{i.email}{i.dept ? ` · ${i.dept}` : ""}{i.school ? ` · ${i.school}` : ""}</div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Badge status={i.active === false ? "Deactivated" : "Active"} />
              <Btn kind="ghost" disabled={busy} style={{ padding: "6px 12px", fontSize: 12 }} onClick={() => resetPassword(i.id, i.name)}>Reset password</Btn>
              <Btn kind="ghost" disabled={busy} style={{ padding: "6px 12px", fontSize: 12 }} onClick={() => toggleActive(i.id)}>
                {i.active === false ? "Reactivate" : "Deactivate"}
              </Btn>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

/* ---------------------------- table -------------------------------- */

function Table({ head, rows }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h} style={{ textAlign: "left", padding: "8px 10px", color: T.faint, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", borderBottom: `1px solid ${T.border}` }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((cell, j) => (
                <td key={j} style={{ padding: "9px 10px", borderBottom: `1px solid ${T.border}`, fontFamily: j > 0 && typeof cell === "string" && cell.includes(":") ? MONO : BODY }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
