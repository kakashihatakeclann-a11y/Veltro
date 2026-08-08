import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { NextResponse } from "next/server"
import { adminDb } from "@/lib/firebaseAdmin"

const GMAIL_FETCH_CONCURRENCY = 10
const MAX_BODY_CHARS = 3000

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

function decodeBase64Url(data: string): string {
  return Buffer.from(data, "base64").toString("utf8")
}

// Walks a Gmail message payload (which can be arbitrarily nested multipart/*)
// and pulls out the best plain-text representation it can find.
function extractPlainTextBody(payload: any): string {
  if (!payload) return ""
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return decodeBase64Url(payload.body.data)
  }
  if (payload.parts) {
    const plainPart = payload.parts.find((p: any) => p.mimeType === "text/plain")
    if (plainPart?.body?.data) return decodeBase64Url(plainPart.body.data)
    for (const part of payload.parts) {
      const nested = extractPlainTextBody(part)
      if (nested) return nested
    }
    const htmlPart = payload.parts.find((p: any) => p.mimeType === "text/html")
    if (htmlPart?.body?.data) {
      return decodeBase64Url(htmlPart.body.data).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
    }
  }
  if (payload.mimeType === "text/html" && payload.body?.data) {
    return decodeBase64Url(payload.body.data).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
  }
  return ""
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

  const userEmail: string | undefined = (session as any).user?.email
  let isPro = false
  let trialActive = false
  let trialDaysLeft = 0

  if (userEmail) {
    try {
      const userRef = adminDb.collection("users").doc(userEmail)
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
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}&labelIds=INBOX`,
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
  const messageIds: { id: string; threadId: string }[] = data.messages || []

  // Gmail's messages.list returns newest-first, so the first message we see
  // for a given thread is the most recent INBOX-labeled one in it. Threads
  // often have several old inbound messages still tagged INBOX even after
  // the user replied — collapsing to one row per thread avoids showing the
  // same conversation multiple times.
  const seenThreads = new Set<string>()
  const dedupedMessages = messageIds.filter((m) => {
    if (!m.threadId) return true
    if (seenThreads.has(m.threadId)) return false
    seenThreads.add(m.threadId)
    return true
  })

  const emails = await mapWithConcurrency(
    dedupedMessages,
    GMAIL_FETCH_CONCURRENCY,
    async (msg) => {
      try {
        // The INBOX label sticks to individual messages, not the thread as a
        // whole — a thread the user already replied to can still surface an
        // old inbound message here. Check who actually sent the LAST message
        // in the thread (across all labels) before treating this as pending.
        const threadRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/threads/${msg.threadId}?format=metadata&metadataHeaders=From&metadataHeaders=Date`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        )
        if (!threadRes.ok) {
          console.error("GMAIL_THREAD_FETCH_FAILED", msg.threadId, threadRes.status)
          return null
        }
        const threadData = await threadRes.json()
        const threadMessages: any[] = threadData.messages || []
        if (threadMessages.length === 0) return null

        const lastMessage = threadMessages[threadMessages.length - 1]
        // Whether the user has replied is decided by Gmail's own SENT label, not
        // by matching the From header against their account address. Agents
        // routinely send from an alias — Google account paulette@gmail.com,
        // sending as paulette@agency.co.nz — and the header match failed on
        // every one of those, so threads they had already answered kept coming
        // back as unanswered. Header matching stays only as a fallback for the
        // rare case Gmail returns no labels.
        const lastFrom: string = lastMessage.payload?.headers?.find((h: any) => h.name === "From")?.value || ""
        const userSpokeLast = Array.isArray(lastMessage.labelIds)
          ? lastMessage.labelIds.includes("SENT")
          : !!userEmail && lastFrom.toLowerCase().includes(userEmail.toLowerCase())
        // The user had the last word: the contact has gone quiet. Nothing will
        // ever arrive to remind them about these, which is why they get missed.
        let daysSilent = 0
        if (userSpokeLast) {
          const repliedAt = new Date(lastMessage.payload?.headers?.find((h: any) => h.name === "Date")?.value || "")
          if (isNaN(repliedAt.getTime())) return null
          daysSilent = Math.floor((Date.now() - repliedAt.getTime()) / 86400000)
          if (daysSilent > 90) return null
        }

        // Fetch the full content of the message that's actually awaiting a
        // reply (usually msg.id, but if a newer inbound message landed after
        // the list call, prefer the thread's true latest message).
        // For a gone-quiet thread the last message is the user's own reply, so
        // load the inbound one instead — that's what the contact actually wanted.
        const targetId = userSpokeLast ? msg.id : (lastMessage.id || msg.id)
        const msgRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${targetId}?format=full`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        )
        if (!msgRes.ok) {
          const errBody = await msgRes.text()
          console.error("GMAIL_MESSAGE_FETCH_FAILED", targetId, msgRes.status, errBody)
          return null
        }
        const msgData = await msgRes.json()
        const headers = msgData.payload?.headers || []
        const subject = headers.find((h: any) => h.name === "Subject")?.value || "No Subject"
        const from = headers.find((h: any) => h.name === "From")?.value || "Unknown"
        const date = headers.find((h: any) => h.name === "Date")?.value || null
        const snippet = msgData.snippet || ""
        const body = extractPlainTextBody(msgData.payload).slice(0, MAX_BODY_CHARS)

        return { id: targetId, threadId: msg.threadId, subject, from, snippet, body, date, awaitingReply: !userSpokeLast, goneQuiet: userSpokeLast, daysSilent }
      } catch (err) {
        console.error("GMAIL_MESSAGE_FETCH_ERROR", msg.id, err)
        return null
      }
    }
  )

  const filteredEmails = emails.filter(Boolean)
  return NextResponse.json({ emails: filteredEmails, isPro: isProOrTrial, trialActive, trialDaysLeft })
}
