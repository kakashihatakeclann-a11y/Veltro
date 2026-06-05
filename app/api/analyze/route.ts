import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { emails } = await req.json()
    if (!emails || !Array.isArray(emails)) {
      return NextResponse.json({ error: "No emails provided" }, { status: 400 })
    }

    const results = await Promise.all(
      emails.map(async (emailText: string) => {
        try {
          const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            max_tokens: 300,
            messages: [
              {
                role: "system",
                content: `You are an email analyzer for freelancers. Analyze the email and return ONLY a JSON object with these fields:
- category: "Important" | "Action Needed" | "Other"
- riskLevel: "high" | "medium" | "none"
- deadline: string or null (e.g. "June 10" or null)
- summary: string (1-2 sentences max)
- tasks: array of strings (action items, empty array if none)
- awaitingReply: boolean (true if this thread needs a reply)
- conversationState: "active" | "waiting_on_them" | "waiting_on_you" | "stalled" | "ghosted"
- followUpUrgency: "high" | "medium" | "low" | null
- followUpReason: string or null (e.g. "client silent 5 days" or null)

Rules:
- Important: from real humans, clients, urgent matters
- Action Needed: requires a response or task
- High risk: deadline within 7 days, client waiting, payment/invoice related, no reply in 48h+
- Ignore newsletters, automated emails, marketing
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
        } catch {
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
          }
        }
      })
    )

    return NextResponse.json({ results })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message }, { status: 500 })
  }
}
