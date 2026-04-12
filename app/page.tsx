"use client";
import { useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";

const cat = {
  "Important":    { border: "#E24B4A", bg: "#FCEBEB", text: "#A32D2D", dot: "#E24B4A" },
  "Action Needed":{ border: "#EF9F27", bg: "#FAEEDA", text: "#854F0B", dot: "#EF9F27" },
  "Other":        { border: "#B4B2A9", bg: "#F1EFE8", text: "#5F5E5A", dot: "#B4B2A9" },
};

export default function Home() {
  const { data: session } = useSession();
  const [emails, setEmails] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const fetchEmails = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/gmail");
      const data = await res.json();
      setEmails(data.emails || []);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const analyzeEmails = async () => {
    setAnalyzing(true);
    try {
      const updated = await Promise.all(
        emails.map(async (email) => {
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
    } catch (err) { console.error(err); }
    setAnalyzing(false);
  };

  const grouped = {
    "Important": emails.filter(e => e.category === "Important"),
    "Action Needed": emails.filter(e => e.category === "Action Needed"),
    "Other": emails.filter(e => !e.category || e.category === "Other"),
  };

  const totalTasks = emails.reduce((acc, e) => acc + (e.tasks?.length || 0), 0);

  if (!session) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif", padding: "2rem" }}>
        <div style={{ marginBottom: "2rem", display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "#534AB7", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
          </div>
          <span style={{ fontSize: "1.5rem", fontWeight: 600, color: "#fff", letterSpacing: "-0.02em" }}>Veltro</span>
        </div>

        <h1 style={{ fontSize: "2.5rem", fontWeight: 700, color: "#fff", textAlign: "center", margin: "0 0 1rem", letterSpacing: "-0.03em", lineHeight: 1.2 }}>
          Your inbox,<br/><span style={{ color: "#7F77DD" }}>intelligently organized</span>
        </h1>
        <p style={{ color: "#888", fontSize: "1.05rem", textAlign: "center", margin: "0 0 2.5rem", maxWidth: "400px" }}>
          Connect Gmail and let AI categorize, summarize, and extract tasks from your emails automatically.
        </p>

        <div style={{ display: "flex", gap: "2rem", marginBottom: "2.5rem" }}>
          {[["AI Categorization", "#FCEBEB", "#A32D2D"], ["Task Extraction", "#FAEEDA", "#854F0B"], ["Smart Summaries", "#EEEDFE", "#3C3489"]].map(([label, bg, color]) => (
            <div key={label} style={{ background: bg, borderRadius: "8px", padding: "8px 14px" }}>
              <span style={{ fontSize: "0.8rem", fontWeight: 500, color }}>{label}</span>
            </div>
          ))}
        </div>

        <button
          onClick={() => signIn("google")}
          style={{ display: "flex", alignItems: "center", gap: "10px", padding: "0.75rem 1.75rem", backgroundColor: "#fff", color: "#000", border: "none", borderRadius: "10px", cursor: "pointer", fontSize: "1rem", fontWeight: 500 }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          Sign in with Google
        </button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "system-ui, sans-serif", color: "#fff" }}>
      <div style={{ borderBottom: "1px solid #1a1a1a", padding: "1rem 2rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ width: "28px", height: "28px", borderRadius: "6px", background: "#534AB7", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
          </div>
          <span style={{ fontWeight: 600, fontSize: "1rem" }}>Veltro</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "0.875rem", color: "#666" }}>{session.user?.name}</span>
          <button onClick={() => signOut()} style={{ padding: "0.35rem 0.9rem", fontSize: "0.8rem", border: "1px solid #333", borderRadius: "6px", background: "transparent", color: "#999", cursor: "pointer" }}>Sign out</button>
        </div>
      </div>

      <div style={{ maxWidth: "760px", margin: "0 auto", padding: "2rem 1rem" }}>
        {emails.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "2rem" }}>
            {[
              ["Important", grouped["Important"].length, "#E24B4A"],
              ["Action needed", grouped["Action Needed"].length, "#EF9F27"],
              ["Tasks found", totalTasks, "#7F77DD"],
            ].map(([label, count, color]) => (
              <div key={label as string} style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: "10px", padding: "1rem" }}>
                <div style={{ fontSize: "1.6rem", fontWeight: 700, color: color as string }}>{count as number}</div>
                <div style={{ fontSize: "0.8rem", color: "#666", marginTop: "2px" }}>{label as string}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: "0.75rem", marginBottom: "2rem" }}>
          <button onClick={fetchEmails} style={{ padding: "0.55rem 1.25rem", backgroundColor: "#fff", color: "#000", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "0.9rem", fontWeight: 500 }}>
            {loading ? "Loading..." : "Fetch emails"}
          </button>
          {emails.length > 0 && (
            <button onClick={analyzeEmails} style={{ padding: "0.55rem 1.25rem", backgroundColor: "#534AB7", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "0.9rem", fontWeight: 500 }}>
              {analyzing ? "Analyzing..." : "Analyze with AI"}
            </button>
          )}
        </div>

        {emails.length === 0 && !loading && (
          <div style={{ textAlign: "center", padding: "4rem 0", color: "#444" }}>
            <p style={{ fontSize: "1rem" }}>Click "Fetch emails" to load your inbox</p>
          </div>
        )}

        {(["Important", "Action Needed", "Other"] as const).map((section) =>
          grouped[section].length > 0 && (
            <div key={section} style={{ marginBottom: "2rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "0.75rem" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: cat[section].dot }}></div>
                <span style={{ fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "#555" }}>{section}</span>
                <span style={{ fontSize: "0.75rem", color: "#444" }}>{grouped[section].length}</span>
              </div>
              {grouped[section].map((email, i) => (
                <div key={i} style={{ background: "#111", border: "1px solid #1e1e1e", borderLeft: `3px solid ${cat[section].border}`, borderRadius: "10px", padding: "1rem 1.25rem", marginBottom: "0.6rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "4px" }}>
                    <strong style={{ fontSize: "0.9rem", color: "#e0e0e0" }}>{email.subject}</strong>
                    {email.category && (
                      <span style={{ fontSize: "0.7rem", padding: "3px 8px", borderRadius: "4px", background: cat[section].bg, color: cat[section].text, marginLeft: "0.5rem", whiteSpace: "nowrap", fontWeight: 500 }}>{email.category}</span>
                    )}
                  </div>
                  <p style={{ fontSize: "0.78rem", color: "#555", margin: "0 0 6px" }}>{email.from}</p>
                  <p style={{ fontSize: "0.85rem", color: "#888", margin: "0 0 8px", lineHeight: 1.5 }}>{email.snippet}</p>
                  {email.summary && <p style={{ fontSize: "0.82rem", color: "#aaa", margin: "0 0 4px" }}><span style={{ color: "#7F77DD", fontWeight: 500 }}>Summary</span> — {email.summary}</p>}
                  {email.tasks?.length > 0 && (
                    <div style={{ marginTop: "8px" }}>
                      <span style={{ fontSize: "0.78rem", color: "#EF9F27", fontWeight: 500 }}>Tasks</span>
                      <ul style={{ margin: "4px 0 0 1rem", padding: 0, fontSize: "0.82rem", color: "#aaa" }}>
                        {email.tasks.map((t: string, j: number) => <li key={j} style={{ marginBottom: "2px" }}>{t}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}