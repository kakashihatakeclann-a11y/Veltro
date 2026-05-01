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
          content: `You are an email analyzer for freelancers. Analyze ALL emails and return ONLY a valid JSON array, no markdown, no extra text. One object per email in the same order:

Rules for categorization:
- "Important" = emails from real individual people (clients, employers, collaborators, friends, family) that need attention. These are personal 1-on-1 emails.
- "Action Needed" = emails requiring a specific action or response from the user. Could be from a real person OR a service they use (e.g. invoice due, account issue, deadline).
- "Other" = mass emails, newsletters, promotions, marketing, automated notifications, social media alerts, app digests. If it was sent to thousands of people it is Other.

Rules for riskLevel:
- "high" ONLY if: email is from a real person AND contains a specific deadline AND no reply has been sent. NEVER flag newsletters, library reminders, Duolingo, or automated emails as high risk.
- "medium" if from a real person with a deadline within 7 days
- "none" for everything else including all automated and marketing emails

[{
  "category": "Important" or "Action Needed" or "Other",
  "summary": "one sentence summary",
  "tasks": ["task 1"],
  "awaitingReply": true or false,
  "deadline": "specific date string or null",
  "riskLevel": "high" or "medium" or "none"
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
