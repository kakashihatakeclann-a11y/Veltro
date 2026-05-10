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
- "Important" = any email that could seriously affect the person's life, work, money, health, relationships, or reputation if ignored. This includes:
  * Emails from real individual people (clients, employers, collaborators, friends, family)
  * Security alerts, account compromises, suspicious login attempts
  * Bank alerts, fraud warnings, suspicious transactions, payment failures, overdrafts
  * Hospital, medical, healthcare, prescription, or appointment emails
  * Government, tax, immigration, court, or legal emails
  * Insurance emails involving claims, renewals, or cancellations
  * Utility disconnection warnings (electricity, water, internet)
  * Landlord or property management emails
  * School, university, or educational institution emails
  * Employment, HR, payroll, or contract emails
  * Debt collection or credit score alerts
  * Flight, travel, or visa confirmation and changes
  * Any email with words like "urgent", "action required", "final notice", "your account has been suspended", "deadline", "overdue"

- "Action Needed" = emails requiring a specific task or response that aren't immediately critical but still need to be done. Includes:
  * Invoice requests or payment requests from clients
  * Account verification or two-factor authentication emails
  * Software subscription renewals
  * Meeting requests or calendar invites
  * Form submissions or document signing requests
  * Shipping or delivery updates requiring action
  * Job application status updates

- "Other" = everything else. Mass emails, newsletters, promotions, marketing, automated digests, social media notifications, app updates, press releases, surveys, loyalty rewards, receipts for routine purchases. If it was sent to thousands of people and requires no action, it is Other.

Rules for riskLevel:
- "high" ONLY if: email is from a real person AND contains a specific deadline AND no reply has been sent. NEVER flag newsletters, automated emails, or promotional emails as high risk.
- "medium" if from a real person with an implicit deadline or time-sensitive request within 7 days.
- "none" for everything else including all automated and marketing emails.

Core principle: When in doubt ask — if this person ignored this email for a week, could it seriously hurt them financially, professionally, legally, or personally? If yes, Important. If no, Other.

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
