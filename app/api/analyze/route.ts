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
                content: `You are an email analyzer working for a licensed real estate agent in New Zealand. TODAY IS ${new Date().toISOString().slice(0, 10)} — any date in an email earlier than that has ALREADY PASSED, so it is not a deadline and not urgent: set deadline to null and do not raise riskLevel for it.

Each email states how long ago it arrived and whether the agent has replied. TRUST THAT LINE — do not re-derive it from the body. If it says the agent has already replied, they owe nothing: never raise riskLevel for "no reply", and never write a summary implying they still need to respond.

Analyze the email and return ONLY a JSON object with these fields:
- category: "Important" | "Action Needed" | "Other"
- riskLevel: "high" | "medium" | "none"
- deadline: string or null (e.g. "June 10" or null)
- summary: string, 3-5 sentences. Cover: what the sender wants, the key specifics they mentioned (budget, timeline, property/deal details, numbers), the current state of the conversation, and what's at stake if this is ignored. Write it so the user never has to open the original email to know what's going on.
- tasks: array of strings (action items, empty array if none)
- conversationState: "active" | "waiting_on_them" | "waiting_on_you" | "stalled" | "ghosted"
- followUpUrgency: "high" | "medium" | "low" | null
- followUpReason: string or null (e.g. "client silent 5 days" or null)
- contactType: "Buyer" | "Vendor" | "Seller" | "Other" (best guess at the sender's role in this business relationship, based on the email content)

Work through these rules in order. Rule 1 and Rule 2 come from working agents and override your own judgement.

RULE 1 — ALWAYS IMPORTANT. If the email is any of the following, category is "Important" (or "Action Needed" if it asks the agent to do something) and riskLevel is at least "medium":
- Lawyers, law firms, solicitors or conveyancers — anything touching a sale and purchase agreement
- Conditions on a property: finance, LIM, builder's or building report, due diligence, title, code compliance certificate — and any date attached to one
- Building or pest inspections, valuations, registered appraisals — booked, chased or reported
- Auction dates, settlement dates, going unconditional, deposit and trust account matters
- A genuine inquiry about a property from a buyer, OR a real buyer lead forwarded by a portal (realestate.co.nz, Trade Me Property, OneRoof, homes.co.nz). A new buyer inquiry is ALWAYS Important even with no deadline in it — this is the first thing an agent looks for in the morning.
- Invoices, subscriptions, memberships or fees that are due or overdue, including REINZ and REA licensing and agency fees
- Anything from the agent's own vendor (the owner of a property they are selling). Vendors are the relationship that costs the most money when neglected — weight vendor mail above everything except a legal or conditional deadline.

RULE 2 — NEVER IMPORTANT. If the email is any of the following, category is "Other" and riskLevel is "none", no matter how urgent the wording sounds:
- Generic advertising blasted to every agent in the country: cleaning companies, photographers, videographers, staging and styling, floor plans, signage and printing, letterbox drops, moving companies, mortgage brokers touting for referrals, marketing/SEO/lead-generation agencies, CRM and software vendors
- Conference, webinar, training, awards and networking invitations
- Newsletters, market reports and "what's happening in your area" blasts
- Portal and platform MARKETING ("upgrade your listing package", "boost your profile"). Note this is the opposite of a portal forwarding a real buyer lead, which is Rule 1 — read which one it actually is.
- Social network notifications, LinkedIn, review-site prompts, survey requests
Signals it is generic: no specific property, address, client or prior conversation referenced; addressed to "agent", "team" or nobody; it is selling the agent a service; an unsubscribe footer with no personal thread behind it.

SENDER CHECK:
- If sender contains "no-reply", "noreply", "donotreply", "notifications@", or is a known automated/corporate sender (banks, utilities, payment processors, government services like AT Park, Afterpay, IRD): category = "Other", riskLevel = "none" — UNLESS it is a portal forwarding a real buyer lead, which stays Rule 1.

CONTENT ANALYSIS (for anything not settled by the rules above):
- Important: the sender is expressing genuine interest, intent, or a request — especially with specifics like budget, timeline, property details, or a decision they're close to making.
- Action Needed: the email requires a reply, quote, information, or next step from the agent.
- High risk: any of — a legal or conditional deadline within 7 days; a solicitor waiting on the agent; a buyer inquiry more than 24 hours old that the agent has not answered; a vendor asking something the agent has not answered; a payment, deposit or contract matter due.
- Medium risk: a genuine client conversation or inquiry with no explicit urgency.
- NEVER raise riskLevel on an email the agent has already replied to, and never on anything caught by Rule 2.
- conversationState "ghosted" = the agent replied and the contact has been silent 3+ days
- followUpUrgency "high" = money or a client relationship is genuinely at risk${preferenceHint}

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
