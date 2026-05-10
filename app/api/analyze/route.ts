import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
export async function POST(req: NextRequest) {
  try {
    const { emails } = await req.json();
    const results = await Promise.all(
      emails.map(async (text: string, i: number) => {
        try {
          const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: `You are an email analyzer for freelancers. Analyze this single email and return ONLY a valid JSON object, no markdown, no extra text.

Rules for categorization:
- "Important" = emails from real individual people (clients, employers, collaborators, friends, family) that need attention. ALSO includes security alerts, account warnings, payment failures, legal notices, or anything that could have serious consequences if ignored.
- "Action Needed" = emails requiring a specific action or response. Could be from a real person OR a service (e.g. invoice due, account issue, deadline, verification required, contract to sign).
- "Other" = mass emails, newsletters, promotions, marketing, automated notifications, social media alerts, app digests, weekly summaries. If it was sent to thousands of people and requires no action, it's Other.

Rules for riskLevel:
- "high" ONLY if: email is from a real person AND contains a specific deadline AND no reply has been sent. NEVER flag newsletters, automated emails, or promotional emails as high risk.
- "medium" if from a real person with an implicit deadline or time-sensitive request within 7 days.
- "none" for everything else including all automated and marketing emails.

Extra rules:
- If the sender appears to be a real person (e.g. john@gmail.com, sarah@company.com) rather than an automated system (e.g. no-reply@, notifications@, support@, billing@, noreply@), always categorize as Important or Action Needed, never Other.
- Google security alerts = Important, riskLevel none
- Payment receipts from automated systems = Other, but payment emails from real people = Important
- Invoice requests from clients = Action Needed
- Account verification emails = Action Needed
- Promotional emails = always Other, always riskLevel none
- When in doubt between Important and Other, ask: did a real human write this specifically for me? If yes, Important. If no, Other.

Return exactly this shape:
{"category":"Important","summary":"one sentence","tasks":["task 1"],"awaitingReply":false,"deadline":null,"riskLevel":"none"}`
              },
              { role: "user", content: text }
            ],
            max_tokens: 300,
          });
          const raw = completion.choices[0].message.content || "{}";
          return JSON.parse(raw);
        } catch {
          return { category: "Other", summary: "", tasks: [], awaitingReply: false, deadline: null, riskLevel: "none" };
        }
      })
    );
    return NextResponse.json({ results });
  } catch (error: any) {
    console.error("Analysis error:", error?.message);
    return NextResponse.json({ error: error?.message || "Analysis failed" }, { status: 500 });
  }
}
