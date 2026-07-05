import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { adminDb } from "@/lib/firebaseAdmin"
import { mapWithConcurrency } from "@/lib/concurrency"
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const OPENAI_ANALYSIS_CONCURRENCY = 5
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const { emails } = await req.json()
    if (!emails || !Array.isArray(emails)) {
      return NextResponse.json({ error: "No emails provided" }, { status: 400 })
    }
    const results = await mapWithConcurrency(
      emails,
      OPENAI_ANALYSIS_CONCURRENCY,
      async (emailText: string) => {
        try {
          const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            max_tokens: 300,
            messages: [
              {
                role: "system",
                content: `You are an email analyzer for busy professionals managing client communications. Analyze the email and return ONLY a JSON object with these fields:
- category: "Important" | "Action Needed" | "Other"
- riskLevel: "high" | "medium" | "none"
- deadline: string or null (e.g. "June 10" or null)
- summary: string (1-2 sentences max)
- tasks: array of strings (action items, empty array if none)
- awaitingReply: boolean (true if this thread needs a reply)
- conversationState: "active" | "waiting_on_them" | "waiting_on_you" | "stalled" | "ghosted"
- followUpUrgency: "high" | "medium" | "low" | null
- followUpReason: string or null (e.g. "client silent 5 days" or null)

SENDER CHECK (do this first):
- If sender contains "no-reply", "noreply", "donotreply", "notifications@", or is a known automated/corporate sender (banks, utilities, payment processors, government services like AT Park, Afterpay, IRD): category = "Other", riskLevel = "none". Stop here, do not analyze content further.
- Otherwise, this is a real person — proceed to content analysis below.

CONTENT ANALYSIS (for real people only):
- Important: the sender is expressing genuine interest, intent, or a request — especially with specifics like budget, timeline, requirements, or a decision they're close to making. A new inquiry with clear buying intent IS Important even with no explicit deadline mentioned.
- Action Needed: the email requires a reply, quote, information, or next step from the user.
- High risk: any of — explicit deadline within 7 days, sender indicates they're deciding soon or comparing options, payment/contract related, no reply sent in 48h+ on an active thread, OR a new high-intent inquiry (clear budget + timeline) that hasn't been responded to yet.
- Medium risk: genuine inquiry without explicit urgency signals but clear buying/working intent.
- A detailed inquiry with budget and move-in/start date should NEVER be "Other" — it's at minimum "Important" with medium-high risk, since ignoring it could mean losing the client to a competitor.
- conversationState "ghosted" = no reply expected for 3+ days on important thread
- followUpUrgency "high" = money or client relationship at risk

Return ONLY valid JSON, no other text.`,
              },
              {
                role: "user",
                content: emailText,
              },
            ],
          })
          const content = completion.choices[0].message.content || "{}"
          const cleaned = content.replace(/```json|```/g, "").trim()
          return JSON.parse(cleaned)
        } catch (err) {
          console.error("Failed to analyze email:", err)
          return {
            category: "Other",
            riskLevel: "none",
            deadline: null,
            summary: "",
            tasks: [],
            awaitingReply: false,
            conversationState: "active",
            followUpUrgency: null,
            followUpReason: null,
            analysisFailed: true,
          }
        }
      }
    )

    const userEmail = (session as any).user?.email
    if (userEmail) {
      const atRiskCount = results.filter((r: any) => r.riskLevel === "high").length
      try {
        await adminDb.collection("users").doc(userEmail).set({ lastAtRiskCount: atRiskCount }, { merge: true })
      } catch (err) {
        console.error("Failed to persist at-risk count:", err)
      }
    }

    return NextResponse.json({ results })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message }, { status: 500 })
  }
}
