import { useState, useEffect, useCallback, useRef } from "react";
import { auth, db } from "./firebase";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
 
const XP_TABLE = Array.from({ length: 100 }, (_, i) => Math.floor(100 * Math.pow(1.15, i)));
const DIFFICULTY = {
  Easy:   { xp: 15, color: "#22c55e", label: "EASY", stat: 1 },
  Medium: { xp: 35, color: "#f59e0b", label: "MED",  stat: 2 },
  Hard:   { xp: 75, color: "#ef4444", label: "HARD", stat: 3 },
};
const CATEGORIES = {
  Health:  { icon: "🏃", stat: "strength",    color: "#ef4444", bg: "#fef2f2" },
  Wealth:  { icon: "💰", stat: "charisma",     color: "#f59e0b", bg: "#fffbeb" },
  Mindset: { icon: "🧠", stat: "intelligence", color: "#8b5cf6", bg: "#f5f3ff" },
  Skill:   { icon: "⚡", stat: "discipline",   color: "#0ea5e9", bg: "#f0f9ff" },
};
const STREAK_MILESTONES = [3, 7, 14, 21, 30, 60, 90];
const STREAK_BONUS = { 3: 50, 7: 150, 14: 300, 21: 500, 30: 1000, 60: 2500, 90: 5000 };
const BADGES = [
  { id: "first_step",   name: "First Step",    icon: "👣", desc: "Complete your first habit",  check: (s) => s.totalCompleted >= 1 },
  { id: "week_warrior", name: "Week Warrior",   icon: "🔥", desc: "7-day streak",               check: (s) => s.maxStreak >= 7 },
  { id: "no_excuses",   name: "No Excuses",     icon: "🦁", desc: "30-day streak",              check: (s) => s.maxStreak >= 30 },
  { id: "centurion",    name: "Centurion",      icon: "⚔️", desc: "100 habits completed",       check: (s) => s.totalCompleted >= 100 },
  { id: "polymatch",    name: "Polymath",       icon: "📚", desc: "All 4 categories active",   check: (s) => s.categoryCoverage >= 4 },
  { id: "xp_hoarder",  name: "XP Hoarder",     icon: "💎", desc: "Earn 10,000 XP",             check: (s) => s.totalXp >= 10000 },
  { id: "level10",      name: "Adept",          icon: "🔮", desc: "Reach Level 10",              check: (s) => s.level >= 10 },
];
const QUESTS = [
  { id: "q1", name: "30-Day Discipline", icon: "🔥", desc: "30-day streak on any habit",  goal: 30,   type: "streak",  reward: 2000 },
  { id: "q2", name: "XP Hunter",         icon: "⚡", desc: "Earn 5000 XP from habits",    goal: 5000, type: "xp",      reward: 1500 },
  { id: "q3", name: "Habit Builder",     icon: "🏗️", desc: "Complete 5 different habits", goal: 5,    type: "variety", reward: 600  },
  { id: "q4", name: "5AM Club",          icon: "🌅", desc: "Complete 7 habits in a row",  goal: 7,    type: "morning", reward: 500  },
];
const TITLES = ["Novice","Apprentice","Journeyman","Adept","Expert","Master","Grand Master","Legend","Mythic","Divine"];
const AVATARS = ["🧙","🧝","🦸","🧜","🦹","🐉","🧚","🧛","🧞","🌟"];
const getTitle = (lvl) => TITLES[Math.min(Math.floor(lvl / 11), TITLES.length - 1)];
 
const todayStr = () => new Date().toDateString();
const getLevelFromXP = (xp) => {
  let lvl = 1, acc = 0;
  for (let i = 0; i < 99; i++) { acc += XP_TABLE[i]; if (xp >= acc) lvl = i + 2; else break; }
  return Math.min(lvl, 100);
};
const getXPForLevel = (lvl) => { let t = 0; for (let i = 0; i < lvl - 1; i++) t += XP_TABLE[i]; return t; };
const uid = () => Math.random().toString(36).slice(2, 10);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
// const hashPw = (pw) => btoa(encodeURIComponent(pw + "hq_salt_zak_2025"));
 
// const USERS_KEY = "hq_users_v2";
const SESSION_KEY = "hq_session_v2";
const getUsers = () => { try { return JSON.parse(localStorage.getItem(USERS_KEY) || "{}"); } catch { return {}; } };
// const saveUsers = (u) => localStorage.setItem(USERS_KEY, JSON.stringify(u));
// const getSession = () => { try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); } catch { return null; } };
const saveSession = (s) => localStorage.setItem(SESSION_KEY, JSON.stringify(s));
const clearSession = () => localStorage.removeItem(SESSION_KEY);
 
const C = {
  bg: "#fdf6ee", bgCard: "#ffffff", bgDeep: "#fef3e2",
  amber: "#f59e0b", amberD: "#d97706", amberL: "#fde68a",
  orange: "#ea580c", gold: "#ca8a04",
  text: "#1c1917", textMid: "#57534e", textSoft: "#a8a29e",
  border: "#e7e5e0",
  purple: "#7c3aed", purpleL: "#ede9fe",
  green: "#16a34a", greenL: "#dcfce7",
  red: "#dc2626", redL: "#fee2e2",
  blue: "#0284c7", blueL: "#e0f2fe",
};
 
const cardStyle = {
  background: "#ffffff", borderRadius: 20,
  border: "1px solid #e7e5e0", padding: "18px 18px",
  marginBottom: 14, boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
};
 
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;600;700;800&family=Playfair+Display:wght@700;900&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #fdf6ee; font-family: 'Sora', sans-serif; color: #1c1917; -webkit-font-smoothing: antialiased; }
  input, button, textarea, select { font-family: 'Sora', sans-serif; outline: none; }
  input::placeholder { color: #a8a29e; }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-thumb { background: #e7e5e0; border-radius: 4px; }
  @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
  @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
  @keyframes shimmer { 0%{background-position:200% center} 100%{background-position:-200% center} }
  @keyframes toastIn { from{transform:translateY(-20px);opacity:0} to{transform:translateY(0);opacity:1} }
  @keyframes particleFly { from{opacity:1;transform:translate(-50%,-50%) rotate(var(--a)) translateY(0)} to{opacity:0;transform:translate(-50%,-50%) rotate(var(--a)) translateY(calc(var(--d) * -1px))} }
  .fade-up { animation: fadeUp 0.5s ease both; }
  .floating { animation: float 3s ease-in-out infinite; }
  .shimmer-text {
    background: linear-gradient(90deg, #f59e0b, #ea580c, #ca8a04, #f59e0b);
    background-size: 200% auto;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    animation: shimmer 3s linear infinite;
  }
  .habit-card { transition: transform 0.2s, box-shadow 0.2s; cursor: default; }
  .habit-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.1) !important; }
  .complete-btn { transition: transform 0.15s; }
  .complete-btn:hover:not(:disabled) { transform: scale(1.1); }
`;
 
const defaultProfile = (name, avatar, email, emailMarketing, isGuest) => ({
  name, avatar, email, emailMarketing, isGuest: isGuest || false,
  createdAt: new Date().toISOString(),
  totalXp: 0,
  character: { strength: 0, intelligence: 0, discipline: 0, charisma: 0 },
  habits: [], completedToday: {}, lastLogin: todayStr(),
  badges: [], questProgress: {}, questCompletedHabits: [],
  friends: [
    { id: "f1", name: "Alex",   level: 12, avatar: "🧝", streak: 15, xp: 10200 },
    { id: "f2", name: "Jordan", level: 8,  avatar: "🦸", streak: 7,  xp: 6800  },
    { id: "f3", name: "Sam",    level: 20, avatar: "🧜", streak: 22, xp: 18500 },
  ],
});
 
function Particles({ trigger, color }) {
  const [ps, setPs] = useState([]);
  useEffect(() => {
    if (!trigger) return;
    setPs(Array.from({ length: 12 }, (_, i) => ({
      id: uid(), angle: (i / 12) * 360,
      dist: 35 + Math.random() * 50, size: 5 + Math.random() * 6,
      color: [color || "#f59e0b", "#fff", "#fde68a"][i % 3],
    })));
    const t = setTimeout(() => setPs([]), 900);
    return () => clearTimeout(t);
  }, [trigger, color]);
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 10 }}>
      {ps.map(p => (
        <div key={p.id} style={{
          position: "absolute", left: "50%", top: "50%",
          width: p.size, height: p.size, borderRadius: "50%", background: p.color,
          "--a": p.angle + "deg", "--d": p.dist,
          animation: "particleFly 0.9s ease-out forwards",
        }} />
      ))}
    </div>
  );
}
 
function Toast({ items }) {
  return (
    <div style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 9000, display: "flex", flexDirection: "column", gap: 8, width: "90%", maxWidth: 360, pointerEvents: "none" }}>
      {items.map(n => (
        <div key={n.id} style={{ background: "#fff", borderRadius: 14, padding: "12px 16px", boxShadow: "0 8px 32px rgba(0,0,0,0.15)", border: "1px solid #e7e5e0", display: "flex", alignItems: "center", gap: 12, animation: "toastIn 0.35s cubic-bezier(.34,1.56,.64,1) both", borderLeft: "4px solid " + (n.color || C.amber) }}>
          <span style={{ fontSize: 22 }}>{n.icon}</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>{n.title}</div>
            <div style={{ fontSize: 12, color: C.textMid, marginTop: 1 }}>{n.body}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
 
function TermsModal({ onClose }) {
  const sections = [
    ["1. Acceptance", "By creating an account on HabitQuest, you agree to these Terms. This platform is built on behavioral psychology from Atomic Habits and The Power of Habit."],
    ["2. Account & Data", "Your data is stored securely. We never sell personal data to third parties. You may delete your account at any time."],
    ["3. Email Communications", "If you opt in, we may send: habit tips, science insights, weekly summaries, and promotional offers. Max 3 emails/week. Unsubscribe anytime."],
    ["4. Promotional Emails", "By opting in, you consent to receive emails about HabitQuest products, wellness partnerships, and curated offers. Preference changeable in Settings."],
    ["5. Free Trial", "Guest users may use the app without an account. Guest data is stored locally and may be lost if browser data is cleared. Sign up to preserve all progress."],
    ["6. Gamification", "HabitQuest is a motivational tool, not a medical treatment. XP and streaks encourage consistency but do not guarantee specific outcomes."],
    ["7. Privacy", "We collect: email, username, habit data, usage analytics. No payment data on free tier."],
    ["8. Contact", "Questions? Email support@habitquest.app — Built by Mhmd ZAK"],
  ];
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 8000, overflowY: "auto", padding: 20, backdropFilter: "blur(4px)" }}>
      <div style={{ background: "#fff", borderRadius: 24, maxWidth: 540, margin: "20px auto", padding: 32, boxShadow: "0 24px 80px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: C.text }}>Terms & Conditions</div>
          <button onClick={onClose} style={{ background: C.bg, border: "none", borderRadius: 10, width: 36, height: 36, cursor: "pointer", fontSize: 18, color: C.textMid, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        </div>
        <div style={{ fontSize: 11, color: C.textSoft, marginBottom: 20 }}>Effective: January 2025 · HabitQuest by Mhmd ZAK</div>
        {sections.map(([t, b]) => (
          <div key={t} style={{ marginBottom: 18 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: C.amber, marginBottom: 5 }}>{t}</div>
            <div style={{ fontSize: 13, color: C.textMid, lineHeight: 1.7 }}>{b}</div>
          </div>
        ))}
        <button onClick={onClose} style={{ width: "100%", padding: 14, borderRadius: 14, border: "none", cursor: "pointer", background: "linear-gradient(135deg, #f59e0b, #ea580c)", color: "#fff", fontWeight: 700, fontSize: 15, marginTop: 8 }}>Got it ✓</button>
      </div>
    </div>
  );
}
 
function AuthScreen({ onAuth, onGuest }) {
  const [mode, setMode] = useState("landing");
  const [form, setForm] = useState({ email: "", password: "", name: "", avatar: "🧙", confirmPw: "", emailMarketing: true, termsAccepted: false });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showTerms, setShowTerms] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
 
  const inpStyle = { width: "100%", padding: "13px 16px", borderRadius: 14, border: "1.5px solid #e7e5e0", background: "#fdf6ee", fontSize: 15, color: C.text, marginBottom: 12 };
 
  // const handleLogin = async () => {
  //   setError("");
  //   setLoading(true);
  //   await new Promise(r => setTimeout(r, 500));
  //   const users = getUsers();
  //   const user = Object.values(users).find(u => u.email && u.email.toLowerCase() === form.email.toLowerCase());
  //   if (!user) { setLoading(false); return setError("No account found with that email."); }
  //   if (user.passwordHash !== hashPw(form.password)) { setLoading(false); return setError("Incorrect password. Try again."); }
  //   let profile = { ...user };
  //   if (profile.lastLogin !== todayStr()) {
  //     profile.completedToday = {};
  //     profile.lastLogin = todayStr();
  //     profile.habits = (profile.habits || []).map(h => ({ ...h, recentDays: [...(h.recentDays || []).slice(-29), false] }));
  //   }
  //   users[user.email] = profile;
  //   saveUsers(users);
  //   saveSession({ email: user.email });
  //   setLoading(false);
  //   onAuth(profile);
  // };
  const handleLogin = async () => {
  setError("");
  setLoading(true);
  try {
    const cred = await signInWithEmailAndPassword(auth, form.email, form.password);
    const snap = await getDoc(doc(db, "users", cred.user.uid));
    if (snap.exists()) {
      let profile = snap.data();
      if (profile.lastLogin !== todayStr()) {
        profile.completedToday = {};
        profile.lastLogin = todayStr();
        profile.habits = (profile.habits || []).map(h => ({
          ...h,
          recentDays: [...(h.recentDays || []).slice(-29), false]
        }));
        await setDoc(doc(db, "users", cred.user.uid), profile, { merge: true });
      }
      setLoading(false);
      onAuth(profile);
    }
  } catch (e) {
    setLoading(false);
    if (e.code === "auth/user-not-found") return setError("No account found with that email.");
    if (e.code === "auth/wrong-password") return setError("Incorrect password.");
    if (e.code === "auth/invalid-email") return setError("Please enter a valid email.");
    if (e.code === "auth/invalid-credential") return setError("Incorrect email or password.");
    return setError("Login failed. Please try again.");
  }
};

  
 
  // const handleSignup = async () => {
  //   setError("");
  //   if (!form.name.trim()) return setError("Please enter your hero name.");
  //   if (!form.email.includes("@")) return setError("Please enter a valid email.");
  //   if (form.password.length < 6) return setError("Password must be at least 6 characters.");
  //   if (form.password !== form.confirmPw) return setError("Passwords do not match.");
  //   if (!form.termsAccepted) return setError("Please accept the Terms & Conditions.");
  //   setLoading(true);
  //   await new Promise(r => setTimeout(r, 600));
  //   const users = getUsers();
  //   if (users[form.email.toLowerCase()]) { setLoading(false); return setError("Account already exists with this email."); }
  //   const profile = { ...defaultProfile(form.name.trim(), form.avatar, form.email.toLowerCase(), form.emailMarketing, false), passwordHash: hashPw(form.password) };
  //   users[form.email.toLowerCase()] = profile;
  //   saveUsers(users);
  //   saveSession({ email: form.email.toLowerCase() });
  //   setLoading(false);
  //   onAuth(profile);
  // };

  const handleSignup = async () => {
  setError("");
  if (!form.name.trim()) return setError("Please enter your hero name.");
  if (!form.email.includes("@")) return setError("Please enter a valid email.");
  if (form.password.length < 6) return setError("Password must be at least 6 characters.");
  if (form.password !== form.confirmPw) return setError("Passwords do not match.");
  if (!form.termsAccepted) return setError("Please accept the Terms and Conditions.");
  setLoading(true);
  try {
    const cred = await createUserWithEmailAndPassword(auth, form.email, form.password);
    const profile = defaultProfile(
      form.name.trim(),
      form.avatar,
      form.email.toLowerCase(),
      form.emailMarketing,
      false
    );
    await setDoc(doc(db, "users", cred.user.uid), profile);
    setLoading(false);
    onAuth(profile);
  } catch (e) {
    setLoading(false);
    if (e.code === "auth/email-already-in-use") return setError("An account already exists with this email.");
    if (e.code === "auth/weak-password") return setError("Password is too weak.");
    if (e.code === "auth/invalid-email") return setError("Please enter a valid email.");
    return setError("Sign up failed. Please try again.");
  }
};
 
  const handleForgot = async () => {
    setError("");
    setLoading(true);
    await new Promise(r => setTimeout(r, 700));
    const users = getUsers();
    const user = Object.values(users).find(u => u.email && u.email.toLowerCase() === form.email.toLowerCase());
    setLoading(false);
    if (!user) return setError("No account found with that email.");
    setSuccess("Reset link sent! Check your inbox. (Demo mode — password is unchanged)");
  };
 
  const primaryBtn = (label, onClick, color) => (
    <button onClick={onClick} disabled={loading} style={{ width: "100%", padding: "15px", borderRadius: 16, border: "none", cursor: loading ? "wait" : "pointer", background: loading ? C.border : "linear-gradient(135deg, " + (color || C.amber) + ", " + (color ? color : C.orange) + ")", color: loading ? C.textSoft : "#fff", fontWeight: 800, fontSize: 16, marginBottom: 12, boxShadow: loading ? "none" : "0 6px 20px rgba(245,158,11,0.4)" }}>
      {loading ? "Please wait..." : label}
    </button>
  );
 
  if (mode === "landing") return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(160deg, #fff8ee 0%, #fef3e2 40%, #fdf0ff 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 20px", position: "relative", overflow: "hidden" }}>
      <style>{GLOBAL_CSS}</style>
      {showTerms && <TermsModal onClose={() => setShowTerms(false)} />}
      <div style={{ position: "absolute", width: 300, height: 300, background: "rgba(253,230,138,0.5)", borderRadius: "50%", filter: "blur(60px)", top: -80, right: -80, pointerEvents: "none" }} />
      <div style={{ position: "absolute", width: 250, height: 250, background: "rgba(237,233,254,0.6)", borderRadius: "50%", filter: "blur(60px)", bottom: -60, left: -60, pointerEvents: "none" }} />
 
      <div className="fade-up" style={{ textAlign: "center", marginBottom: 40, position: "relative", zIndex: 1 }}>
        <div className="floating" style={{ fontSize: 72, marginBottom: 16 }}>⚔️</div>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(36px,8vw,60px)", fontWeight: 900, lineHeight: 1.1, marginBottom: 10 }}>
          <span className="shimmer-text">HabitQuest</span>
        </div>
        <div style={{ fontSize: 17, color: C.textMid, fontWeight: 300, maxWidth: 340, margin: "0 auto 6px", lineHeight: 1.5 }}>
          Turn daily habits into an <span style={{ color: C.orange, fontWeight: 700 }}>epic adventure</span>
        </div>
        <div style={{ fontSize: 13, color: C.textSoft }}>Based on Atomic Habits · The Power of Habit</div>
      </div>
 
      <div className="fade-up" style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", marginBottom: 36, position: "relative", zIndex: 1 }}>
        {["⚡ Earn XP daily", "🔥 Build streaks", "🏆 Level up", "🧠 Science-backed", "🎯 Quest system"].map(f => (
          <div key={f} style={{ background: "#fff", border: "1px solid #e7e5e0", borderRadius: 99, padding: "8px 16px", fontSize: 13, fontWeight: 600, color: C.textMid, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>{f}</div>
        ))}
      </div>
 
      <div className="fade-up" style={{ width: "100%", maxWidth: 360, position: "relative", zIndex: 1 }}>
        <button onClick={() => setMode("signup")} style={{ width: "100%", padding: "17px", borderRadius: 18, border: "none", cursor: "pointer", background: "linear-gradient(135deg, #f59e0b, #ea580c)", color: "#fff", fontWeight: 800, fontSize: 17, marginBottom: 12, boxShadow: "0 8px 28px rgba(245,158,11,0.5)" }}>
          🚀 Start Your Quest — Free
        </button>
        <button onClick={() => setMode("login")} style={{ width: "100%", padding: "15px", borderRadius: 18, border: "2px solid #e7e5e0", cursor: "pointer", background: "#fff", color: C.text, fontWeight: 700, fontSize: 16, marginBottom: 16 }}>
          🔑 Login to My Account
        </button>
 
        <div style={{ background: "linear-gradient(135deg, #ede9fe, #fdf4ff)", borderRadius: 16, padding: "16px 18px", border: "1px solid #e9d5ff", marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: C.purple, marginBottom: 4 }}>🎮 Try Without Signing Up</div>
          <div style={{ fontSize: 13, color: C.textMid, lineHeight: 1.5, marginBottom: 12 }}>Jump straight in and explore — no account needed. Sign up later to save your progress across all devices.</div>
          <button onClick={onGuest} style={{ width: "100%", padding: "12px", borderRadius: 12, border: "1.5px solid #c4b5fd", cursor: "pointer", background: "rgba(124,58,237,0.08)", color: C.purple, fontWeight: 700, fontSize: 14 }}>
            Continue as Guest →
          </button>
        </div>
      </div>
 
      <div style={{ fontSize: 12, color: C.textSoft, textAlign: "center", position: "relative", zIndex: 1 }}>
        Engineered by <span style={{ fontWeight: 700, color: C.textMid }}>Mhmd ZAK</span>
        <span style={{ margin: "0 8px" }}>·</span>
        <button onClick={() => setShowTerms(true)} style={{ background: "none", border: "none", color: C.amber, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Terms & Privacy</button>
      </div>
    </div>
  );
 
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
      <style>{GLOBAL_CSS}</style>
      {showTerms && <TermsModal onClose={() => setShowTerms(false)} />}
 
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: "42vh", background: "linear-gradient(135deg, #d97706, #ea580c, #9f1239)", zIndex: 0 }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle at 20% 80%, rgba(255,255,255,0.15) 0%, transparent 50%)" }} />
        <div style={{ position: "absolute", top: "18%", left: "8%", fontSize: 28, opacity: 0.2, animation: "float 4s ease-in-out infinite" }}>⚔️</div>
        <div style={{ position: "absolute", top: "45%", right: "12%", fontSize: 24, opacity: 0.15, animation: "float 3s ease-in-out infinite 1s" }}>🏆</div>
      </div>
 
      <div style={{ position: "absolute", top: 28, left: 0, right: 0, textAlign: "center", zIndex: 2 }}>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 900, color: "#fff" }}>HabitQuest</div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", marginTop: 2 }}>
          {mode === "login" ? "Welcome back, hero 👋" : mode === "signup" ? "Begin your journey ✨" : "Account recovery 🔑"}
        </div>
      </div>
 
      <div style={{ position: "relative", zIndex: 1, flex: 1, display: "flex", flexDirection: "column", paddingTop: "30vh" }}>
        <div style={{ background: "#fff", borderRadius: "28px 28px 0 0", flex: 1, padding: "28px 22px 40px", boxShadow: "0 -8px 40px rgba(0,0,0,0.12)", animation: "fadeUp 0.4s ease both", overflowY: "auto" }}>
 
          {mode !== "forgot" && (
            <div style={{ display: "flex", background: "#fdf6ee", borderRadius: 14, padding: 4, marginBottom: 22, gap: 4 }}>
              {[["login", "🔑 Login"], ["signup", "🚀 Sign Up"]].map(([m, label]) => (
                <button key={m} onClick={() => { setMode(m); setError(""); setSuccess(""); }} style={{ flex: 1, padding: "11px", borderRadius: 10, border: "none", cursor: "pointer", background: mode === m ? "#fff" : "transparent", color: mode === m ? C.text : C.textSoft, fontWeight: mode === m ? 700 : 500, fontSize: 14, boxShadow: mode === m ? "0 2px 8px rgba(0,0,0,0.08)" : "none", transition: "all 0.2s" }}>
                  {label}
                </button>
              ))}
            </div>
          )}
 
          {error   && <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 12, padding: "12px 14px", fontSize: 13, color: C.red,   marginBottom: 14, fontWeight: 500 }}>⚠️ {error}</div>}
          {success && <div style={{ background: "#dcfce7", border: "1px solid #86efac", borderRadius: 12, padding: "12px 14px", fontSize: 13, color: C.green, marginBottom: 14, fontWeight: 500 }}>{success}</div>}
 
          {mode === "login" && (
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.textSoft, letterSpacing: 1, display: "block", marginBottom: 6 }}>EMAIL</label>
              <input value={form.email} onChange={e => set("email", e.target.value)} placeholder="you@email.com" type="email" style={inpStyle} />
              <label style={{ fontSize: 11, fontWeight: 700, color: C.textSoft, letterSpacing: 1, display: "block", marginBottom: 6 }}>PASSWORD</label>
              <div style={{ position: "relative" }}>
                <input value={form.password} onChange={e => set("password", e.target.value)} placeholder="Your password" type={showPw ? "text" : "password"} style={{ ...inpStyle, paddingRight: 48 }} onKeyDown={e => e.key === "Enter" && handleLogin()} />
                <button onClick={() => setShowPw(p => !p)} style={{ position: "absolute", right: 14, top: 13, background: "none", border: "none", cursor: "pointer", fontSize: 18, color: C.textSoft }}>{showPw ? "🙈" : "👁️"}</button>
              </div>
              {primaryBtn("Enter the Realm ⚔️", handleLogin)}
              <div style={{ textAlign: "center", marginBottom: 16 }}>
                <button onClick={() => { setMode("forgot"); setError(""); }} style={{ background: "none", border: "none", color: C.amber, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Forgot password?</button>
              </div>
              <div style={{ textAlign: "center", fontSize: 13, color: C.textSoft }}>
                No account?{" "}
                <button onClick={() => setMode("signup")} style={{ background: "none", border: "none", color: C.orange, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>Sign up free →</button>
              </div>
            </div>
          )}
 
          {mode === "signup" && (
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.textSoft, letterSpacing: 1, display: "block", marginBottom: 8 }}>CHOOSE YOUR AVATAR</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                {AVATARS.map(a => (
                  <button key={a} onClick={() => set("avatar", a)} style={{ width: 44, height: 44, borderRadius: 12, border: "2px solid " + (form.avatar === a ? C.amber : C.border), background: form.avatar === a ? C.amberL : "#fdf6ee", fontSize: 22, cursor: "pointer", transition: "all 0.15s", transform: form.avatar === a ? "scale(1.1)" : "scale(1)", display: "flex", alignItems: "center", justifyContent: "center" }}>{a}</button>
                ))}
              </div>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.textSoft, letterSpacing: 1, display: "block", marginBottom: 6 }}>HERO NAME</label>
              <input value={form.name} onChange={e => set("name", e.target.value)} placeholder="What shall we call you?" style={inpStyle} />
              <label style={{ fontSize: 11, fontWeight: 700, color: C.textSoft, letterSpacing: 1, display: "block", marginBottom: 6 }}>EMAIL</label>
              <input value={form.email} onChange={e => set("email", e.target.value)} placeholder="you@email.com" type="email" style={inpStyle} />
              <label style={{ fontSize: 11, fontWeight: 700, color: C.textSoft, letterSpacing: 1, display: "block", marginBottom: 6 }}>PASSWORD</label>
              <div style={{ position: "relative" }}>
                <input value={form.password} onChange={e => set("password", e.target.value)} placeholder="Min. 6 characters" type={showPw ? "text" : "password"} style={{ ...inpStyle, paddingRight: 48 }} />
                <button onClick={() => setShowPw(p => !p)} style={{ position: "absolute", right: 14, top: 13, background: "none", border: "none", cursor: "pointer", fontSize: 18, color: C.textSoft }}>{showPw ? "🙈" : "👁️"}</button>
              </div>
              <input value={form.confirmPw} onChange={e => set("confirmPw", e.target.value)} placeholder="Confirm password" type="password" style={{ ...inpStyle, marginBottom: 16 }} />
 
              <div style={{ background: "#e0f2fe", borderRadius: 14, padding: 14, marginBottom: 12, border: "1px solid #bae6fd" }}>
                <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                  <input type="checkbox" checked={form.emailMarketing} onChange={e => set("emailMarketing", e.target.checked)} style={{ marginTop: 3, accentColor: C.blue, width: 16, height: 16, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: C.textMid, lineHeight: 1.5 }}>
                    <span style={{ fontWeight: 700, color: C.text }}>📧 Send me weekly tips and offers</span><br />
                    Habit science, progress reports and exclusive deals. Max 3 per week. Unsubscribe anytime.
                  </span>
                </label>
              </div>
 
              <div style={{ background: form.termsAccepted ? "#dcfce7" : "#fdf6ee", borderRadius: 14, padding: 14, marginBottom: 20, border: "1px solid " + (form.termsAccepted ? "#86efac" : C.border), transition: "all 0.2s" }}>
                <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                  <input type="checkbox" checked={form.termsAccepted} onChange={e => set("termsAccepted", e.target.checked)} style={{ marginTop: 3, accentColor: C.green, width: 16, height: 16, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: C.textMid, lineHeight: 1.5 }}>
                    I agree to the{" "}
                    <button onClick={() => setShowTerms(true)} style={{ background: "none", border: "none", color: C.amber, cursor: "pointer", fontSize: 13, fontWeight: 700, padding: 0, textDecoration: "underline" }}>Terms and Conditions</button>
                    {" "}and Privacy Policy.{" "}
                    <span style={{ color: C.red, fontWeight: 600 }}>Required</span>
                  </span>
                </label>
              </div>
 
              {primaryBtn("🚀 Begin My Quest", handleSignup)}
            </div>
          )}
 
          {mode === "forgot" && (
            <div>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, color: C.text, marginBottom: 6 }}>Reset Password</div>
              <div style={{ fontSize: 14, color: C.textMid, marginBottom: 20 }}>Enter your email and we will send you a reset link.</div>
              <input value={form.email} onChange={e => set("email", e.target.value)} placeholder="you@email.com" type="email" style={inpStyle} />
              {primaryBtn("Send Reset Link", handleForgot, C.purple)}
              <button onClick={() => { setMode("login"); setError(""); setSuccess(""); }} style={{ width: "100%", padding: "13px", borderRadius: 16, border: "1.5px solid #e7e5e0", cursor: "pointer", background: "transparent", color: C.textMid, fontWeight: 600, fontSize: 15 }}>← Back to Login</button>
            </div>
          )}
 
          {mode !== "landing" && (
            <div style={{ textAlign: "center", marginTop: 20 }}>
              <button onClick={() => { setMode("landing"); setError(""); }} style={{ background: "none", border: "none", color: C.textSoft, cursor: "pointer", fontSize: 13 }}>← Back to home</button>
            </div>
          )}
        </div>
      </div>
 
      <div style={{ background: "#fff", borderTop: "1px solid #e7e5e0", textAlign: "center", padding: "12px 20px", position: "relative", zIndex: 3 }}>
        <span style={{ fontSize: 12, color: C.textSoft }}>Engineered by <span style={{ fontWeight: 700, color: C.textMid }}>Mhmd ZAK</span></span>
      </div>
    </div>
  );
}
 
function XPBar({ xp }) {
  const level = getLevelFromXP(xp);
  const cur = getXPForLevel(level);
  const nxt = getXPForLevel(level + 1);
  const pct = clamp((xp - cur) / (nxt - cur), 0, 1);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.textSoft, marginBottom: 4, fontWeight: 600 }}>
        <span>LVL {level} — {getTitle(level)}</span>
        <span>{xp - cur} / {nxt - cur} XP</span>
      </div>
      <div style={{ height: 8, background: "#fef3e2", borderRadius: 99, overflow: "hidden", border: "1px solid #e7e5e0" }}>
        <div style={{ height: "100%", width: (pct * 100) + "%", background: "linear-gradient(90deg, #f59e0b, #ea580c)", borderRadius: 99, transition: "width 0.7s cubic-bezier(.4,0,.2,1)" }} />
      </div>
    </div>
  );
}
 
function StatBar({ label, value, color, icon }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: C.textMid, marginBottom: 4, fontWeight: 600 }}>
        <span>{icon} {label}</span>
        <span style={{ color: color }}>{value}</span>
      </div>
      <div style={{ height: 6, background: "#fef3e2", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ height: "100%", width: (clamp(value / 100, 0, 1) * 100) + "%", background: color, borderRadius: 99, transition: "width 0.5s" }} />
      </div>
    </div>
  );
}
 
function HabitCard({ habit, onComplete, onDelete, completedToday }) {
  const [burst, setBurst] = useState(false);
  const done = !!completedToday[habit.id];
  const cat = CATEGORIES[habit.category];
  const diff = DIFFICULTY[habit.difficulty];
  const handle = () => {
    if (done) return;
    setBurst(true);
    setTimeout(() => setBurst(false), 900);
    onComplete(habit.id);
  };
  return (
    <div className="habit-card" style={{ ...cardStyle, opacity: done ? 0.7 : 1, position: "relative", overflow: "hidden", borderLeft: "4px solid " + (done ? C.border : cat.color) }}>
      {burst && <Particles trigger={burst} color={diff.color} />}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 48, height: 48, borderRadius: 14, background: cat.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0, border: "1px solid " + cat.color + "33" }}>{cat.icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: done ? C.textSoft : C.text }}>{habit.name}</span>
            <span style={{ fontSize: 10, fontWeight: 800, color: diff.color, background: diff.color + "18", padding: "2px 7px", borderRadius: 6 }}>{diff.label}</span>
          </div>
          {habit.cue && <div style={{ fontSize: 12, color: C.textSoft, marginBottom: 4 }}>⏰ {habit.cue}</div>}
          <div style={{ display: "flex", gap: 14, fontSize: 12, color: C.textMid, fontWeight: 600 }}>
            <span>🔥 {habit.streak}d</span>
            <span style={{ color: C.amber }}>+{diff.xp} XP</span>
            {habit.bestStreak > 0 && <span>🏅 {habit.bestStreak}d best</span>}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
          <button className="complete-btn" onClick={handle} disabled={done} style={{ width: 44, height: 44, borderRadius: 13, border: "none", cursor: done ? "default" : "pointer", background: done ? "#dcfce7" : "linear-gradient(135deg, " + cat.color + ", " + cat.color + "cc)", color: done ? C.green : "#fff", fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: done ? "none" : "0 4px 14px " + cat.color + "55" }}>{done ? "✓" : "○"}</button>
          <button onClick={() => onDelete(habit.id)} style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid #e7e5e0", background: "transparent", color: C.textSoft, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>🗑</button>
        </div>
      </div>
      {habit.recentDays && habit.recentDays.length > 0 && (
        <div style={{ display: "flex", gap: 4, marginTop: 12, flexWrap: "wrap" }}>
          {habit.recentDays.slice(-14).map((d, i) => (
            <div key={i} style={{ width: 16, height: 16, borderRadius: 4, background: d ? cat.color : "#fef3e2", border: "1px solid " + (d ? cat.color + "88" : "#e7e5e0") }} />
          ))}
        </div>
      )}
    </div>
  );
}
 
function AddHabitModal({ onAdd, onClose }) {
  const [form, setForm] = useState({ name: "", category: "Health", difficulty: "Easy", cue: "", reward: "" });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const submit = () => {
    if (!form.name.trim()) return;
    onAdd({ ...form, id: uid(), streak: 0, bestStreak: 0, recentDays: [], totalDone: 0, createdAt: todayStr() });
    onClose();
  };
  const inpStyle2 = { width: "100%", padding: "12px 16px", borderRadius: 14, border: "1.5px solid #e7e5e0", background: "#fdf6ee", fontSize: 14, color: C.text, marginBottom: 12 };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 5000, display: "flex", alignItems: "flex-end", justifyContent: "center", backdropFilter: "blur(4px)" }}>
      <div style={{ background: "#fff", borderRadius: "24px 24px 0 0", padding: "28px 22px 40px", width: "100%", maxWidth: 500, boxShadow: "0 -8px 40px rgba(0,0,0,0.2)", animation: "fadeUp 0.3s ease both", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: C.text }}>New Habit Quest</div>
          <button onClick={onClose} style={{ background: "#fdf6ee", border: "none", borderRadius: 10, width: 36, height: 36, cursor: "pointer", fontSize: 18, color: C.textMid, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        </div>
        <label style={{ fontSize: 11, fontWeight: 700, color: C.textSoft, letterSpacing: 1, display: "block", marginBottom: 6 }}>HABIT NAME</label>
        <input value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Morning Workout" style={inpStyle2} autoFocus />
        <label style={{ fontSize: 11, fontWeight: 700, color: C.textSoft, letterSpacing: 1, display: "block", marginBottom: 8 }}>CATEGORY</label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
          {Object.entries(CATEGORIES).map(([k, v]) => (
            <button key={k} onClick={() => set("category", k)} style={{ padding: "12px 10px", borderRadius: 12, border: "2px solid " + (form.category === k ? v.color : C.border), background: form.category === k ? v.bg : "#fdf6ee", color: form.category === k ? v.color : C.textMid, cursor: "pointer", fontSize: 14, fontWeight: 700, transition: "all 0.15s" }}>{v.icon} {k}</button>
          ))}
        </div>
        <label style={{ fontSize: 11, fontWeight: 700, color: C.textSoft, letterSpacing: 1, display: "block", marginBottom: 8 }}>DIFFICULTY</label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
          {Object.entries(DIFFICULTY).map(([k, v]) => (
            <button key={k} onClick={() => set("difficulty", k)} style={{ padding: "12px 8px", borderRadius: 12, border: "2px solid " + (form.difficulty === k ? v.color : C.border), background: form.difficulty === k ? v.color + "15" : "#fdf6ee", color: form.difficulty === k ? v.color : C.textMid, cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
              {v.label}<br /><span style={{ fontSize: 11, opacity: 0.8 }}>+{v.xp} XP</span>
            </button>
          ))}
        </div>
        <label style={{ fontSize: 11, fontWeight: 700, color: C.textSoft, letterSpacing: 1, display: "block", marginBottom: 6 }}>CUE / TRIGGER</label>
        <input value={form.cue} onChange={e => set("cue", e.target.value)} placeholder="e.g. After morning coffee" style={inpStyle2} />
        <label style={{ fontSize: 11, fontWeight: 700, color: C.textSoft, letterSpacing: 1, display: "block", marginBottom: 6 }}>YOUR REWARD</label>
        <input value={form.reward} onChange={e => set("reward", e.target.value)} placeholder="e.g. 10 min of your fav show" style={{ ...inpStyle2, marginBottom: 20 }} />
        <button onClick={submit} style={{ width: "100%", padding: "15px", borderRadius: 16, border: "none", cursor: "pointer", background: "linear-gradient(135deg, #f59e0b, #ea580c)", color: "#fff", fontWeight: 800, fontSize: 16, boxShadow: "0 6px 20px rgba(245,158,11,0.5)" }}>⚔️ Create Quest</button>
      </div>
    </div>
  );
}
 
function Footer({ onShowTerms }) {
  return (
    <div style={{ textAlign: "center", padding: "20px 20px 110px", borderTop: "1px solid #e7e5e0", marginTop: 20 }}>
      <div style={{ fontSize: 12, color: C.textSoft }}>
        Engineered by{" "}
        <span style={{ fontWeight: 800, color: C.textMid, fontFamily: "'Playfair Display',serif" }}>Mhmd ZAK</span>
        <span style={{ margin: "0 10px", color: C.border }}>·</span>
        <button onClick={onShowTerms} style={{ background: "none", border: "none", color: C.amber, cursor: "pointer", fontSize: 12, fontWeight: 600, textDecoration: "underline" }}>Terms and Privacy</button>
        <span style={{ margin: "0 10px", color: C.border }}>·</span>
        <span>© 2025 HabitQuest</span>
      </div>
    </div>
  );
}
 
function SettingsTab({ profile, onUpdate, onLogout, onSignup, setShowTerms }) {
  const [form, setForm] = useState({ name: profile.name, avatar: profile.avatar, emailMarketing: profile.emailMarketing || false });
  const [saved, setSaved] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const save = () => { onUpdate(form); setSaved(true); setTimeout(() => setSaved(false), 2500); };
  return (
    <div style={{ paddingBottom: 20 }}>
      {profile.isGuest && (
        <div style={{ background: "linear-gradient(135deg, #ede9fe, #fdf4ff)", borderRadius: 18, padding: 20, marginBottom: 16, border: "1px solid #e9d5ff", textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔓</div>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, color: C.purple, marginBottom: 6 }}>You are in Guest Mode</div>
          <div style={{ fontSize: 13, color: C.textMid, lineHeight: 1.6, marginBottom: 14 }}>Create a free account to save your habits, streaks, and XP across all your devices forever.</div>
          <button onClick={onSignup} style={{ width: "100%", padding: "13px", borderRadius: 14, border: "none", cursor: "pointer", background: "linear-gradient(135deg, #7c3aed, #9333ea)", color: "#fff", fontWeight: 700, fontSize: 15 }}>🚀 Create Free Account</button>
        </div>
      )}
      <div style={cardStyle}>
        <div style={{ fontWeight: 700, fontSize: 14, color: C.text, marginBottom: 16 }}>👤 Profile</div>
        <label style={{ fontSize: 11, fontWeight: 700, color: C.textSoft, display: "block", marginBottom: 8, letterSpacing: 1 }}>AVATAR</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          {AVATARS.map(a => (
            <button key={a} onClick={() => set("avatar", a)} style={{ width: 42, height: 42, borderRadius: 12, border: "2px solid " + (form.avatar === a ? C.amber : C.border), background: form.avatar === a ? C.amberL : "#fdf6ee", fontSize: 20, cursor: "pointer", transform: form.avatar === a ? "scale(1.1)" : "scale(1)", transition: "all 0.15s", display: "flex", alignItems: "center", justifyContent: "center" }}>{a}</button>
          ))}
        </div>
        <label style={{ fontSize: 11, fontWeight: 700, color: C.textSoft, display: "block", marginBottom: 6, letterSpacing: 1 }}>HERO NAME</label>
        <input value={form.name} onChange={e => set("name", e.target.value)} style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1.5px solid #e7e5e0", background: "#fdf6ee", fontSize: 15, color: C.text, marginBottom: 12 }} />
        {!profile.isGuest && <div style={{ fontSize: 13, color: C.textSoft }}>📧 {profile.email} · Member since {new Date(profile.createdAt).toLocaleDateString()}</div>}
      </div>
 
      {!profile.isGuest && (
        <div style={cardStyle}>
          <div style={{ fontWeight: 700, fontSize: 14, color: C.text, marginBottom: 14 }}>📧 Email Preferences</div>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", marginBottom: 12 }}>
            <input type="checkbox" checked={form.emailMarketing} onChange={e => set("emailMarketing", e.target.checked)} style={{ marginTop: 3, accentColor: C.amber, width: 17, height: 17, flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: C.textMid, lineHeight: 1.6 }}>
              <span style={{ fontWeight: 700, color: C.text }}>Weekly tips and promotional emails</span><br />
              Habit science, progress reports and exclusive offers. Max 3 per week.
            </span>
          </label>
          <button onClick={() => setShowTerms(true)} style={{ background: "none", border: "none", color: C.amber, cursor: "pointer", fontSize: 13, fontWeight: 600, padding: 0, textDecoration: "underline" }}>View Terms and Conditions</button>
        </div>
      )}
 
      {saved && <div style={{ background: "#dcfce7", border: "1px solid #86efac", borderRadius: 12, padding: "12px 14px", fontSize: 13, color: C.green, marginBottom: 14, fontWeight: 600, textAlign: "center" }}>✅ Changes saved!</div>}
      <button onClick={save} style={{ width: "100%", padding: "14px", borderRadius: 16, border: "none", cursor: "pointer", background: "linear-gradient(135deg, #f59e0b, #ea580c)", color: "#fff", fontWeight: 800, fontSize: 15, marginBottom: 10, boxShadow: "0 6px 20px rgba(245,158,11,0.4)" }}>💾 Save Changes</button>
      <button onClick={onLogout} style={{ width: "100%", padding: "13px", borderRadius: 16, border: "1.5px solid #fca5a5", cursor: "pointer", background: "#fee2e2", color: C.red, fontWeight: 700, fontSize: 15 }}>🚪 {profile.isGuest ? "Exit Guest Mode" : "Logout"}</button>
    </div>
  );
}
 
export default function HabitQuest() {
  const [authed, setAuthed]     = useState(false);
  const [profile, setProfile]   = useState(null);
  const [tab, setTab]           = useState("habits");
  const [showAdd, setShowAdd]   = useState(false);
  const [lvlAnim, setLvlAnim]   = useState(false);
  const [toasts, setToasts]     = useState([]);
  const [filter, setFilter]     = useState("All");
  const [loading, setLoading]   = useState(true);
  const [showTerms, setShowTerms] = useState(false);
  const prevLvl = useRef(1);
 
  // useEffect(() => {
  //   const session = getSession();
  //   if (session && session.email) {
  //     const users = getUsers();
  //     const u = users[session.email];
  //     if (u) { setProfile(u); setAuthed(true); }
  //   } else if (session && session.guest) {
  //     const guestData = JSON.parse(localStorage.getItem("hq_guest") || "null");
  //     if (guestData) { setProfile(guestData); setAuthed(true); }
  //   }
  //   setLoading(false);
  // }, []);
  useEffect(() => {
  const unsub = onAuthStateChanged(auth, async (user) => {
    if (user) {
      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists()) {
        setProfile(snap.data());
        setAuthed(true);
      }
    } else {
      const guestData = JSON.parse(localStorage.getItem("hq_guest") || "null");
      if (guestData) {
        setProfile(guestData);
        setAuthed(true);
      }
    }
    setLoading(false);
  });
  return () => unsub();
}, []);
 
  // useEffect(() => {
  //   if (!profile) return;
  //   if (profile.isGuest) {
  //     localStorage.setItem("hq_guest", JSON.stringify(profile));
  //   } else {
  //     const users = getUsers();
  //     users[profile.email] = profile;
  //     saveUsers(users);
  //   }
  // }, [profile]);

  useEffect(() => {
  if (!profile) return;
  if (profile.isGuest) {
    localStorage.setItem("hq_guest", JSON.stringify(profile));
    return;
  }
  const user = auth.currentUser;
  if (user) {
    setDoc(doc(db, "users", user.uid), profile, { merge: true });
  }
}, [profile]);
 
  useEffect(() => {
    if (!profile) return;
    const lvl = getLevelFromXP(profile.totalXp);
    if (lvl > prevLvl.current) {
      setLvlAnim(true);
      push({ icon: "⬆️", title: "Level Up! → " + lvl, body: "You are now a " + getTitle(lvl) + "!", color: C.amber });
      setTimeout(() => setLvlAnim(false), 3000);
    }
    prevLvl.current = lvl;
}, [profile?.totalXp]);
 
  const push = useCallback((n) => {
    const id = uid();
    setToasts(t => [...t, { ...n, id }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3800);
  }, []);
 
  const handleAuth = (prof) => { setProfile(prof); setAuthed(true); };
 
  const handleGuest = () => {
    const guest = defaultProfile("Adventurer", "🧙", "guest@local", false, true);
    localStorage.setItem("hq_guest", JSON.stringify(guest));
    saveSession({ guest: true });
    setProfile(guest);
    setAuthed(true);
  };
 
  // const handleLogout = () => {
  //   clearSession();
  //   localStorage.removeItem("hq_guest");
  //   setAuthed(false);
  //   setProfile(null);
  //   setTab("habits");
  // };

  const handleLogout = async () => {
  try { await signOut(auth); } catch (e) {}
  clearSession();
  localStorage.removeItem("hq_guest");
  setAuthed(false);
  setProfile(null);
  setTab("habits");
};
 
  const updateProfile = (updates) => {
    setProfile(p => ({ ...p, ...updates }));
    push({ icon: "✅", title: "Profile Updated", body: "Changes saved", color: C.green });
  };
 
  const addHabit = (habit) => {
    setProfile(p => ({ ...p, habits: [...p.habits, habit] }));
    push({ icon: "⚔️", title: "Quest Created!", body: habit.name, color: C.amber });
  };
 
  const deleteHabit = (id) => setProfile(p => ({ ...p, habits: p.habits.filter(h => h.id !== id) }));
 
  const completeHabit = (habitId) => {
    setProfile(p => {
      const habit = p.habits.find(h => h.id === habitId);
      if (!habit || p.completedToday[habitId]) return p;
      const diff = DIFFICULTY[habit.difficulty];
      const cat = CATEGORIES[habit.category];
      let xpGain = diff.xp;
      const newStreak = habit.streak + 1;
      const newBest = Math.max(habit.bestStreak || 0, newStreak);
      let bonusMsg = null;
      if (STREAK_MILESTONES.includes(newStreak)) {
        const bonus = STREAK_BONUS[newStreak];
        xpGain += bonus;
        bonusMsg = newStreak + "-Day Streak! +" + bonus + " Bonus XP!";
      }
      const newTotalXp = p.totalXp + xpGain;
      const statKey = cat.stat;
      const newChar = { ...p.character, [statKey]: clamp((p.character[statKey] || 0) + diff.stat, 0, 999) };
      const newHabits = p.habits.map(h => h.id === habitId ? { ...h, streak: newStreak, bestStreak: newBest, recentDays: [...(h.recentDays || []).slice(0, -1), true], totalDone: (h.totalDone || 0) + 1 } : h);
      const newQP = { ...p.questProgress };
      QUESTS.forEach(q => {
        if (q.type === "xp") newQP[q.id] = Math.min((newQP[q.id] || 0) + xpGain, q.goal);
        if (q.type === "streak") newQP[q.id] = Math.max(newQP[q.id] || 0, newStreak);
        if (q.type === "variety") newQP[q.id] = new Set([...(p.questCompletedHabits || []), habitId]).size;
      });
      const stats = {
        totalCompleted: newHabits.reduce((a, h) => a + (h.totalDone || 0), 0),
        maxStreak: newHabits.reduce((m, h) => Math.max(m, h.streak), 0),
        totalXp: newTotalXp,
        level: getLevelFromXP(newTotalXp),
        categoryCoverage: new Set(newHabits.map(h => h.category)).size,
      };
      const newBadges = [...new Set([...(p.badges || []), ...BADGES.filter(b => !(p.badges || []).includes(b.id) && b.check(stats)).map(b => b.id)])];
      setTimeout(() => {
        push({ icon: cat.icon, title: "+" + xpGain + " XP earned", body: habit.name + " completed!", color: diff.color });
        if (bonusMsg) setTimeout(() => push({ icon: "🔥", title: "Streak Bonus!", body: bonusMsg, color: C.orange }), 500);
        newBadges.filter(id => !(p.badges || []).includes(id)).forEach((id, i) => {
          const badge = BADGES.find(b => b.id === id);
          if (badge) setTimeout(() => push({ icon: badge.icon, title: "Badge Unlocked!", body: badge.name, color: C.purple }), 800 + i * 600);
        });
      }, 50);
      return { ...p, totalXp: newTotalXp, completedToday: { ...p.completedToday, [habitId]: true }, habits: newHabits, character: newChar, questProgress: newQP, badges: newBadges, questCompletedHabits: [...new Set([...(p.questCompletedHabits || []), habitId])] };
    });
  };
 
  if (loading) {
    return (
      <div style={{ height: "100vh", background: "#fdf6ee", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
        <style>{GLOBAL_CSS}</style>
        <div className="floating" style={{ fontSize: 56 }}>⚔️</div>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: C.amber }}>Loading Quest...</div>
      </div>
    );
  }
 
  if (!authed || !profile) {
    return <AuthScreen onAuth={handleAuth} onGuest={handleGuest} />;
  }
 
  const level = getLevelFromXP(profile.totalXp);
  const filteredHabits = filter === "All" ? profile.habits : profile.habits.filter(h => h.category === filter);
  const doneCount = Object.keys(profile.completedToday).length;
  const totalH = profile.habits.length;
 
  const TABS = [
    { id: "habits",      icon: "⚔️", label: "Habits"   },
    { id: "character",   icon: "🧙", label: "Hero"     },
    { id: "quests",      icon: "🗺️", label: "Quests"   },
    { id: "leaderboard", icon: "🏆", label: "Guild"    },
    { id: "analytics",   icon: "📊", label: "Stats"    },
    { id: "settings",    icon: "⚙️", label: "Settings" },
  ];
 
  return (
    <div style={{ minHeight: "100vh", background: "#fdf6ee", fontFamily: "'Sora', sans-serif", color: C.text }}>
      <style>{GLOBAL_CSS}</style>
      {showTerms && <TermsModal onClose={() => setShowTerms(false)} />}
      <Toast items={toasts} />
      {showAdd && <AddHabitModal onAdd={addHabit} onClose={() => setShowAdd(false)} />}
 
      <div style={{ background: "#fff", borderBottom: "1px solid #e7e5e0", padding: "14px 18px 12px", position: "sticky", top: 0, zIndex: 200, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
        {profile.isGuest && (
          <div style={{ background: "linear-gradient(135deg, #ede9fe, #fdf4ff)", borderRadius: 12, padding: "10px 14px", marginBottom: 12, border: "1px solid #e9d5ff", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div style={{ fontSize: 13, color: C.purple, fontWeight: 600 }}>🎮 Guest Mode — progress saved locally only</div>
            <button onClick={handleLogout} style={{ background: C.purple, border: "none", borderRadius: 8, padding: "6px 12px", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}>Save Progress →</button>
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, fontWeight: 900 }}>
              <span className="shimmer-text">HabitQuest</span>
            </div>
            <div style={{ fontSize: 12, color: C.textSoft, marginTop: 1 }}>Hey {profile.name} 👋</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 10, color: C.textSoft, fontWeight: 700, letterSpacing: 1 }}>LEVEL</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: lvlAnim ? C.orange : C.amber, transition: "color 0.3s", fontFamily: "'Playfair Display',serif" }}>{level}</div>
            </div>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: "#fef3e2", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, border: "2px solid #e7e5e0" }}>{profile.avatar}</div>
          </div>
        </div>
        <XPBar xp={profile.totalXp} />
      </div>
 
      <div style={{ padding: "16px 16px 0", maxWidth: 600, margin: "0 auto" }}>
 
        {tab === "habits" && (
          <div className="fade-up">
            <div style={{ ...cardStyle, background: "linear-gradient(135deg, #fff, #fef3e2)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Today's Quests</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: doneCount === totalH && totalH > 0 ? C.green : C.textMid }}>{doneCount}/{totalH} done</div>
              </div>
              <div style={{ height: 8, background: "#fef3e2", borderRadius: 99, overflow: "hidden" }}>
                <div style={{ height: "100%", width: totalH ? (doneCount / totalH * 100) + "%" : "0%", background: "linear-gradient(90deg, #f59e0b, #ea580c)", borderRadius: 99, transition: "width 0.6s ease" }} />
              </div>
              {doneCount === totalH && totalH > 0 && <div style={{ textAlign: "center", fontSize: 13, fontWeight: 700, color: C.green, marginTop: 8 }}>✨ All quests complete — Legendary Day!</div>}
            </div>
 
            <div style={{ display: "flex", gap: 8, marginBottom: 14, overflowX: "auto", paddingBottom: 4 }}>
              {["All", ...Object.keys(CATEGORIES)].map(c => (
                <button key={c} onClick={() => setFilter(c)} style={{ padding: "8px 14px", borderRadius: 99, border: "1.5px solid " + (filter === c ? C.amber : C.border), background: filter === c ? C.amberL : "#fff", color: filter === c ? C.amberD : C.textMid, cursor: "pointer", fontSize: 13, whiteSpace: "nowrap", fontWeight: filter === c ? 700 : 500, transition: "all 0.15s" }}>
                  {c === "All" ? "All" : CATEGORIES[c].icon + " " + c}
                </button>
              ))}
            </div>
 
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {filteredHabits.length === 0 ? (
                <div style={{ textAlign: "center", padding: "48px 20px", color: C.textSoft }}>
                  <div style={{ fontSize: 52, marginBottom: 12 }}>⚔️</div>
                  <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, color: C.text, marginBottom: 6 }}>No quests yet</div>
                  <div style={{ fontSize: 14, marginBottom: 20 }}>Start your first habit and begin the adventure</div>
                  <button onClick={() => setShowAdd(true)} style={{ padding: "13px 28px", borderRadius: 14, border: "none", cursor: "pointer", background: "linear-gradient(135deg,#f59e0b,#ea580c)", color: "#fff", fontWeight: 700, fontSize: 15 }}>+ Create First Habit</button>
                </div>
              ) : filteredHabits.map(h => (
                <HabitCard key={h.id} habit={h} onComplete={completeHabit} onDelete={deleteHabit} completedToday={profile.completedToday} />
              ))}
            </div>
 
            <Footer onShowTerms={() => setShowTerms(true)} />
            <button onClick={() => setShowAdd(true)} style={{ position: "fixed", bottom: 82, right: 20, width: 58, height: 58, borderRadius: "50%", border: "none", cursor: "pointer", background: "linear-gradient(135deg, #f59e0b, #ea580c)", color: "#fff", fontSize: 28, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 24px rgba(245,158,11,0.6)", zIndex: 300 }}>+</button>
          </div>
        )}
 
        {tab === "character" && (
          <div className="fade-up">
            <div style={{ ...cardStyle, background: "linear-gradient(160deg, #fff 0%, #fef3e2 100%)", textAlign: "center", padding: 28 }}>
              <div style={{ fontSize: 72, marginBottom: 12 }}>{profile.avatar}</div>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, fontWeight: 900 }}>{profile.name}</div>
              <div style={{ fontSize: 14, color: C.amber, fontWeight: 700, marginTop: 4, marginBottom: 16 }}>{getTitle(level)} • Level {level}</div>
              <XPBar xp={profile.totalXp} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 16 }}>
                {[["Total XP", profile.totalXp.toLocaleString(), C.amber], ["Badges", (profile.badges || []).length, C.purple], ["Habits", profile.habits.length, C.blue]].map(([l, v, c]) => (
                  <div key={l} style={{ background: "#fef3e2", borderRadius: 12, padding: 12 }}>
                    <div style={{ fontSize: 10, color: C.textSoft, fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>{l.toUpperCase()}</div>
                    <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, fontWeight: 900, color: c }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={cardStyle}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16 }}>⚔️ Character Stats</div>
              <StatBar label="Strength"     value={clamp(profile.character.strength, 0, 100)}     color="#ef4444" icon="🏃" />
              <StatBar label="Intelligence" value={clamp(profile.character.intelligence, 0, 100)} color="#8b5cf6" icon="🧠" />
              <StatBar label="Discipline"   value={clamp(profile.character.discipline, 0, 100)}   color="#0ea5e9" icon="⚡" />
              <StatBar label="Charisma"     value={clamp(profile.character.charisma, 0, 100)}     color="#f59e0b" icon="💫" />
            </div>
            <div style={cardStyle}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16 }}>🏅 Badges</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {BADGES.map(b => {
                  const earned = (profile.badges || []).includes(b.id);
                  return (
                    <div key={b.id} style={{ background: earned ? C.amberL : "#fef3e2", border: "1px solid " + (earned ? C.amber + "44" : C.border), borderRadius: 14, padding: 14, opacity: earned ? 1 : 0.5, display: "flex", gap: 10, alignItems: "center" }}>
                      <span style={{ fontSize: 26, filter: earned ? "none" : "grayscale(1)" }}>{b.icon}</span>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: earned ? C.text : C.textSoft }}>{b.name}</div>
                        <div style={{ fontSize: 11, color: C.textSoft, marginTop: 2 }}>{b.desc}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <Footer onShowTerms={() => setShowTerms(true)} />
          </div>
        )}
 
        {tab === "quests" && (
          <div className="fade-up">
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, fontWeight: 900, marginBottom: 4 }}>Epic Quests</div>
            <div style={{ fontSize: 13, color: C.textSoft, marginBottom: 18 }}>Complete quests to earn bonus XP</div>
            {QUESTS.map(q => {
              const prog = profile.questProgress && profile.questProgress[q.id] ? profile.questProgress[q.id] : 0;
              const pct = clamp(prog / q.goal, 0, 1);
              const done = pct >= 1;
              return (
                <div key={q.id} style={{ ...cardStyle, borderLeft: "4px solid " + (done ? C.green : C.amber), background: done ? "#dcfce7" : "#fff" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      <span style={{ fontSize: 28 }}>{q.icon}</span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15, color: done ? C.green : C.text }}>{q.name}</div>
                        <div style={{ fontSize: 12, color: C.textSoft, marginTop: 2 }}>{q.desc}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.amber }}>+{q.reward} XP</div>
                      {done && <div style={{ fontSize: 11, color: C.green, fontWeight: 700 }}>DONE ✓</div>}
                    </div>
                  </div>
                  <div style={{ height: 6, background: "#fef3e2", borderRadius: 99, overflow: "hidden", marginBottom: 6 }}>
                    <div style={{ height: "100%", width: (pct * 100) + "%", background: done ? C.green : "linear-gradient(90deg,#f59e0b,#ea580c)", borderRadius: 99, transition: "width 0.5s" }} />
                  </div>
                  <div style={{ fontSize: 12, color: C.textSoft, fontWeight: 600 }}>{Math.min(prog, q.goal)} / {q.goal}</div>
                </div>
              );
            })}
            <Footer onShowTerms={() => setShowTerms(true)} />
          </div>
        )}
 
        {tab === "leaderboard" && (
          <div className="fade-up">
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, fontWeight: 900, marginBottom: 4 }}>Realm Rankings</div>
            <div style={{ fontSize: 13, color: C.textSoft, marginBottom: 18 }}>How you stack up against fellow adventurers</div>
            {[...profile.friends, { id: "me", name: profile.name, level, avatar: profile.avatar, streak: Math.max(...profile.habits.map(h => h.streak), 0), xp: profile.totalXp }]
              .sort((a, b) => (b.xp || b.level * 1000) - (a.xp || a.level * 1000))
              .map((f, i) => {
                const isMe = f.id === "me";
                const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "#" + (i + 1);
                return (
                  <div key={f.id} style={{ ...cardStyle, background: isMe ? C.amberL : "#fff", border: isMe ? "2px solid " + C.amber : "1px solid #e7e5e0", display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{ fontSize: i < 3 ? 26 : 16, fontWeight: 800, color: C.textMid, width: 32, textAlign: "center" }}>{medal}</div>
                    <div style={{ fontSize: 32 }}>{f.avatar}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: isMe ? C.amberD : C.text }}>{f.name}{isMe ? " (You)" : ""}</div>
                      <div style={{ fontSize: 12, color: C.textSoft, fontWeight: 600 }}>{getTitle(f.level)} · Lv.{f.level} · 🔥 {f.streak}d</div>
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 14, color: C.amber }}>{(f.xp || f.level * 850).toLocaleString()} XP</div>
                  </div>
                );
              })}
            <div style={cardStyle}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>🧠 Atomic Habits Science</div>
              {[["👁️","Make It Obvious","Set clear cues and triggers for your habits"],["🎯","Make It Attractive","Pair habits with things you enjoy"],["🐾","Make It Easy","Start with 2-minute micro-habits"],["⭐","Make It Satisfying","Reward yourself immediately after"]].map(([icon, t, d]) => (
                <div key={t} style={{ display: "flex", gap: 12, marginBottom: 14, alignItems: "flex-start" }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: C.amberL, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{icon}</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{t}</div>
                    <div style={{ fontSize: 12, color: C.textMid }}>{d}</div>
                  </div>
                </div>
              ))}
            </div>
            <Footer onShowTerms={() => setShowTerms(true)} />
          </div>
        )}
 
        {tab === "analytics" && (
          <div className="fade-up">
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, fontWeight: 900, marginBottom: 18 }}>Your Progress</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              {[
                { l: "Total Done",  v: profile.habits.reduce((a, h) => a + (h.totalDone || 0), 0), icon: "✅", c: C.green  },
                { l: "Best Streak", v: profile.habits.reduce((m, h) => Math.max(m, h.bestStreak || 0), 0) + "d", icon: "🏆", c: C.amber  },
                { l: "Avg Streak",  v: (profile.habits.length ? (profile.habits.reduce((a, h) => a + h.streak, 0) / profile.habits.length).toFixed(1) : 0) + "d", icon: "🔥", c: C.orange },
                { l: "Your Level",  v: level, icon: "⬆️", c: C.purple },
              ].map(s => (
                <div key={s.l} style={{ ...cardStyle, textAlign: "center", marginBottom: 0 }}>
                  <div style={{ fontSize: 28, marginBottom: 6 }}>{s.icon}</div>
                  <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 26, fontWeight: 900, color: s.c }}>{s.v}</div>
                  <div style={{ fontSize: 12, color: C.textSoft, fontWeight: 600, marginTop: 2 }}>{s.l}</div>
                </div>
              ))}
            </div>
            <div style={cardStyle}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16 }}>📊 Habit Completion Rates</div>
              {profile.habits.length === 0 ? (
                <div style={{ textAlign: "center", padding: "20px 0", color: C.textSoft, fontSize: 14 }}>No habits tracked yet</div>
              ) : profile.habits.map(h => {
                const cat = CATEGORIES[h.category];
                const cr = h.recentDays && h.recentDays.length ? h.recentDays.filter(Boolean).length / h.recentDays.length : 0;
                return (
                  <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: cat.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{cat.icon}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, marginBottom: 5 }}>
                        <span>{h.name}</span>
                        <span style={{ color: cat.color }}>{Math.round(cr * 100)}%</span>
                      </div>
                      <div style={{ height: 6, background: "#fef3e2", borderRadius: 99, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: (cr * 100) + "%", background: cat.color, borderRadius: 99 }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <Footer onShowTerms={() => setShowTerms(true)} />
          </div>
        )}
 
        {tab === "settings" && (
          <div className="fade-up">
            <SettingsTab profile={profile} onUpdate={updateProfile} onLogout={handleLogout} onSignup={handleLogout} setShowTerms={setShowTerms} />
            <Footer onShowTerms={() => setShowTerms(true)} />
          </div>
        )}
      </div>
 
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#fff", borderTop: "1px solid #e7e5e0", display: "flex", zIndex: 200, boxShadow: "0 -4px 20px rgba(0,0,0,0.08)" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, padding: "10px 0 8px", border: "none", background: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, color: tab === t.id ? C.amber : C.textSoft, transition: "color 0.2s", borderTop: "3px solid " + (tab === t.id ? C.amber : "transparent") }}>
            <span style={{ fontSize: 18 }}>{t.icon}</span>
            <span style={{ fontSize: 9, fontWeight: tab === t.id ? 800 : 500 }}>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}