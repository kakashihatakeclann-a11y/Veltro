"use client";
import { useState, useEffect } from "react";
import { useSession, signIn, signOut } from "next-auth/react";

const cat = {
  "Important":     { border: "#E24B4A", bg: "rgba(226,75,74,0.08)", text: "#E24B4A", dot: "#E24B4A" },
  "Action Needed": { border: "#EF9F27", bg: "rgba(239,159,39,0.08)", text: "#EF9F27", dot: "#EF9F27" },
  "Other":         { border: "#3a3a3a", bg: "rgba(255,255,255,0.03)", text: "#666", dot: "#444" },
};

export default function Home() {
  const { data: session } = useSession();
  const [emails, setEmails] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [replyOpen, setReplyOpen] = useState<number | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [activeTab, setActiveTab] = useState<"inbox" | "activity">("inbox");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [usage, setUsage] = useState({ analyzed: 0, tasks: 0, replies: 0 });

  useEffect(() => {
    const savedTheme = localStorage.getItem("veltro_theme") as "dark" | "light" | null;
    if (savedTheme) setTheme(savedTheme);
    const savedUsage = localStorage.getItem("veltro_usage");
    if (savedUsage) setUsage(JSON.parse(savedUsage));
  }, []);

  const toggleTheme = (t: "dark" | "light") => {
    setTheme(t);
    localStorage.setItem("veltro_theme", t);
  };

  const d = {
    bg: theme === "dark" ? "#080808" : "#f5f5f5",
    navBg: theme === "dark" ? "rgba(8,8,8,0.9)" : "rgba(245,245,245,0.9)",
    navBorder: theme === "dark" ? "#141414" : "#e0e0e0",
    cardBg: theme === "dark" ? "#0c0c0c" : "#ffffff",
    cardBorder: theme === "dark" ? "#161616" : "#e8e8e8",
    statBg: theme === "dark" ? "#0e0e0e" : "#ffffff",
    text: theme === "dark" ? "#fff" : "#111",
    textSub: theme === "dark" ? "#666" : "#888",
    textMuted: theme === "dark" ? "#999" : "#666",
    textFaint: theme === "dark" ? "#444" : "#bbb",
    divider: theme === "dark" ? "#111" : "#eee",
    tabBg: theme === "dark" ? "#0e0e0e" : "#ececec",
    tabActiveBg: theme === "dark" ? "#1a1a1a" : "#fff",
    tabActiveText: theme === "dark" ? "#fff" : "#111",
    emptyIcon: theme === "dark" ? "#333" : "#ccc",
  };

  const sendReply = async (email: any, idx: number) => {
    setSending(true);
    try {
      const toMatch = email.from.match(/<(.+)>/);
      const to = toMatch ? toMatch[1] : email.from;
      await fetch("/api/gmail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject: `Re: ${email.subject}`, message: replyText, threadId: email.threadId }),
      });
      setReplyOpen(null);
      setReplyText("");
      const newUsage = { ...usage, replies: usage.replies + 1 };
      setUsage(newUsage);
      localStorage.setItem("veltro_usage", JSON.stringify(newUsage));
    } catch (err) { console.error(err); }
    setSending(false);
  };

  const fetchAndAnalyze = async () => {
    setLoading(true);
    setEmails([]);
    try {
      const res = await fetch("/api/gmail");
      const data = await res.json();
      const fetched = data.emails || [];
      setEmails(fetched);
      setLoading(false);
      setAnalyzing(true);
      const updated = await Promise.all(
        fetched.map(async (email: any) => {
          const res = await fetch("/api/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ emailText: `Subject: ${email.subject}\nFrom: ${email.from}\n\n${email.snippet}` }),
          });
          const data = await res.json();
          return { ...email, ...data };
        })
      );
      setEmails(updated);
      const newUsage = {
        analyzed: usage.analyzed + updated.length,
        tasks: usage.tasks + updated.reduce((acc: number, e: any) => acc + (e.tasks?.length || 0), 0),
        replies: usage.replies,
      };
      setUsage(newUsage);
      localStorage.setItem("veltro_usage", JSON.stringify(newUsage));
    } catch (err) { console.error(err); }
    setLoading(false);
    setAnalyzing(false);
  };

  const grouped = {
    "Important":     emails.filter(e => e.category === "Important"),
    "Action Needed": emails.filter(e => e.category === "Action Needed"),
    "Other":         emails.filter(e => !e.category || e.category === "Other"),
  };

  const totalTasks = emails.reduce((acc, e) => acc + (e.tasks?.length || 0), 0);
  const awaitingCount = emails.filter(e => e.awaitingReply).length;
  const isWorking = loading || analyzing;

  if (!session) {
    return (
      <>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap');
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { background: #080808; }
          .landing { min-height: 100vh; background: #080808; display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: 'DM Sans', sans-serif; padding: 2rem; position: relative; overflow: hidden; }
          .grid-bg { position: fixed; inset: 0; pointer-events: none; background-image: linear-gradient(rgba(83,74,183,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(83,74,183,0.06) 1px, transparent 1px); background-size: 48px 48px; }
          .glow { position: fixed; top: -200px; left: 50%; transform: translateX(-50%); width: 700px; height: 500px; background: radial-gradient(ellipse, rgba(83,74,183,0.18) 0%, transparent 70%); pointer-events: none; }
          .logo-wrap { display: flex; align-items: center; gap: 10px; margin-bottom: 2.5rem; }
          .logo-icon { width: 40px; height: 40px; border-radius: 10px; background: #534AB7; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 20px rgba(83,74,183,0.4); }
          .logo-text { font-family: 'Syne', sans-serif; font-size: 1.5rem; font-weight: 700; color: #fff; letter-spacing: -0.02em; }
          .headline { font-family: 'Syne', sans-serif; font-size: clamp(2.2rem, 6vw, 3.8rem); font-weight: 800; color: #fff; text-align: center; line-height: 1.1; letter-spacing: -0.04em; margin-bottom: 1.25rem; }
          .headline span { color: #7F77DD; }
          .subhead { color: #666; font-size: 1.05rem; text-align: center; max-width: 420px; line-height: 1.65; margin-bottom: 2.5rem; font-weight: 300; }
          .pills { display: flex; gap: 10px; margin-bottom: 2.8rem; flex-wrap: wrap; justify-content: center; }
          .pill { padding: 6px 14px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.04); font-size: 0.78rem; color: #888; }
          .signin-btn { display: flex; align-items: center; gap: 10px; padding: 0.8rem 1.8rem; background: #fff; color: #000; border: none; border-radius: 12px; cursor: pointer; font-size: 0.95rem; font-weight: 500; font-family: 'DM Sans', sans-serif; transition: opacity 0.15s, transform 0.15s; box-shadow: 0 4px 24px rgba(0,0,0,0.4); }
          .signin-btn:hover { opacity: 0.9; transform: translateY(-1px); }
          .trust { margin-top: 1.5rem; font-size: 0.75rem; color: #333; }
        `}</style>
        <div className="landing">
          <div className="grid-bg" />
          <div className="glow" />
          <div className="logo-wrap">
            <div className="logo-icon">
              <svg width="18" height="18" viewBox="0 0 100 130" fill="none">
                <polygon points="0,0 28,0 50,90 72,0 100,0 60,130 40,130" fill="#7F77DD"/>
                <polygon points="40,130 60,130 100,0 72,0" fill="#534AB7"/>
              </svg>
            </div>
            <span className="logo-text">Veltro</span>
          </div>
          <h1 className="headline">Your inbox,<br/><span>intelligently organized</span></h1>
          <p className="subhead">Connect Gmail and let AI categorize, summarize, and extract tasks from your emails — automatically.</p>
          <div className="pills">
            {["AI Categorization", "Task Extraction", "Smart Summaries", "Priority Ranking"].map(l => (
              <div key={l} className="pill">{l}</div>
            ))}
          </div>
          <button className="signin-btn" onClick={() => signIn("google")}>
            <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Sign in with Google
          </button>
          <p className="trust">Read-only access · Your data is never stored</p>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700&family=DM+Sans:wght@300;400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${d.bg}; transition: background 0.2s; }
      `}</style>

      <div style={{ minHeight: "100vh", background: d.bg, fontFamily: "'DM Sans', sans-serif", color: d.text, transition: "all 0.2s" }}>

        {/* NAV */}
        <nav style={{ borderBottom: `1px solid ${d.navBorder}`, padding: "0.85rem 2rem", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: d.navBg, backdropFilter: "blur(12px)", zIndex: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ width: "28px", height: "28px", borderRadius: "7px", background: "#534AB7", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="13" height="13" viewBox="0 0 100 130" fill="none">
                <polygon points="0,0 28,0 50,90 72,0 100,0 60,130 40,130" fill="#7F77DD"/>
                <polygon points="40,130 60,130 100,0 72,0" fill="#534AB7"/>
              </svg>
            </div>
            <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "1rem", color: d.text, letterSpacing: "-0.01em" }}>Veltro</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {/* THEME SWITCHER */}
            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
              <button
                onClick={() => toggleTheme("dark")}
                title="Dark mode"
                style={{ width: "22px", height: "22px", borderRadius: "50%", background: "#080808", border: theme === "dark" ? "2px solid #7F77DD" : "2px solid #333", cursor: "pointer", transition: "border 0.15s" }}
              />
              <button
                onClick={() => toggleTheme("light")}
                title="Light mode"
                style={{ width: "22px", height: "22px", borderRadius: "50%", background: "#f0f0f0", border: theme === "light" ? "2px solid #7F77DD" : "2px solid #ccc", cursor: "pointer", transition: "border 0.15s" }}
              />
            </div>
            <span style={{ fontSize: "0.82rem", color: d.textSub }}>{session.user?.email}</span>
            <button onClick={() => signOut()} style={{ padding: "0.3rem 0.85rem", fontSize: "0.78rem", border: `1px solid ${d.navBorder}`, borderRadius: "6px", background: "transparent", color: d.textMuted, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
              Sign out
            </button>
          </div>
        </nav>

        <div style={{ maxWidth: "720px", margin: "0 auto", padding: "2.5rem 1.5rem" }}>

          {/* TABS */}
          <div style={{ display: "flex", gap: "4px", marginBottom: "2rem", background: d.tabBg, border: `1px solid ${d.cardBorder}`, borderRadius: "10px", padding: "4px", width: "fit-content" }}>
            {(["inbox", "activity"] as const).map(t => (
              <button key={t} onClick={() => setActiveTab(t)} style={{ padding: "0.4rem 1rem", borderRadius: "7px", fontSize: "0.82rem", cursor: "pointer", border: "none", background: activeTab === t ? d.tabActiveBg : "transparent", color: activeTab === t ? d.tabActiveText : d.textFaint, fontFamily: "'DM Sans', sans-serif", transition: "all 0.15s", textTransform: "capitalize" }}>
                {t}
              </button>
            ))}
          </div>

          {/* ACTIVITY TAB */}
          {activeTab === "activity" && (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", marginBottom: "2rem" }}>
                {[
                  { num: usage.analyzed, label: "Emails analyzed", color: "#7F77DD" },
                  { num: usage.tasks, label: "Tasks extracted", color: "#EF9F27" },
                  { num: usage.replies, label: "Replies sent", color: "#E24B4A" },
                ].map(({ num, label, color }) => (
                  <div key={label} style={{ background: d.statBg, border: `1px solid ${d.cardBorder}`, borderRadius: "12px", padding: "1.25rem" }}>
                    <div style={{ fontSize: "2.2rem", fontWeight: 700, lineHeight: 1, color, fontVariantNumeric: "tabular-nums" }}>{num}</div>
                    <div style={{ fontSize: "0.78rem", color: d.textSub, marginTop: "6px" }}>{label}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: "0.78rem", color: d.textMuted, lineHeight: 1.6, background: d.statBg, border: `1px solid ${d.cardBorder}`, borderRadius: "12px", padding: "1rem 1.25rem" }}>
                Activity is saved across sessions. Upgrade to Pro to unlock unlimited analysis and full history.
              </div>
              {usage.analyzed > 0 && (
                <div style={{ marginTop: "1.5rem", background: d.statBg, border: `1px solid ${d.cardBorder}`, borderRadius: "12px", padding: "1.25rem" }}>
                  <div style={{ fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: d.textFaint, marginBottom: "1rem" }}>Session breakdown</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {[
                      { label: "Emails analyzed", val: usage.analyzed, max: 15, color: "#7F77DD" },
                      { label: "Tasks extracted", val: usage.tasks, max: Math.max(usage.tasks, 1), color: "#EF9F27" },
                      { label: "Replies sent", val: usage.replies, max: Math.max(usage.replies, 1), color: "#E24B4A" },
                    ].map(({ label, val, max, color }) => (
                      <div key={label}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", color: d.textMuted, marginBottom: "4px" }}>
                          <span>{label}</span><span>{val}</span>
                        </div>
                        <div style={{ height: "4px", background: d.navBorder, borderRadius: "999px", overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${Math.min((val / max) * 100, 100)}%`, background: color, borderRadius: "999px", transition: "width 0.4s ease" }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* INBOX TAB */}
          {activeTab === "inbox" && (
            <>
              {emails.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px", marginBottom: "2rem" }}>
                  {([
                    ["Important", grouped["Important"].length, "#E24B4A"],
                    ["Action Needed", grouped["Action Needed"].length, "#EF9F27"],
                    ["Tasks Found", totalTasks, "#7F77DD"],
                    ["Awaiting Reply", awaitingCount, "#E24B4A"],
                  ] as [string, number, string][]).map(([label, count, color]) => (
                    <div key={label} style={{ background: d.statBg, border: `1px solid ${d.cardBorder}`, borderRadius: "12px", padding: "1.1rem 1.25rem" }}>
                      <div style={{ fontSize: "1.8rem", fontWeight: 700, lineHeight: 1, color, fontVariantNumeric: "tabular-nums" }}>{count}</div>
                      <div style={{ fontSize: "0.75rem", color: d.textSub, marginTop: "4px" }}>{label}</div>
                    </div>
                  ))}
                </div>
              )}

              {analyzing && (
                <div style={{ marginBottom: "1.5rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: d.textSub, marginBottom: "6px" }}>
                    <span>Analyzing with AI...</span>
                    <span>{emails.filter(e => e.category).length} / {emails.length}</span>
                  </div>
                  <div style={{ height: "3px", background: d.navBorder, borderRadius: "999px", overflow: "hidden" }}>
                    <div style={{ height: "100%", background: "linear-gradient(90deg, #534AB7, #7F77DD)", borderRadius: "999px", transition: "width 0.4s ease", width: `${emails.length > 0 ? (emails.filter(e => e.category).length / emails.length) * 100 : 0}%` }} />
                  </div>
                </div>
              )}

              <button onClick={fetchAndAnalyze} disabled={isWorking} style={{ padding: "0.6rem 1.4rem", background: theme === "dark" ? "#fff" : "#111", color: theme === "dark" ? "#000" : "#fff", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "0.88rem", fontWeight: 500, fontFamily: "'DM Sans', sans-serif", marginBottom: "2rem", display: "inline-flex", alignItems: "center", gap: "8px", opacity: isWorking ? 0.5 : 1 }}>
                {isWorking && <div style={{ width: "14px", height: "14px", border: "2px solid #333", borderTopColor: "#666", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />}
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                {loading ? "Fetching emails..." : analyzing ? "Analyzing..." : "Organize my inbox"}
              </button>

              {emails.length === 0 && !isWorking && (
                <div style={{ textAlign: "center", padding: "5rem 0" }}>
                  <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: d.statBg, border: `1px solid ${d.cardBorder}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem" }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={d.emptyIcon} strokeWidth="1.5"><path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                  </div>
                  <p style={{ fontSize: "0.9rem", color: d.textFaint }}>Hit "Organize my inbox" to get started</p>
                </div>
              )}

              {(["Important", "Action Needed", "Other"] as const).map((section) =>
                grouped[section].length > 0 && (
                  <div key={section} style={{ marginBottom: "2rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "0.75rem", paddingBottom: "0.5rem", borderBottom: `1px solid ${d.divider}` }}>
                      <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: cat[section].dot, flexShrink: 0 }} />
                      <span style={{ fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: d.textFaint }}>{section}</span>
                      <span style={{ fontSize: "0.7rem", color: d.textFaint, background: d.statBg, padding: "1px 7px", borderRadius: "999px" }}>{grouped[section].length}</span>
                    </div>
                    {grouped[section].map((email, i) => {
                      const globalIdx = emails.indexOf(email);
                      const isOpen = expanded === globalIdx;
                      const hasExtra = email.summary || email.tasks?.length > 0;
                      return (
                        <div key={i} style={{ background: d.cardBg, border: `1px solid ${d.cardBorder}`, borderLeft: `2px solid ${cat[section].border}`, borderRadius: "12px", marginBottom: "8px", overflow: "hidden", cursor: "pointer" }}
                          onClick={() => hasExtra && setExpanded(isOpen ? null : globalIdx)}>
                          <div style={{ padding: "1rem 1.25rem" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", marginBottom: "3px" }}>
                              <strong style={{ fontSize: "0.88rem", fontWeight: 500, color: d.text, lineHeight: 1.4 }}>{email.subject}</strong>
                              {email.category && (
                                <span style={{ fontSize: "0.68rem", padding: "3px 8px", borderRadius: "5px", fontWeight: 500, whiteSpace: "nowrap", flexShrink: 0, background: cat[section].bg, color: cat[section].text }}>
                                  {email.category}
                                </span>
                              )}
                            </div>
                            <p style={{ fontSize: "0.75rem", color: d.textSub, marginBottom: "6px" }}>{email.from}</p>
                            {email.awaitingReply && (
                              <span style={{ fontSize: "0.7rem", color: "#E24B4A", background: "rgba(226,75,74,0.1)", padding: "2px 8px", borderRadius: "4px", display: "inline-block", marginBottom: "6px" }}>⚠ No reply in 48h</span>
                            )}
                            <p style={{ fontSize: "0.82rem", color: d.textMuted, lineHeight: 1.55 }}>{email.snippet}</p>
                          </div>
                          {isOpen && hasExtra && (
                            <div style={{ padding: "0 1.25rem 1rem", borderTop: `1px solid ${d.divider}` }}>
                              <div style={{ height: "1px", background: d.divider, marginBottom: "0.75rem" }} />
                              {email.summary && (
                                <div style={{ display: "flex", gap: "8px", alignItems: "flex-start", marginBottom: "0.75rem" }}>
                                  <div style={{ width: "16px", height: "16px", borderRadius: "4px", background: "rgba(127,119,221,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: "1px" }}>
                                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#7F77DD" strokeWidth="2.5"><path d="M9 12h6M9 8h6M9 16h4"/><rect x="3" y="3" width="18" height="18" rx="3"/></svg>
                                  </div>
                                  <p style={{ fontSize: "0.82rem", color: d.textMuted, lineHeight: 1.55 }}>{email.summary}</p>
                                </div>
                              )}
                              {email.tasks?.length > 0 && (
                                <div>
                                  <div style={{ fontSize: "0.72rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "#EF9F27", marginBottom: "6px" }}>Tasks</div>
                                  {email.tasks.map((t: string, j: number) => (
                                    <div key={j} style={{ display: "flex", alignItems: "flex-start", gap: "8px", marginBottom: "5px" }}>
                                      <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#EF9F27", flexShrink: 0, marginTop: "6px", opacity: 0.6 }} />
                                      <span style={{ fontSize: "0.82rem", color: d.textMuted, lineHeight: 1.4 }}>{t}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                              <div style={{ marginTop: "0.75rem" }}>
                                {replyOpen === globalIdx ? (
                                  <div onClick={e => e.stopPropagation()}>
                                    <textarea value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Write your reply..."
                                      style={{ width: "100%", minHeight: "80px", background: d.statBg, border: `1px solid ${d.cardBorder}`, borderRadius: "8px", color: d.text, fontSize: "0.82rem", padding: "0.6rem 0.75rem", fontFamily: "DM Sans, sans-serif", resize: "vertical", outline: "none" }} />
                                    <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
                                      <button onClick={() => sendReply(email, globalIdx)} disabled={sending || !replyText.trim()}
                                        style={{ padding: "0.4rem 1rem", background: "#534AB7", color: "#fff", border: "none", borderRadius: "6px", fontSize: "0.8rem", cursor: "pointer", opacity: sending || !replyText.trim() ? 0.5 : 1 }}>
                                        {sending ? "Sending..." : "Send"}
                                      </button>
                                      <button onClick={() => { setReplyOpen(null); setReplyText(""); }}
                                        style={{ padding: "0.4rem 1rem", background: "transparent", color: d.textMuted, border: `1px solid ${d.cardBorder}`, borderRadius: "6px", fontSize: "0.8rem", cursor: "pointer" }}>
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <button onClick={e => { e.stopPropagation(); setReplyOpen(globalIdx); }}
                                    style={{ padding: "0.35rem 0.9rem", background: "transparent", color: "#534AB7", border: "1px solid #534AB7", borderRadius: "6px", fontSize: "0.78rem", cursor: "pointer" }}>
                                    ↩ Reply
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}