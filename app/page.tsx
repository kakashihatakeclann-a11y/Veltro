"use client";
import { useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";

const categoryColors: Record<string, { border: string; badge: string; label: string }> = {
  "Important": { border: "#E24B4A", badge: "#FCEBEB", label: "#A32D2D" },
  "Action Needed": { border: "#EF9F27", badge: "#FAEEDA", label: "#854F0B" },
  "Other": { border: "#B4B2A9", badge: "#F1EFE8", label: "#5F5E5A" },
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
    } catch (err) {
      console.error(err);
    }
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
    } catch (err) {
      console.error(err);
    }
    setAnalyzing(false);
  };

  const grouped = {
    "Important": emails.filter(e => e.category === "Important"),
    "Action Needed": emails.filter(e => e.category === "Action Needed"),
    "Other": emails.filter(e => !e.category || e.category === "Other"),
  };

  if (!session) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-sans, Arial)" }}>
        <h1 style={{ fontSize: "2rem", fontWeight: 500, marginBottom: "0.5rem" }}>Veltro</h1>
        <p style={{ color: "#888", marginBottom: "1.5rem" }}>Your AI-powered inbox, simplified.</p>
        <button onClick={() => signIn("google")} style={{ padding: "0.6rem 1.5rem", backgroundColor: "#000", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "1rem" }}>
          Sign in with Google
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "720px", margin: "0 auto", padding: "2rem 1rem", fontFamily: "var(--font-sans, Arial)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 500, margin: 0 }}>Veltro</h1>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span style={{ fontSize: "0.875rem", color: "#888" }}>{session.user?.name}</span>
          <button onClick={() => signOut()} style={{ padding: "0.4rem 0.9rem", fontSize: "0.875rem", border: "0.5px solid #ccc", borderRadius: "6px", background: "transparent", cursor: "pointer" }}>Sign out</button>
        </div>
      </div>

      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "2rem" }}>
        <button onClick={fetchEmails} style={{ padding: "0.5rem 1.2rem", backgroundColor: "#000", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "0.9rem" }}>
          {loading ? "Loading..." : "Fetch emails"}
        </button>
        {emails.length > 0 && (
          <button onClick={analyzeEmails} style={{ padding: "0.5rem 1.2rem", backgroundColor: "#534AB7", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "0.9rem" }}>
            {analyzing ? "Analyzing..." : "Analyze with AI"}
          </button>
        )}
      </div>

      {emails.length === 0 && !loading && (
        <p style={{ color: "#888", fontSize: "0.9rem" }}>No emails loaded yet. Click "Fetch emails" to start.</p>
      )}

      {(["Important", "Action Needed", "Other"] as const).map((cat) => (
        grouped[cat].length > 0 && (
          <div key={cat} style={{ marginBottom: "2rem" }}>
            <h2 style={{ fontSize: "0.8rem", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em", color: "#888", marginBottom: "0.75rem" }}>{cat}</h2>
            {grouped[cat].map((email, i) => {
              const colors = categoryColors[cat];
              return (
                <div key={i} style={{ background: "#fff", border: "0.5px solid #e0e0e0", borderLeft: `3px solid ${colors.border}`, borderRadius: "8px", padding: "1rem", marginBottom: "0.75rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.25rem" }}>
                    <strong style={{ fontSize: "0.95rem" }}>{email.subject}</strong>
                    {email.category && (
                      <span style={{ fontSize: "0.75rem", padding: "2px 8px", borderRadius: "4px", background: colors.badge, color: colors.label, whiteSpace: "nowrap", marginLeft: "0.5rem" }}>{email.category}</span>
                    )}
                  </div>
                  <p style={{ fontSize: "0.8rem", color: "#888", margin: "0 0 0.5rem" }}>{email.from}</p>
                  <p style={{ fontSize: "0.875rem", color: "#444", margin: "0 0 0.5rem" }}>{email.snippet}</p>
                  {email.summary && <p style={{ fontSize: "0.875rem", margin: "0 0 0.25rem" }}><strong>Summary:</strong> {email.summary}</p>}
                  {email.tasks && email.tasks.length > 0 && (
                    <div style={{ marginTop: "0.5rem" }}>
                      <strong style={{ fontSize: "0.875rem" }}>Tasks:</strong>
                      <ul style={{ margin: "0.25rem 0 0 1rem", padding: 0, fontSize: "0.875rem" }}>
                        {email.tasks.map((t: string, j: number) => <li key={j}>{t}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      ))}
    </div>
  );
}