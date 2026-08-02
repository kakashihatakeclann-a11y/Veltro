import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { adminDb } from "@/lib/firebaseAdmin"
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const ANALYZE_CONCURRENCY = 8

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let nextIndex = 0
  async function worker() {
    while (nextIndex < items.length) {
      const current = nextIndex++
      results[current] = await fn(items[current])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

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

    const userEmailForPrefs = (session as any).user?.email
    let preferenceHint = ""
    if (userEmailForPrefs) {
      try {
        const feedbackSnap = await adminDb
          .collection("users").doc(userEmailForPrefs)
          .collection("feedback").get()
        const liked: string[] = []
        const disliked: string[] = []
        feedbackSnap.forEach(doc => {
          const f = doc.data()
          if ((f.up || 0) > (f.down || 0)) liked.push(doc.id)
          else if ((f.down || 0) > (f.up || 0)) disliked.push(doc.id)
        })
        if (liked.length || disliked.length) {
          preferenceHint = `\n\nUSER PREFERENCES (learned from past feedback — apply these when scoring category/riskLevel):
- Senders this user has marked IMPORTANT before, weight higher: ${liked.join(", ") || "none"}
- Senders this user has marked NOT important before, weight lower (toward "Other"): ${disliked.join(", ") || "none"}`
        }
      } catch (err) {
        console.error("Failed to load feedback preferences:", err)
      }
    }

    const results = await mapWithConcurrency(
      emails,
      ANALYZE_CONCURRENCY,
      async (emailText: string) => {
        try {
          const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            max_tokens: 500,
            messages: [
              {
                role: "system",
                content: `You are an email analyzer for busy professionals managing client communications. Each email includes how long ago it was received and confirmation that the user has not replied yet (that part is already known — don't re-derive it). Analyze the email and return ONLY a JSON object with these fields:
- category: "Important" | "Action Needed" | "Other"
- riskLevel: "high" | "medium" | "none"
- deadline: string or null (e.g. "June 10" or null)
- summary: string, 3-5 sentences. Cover: what the sender wants, the key specifics they mentioned (budget, timeline, property/deal details, numbers), the current state of the conversation, and what's at stake if this is ignored. Write it so the user never has to open the original email to know what's going on.
- tasks: array of strings (action items, empty array if none)
- conversationState: "active" | "waiting_on_them" | "waiting_on_you" | "stalled" | "ghosted"
- followUpUrgency: "high" | "medium" | "low" | null
- followUpReason: string or null (e.g. "client silent 5 days" or null)
- contactType: "Buyer" | "Vendor" | "Seller" | "Other" (best guess at the sender's role in this business relationship, based on the email content)

SENDER CHECK (do this first):
- If sender contains "no-reply", "noreply", "donotreply", "notifications@", or is a known automated/corporate sender (banks, utilities, payment processors, government services like AT Park, Afterpay, IRD): category = "Other", riskLevel = "none". Stop here, do not analyze content further.
- Otherwise, this is a real person — proceed to content analysis below.

CONTENT ANALYSIS (for real people only):
- Important: the sender is expressing genuine interest, intent, or a request — especially with specifics like budget, timeline, requirements, or a decision they're close to making. A new inquiry with clear buying intent IS Important even with no explicit deadline mentioned.
- Action Needed: the email requires a reply, quote, information, or next step from the user.
- High risk: any of — explicit deadline within 7 days, sender indicates they're deciding soon or comparing options, payment/contract related, received 48h+ ago with still no reply from the user, OR a new high-intent inquiry (clear budget + timeline) that hasn't been responded to yet.
- Medium risk: genuine inquiry without explicit urgency signals but clear buying/working intent.
- A detailed inquiry with budget and move-in/start date should NEVER be "Other" — it's at minimum "Important" with medium-high risk, since ignoring it could mean losing the client to a competitor.
- conversationState "ghosted" = no reply expected for 3+ days on important thread
- followUpUrgency "high" = money or client relationship at risk${preferenceHint}

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
            conversationState: "active",
            followUpUrgency: null,
            followUpReason: null,
            contactType: "Other",
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
