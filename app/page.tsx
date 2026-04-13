"use client";
import { useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";

const cat = {
  "Important":     { border: "#E24B4A", bg: "rgba(226,75,74,0.08)", text: "#E24B4A", dot: "#E24B4A", label: "Important" },
  "Action Needed": { border: "#EF9F27", bg: "rgba(239,159,39,0.08)", text: "#EF9F27", dot: "#EF9F27", label: "Action Needed" },
  "Other":         { border: "#3a3a3a", bg: "rgba(255,255,255,0.03)", text: "#666", dot: "#444", label: "Other" },
};

export default function Home() {
  const { data: session } = useSession();
  const [emails, setEmails] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);

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
            body: JSON.stringify({
              emailText: `Subject: ${email.subject}\nFrom: ${email.from}\n\n${email.snippet}`,
            }),
          });
          const data = await res.json();
          return { ...email, ...data };
        })
      );
      setEmails(updated);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
    setAnalyzing(false);
  };

  const grouped = {
    "Important":     emails.filter(e => e.category === "Important"),
    "Action Needed": emails.filter(e => e.category === "Action Needed"),
    "Other":         emails.filter(e => !e.category || e.category === "Other"),
  };

  const totalTasks = emails.reduce((acc, e) => acc + (e.tasks?.length || 0), 0);
  const isWorking = loading || analyzing;

  // ── LANDING PAGE ──────────────────────────────────────────────────
  if (!session) {
    return (
      <>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap');
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { background: #080808; }

          .landing { min-height: 100vh; background: #080808; display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: 'DM Sans', sans-serif; padding: 2rem; position: relative; overflow: hidden; }

          .grid-bg {
            position: fixed; inset: 0; pointer-events: none;
            background-image: linear-gradient(rgba(83,74,183,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(83,74,183,0.06) 1px, transparent 1px);
            background-size: 48px 48px;
          }
          .glow { position: fixed; top: -200px; left: 50%; transform: translateX(-50%); width: 700px; height: 500px; background: radial-gradient(ellipse, rgba(83,74,183,0.18) 0%, transparent 70%); pointer-events: none; }

          .logo-wrap { display: flex; align-items: center; gap: 10px; margin-bottom: 2.5rem; }
          .logo-icon { width: 40px; height: 40px; border-radius: 10px; background: #534AB7; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 20px rgba(83,74,183,0.4); }
          .logo-text { font-family: 'Syne', sans-serif; font-size: 1.5rem; font-weight: 700; color: #fff; letter-spacing: -0.02em; }

          .headline { font-family: 'Syne', sans-serif; font-size: clamp(2.2rem, 6vw, 3.8rem); font-weight: 800; color: #fff; text-align: center; line-height: 1.1; letter-spacing: -0.04em; margin-bottom: 1.25rem; }
          .headline span { color: #7F77DD; }

          .subhead { color: #666; font-size: 1.05rem; text-align: center; max-width: 420px; line-height: 1.65; margin-bottom: 2.5rem; font-weight: 300; }

          .pills { display: flex; gap: 10px; margin-bottom: 2.8rem; flex-wrap: wrap; justify-content: center; }
          .pill { padding: 6px 14px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.04); font-size: 0.78rem; color: #888; font-weight: 400; letter-spacing: 0.01em; }

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
</svg>            </div>
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

  // ── DASHBOARD ─────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700&family=DM+Sans:wght@300;400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #080808; }

        .dash { min-height: 100vh; background: #080808; font-family: 'DM Sans', sans-serif; color: #fff; }

        /* NAV */
        .nav { border-bottom: 1px solid #141414; padding: 0.85rem 2rem; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; background: rgba(8,8,8,0.9); backdrop-filter: blur(12px); z-index: 10; }
        .nav-logo { display: flex; align-items: center; gap: 8px; }
        .nav-icon { width: 28px; height: 28px; border-radius: 7px; background: #534AB7; display: flex; align-items: center; justify-content: center; }
        .nav-name { font-family: 'Syne', sans-serif; font-weight: 700; font-size: 1rem; color: #fff; letter-spacing: -0.01em; }
        .nav-right { display: flex; align-items: center; gap: 12px; }
        .nav-user { font-size: 0.82rem; color: #444; }
        .nav-signout { padding: 0.3rem 0.85rem; font-size: 0.78rem; border: 1px solid #1e1e1e; border-radius: 6px; background: transparent; color: #555; cursor: pointer; font-family: 'DM Sans', sans-serif; transition: border-color 0.15s, color 0.15s; }
        .nav-signout:hover { border-color: #333; color: #888; }

        /* MAIN */
        .main { max-width: 720px; margin: 0 auto; padding: 2.5rem 1.5rem; }

        /* STAT CARDS */
        .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 2rem; }
        .stat { background: #0e0e0e; border: 1px solid #161616; border-radius: 12px; padding: 1.1rem 1.25rem; }
        .stat-num { font-family: 'Syne', sans-serif; font-size: 1.8rem; font-weight: 700; line-height: 1; }
        .stat-label { font-size: 0.75rem; color: #444; margin-top: 4px; font-weight: 400; }

        /* ORGANIZE BUTTON */
        .organize-btn { padding: 0.6rem 1.4rem; background: #fff; color: #000; border: none; border-radius: 8px; cursor: pointer; font-size: 0.88rem; font-weight: 500; font-family: 'DM Sans', sans-serif; transition: opacity 0.15s, transform 0.1s; margin-bottom: 2rem; display: inline-flex; align-items: center; gap: 8px; }
        .organize-btn:hover:not(:disabled) { opacity: 0.88; transform: translateY(-1px); }
        .organize-btn:disabled { background: #1a1a1a; color: #444; cursor: not-allowed; transform: none; }

        /* LOADING SPINNER */
        .spinner { width: 14px; height: 14px; border: 2px solid #333; border-top-color: #666; border-radius: 50%; animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* EMPTY STATE */
        .empty { text-align: center; padding: 5rem 0; }
        .empty-icon { width: 48px; height: 48px; border-radius: 12px; background: #111; border: 1px solid #1a1a1a; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem; }
        .empty-text { font-size: 0.9rem; color: #333; }

        /* SECTION HEADER */
        .section-head { display: flex; align-items: center; gap: 8px; margin-bottom: 0.75rem; padding-bottom: 0.5rem; border-bottom: 1px solid #111; }
        .section-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
        .section-label { font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: #444; }
        .section-count { font-size: 0.7rem; color: #2a2a2a; background: #141414; padding: 1px 7px; border-radius: 999px; }

        /* EMAIL CARD */
        .email-card { background: #0c0c0c; border: 1px solid #161616; border-radius: 12px; margin-bottom: 8px; overflow: hidden; transition: border-color 0.15s; cursor: pointer; }
        .email-card:hover { border-color: #222; }
        .email-card-inner { padding: 1rem 1.25rem; }
        .email-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 3px; }
        .email-subject { font-size: 0.88rem; font-weight: 500; color: #d0d0d0; line-height: 1.4; }
        .email-from { font-size: 0.75rem; color: #333; margin-bottom: 6px; }
        .email-snippet { font-size: 0.82rem; color: #555; line-height: 1.55; }

        /* EXPANDED CONTENT */
        .email-expanded { padding: 0 1.25rem 1rem; border-top: 1px solid #111; margin-top: 0; }
        .divider { height: 1px; background: #111; margin-bottom: 0.75rem; }
        .summary-block { display: flex; gap: 8px; align-items: flex-start; margin-bottom: 0.75rem; }
        .summary-icon { width: 16px; height: 16px; border-radius: 4px; background: rgba(127,119,221,0.15); display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px; }
        .summary-text { font-size: 0.82rem; color: #777; line-height: 1.55; }
        .tasks-block { }
        .tasks-title { font-size: 0.72rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #EF9F27; margin-bottom: 6px; }
        .task-item { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 5px; }
        .task-dot { width: 5px; height: 5px; border-radius: 50%; background: #EF9F27; flex-shrink: 0; margin-top: 6px; opacity: 0.6; }
        .task-text { font-size: 0.82rem; color: #666; line-height: 1.4; }

        /* CAT BADGE */
        .cat-badge { font-size: 0.68rem; padding: 3px 8px; border-radius: 5px; font-weight: 500; white-space: nowrap; flex-shrink: 0; }

        /* SECTION WRAP */
        .section-wrap { margin-bottom: 2rem; }

        /* PROGRESS BAR */
        .progress-wrap { margin-bottom: 1.5rem; }
        .progress-label { font-size: 0.75rem; color: #333; margin-bottom: 6px; display: flex; justify-content: space-between; }
        .progress-bar { height: 3px; background: #111; border-radius: 999px; overflow: hidden; }
        .progress-fill { height: 100%; background: linear-gradient(90deg, #534AB7, #7F77DD); border-radius: 999px; transition: width 0.4s ease; }
      `}</style>

      <div className="dash">
        {/* NAV */}
        <nav className="nav">
          <div className="nav-logo">
            <div className="nav-icon">
              <svg width="13" height="13" viewBox="0 0 100 130" fill="none">
  <polygon points="0,0 28,0 50,90 72,0 100,0 60,130 40,130" fill="#7F77DD"/>
  <polygon points="40,130 60,130 100,0 72,0" fill="#534AB7"/>
</svg>
            </div>
            <span className="nav-name">Veltro</span>
          </div>
          <div className="nav-right">
            <span className="nav-user">{session.user?.email}</span>
            <button className="nav-signout" onClick={() => signOut()}>Sign out</button>
          </div>
        </nav>

        <div className="main">

          {/* STAT CARDS — only show after emails loaded */}
          {emails.length > 0 && (
            <div className="stats">
              {([
                ["Important", grouped["Important"].length, "#E24B4A"],
                ["Action Needed", grouped["Action Needed"].length, "#EF9F27"],
                ["Tasks Found", totalTasks, "#7F77DD"],
              ] as [string, number, string][]).map(([label, count, color]) => (
                <div className="stat" key={label}>
                  <div className="stat-num" style={{ color }}>{count}</div>
                  <div className="stat-label">{label}</div>
                </div>
              ))}
            </div>
          )}

          {/* ANALYZING PROGRESS */}
          {analyzing && (
            <div className="progress-wrap">
              <div className="progress-label">
                <span>Analyzing with AI...</span>
                <span>{emails.filter(e => e.category).length} / {emails.length}</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${emails.length > 0 ? (emails.filter(e => e.category).length / emails.length) * 100 : 0}%` }} />
              </div>
            </div>
          )}

          {/* ORGANIZE BUTTON */}
          <button className="organize-btn" onClick={fetchAndAnalyze} disabled={isWorking}>
            {isWorking && <div className="spinner" />}
            {loading ? "Fetching emails..." : analyzing ? "Analyzing..." : "Organize my inbox"}
          </button>

          {/* EMPTY STATE */}
          {emails.length === 0 && !isWorking && (
            <div className="empty">
              <div className="empty-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="1.5"><path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
              </div>
              <p className="empty-text">Hit "Organize my inbox" to get started</p>
            </div>
          )}

          {/* EMAIL SECTIONS */}
          {(["Important", "Action Needed", "Other"] as const).map((section) =>
            grouped[section].length > 0 && (
              <div className="section-wrap" key={section}>
                <div className="section-head">
                  <div className="section-dot" style={{ background: cat[section].dot }} />
                  <span className="section-label">{section}</span>
                  <span className="section-count">{grouped[section].length}</span>
                </div>

                {grouped[section].map((email, i) => {
                  const globalIdx = emails.indexOf(email);
                  const isOpen = expanded === globalIdx;
                  const hasExtra = email.summary || email.tasks?.length > 0;
                  return (
                    <div
                      className="email-card"
                      key={i}
                      style={{ borderLeft: `2px solid ${cat[section].border}` }}
                      onClick={() => hasExtra && setExpanded(isOpen ? null : globalIdx)}
                    >
                      <div className="email-card-inner">
                        <div className="email-top">
                          <strong className="email-subject">{email.subject}</strong>
                          {email.category && (
                            <span className="cat-badge" style={{ background: cat[section].bg, color: cat[section].text }}>
                              {email.category}
                            </span>
                          )}
                        </div>
                        <p className="email-from">{email.from}</p>
                        <p className="email-snippet">{email.snippet}</p>
                      </div>

                      {isOpen && hasExtra && (
                        <div className="email-expanded">
                          <div className="divider" />
                          {email.summary && (
                            <div className="summary-block">
                              <div className="summary-icon">
                                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#7F77DD" strokeWidth="2.5"><path d="M9 12h6M9 8h6M9 16h4"/><rect x="3" y="3" width="18" height="18" rx="3"/></svg>
                              </div>
                              <p className="summary-text">{email.summary}</p>
                            </div>
                          )}
                          {email.tasks?.length > 0 && (
                            <div className="tasks-block">
                              <div className="tasks-title">Tasks</div>
                              {email.tasks.map((t: string, j: number) => (
                                <div className="task-item" key={j}>
                                  <div className="task-dot" />
                                  <span className="task-text">{t}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>
      </div>
    </>
  );
}