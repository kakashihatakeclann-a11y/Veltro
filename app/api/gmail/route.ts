import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { NextResponse } from "next/server"
import { adminDb } from "@/lib/firebaseAdmin"

const GMAIL_FETCH_CONCURRENCY = 10

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

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  if ((session as any).error === "RefreshAccessTokenError") {
    return NextResponse.json({ error: "Session expired, please sign in again" }, { status: 401 })
  }

  const accessToken = (session as any).accessToken
  if (!accessToken) {
    return NextResponse.json({ error: "No access token" }, { status: 401 })
  }

  const email = (session as any).user?.email
  let isPro = false
  let trialActive = false
  let trialDaysLeft = 0

  if (email) {
    try {
      const userRef = adminDb.collection("users").doc(email)
      const userDoc = await userRef.get()
      if (!userDoc.exists) {
        await userRef.set({
          isPro: false,
          trialStartDate: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          lastActive: new Date().toISOString(),
        })
        trialActive = true
        trialDaysLeft = 7
      } else {
        const data = userDoc.data()
        isPro = data?.isPro === true
        if (!isPro && data?.trialStartDate) {
          const trialStart = new Date(data.trialStartDate)
          const now = new Date()
          const daysSinceStart = Math.floor((now.getTime() - trialStart.getTime()) / (1000 * 60 * 60 * 24))
          trialDaysLeft = Math.max(0, 7 - daysSinceStart)
          trialActive = trialDaysLeft > 0
        }
        await userRef.set({ lastActive: new Date().toISOString() }, { merge: true })
      }
    } catch (err) {
      console.error("FIRESTORE_USER_LOOKUP_FAILED", err)
      // don't block the request over a Firestore hiccup — fall back to free tier limits
    }
  }

  const isProOrTrial = isPro || trialActive
  const maxResults = isProOrTrial ? 100 : 50

  let res: Response
  try {
    res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
  } catch (err) {
    console.error("GMAIL_LIST_FETCH_NETWORK_ERROR", err)
    return NextResponse.json({ error: "Couldn't reach Gmail. Try again in a moment." }, { status: 502 })
  }

  if (!res.ok) {
    const errorBody = await res.text()
    console.error("GMAIL_LIST_FETCH_FAILED", res.status, errorBody)

    if (res.status === 401) {
      return NextResponse.json({ error: "Session expired, please sign in again" }, { status: 401 })
    }
    if (res.status === 403) {
      return NextResponse.json({ error: "Gmail access not authorized. Please reconnect your Google account." }, { status: 403 })
    }
    if (res.status === 429) {
      return NextResponse.json({ error: "Too many requests to Gmail right now. Please try again shortly." }, { status: 429 })
    }
    return NextResponse.json({ error: "Failed to fetch emails", detail: errorBody }, { status: res.status })
  }

  const data = await res.json()
  const messageIds = data.messages || []

  const emails = await mapWithConcurrency(
    messageIds,
    GMAIL_FETCH_CONCURRENCY,
    async (msg: any) => {
      try {
        const msgRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        )
        if (!msgRes.ok) {
          const errBody = await msgRes.text()
          console.error("GMAIL_MESSAGE_FETCH_FAILED", msg.id, msgRes.status, errBody)
          return null
        }
        const msgData = await msgRes.json()
        const headers = msgData.payload?.headers || []
        const subject = headers.find((h: any) => h.name === "Subject")?.value || "No Subject"
        const from = headers.find((h: any) => h.name === "From")?.value || "Unknown"
        const date = headers.find((h: any) => h.name === "Date")?.value || null
        const snippet = msgData.snippet || ""
        return { id: msg.id, subject, from, snippet, date, awaitingReply: false }
      } catch (err) {
        console.error("GMAIL_MESSAGE_FETCH_ERROR", msg.id, err)
        return null
      }
    }
  )

  const filteredEmails = emails.filter(Boolean)
  return NextResponse.json({ emails: filteredEmails, isPro: isProOrTrial, trialActive, trialDaysLeft })
}
