import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
export async function POST(req: NextRequest) {
  try {
    const { emails } = await req.json();
    const numbered = emails.map((text: string, i: number) => `[${i}] ${text}`).join("\n\n");
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an email analyzer. Analyze ALL emails below and return ONLY a valid JSON array, no markdown, no extra text. One object per email in the same order:
[{
  "category": "Important" or "Action Needed" or "Other",
  "summary": "one sentence summary",
  "tasks": ["task 1"],
  "awaitingReply": true or false,
  "deadline": "date string like 'May 5' or 'Friday' or 'next week' or null if no deadline mentioned",
  "riskLevel": "high" if deadline within 48 hours or overdue AND no reply, "medium" if deadline within 7 days, "none" otherwise
}]`
        },
        { role: "user", content: numbered }
      ],
      max_tokens: 4000
    });
    const raw = completion.choices[0].message.content || "[]";
    const result = JSON.parse(raw);
    return NextResponse.json({ results: result });
  } catch (error: any) {
    console.error("OpenAI error:", error?.message);
    return NextResponse.json({ error: error?.message || "Analysis failed" }, { status: 500 });
  }
}
