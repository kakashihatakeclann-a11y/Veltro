"use client";
import { useState, useEffect, useRef } from "react";
import { useSession, signIn, signOut } from "next-auth/react";

const cat = {
  "Important":     { border: "#E24B4A", bg: "rgba(226,75,74,0.08)", text: "#E24B4A", dot: "#E24B4A", label: "IMPORTANT" },
  "Action Needed": { border: "#EF9F27", bg: "rgba(239,159,39,0.08)", text: "#EF9F27", dot: "#EF9F27", label: "ACTION" },
  "Other":         { border: "#2a2a2a", bg: "rgba(255,255,255,0.02)", text: "#555", dot: "#333", label: "OTHER" },
};

const FREE_AT_RISK_LIMIT = 5;

const decodeHtml = (text: string) => {
  if (!text) return text;
  return text
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
};

// "Jane Doe <jane@acme.com>" -> { name: "Jane Doe", email: "jane@acme.com" }
const parseSender = (from: string) => {
  if (!from) return { name: "Unknown", email: "" };
  const match = from.match(/^(.*?)\s*<([^>]+)>$/);
  if (match) {
    const name = decodeHtml(match[1].replace(/^"|"$/g, "").trim());
    return { name: name || match[2], email: match[2].trim() };
  }
  return { name: decodeHtml(from), email: from.trim() };
};

const formatEmailDate = (dateStr: string | null) => {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "";
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();
  const time = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (isToday) return time;
  if (isYesterday) return `Yesterday, ${time}`;
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString([], { month: "short", day: "numeric", year: sameYear ? undefined : "numeric" }) + `, ${time}`;
};

// Opens a ready-to-type Gmail compose window with the recipient already filled in.
const gmailReplyLink = (senderEmail: string) => `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(senderEmail)}`;

export default function Home() {
  const { data: session } = useSession();
  const [emails, setEmails] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"inbox" | "activity">("inbox");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [usage, setUsage] = useState({ analyzed: 0, tasks: 0 });
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showGoogleWarning, setShowGoogleWarning] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [trialActive, setTrialActive] = useState(false);
  const [trialDaysLeft, setTrialDaysLeft] = useState(0);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [feedbackGiven, setFeedbackGiven] = useState<Record<string, "up" | "down">>({});
  const [tagFilter, setTagFilter] = useState<"All" | "Buyer" | "Vendor" | "Seller">("All");
  const [showTasksPanel, setShowTasksPanel] = useState(false);
  const [completedTasks, setCompletedTasks] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const saved = localStorage.getItem("veltro_completed_tasks");
    if (saved) {
      try { setCompletedTasks(JSON.parse(saved)); } catch { /* ignore malformed cache */ }
    }
  }, []);

  const toggleTaskDone = (taskId: string) => {
    setCompletedTasks(prev => {
      const next = { ...prev, [taskId]: !prev[taskId] };
      localStorage.setItem("veltro_completed_tasks", JSON.stringify(next));
      return next;
    });
  };

  const sendFeedback = async (from: string, signal: "up" | "down" | "click") => {
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, signal }),
      });
    } catch {
      // best-effort — feedback loop shouldn't block the UI
    }
  };

  const giveFeedback = (email: any, signal: "up" | "down") => {
    setFeedbackGiven(prev => ({ ...prev, [email.id]: signal }));
    sendFeedback(email.from, signal);
  };

  const replyInGmail = (email: any) => {
    sendFeedback(email.from, "click");
    const { email: senderEmail } = parseSender(email.from);
    window.open(gmailReplyLink(senderEmail), "_blank", "noopener,noreferrer");
  };

  useEffect(() => {
    const savedTheme = localStorage.getItem("veltro_theme") as "dark" | "light" | null;
    if (savedTheme) setTheme(savedTheme);
    const savedUsage = localStorage.getItem("veltro_usage");
    if (savedUsage) {
      try {
        const parsed = JSON.parse(savedUsage);
        if (typeof parsed?.analyzed === "number" && typeof parsed?.tasks === "number") {
          setUsage(parsed);
        }
      } catch {
        // ignore malformed cache
      }
    }
  }, []);

  const toggleTheme = (t: "dark" | "light") => {
    setTheme(t);
    localStorage.setItem("veltro_theme", t);
  };

  const d = {
    bg:           theme === "dark" ? "#060606" : "#f2f2f0",
    navBg:        theme === "dark" ? "rgba(6,6,6,0.92)" : "rgba(242,242,240,0.92)",
    navBorder:    theme === "dark" ? "#111" : "#ddd",
    cardBg:       theme === "dark" ? "#0a0a0a" : "#ffffff",
    cardBorder:   theme === "dark" ? "#141414" : "#e4e4e4",
    statBg:       theme === "dark" ? "#0d0d0d" : "#ffffff",
    text:         theme === "dark" ? "#f0f0f0" : "#0d0d0d",
    textSub:      theme === "dark" ? "#555" : "#888",
    textMuted:    theme === "dark" ? "#888" : "#555",
    textFaint:    theme === "dark" ? "#333" : "#bbb",
    divider:      theme === "dark" ? "#111" : "#ebebeb",
    tabBg:        theme === "dark" ? "#0d0d0d" : "#e8e8e6",
    tabActiveBg:  theme === "dark" ? "#161616" : "#fff",
    tabActiveText:theme === "dark" ? "#f0f0f0" : "#0d0d0d",
    emptyIcon:    theme === "dark" ? "#222" : "#ccc",
    scanLine:     theme === "dark" ? "rgba(83,74,183,0.03)" : "rgba(83,74,183,0.02)",
  };

  const fetchAndAnalyze = async () => {
    setLoading(true);
    setAnalyzing(false);
    setEmails([]);
    setExpanded(null);
    setFetchError(null);
    setAnalysisProgress(0);
    let progInterval: ReturnType<typeof setInterval> | null = null;
    try {
      const res = await fetch("/api/gmail");
      if (!res.ok) {
  let message = `Gmail fetch failed: ${res.status}`;
  try {
    const errData = await res.json();
    if (errData?.error) message = errData.error;
  } catch {}
  throw new Error(message);
}
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const fetched = data.emails || [];
      if (data.isPro !== undefined) setIsPro(data.isPro);
      if (data.trialDaysLeft !== undefined) setTrialDaysLeft(data.trialDaysLeft);
      if (data.trialActive !== undefined) setTrialActive(data.trialActive);
      setEmails(fetched);
      setLoading(false);
      setAnalyzing(true);

      let prog = 0;
      progInterval = setInterval(() => {
        prog = Math.min(prog + Math.random() * 8, 85);
        setAnalysisProgress(prog);
      }, 200);

      const emailTexts = fetched.map((email: any) => {
        const received = email.date ? new Date(email.date) : null;
        const validDate = received && !isNaN(received.getTime());
        const hoursAgo = validDate ? Math.floor((Date.now() - received.getTime()) / 3600000) : null;
        const receivedLine = hoursAgo === null
          ? ""
          : hoursAgo < 1
            ? "Received: just now. The user has not replied yet.\n"
            : hoursAgo < 48
              ? `Received: ${hoursAgo} hour${hoursAgo === 1 ? "" : "s"} ago. The user has not replied yet.\n`
              : `Received: ${Math.floor(hoursAgo / 24)} day${Math.floor(hoursAgo / 24) === 1 ? "" : "s"} ago. The user has not replied yet.\n`;
        const stateLine = email.goneQuiet ? `The user ALREADY REPLIED to this thread ${email.daysSilent} day(s) ago and the contact has not come back since. The user owes nothing here.\n` : receivedLine;
        return `Subject: ${email.subject}\nFrom: ${email.from}\n${stateLine}\n${email.body || email.snippet}`;
      });
      const analysisRes = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails: emailTexts }),
      });
      if (!analysisRes.ok) throw new Error(`Analysis failed: ${analysisRes.status}`);
      const analysisData = await analysisRes.json();
      if (analysisData.error) throw new Error(analysisData.error);
      const results = analysisData.results || [];
      const updated = fetched.map((email: any, i: number) => ({ ...email, ...results[i] }));
      setEmails(updated);
      const newUsage = {
        analyzed: usage.analyzed + updated.length,
        tasks: usage.tasks + updated.reduce((acc: number, e: any) => acc + (e.tasks?.length || 0), 0),
      };
      setUsage(newUsage);
      localStorage.setItem("veltro_usage", JSON.stringify(newUsage));
    } catch (err: any) {
      console.error(err);
      setFetchError(err?.message || "Something went wrong. Please try again.");
    } finally {
      if (progInterval) clearInterval(progInterval);
      setAnalysisProgress(100);
      setLoading(false);
      setAnalyzing(false);
    }
  };

  const hasLoaded = useRef(false);
  useEffect(() => {
    if (session && !hasLoaded.current) {
      hasLoaded.current = true;
      fetchAndAnalyze();
    }
  }, [session]);

  const presentTags = Array.from(new Set(emails.map(e => e.contactType).filter(t => t && t !== "Other"))) as string[];
  const visibleEmails = tagFilter === "All" ? emails : emails.filter(e => e.contactType === tagFilter);

  // Gone-quiet threads get their own section, so keep them out of the triage
  // lists below — otherwise the same client shows up twice.
  const inboxEmails = visibleEmails.filter(e => !e.goneQuiet);

  const grouped = {
    "Important":     inboxEmails.filter(e => e.category === "Important"),
    "Action Needed": inboxEmails.filter(e => e.category === "Action Needed"),
    "Other":         inboxEmails.filter(e => !e.category || e.category === "Other"),
  };

  const totalTasks = visibleEmails.reduce((acc, e) => acc + (e.tasks?.length || 0), 0);
  const allAtRiskEmails = inboxEmails.filter(e => e.riskLevel === "high");
  const atRiskEmails = isPro ? allAtRiskEmails : allAtRiskEmails.slice(0, FREE_AT_RISK_LIMIT);
  const atRiskHidden = isPro ? 0 : Math.max(0, allAtRiskEmails.length - FREE_AT_RISK_LIMIT);
  const awaitingCount = visibleEmails.filter(e => e.awaitingReply).length;
  const isWorking = loading || analyzing;

  const allTasks = emails.flatMap((e, ei) =>
    (e.tasks || []).map((t: string, ti: number) => ({ id: `${e.id || ei}-${ti}`, text: t, subject: e.subject, emailId: e.id }))
  );
  const openTasksCount = allTasks.filter(t => !completedTasks[t.id]).length;

  const getUrgencyScore = (email: any) => {
    let score = 0;
    if (email.deadline) score += 10;
    if (email.awaitingReply) score += 5;
    if (email.category === "Important") score += 3;
    if (email.category === "Action Needed") score += 2;
    return score;
  };

  const sortedAtRisk = [...atRiskEmails].sort((a, b) => getUrgencyScore(b) - getUrgencyScore(a));

  // Clients who went quiet after the user replied. Nothing arrives to remind
  // you about these, so they're the ones that quietly cost deals. "Other" means
  // the analyzer judged the thread finished or automated — those would bury the
  // ones that matter.
  const goneQuietEmails = visibleEmails
    .filter(e => e.goneQuiet && e.category && e.category !== "Other")
    .sort((a, b) => (b.daysSilent || 0) - (a.daysSilent || 0));

  const elapsedLabel = (email: any) => {
    if (!email.date) return null;
    const received = new Date(email.date);
    if (isNaN(received.getTime())) return null;
    const hours = Math.floor((Date.now() - received.getTime()) / 3600000);
    if (hours < 1) return "JUST NOW";
    if (hours < 24) return `${hours}H`;
    return `${Math.floor(hours / 24)}D`;
  };

  const renderRiskBadge = (email: any) => {
    const elapsed = elapsedLabel(email);
    if (email.deadline && email.awaitingReply) return (
      <span style={{ fontSize: "0.65rem", padding: "2px 7px", borderRadius: "4px", background: "rgba(226,75,74,0.2)", color: "#E24B4A", fontWeight: 700, letterSpacing: "0.05em" }}>DEADLINE + NO REPLY</span>
    );
    if (email.deadline) return (
      <span style={{ fontSize: "0.65rem", padding: "2px 7px", borderRadius: "4px", background: "rgba(226,75,74,0.15)", color: "#E24B4A", fontWeight: 700, letterSpacing: "0.05em" }}>DEADLINE</span>
    );
    if (email.awaitingReply) return (
      <span style={{ fontSize: "0.65rem", padding: "2px 7px", borderRadius: "4px", background: "rgba(239,159,39,0.15)", color: "#EF9F27", fontWeight: 700, letterSpacing: "0.05em" }}>NO REPLY{elapsed ? ` · ${elapsed}` : ""}</span>
    );
    return <span style={{ fontSize: "0.65rem", padding: "2px 7px", borderRadius: "4px", background: "rgba(226,75,74,0.12)", color: "#E24B4A", fontWeight: 700, letterSpacing: "0.05em" }}>HIGH RISK</span>;
  };

  const renderEmailCard = (email: any, i: number, isAtRisk = false) => {
    const globalIdx = emails.indexOf(email);
    const isOpen = expanded === globalIdx;
    const borderColor = isAtRisk ? "#E24B4A" : cat[email.category as keyof typeof cat]?.border || "#2a2a2a";
    const bgColor = isAtRisk
      ? (theme === "dark" ? "rgba(226,75,74,0.04)" : "rgba(226,75,74,0.03)")
      : d.cardBg;

    return (
      <div
        key={globalIdx}
        style={{
          background: bgColor,
          border: `1px solid ${isAtRisk ? "rgba(226,75,74,0.2)" : d.cardBorder}`,
          borderLeft: `2px solid ${borderColor}`,
          borderRadius: "10px",
          marginBottom: "6px",
          overflow: "hidden",
          cursor: "pointer",
          transition: "border-color 0.15s, background 0.15s",
        }}
        onClick={() => setExpanded(isOpen ? null : globalIdx)}
      >
        <div style={{ padding: "0.9rem 1.1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px", marginBottom: "4px" }}>
            <strong style={{ fontSize: "0.87rem", fontWeight: 500, color: d.text, lineHeight: 1.35, flex: 1 }}>{decodeHtml(email.subject)}</strong>
            <div style={{ display: "flex", gap: "5px", flexShrink: 0, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
              {email.analysisFailed && (
                <span style={{ fontSize: "0.63rem", padding: "2px 7px", borderRadius: "4px", fontWeight: 700, letterSpacing: "0.06em", background: "rgba(136,136,136,0.12)", color: "#888" }}>
                  ANALYSIS UNAVAILABLE
                </span>
              )}
              {isAtRisk ? renderRiskBadge(email) : email.category && email.category !== "Other" && (
                <span style={{
                  fontSize: "0.63rem", padding: "2px 7px", borderRadius: "4px", fontWeight: 700,
                  letterSpacing: "0.06em",
                  background: cat[email.category as keyof typeof cat]?.bg,
                  color: cat[email.category as keyof typeof cat]?.text,
                }}>
                  {cat[email.category as keyof typeof cat]?.label}
                </span>
              )}
              {email.id && (
                <button
                  onClick={e => { e.stopPropagation(); replyInGmail(email); }}
                  title="Reply in Gmail"
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "20px", height: "20px", padding: 0, border: "none", borderRadius: "4px", background: "transparent", cursor: "pointer", flexShrink: 0 }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={d.textFaint} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/>
                  </svg>
                </button>
              )}
            </div>
          </div>
          {(() => {
            const { name, email: senderEmail } = parseSender(email.from);
            const when = formatEmailDate(email.date);
            return (
              <div style={{ display: "flex", alignItems: "baseline", gap: "6px", flexWrap: "wrap", marginBottom: "5px" }}>
                <span style={{ fontSize: "0.78rem", color: d.text, fontWeight: 500 }}>{name}</span>
                {senderEmail && senderEmail !== name && (
                  <span style={{ fontSize: "0.72rem", color: d.textSub, fontFamily: "monospace" }}>{senderEmail}</span>
                )}
                {when && (
                  <span style={{ fontSize: "0.68rem", color: d.textFaint, marginLeft: "auto" }}>{when}</span>
                )}
              </div>
            );
          })()}
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: email.snippet ? "6px" : 0 }}>
            {email.contactType && email.contactType !== "Other" && (
              <span style={{ fontSize: "0.68rem", padding: "1px 7px", borderRadius: "999px", border: `1px solid ${d.cardBorder}`, color: d.textMuted }}>
                {email.contactType}
              </span>
            )}
            {email.deadline && (
              <span style={{ fontSize: "0.72rem", color: "#E24B4A", display: "flex", alignItems: "center", gap: "3px" }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#E24B4A" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                {decodeHtml(email.deadline)}
              </span>
            )}
            {email.awaitingReply && (
              <span style={{ fontSize: "0.72rem", color: "#EF9F27", display: "flex", alignItems: "center", gap: "3px" }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#EF9F27" strokeWidth="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                Awaiting reply
              </span>
            )}
            {email.tasks?.length > 0 && (
              <span style={{ fontSize: "0.72rem", color: "#7F77DD", display: "flex", alignItems: "center", gap: "3px" }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#7F77DD" strokeWidth="2.5"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                {email.tasks.length} task{email.tasks.length > 1 ? "s" : ""}
              </span>
            )}
          </div>
          {!isAtRisk && (
            <p style={{ fontSize: "0.8rem", color: d.textMuted, lineHeight: 1.5, marginTop: "2px" }}>{decodeHtml(email.snippet)}</p>
          )}
        </div>
        {isOpen && (
          <div
            style={{ padding: "0 1.1rem 1rem", borderTop: `1px solid ${isAtRisk ? "rgba(226,75,74,0.15)" : d.divider}` }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ height: "1px", background: isAtRisk ? "rgba(226,75,74,0.1)" : d.divider, marginBottom: "0.8rem" }} />
            {isAtRisk && email.snippet && (
              <p style={{ fontSize: "0.8rem", color: d.textMuted, lineHeight: 1.5, marginBottom: "0.8rem" }}>{decodeHtml(email.snippet)}</p>
            )}
            {email.summary && (
              <div style={{ marginBottom: "0.8rem", padding: "0.65rem 0.85rem", background: theme === "dark" ? "rgba(127,119,221,0.06)" : "rgba(127,119,221,0.05)", borderRadius: "8px", borderLeft: "2px solid rgba(127,119,221,0.3)" }}>
                <div style={{ fontSize: "0.67rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#7F77DD", marginBottom: "5px" }}>AI Summary</div>
                <p style={{ fontSize: "0.82rem", color: d.textMuted, lineHeight: 1.6 }}>{decodeHtml(email.summary)}</p>
              </div>
            )}
            {email.tasks?.length > 0 && (
              <div style={{ marginBottom: "0.5rem" }}>
                <div style={{ fontSize: "0.67rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#EF9F27", marginBottom: "8px" }}>Tasks</div>
                {email.tasks.map((t: string, j: number) => (
                  <div key={j} style={{ display: "flex", alignItems: "flex-start", gap: "8px", marginBottom: "6px" }}>
                    <div style={{ width: "4px", height: "4px", borderRadius: "50%", background: "#EF9F27", flexShrink: 0, marginTop: "7px", opacity: 0.7 }} />
                    <span style={{ fontSize: "0.81rem", color: d.textMuted, lineHeight: 1.45 }}>{decodeHtml(t)}</span>
                  </div>
                ))}
              </div>
            )}
            {email.deadline && (
              <div style={{ marginTop: "0.5rem", padding: "0.5rem 0.85rem", background: "rgba(226,75,74,0.07)", borderRadius: "7px", display: "flex", alignItems: "center", gap: "8px" }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#E24B4A" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <span style={{ fontSize: "0.8rem", color: "#E24B4A" }}>Deadline: <strong>{decodeHtml(email.deadline)}</strong></span>
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", marginTop: "0.9rem", paddingTop: "0.75rem", borderTop: `1px solid ${isAtRisk ? "rgba(226,75,74,0.1)" : d.divider}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ fontSize: "0.68rem", color: d.textFaint, marginRight: "2px" }}>Was this useful?</span>
                {(["up", "down"] as const).map(signal => (
                  <button
                    key={signal}
                    onClick={() => giveFeedback(email, signal)}
                    title={signal === "up" ? "Important to me" : "Not important"}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "center", width: "24px", height: "24px",
                      border: `1px solid ${feedbackGiven[email.id] === signal ? (signal === "up" ? "#7F77DD" : "#E24B4A") : d.cardBorder}`,
                      borderRadius: "6px",
                      background: feedbackGiven[email.id] === signal ? (signal === "up" ? "rgba(127,119,221,0.12)" : "rgba(226,75,74,0.1)") : "transparent",
                      cursor: "pointer",
                    }}
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={feedbackGiven[email.id] === signal ? (signal === "up" ? "#7F77DD" : "#E24B4A") : d.textFaint} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: signal === "down" ? "rotate(180deg)" : undefined }}>
                      <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
                    </svg>
                  </button>
                ))}
              </div>
              {email.id && (
                <button
                  onClick={() => replyInGmail(email)}
                  style={{ fontSize: "0.75rem", color: "#7F77DD", background: "transparent", border: "none", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontWeight: 500, display: "flex", alignItems: "center", gap: "4px" }}
                >
                  Reply in Gmail
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#7F77DD" strokeWidth="2.5"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  /* ─── LANDING PAGE ─── */
  if (!session) {
    return (
      <>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&display=swap');
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          html, body { height: 100%; }
          body { background: #060606; font-family: 'DM Sans', sans-serif; }
          .landing { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2rem; position: relative; overflow: hidden; }
          .noise { position: fixed; inset: 0; pointer-events: none; opacity: 0.025; background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E"); background-size: 128px 128px; mix-blend-mode: overlay; }
          .grid { position: fixed; inset: 0; pointer-events: none; background-image: linear-gradient(rgba(83,74,183,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(83,74,183,0.04) 1px, transparent 1px); background-size: 44px 44px; }
          .orb { position: fixed; border-radius: 50%; pointer-events: none; filter: blur(80px); }
          .orb1 { width: 600px; height: 400px; top: -150px; left: 50%; transform: translateX(-50%); background: radial-gradient(ellipse, rgba(83,74,183,0.22) 0%, transparent 70%); }
          .orb2 { width: 300px; height: 300px; bottom: 5%; right: 5%; background: radial-gradient(ellipse, rgba(226,75,74,0.1) 0%, transparent 70%); }
          .logo-wrap { display: flex; align-items: center; gap: 10px; margin-bottom: 3rem; }
          .logo-icon { width: 38px; height: 38px; border-radius: 9px; background: #534AB7; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 24px rgba(83,74,183,0.5); }
          .logo-text { font-family: 'Syne', sans-serif; font-size: 1.4rem; font-weight: 700; color: #f0f0f0; letter-spacing: -0.02em; }
          .eyebrow { font-size: 0.7rem; font-weight: 600; letter-spacing: 0.15em; text-transform: uppercase; color: #534AB7; margin-bottom: 1.2rem; display: flex; align-items: center; gap: 8px; }
          .eyebrow::before, .eyebrow::after { content: ''; flex: 1; height: 1px; background: rgba(83,74,183,0.3); max-width: 40px; }
          .headline { font-family: 'Syne', sans-serif; font-size: clamp(2.2rem, 6vw, 3.8rem); font-weight: 800; color: #f0f0f0; text-align: center; line-height: 1.05; letter-spacing: -0.04em; margin-bottom: 1.4rem; max-width: 700px; }
          .headline em { color: #7F77DD; font-style: normal; }
          .subhead { color: #555; font-size: 1rem; text-align: center; max-width: 420px; line-height: 1.7; margin-bottom: 2.5rem; font-weight: 300; }
          .alert-card { background: rgba(226,75,74,0.06); border: 1px solid rgba(226,75,74,0.18); border-radius: 10px; padding: 12px 16px; margin-bottom: 2.5rem; max-width: 420px; display: flex; gap: 12px; align-items: flex-start; }
          .alert-icon { font-size: 1rem; flex-shrink: 0; margin-top: 1px; }
          .alert-text { font-size: 0.8rem; color: #999; line-height: 1.6; }
          .alert-text strong { color: #E24B4A; font-weight: 500; }
          .features { display: flex; gap: 8px; margin-bottom: 2.5rem; flex-wrap: wrap; justify-content: center; }
          .feature { padding: 5px 12px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.06); background: rgba(255,255,255,0.02); font-size: 0.75rem; color: #555; display: flex; align-items: center; gap: 5px; }
          .feature-dot { width: 5px; height: 5px; border-radius: 50%; background: #534AB7; }
          .signin-btn { display: flex; align-items: center; gap: 10px; padding: 0.75rem 1.75rem; background: #f0f0f0; color: #060606; border: none; border-radius: 10px; cursor: pointer; font-size: 0.9rem; font-weight: 500; font-family: 'DM Sans', sans-serif; transition: opacity 0.15s, transform 0.15s; box-shadow: 0 4px 28px rgba(0,0,0,0.5); }
          .signin-btn:hover { opacity: 0.92; transform: translateY(-1px); }
          .trust-row { margin-top: 1.25rem; display: flex; gap: 16px; align-items: center; justify-content: center; }
          .trust-item { font-size: 0.72rem; color: #2a2a2a; display: flex; align-items: center; gap: 4px; }
          .footer-links { margin-top: 1.5rem; display: flex; gap: 16px; }
          .footer-link { font-size: 0.72rem; color: #2a2a2a; text-decoration: none; transition: color 0.15s; }
          .footer-link:hover { color: #555; }
          @keyframes fadeIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
          .warning-modal { animation: fadeIn 0.18s ease; }
        `}</style>
        <div className="landing">
          <div className="noise" />
          <div className="grid" />
          <div className="orb orb1" />
          <div className="orb orb2" />
          <div className="logo-wrap">
            <div className="logo-icon">
              <svg width="16" height="16" viewBox="0 0 100 130" fill="none">
                <polygon points="0,0 28,0 50,90 72,0 100,0 60,130 40,130" fill="#7F77DD"/>
                <polygon points="40,130 60,130 100,0 72,0" fill="#534AB7"/>
              </svg>
            </div>
            <span className="logo-text">Veltro</span>
          </div>
          <div className="eyebrow">Your inbox, organized</div>
          <h1 className="headline">
            One missed email.<br/><em>One lost client.</em>
          </h1>
          <p className="subhead">
            Veltro scans your Gmail and surfaces every at-risk deadline before it costs you — so nothing slips through, whatever work you do.
          </p>
          <div className="alert-card">
            <span className="alert-icon">⚠️</span>
            <p className="alert-text">
              <strong>You don't lose clients over bad work.</strong> You lose them over missed follow-ups, buried deadlines, and forgotten emails. Veltro fixes that.
            </p>
          </div>
          <div className="features">
            {["At Risk Radar","Deadline Detection","AI Summaries","Task Extraction","Smart Categories","Awaiting Reply"].map(l => (
              <div key={l} className="feature">
                <div className="feature-dot" />
                {l}
              </div>
            ))}
          </div>
<button className="signin-btn" onClick={async () => { try { await fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event: "google_click", timestamp: new Date().toISOString() }) }); } catch {} setShowGoogleWarning(true); }}>            <svg width="17" height="17" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.43-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Continue with Google
          </button>
          <div className="trust-row">
            <span className="trust-item">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#2a2a2a" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              Read-only access
            </span>
            <span style={{ color: "#1a1a1a", fontSize: "0.72rem" }}>·</span>
            <span className="trust-item">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#2a2a2a" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              No email storage
            </span>
            <span style={{ color: "#1a1a1a", fontSize: "0.72rem" }}>·</span>
            <span className="trust-item">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#2a2a2a" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              60s setup
            </span>
          </div>
          <div className="footer-links">
            <a href="/privacy" className="footer-link">Privacy Policy</a>
            <a href="/terms" className="footer-link">Terms of Service</a>
          </div>
        </div>

        {/* GOOGLE WARNING MODAL */}
        {showGoogleWarning && (
          <div
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", backdropFilter: "blur(6px)" }}
            onClick={() => setShowGoogleWarning(false)}
          >
            <div
              className="warning-modal"
              style={{ background: "#0d0d0d", border: "1px solid #222", borderRadius: "20px", padding: "2rem", maxWidth: "380px", width: "100%", boxShadow: "0 32px 80px rgba(0,0,0,0.8)" }}
              onClick={e => e.stopPropagation()}
            >
              {/* Icon */}
              <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: "rgba(239,159,39,0.1)", border: "1px solid rgba(239,159,39,0.25)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1.25rem" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#EF9F27" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>

              {/* Title */}
              <div style={{ fontSize: "1.15rem", fontWeight: 700, color: "#f0f0f0", fontFamily: "'Syne', sans-serif", marginBottom: "0.5rem", letterSpacing: "-0.01em" }}>
                Before you continue
              </div>

              {/* Body */}
              <p style={{ fontSize: "0.84rem", color: "#777", lineHeight: 1.75, marginBottom: "1rem" }}>
                Google is currently reviewing Veltro. On the next screen you'll see a standard security notice for apps under review.
              </p>

              {/* Steps */}
              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid #1a1a1a", borderRadius: "12px", padding: "1rem 1.1rem", marginBottom: "1.5rem" }}>
                {[
                  { step: "1", text: 'Click "Advanced" at the bottom left' },
                  { step: "2", text: 'Click "Go to Veltro (unsafe)"' },
                  { step: "3", text: "Review Gmail read-only permissions" },
                  { step: "4", text: "Click Allow to continue" },
                ].map(({ step, text }) => (
                  <div key={step} style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: step === "4" ? 0 : "0.65rem" }}>
                    <div style={{ width: "20px", height: "20px", borderRadius: "50%", background: "rgba(83,74,183,0.15)", border: "1px solid rgba(83,74,183,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "#7F77DD" }}>{step}</span>
                    </div>
                    <span style={{ fontSize: "0.8rem", color: "#888" }}>{text}</span>
                  </div>
                ))}
              </div>

              {/* Security note */}
              <div style={{ display: "flex", gap: "8px", alignItems: "flex-start", marginBottom: "1.5rem", padding: "0.75rem 1rem", background: "rgba(83,74,183,0.05)", border: "1px solid rgba(83,74,183,0.15)", borderRadius: "10px" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="2.5" style={{ flexShrink: 0, marginTop: "1px" }}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                <span style={{ fontSize: "0.75rem", color: "#444", lineHeight: 1.6 }}>Veltro requests <strong style={{ color: "#534AB7" }}>read-only</strong> Gmail access. We never send, delete, or store your emails.</span>
              </div>

              {/* CTA */}
              <button
                onClick={() => { setShowGoogleWarning(false); signIn("google"); }}
                style={{ width: "100%", padding: "0.8rem", background: "linear-gradient(135deg, #534AB7, #7F77DD)", color: "#fff", border: "none", borderRadius: "11px", fontSize: "0.9rem", fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", boxShadow: "0 4px 20px rgba(83,74,183,0.35)", letterSpacing: "-0.01em" }}
              >
                Got it — continue with Google
              </button>
              <button
                onClick={() => setShowGoogleWarning(false)}
                style={{ width: "100%", marginTop: "0.6rem", padding: "0.5rem", background: "transparent", border: "none", color: "#333", fontSize: "0.75rem", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // Ties the checkout to the signed-in account: prefills the email (convenience)
  // and passes it as custom data, which LemonSqueezy echoes back on the webhook
  // regardless of what the customer types/edits in the checkout email field —
  // otherwise a mismatched checkout email leaves a paying customer stuck on Free.
  const accountEmail = session.user?.email || "";
  const checkoutUrl = `https://veltro.lemonsqueezy.com/checkout/buy/516e106c-4b5a-42eb-8a08-a209c900c5d8?checkout[email]=${encodeURIComponent(accountEmail)}&checkout[custom][user_email]=${encodeURIComponent(accountEmail)}`;

  /* ─── APP ─── */
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${d.bg}; transition: background 0.2s; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse-dot { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        .email-card:hover { border-color: rgba(83,74,183,0.25) !important; }
        .risk-card:hover { border-color: rgba(226,75,74,0.35) !important; }
        .theme-btn:hover { opacity: 0.75; }
      `}</style>

      <div style={{ minHeight: "100vh", background: d.bg, fontFamily: "'DM Sans', sans-serif", color: d.text, transition: "all 0.2s", paddingBottom: "70px" }}>

        <div style={{ position: "sticky", top: 0, zIndex: 10 }}>
        {trialActive && (
          <div style={{ background: "linear-gradient(135deg, #534AB7, #7F77DD)", padding: "0.45rem 2rem", textAlign: "center", fontSize: "0.75rem", color: "rgba(255,255,255,0.9)", letterSpacing: "0.01em" }}>
            🎉 Trial active — <strong>{trialDaysLeft} day{trialDaysLeft !== 1 ? "s" : ""} left</strong> ·{" "}
            <span style={{ textDecoration: "underline", cursor: "pointer", opacity: 0.8 }} onClick={() => setShowUpgrade(true)}>Upgrade to keep Pro access</span>
          </div>
        )}

        <nav style={{
          borderBottom: `1px solid ${d.navBorder}`,
          padding: "0.8rem 1.75rem",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: d.navBg, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ width: "26px", height: "26px", borderRadius: "6px", background: "#534AB7", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="12" height="12" viewBox="0 0 100 130" fill="none">
                <polygon points="0,0 28,0 50,90 72,0 100,0 60,130 40,130" fill="#7F77DD"/>
                <polygon points="40,130 60,130 100,0 72,0" fill="#534AB7"/>
              </svg>
            </div>
            <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "0.95rem", color: d.text, letterSpacing: "-0.01em" }}>Veltro</span>
            {isPro && (
              <span style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.1em", color: "#7F77DD", background: "rgba(127,119,221,0.1)", padding: "2px 6px", borderRadius: "4px", border: "1px solid rgba(127,119,221,0.2)" }}>PRO</span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button onClick={() => setShowTasksPanel(true)} style={{ position: "relative", display: "flex", alignItems: "center", gap: "6px", padding: "0.35rem 0.7rem", border: `1px solid ${d.navBorder}`, borderRadius: "7px", background: "transparent", color: d.textMuted, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontSize: "0.78rem" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={d.textMuted} strokeWidth="2" strokeLinecap="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
              Tasks
              {openTasksCount > 0 && (
                <span style={{ fontSize: "0.62rem", fontWeight: 700, color: "#fff", background: "#7F77DD", borderRadius: "999px", padding: "1px 6px", minWidth: "16px", textAlign: "center" }}>{openTasksCount}</span>
              )}
            </button>
            <div style={{ display: "flex", gap: "3px", background: d.tabBg, border: `1px solid ${d.cardBorder}`, borderRadius: "8px", padding: "3px" }}>
              <button className="theme-btn" onClick={() => toggleTheme("dark")} title="Dark"
                style={{ width: "26px", height: "26px", borderRadius: "5px", background: theme === "dark" ? "#1a1a2e" : "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={theme === "dark" ? "#7F77DD" : d.textFaint} strokeWidth="2" strokeLinecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
              </button>
              <button className="theme-btn" onClick={() => toggleTheme("light")} title="Light"
                style={{ width: "26px", height: "26px", borderRadius: "5px", background: theme === "light" ? "#fffbe6" : "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={theme === "light" ? "#f59e0b" : d.textFaint} strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                  <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                </svg>
              </button>
            </div>
            <button onClick={() => signOut()} style={{ padding: "0.28rem 0.75rem", fontSize: "0.75rem", border: `1px solid ${d.navBorder}`, borderRadius: "6px", background: "transparent", color: d.textMuted, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
              Sign out
            </button>
          </div>
        </nav>
        </div>

        <div style={{ maxWidth: "680px", margin: "0 auto", padding: "2rem 1.25rem" }}>
          <div style={{ display: "flex", gap: "3px", marginBottom: "1.75rem", background: d.tabBg, border: `1px solid ${d.cardBorder}`, borderRadius: "9px", padding: "3px", width: "fit-content" }}>
            {(["inbox", "activity"] as const).map(t => (
              <button key={t} onClick={() => setActiveTab(t)} style={{
                padding: "0.35rem 0.9rem", borderRadius: "6px", fontSize: "0.78rem", cursor: "pointer",
                border: "none", background: activeTab === t ? d.tabActiveBg : "transparent",
                color: activeTab === t ? d.tabActiveText : d.textFaint,
                fontFamily: "'DM Sans', sans-serif", transition: "all 0.15s", textTransform: "capitalize",
                fontWeight: activeTab === t ? 500 : 400,
              }}>
                {t}
              </button>
            ))}
          </div>

          {activeTab === "activity" && (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px", marginBottom: "1.5rem" }}>
                {[
                  { num: usage.analyzed, label: "Emails analyzed", color: "#7F77DD", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7F77DD" strokeWidth="1.8"><path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg> },
                  { num: usage.tasks, label: "Tasks extracted", color: "#EF9F27", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#EF9F27" strokeWidth="1.8"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg> },
                  { num: allAtRiskEmails.length, label: "At Risk flagged", color: "#E24B4A", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#E24B4A" strokeWidth="1.8"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> },
                  { num: awaitingCount, label: "Awaiting reply", color: "#55b3a0", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#55b3a0" strokeWidth="1.8"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> },
                ].map(({ num, label, color, icon }) => (
                  <div key={label} style={{ background: d.statBg, border: `1px solid ${d.cardBorder}`, borderRadius: "10px", padding: "1.1rem 1.2rem", display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ fontSize: "2rem", fontWeight: 700, lineHeight: 1, color, fontVariantNumeric: "tabular-nums" }}>{num}</div>
                      <div style={{ opacity: 0.6 }}>{icon}</div>
                    </div>
                    <div style={{ fontSize: "0.75rem", color: d.textSub }}>{label}</div>
                  </div>
                ))}
              </div>
              {!isPro && (
                <div style={{ fontSize: "0.78rem", color: d.textMuted, background: d.statBg, border: `1px solid ${d.cardBorder}`, borderRadius: "10px", padding: "0.9rem 1.2rem", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
                  <span>{trialActive ? `Trial · ${trialDaysLeft} days left` : `Free plan · ${FREE_AT_RISK_LIMIT} At Risk · 20 emails/day`}</span>
                  <button onClick={() => setShowUpgrade(true)} style={{ padding: "0.3rem 0.75rem", background: "linear-gradient(135deg, #534AB7, #7F77DD)", color: "#fff", border: "none", borderRadius: "6px", fontSize: "0.72rem", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", fontFamily: "'DM Sans', sans-serif" }}>
                    Go Pro ✨
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === "inbox" && (
            <>
              {emails.length > 0 && !isWorking && (
                <div style={{ background: "linear-gradient(135deg, rgba(83,74,183,0.08), rgba(127,119,221,0.04))", border: "1px solid rgba(83,74,183,0.2)", borderRadius: "12px", padding: "1rem 1.2rem", marginBottom: "1.5rem" }}>
                  <div style={{ fontSize: "0.85rem", color: d.text, lineHeight: 1.6 }}>
                    👋 <strong>It&apos;s {new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.</strong>{" "}
                    {sortedAtRisk.length > 0
                      ? <>You&apos;ve got <strong style={{ color: "#E24B4A" }}>{sortedAtRisk.length} at-risk email{sortedAtRisk.length > 1 ? "s" : ""}</strong> that need a reply before they turn into a lost deal.</>
                      : <>Nothing at risk right now — inbox is under control.</>
                    }
                    {totalTasks > 0 && <> There{totalTasks > 1 ? " are " : " is "}<strong style={{ color: "#7F77DD" }}>{totalTasks} open task{totalTasks > 1 ? "s" : ""}</strong> waiting for tomorrow.</>}
                  </div>
                </div>
              )}

              {presentTags.length > 0 && (
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "1.25rem" }}>
                  {(["All", ...presentTags] as const).map(tag => (
                    <button
                      key={tag}
                      onClick={() => setTagFilter(tag as any)}
                      style={{
                        padding: "0.32rem 0.8rem", borderRadius: "999px", fontSize: "0.74rem", cursor: "pointer",
                        border: `1px solid ${tagFilter === tag ? "#7F77DD" : d.cardBorder}`,
                        background: tagFilter === tag ? "rgba(127,119,221,0.12)" : "transparent",
                        color: tagFilter === tag ? "#7F77DD" : d.textMuted,
                        fontFamily: "'DM Sans', sans-serif", fontWeight: tagFilter === tag ? 600 : 400,
                      }}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              )}

              {emails.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px", marginBottom: "1.75rem" }}>
                  {([
                    ["Important", grouped["Important"].length, "#E24B4A"],
                    ["Action Needed", grouped["Action Needed"].length, "#EF9F27"],
                    ["Tasks", totalTasks, "#7F77DD"],
                    ["At Risk", atRiskEmails.length, "#E24B4A"],
                  ] as [string, number, string][]).map(([label, count, color]) => (
                    <div key={label} style={{ background: d.statBg, border: `1px solid ${d.cardBorder}`, borderRadius: "9px", padding: "0.9rem 1rem" }}>
                      <div style={{ fontSize: "1.6rem", fontWeight: 700, lineHeight: 1, color, fontVariantNumeric: "tabular-nums" }}>{count}</div>
                      <div style={{ fontSize: "0.7rem", color: d.textSub, marginTop: "3px" }}>{label}</div>
                    </div>
                  ))}
                </div>
              )}

              {analyzing && (
                <div style={{ marginBottom: "1.25rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: d.textSub, marginBottom: "5px" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                      <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#7F77DD", animation: "pulse-dot 1s ease infinite" }} />
                      Analyzing with AI...
                    </span>
                    <span>{Math.round(analysisProgress)}%</span>
                  </div>
                  <div style={{ height: "2px", background: d.navBorder, borderRadius: "999px", overflow: "hidden" }}>
                    <div style={{ height: "100%", background: "linear-gradient(90deg, #534AB7, #7F77DD)", borderRadius: "999px", transition: "width 0.3s ease", width: `${analysisProgress}%` }} />
                  </div>
                </div>
              )}

              <button onClick={fetchAndAnalyze} disabled={isWorking} style={{
                padding: "0.55rem 1.25rem",
                background: theme === "dark" ? "#f0f0f0" : "#0d0d0d",
                color: theme === "dark" ? "#060606" : "#f0f0f0",
                border: "none", borderRadius: "7px", cursor: "pointer",
                fontSize: "0.82rem", fontWeight: 500,
                fontFamily: "'DM Sans', sans-serif",
                marginBottom: "1.75rem",
                display: "inline-flex", alignItems: "center", gap: "7px",
                opacity: isWorking ? 0.45 : 1,
                transition: "opacity 0.15s",
              }}>
                {isWorking && <div style={{ width: "12px", height: "12px", border: `2px solid ${theme === "dark" ? "#333" : "#aaa"}`, borderTopColor: theme === "dark" ? "#888" : "#444", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />}
                {loading ? "Fetching inbox..." : analyzing ? "Analyzing..." : "↻ Refresh inbox"}
              </button>

              {fetchError && (
                <div style={{ background: "rgba(226,75,74,0.06)", border: "1px solid rgba(226,75,74,0.2)", borderRadius: "10px", padding: "0.9rem 1.1rem", marginBottom: "1.25rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                  <div>
                    <div style={{ fontSize: "0.83rem", color: "#E24B4A", fontWeight: 500, marginBottom: "2px" }}>Couldn't load your inbox</div>
                    <div style={{ fontSize: "0.72rem", color: d.textMuted }}>{fetchError}</div>
                  </div>
                  <button onClick={fetchAndAnalyze} style={{ padding: "0.32rem 0.8rem", background: "#E24B4A", color: "#fff", border: "none", borderRadius: "6px", fontSize: "0.75rem", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap" }}>
                    Retry
                  </button>
                </div>
              )}

              {emails.length === 0 && !isWorking && !fetchError && (
                <div style={{ textAlign: "center", padding: "5rem 0" }}>
                  <div style={{ width: "44px", height: "44px", borderRadius: "10px", background: d.statBg, border: `1px solid ${d.cardBorder}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 0.85rem" }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={d.emptyIcon} strokeWidth="1.5"><path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                  </div>
                  <p style={{ fontSize: "0.85rem", color: d.textFaint }}>No emails loaded yet</p>
                </div>
              )}

              {goneQuietEmails.length > 0 && (
                <div style={{ marginBottom: "2rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "0.7rem", paddingBottom: "0.5rem", borderBottom: `1px solid ${d.divider}` }}>
                    <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#E24B4A", animation: "pulse-dot 2s ease infinite" }} />
                    <span style={{ fontSize: "0.67rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#E24B4A" }}>Gone Quiet</span>
                    <span style={{ fontSize: "0.67rem", color: "#E24B4A", background: "rgba(226,75,74,0.1)", padding: "1px 6px", borderRadius: "4px", fontWeight: 700 }}>{goneQuietEmails.length}</span>
                  </div>
                  {goneQuietEmails.map((email, i) => (
                    <div key={`gq-${i}`} style={{ marginBottom: "6px" }}>
                      <div style={{ fontSize: "0.6rem", fontWeight: 700, color: "#E24B4A", letterSpacing: "0.06em", marginBottom: "2px" }}>
                        SILENT {email.daysSilent} DAY{email.daysSilent === 1 ? "" : "S"}
                      </div>
                      {renderEmailCard(email, i, true)}
                    </div>
                  ))}
                </div>
              )}

              {sortedAtRisk.length > 0 && (
                <div style={{ marginBottom: "2rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "0.7rem", paddingBottom: "0.5rem", borderBottom: `1px solid ${d.divider}` }}>
                    <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#E24B4A", animation: "pulse-dot 2s ease infinite" }} />
                    <span style={{ fontSize: "0.67rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#E24B4A" }}>At Risk</span>
                    <span style={{ fontSize: "0.67rem", color: "#E24B4A", background: "rgba(226,75,74,0.1)", padding: "1px 6px", borderRadius: "4px", fontWeight: 700 }}>{sortedAtRisk.length}</span>
                    {!isPro && allAtRiskEmails.length > FREE_AT_RISK_LIMIT && (
                      <span style={{ fontSize: "0.65rem", color: d.textFaint, marginLeft: "2px" }}>showing {FREE_AT_RISK_LIMIT} of {allAtRiskEmails.length}</span>
                    )}
                  </div>
                  {sortedAtRisk.map((email, i) => renderEmailCard(email, i, true))}
                  {atRiskHidden > 0 && (
                    <div onClick={() => setShowUpgrade(true)} style={{ background: "rgba(226,75,74,0.03)", border: "1px dashed rgba(226,75,74,0.25)", borderRadius: "10px", padding: "0.8rem 1.1rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: "0.8rem", color: "#E24B4A" }}>+{atRiskHidden} more At Risk email{atRiskHidden > 1 ? "s" : ""} hidden</span>
                      <span style={{ fontSize: "0.75rem", color: "#7F77DD", fontWeight: 500 }}>Upgrade to unlock →</span>
                    </div>
                  )}
                </div>
              )}

              {(["Important", "Action Needed", "Other"] as const).map((section) =>
                grouped[section].length > 0 && (
                  <div key={section} style={{ marginBottom: "1.75rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "0.7rem", paddingBottom: "0.5rem", borderBottom: `1px solid ${d.divider}` }}>
                      <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: cat[section].dot, flexShrink: 0 }} />
                      <span style={{ fontSize: "0.67rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: section === "Other" ? d.textFaint : cat[section].text }}>
                        {section}
                      </span>
                      <span style={{ fontSize: "0.67rem", color: d.textFaint, background: d.statBg, padding: "1px 6px", borderRadius: "4px" }}>{grouped[section].length}</span>
                    </div>
                    {grouped[section].map((email, i) => renderEmailCard(email, i, false))}
                  </div>
                )
              )}
            </>
          )}
        </div>

        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: theme === "dark" ? "rgba(6,6,6,0.96)" : "rgba(242,242,240,0.96)", borderTop: `1px solid ${d.navBorder}`, padding: "0.65rem 1.75rem", display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 20, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
            {session.user?.image ? (
              <img
                src={session.user.image}
                alt=""
                referrerPolicy="no-referrer"
                style={{ width: "30px", height: "30px", borderRadius: "50%", flexShrink: 0, objectFit: "cover" }}
                onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            ) : (
              <div style={{ width: "30px", height: "30px", borderRadius: "50%", background: "linear-gradient(135deg, #534AB7, #7F77DD)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.72rem", color: "#fff", fontWeight: 700, flexShrink: 0 }}>
                {session.user?.email?.[0]?.toUpperCase()}
              </div>
            )}
            <div>
              <div style={{ fontSize: "0.75rem", color: d.text, fontWeight: 500 }}>{session.user?.email}</div>
              <div style={{ fontSize: "0.65rem", color: d.textSub }}>
                {isPro ? "Pro · Unlimited" : trialActive ? `Trial · ${trialDaysLeft}d left` : `Free · ${FREE_AT_RISK_LIMIT} alerts · 20 emails/day`}
              </div>
            </div>
          </div>
          {!isPro && (
            <button onClick={() => setShowUpgrade(true)} style={{ padding: "0.42rem 1rem", background: "linear-gradient(135deg, #534AB7, #7F77DD)", color: "#fff", border: "none", borderRadius: "7px", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", boxShadow: "0 2px 14px rgba(83,74,183,0.35)" }}>
              Upgrade ✨
            </button>
          )}
        </div>

        {showUpgrade && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }} onClick={() => setShowUpgrade(false)}>
            <div style={{ background: theme === "dark" ? "#0a0a0a" : "#fff", border: `1px solid ${d.cardBorder}`, borderRadius: "18px", padding: "1.75rem", maxWidth: "360px", width: "100%", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }} onClick={e => e.stopPropagation()}>
              <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
                <div style={{ width: "44px", height: "44px", borderRadius: "11px", background: "linear-gradient(135deg, #534AB7, #7F77DD)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 0.9rem" }}>
                  <svg width="18" height="18" viewBox="0 0 100 130" fill="none"><polygon points="0,0 28,0 50,90 72,0 100,0 60,130 40,130" fill="#fff"/></svg>
                </div>
                <div style={{ fontSize: "1.3rem", fontWeight: 700, color: d.text, fontFamily: "'Syne', sans-serif", marginBottom: "0.25rem" }}>Veltro Pro</div>
                <div style={{ fontSize: "0.8rem", color: d.textSub, marginBottom: "1rem" }}>Never miss a client deadline again</div>
                <div style={{ fontSize: "2rem", fontWeight: 800, color: "#7F77DD", letterSpacing: "-0.02em" }}>
                  NZ$29.99<span style={{ fontSize: "0.9rem", fontWeight: 400, color: d.textSub }}>/month</span>
                </div>
              </div>
              <div style={{ marginBottom: "1.4rem" }}>
                {[
                  { icon: "⚠️", text: "Unlimited At Risk deadline alerts" },
                  { icon: "📧", text: "Unlimited email analysis, every day" },
                  { icon: "🎯", text: "Priority categorization — smarter flags" },
                  { icon: "⏰", text: "Deadline + awaiting reply detection" },
                ].map(({ icon, text }) => (
                  <div key={text} style={{ display: "flex", alignItems: "center", gap: "11px", marginBottom: "0.8rem" }}>
                    <span style={{ fontSize: "0.95rem" }}>{icon}</span>
                    <span style={{ fontSize: "0.82rem", color: d.textMuted }}>{text}</span>
                  </div>
                ))}
              </div>
              <a href={checkoutUrl} target="_blank" rel="noopener noreferrer"
                style={{ display: "block", width: "100%", padding: "0.7rem", background: "linear-gradient(135deg, #534AB7, #7F77DD)", color: "#fff", border: "none", borderRadius: "10px", fontSize: "0.88rem", fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", textAlign: "center", textDecoration: "none", boxShadow: "0 4px 20px rgba(83,74,183,0.35)" }}>
                Upgrade — NZ$29.99/mo
              </a>
              <button onClick={() => setShowUpgrade(false)} style={{ width: "100%", marginTop: "0.6rem", padding: "0.45rem", background: "transparent", border: "none", color: d.textFaint, fontSize: "0.75rem", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                Maybe later
              </button>
            </div>
          </div>
        )}

        {showTasksPanel && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 60, display: "flex", justifyContent: "flex-end" }} onClick={() => setShowTasksPanel(false)}>
            <div
              style={{ width: "min(360px, 100%)", height: "100%", background: d.cardBg, borderLeft: `1px solid ${d.cardBorder}`, display: "flex", flexDirection: "column", boxShadow: "-12px 0 40px rgba(0,0,0,0.35)" }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ padding: "1.1rem 1.25rem", borderBottom: `1px solid ${d.divider}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "1rem", color: d.text }}>Tasks</div>
                  <div style={{ fontSize: "0.72rem", color: d.textSub }}>{openTasksCount} open · {allTasks.length - openTasksCount} done</div>
                </div>
                <button onClick={() => setShowTasksPanel(false)} style={{ background: "transparent", border: "none", cursor: "pointer", color: d.textFaint, fontSize: "1.1rem", lineHeight: 1, padding: "0.25rem" }}>×</button>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: "0.75rem 1.1rem" }}>
                {allTasks.length === 0 && (
                  <p style={{ fontSize: "0.8rem", color: d.textFaint, textAlign: "center", marginTop: "2rem" }}>No tasks extracted yet.</p>
                )}
                {allTasks.map(task => (
                  <div key={task.id} style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "0.6rem 0", borderBottom: `1px solid ${d.divider}` }}>
                    <input
                      type="checkbox"
                      checked={!!completedTasks[task.id]}
                      onChange={() => toggleTaskDone(task.id)}
                      style={{ marginTop: "3px", width: "14px", height: "14px", accentColor: "#7F77DD", cursor: "pointer", flexShrink: 0 }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "0.82rem", color: completedTasks[task.id] ? d.textFaint : d.text, textDecoration: completedTasks[task.id] ? "line-through" : "none", lineHeight: 1.45 }}>
                        {decodeHtml(task.text)}
                      </div>
                      <div style={{ fontSize: "0.68rem", color: d.textFaint, marginTop: "2px" }}>{decodeHtml(task.subject)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
