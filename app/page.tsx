"use client";
import { useState } from "react";

export default function Home() {
  const [text, setText] = useState("");
  const [output, setOutput] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const analyze = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailText: text })
      });
      const data = await res.json();
      console.log("API response:", data);
      setOutput(data);
    } catch (err) {
      console.error("Error:", err);
    }
    setLoading(false);
  };
  return (
    <div style={{ padding: "2rem", fontFamily: "Arial" }}>
      <h1 style={{ fontSize: "2rem", fontWeight: "bold" }}>Veltro</h1>
      <p>Paste your email below to categorize and create tasks:</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        style={{ width: "100%", height: "150px", padding: "0.5rem", marginTop: "0.5rem" }}
        placeholder="Paste email here..."
      />
      <button
        onClick={analyze}
        style={{ marginTop: "1rem", padding: "0.5rem 1rem", backgroundColor: "black", color: "white", border: "none", cursor: "pointer" }}
      >
        {loading ? "Analyzing..." : "Analyze"}
      </button>

      {output && (
        <div style={{ marginTop: "1rem" }}>
          <h2>Category: {output.category}</h2>
          <p><strong>Summary:</strong> {output.summary}</p>
          <h3>Tasks:</h3>
          <ul>
{output.tasks && output.tasks.map((task: string, i: number) => <li key={i}>{task}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}