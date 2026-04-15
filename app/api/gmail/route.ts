import { getServerSession } from "next-auth"
import { authOptions } from "../auth/[...nextauth]/route"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const accessToken = (session as any).accessToken

  if (!accessToken) {
    return NextResponse.json({ error: "No access token" }, { status: 401 })
  }

  const res = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  )

  const data = await res.json()
  const messageIds = data.messages || []

  const emails = await Promise.all(
    messageIds.map(async (msg: { id: string }) => {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      )
      const msgData = await msgRes.json()
      const subject = msgData.payload?.headers?.find((h: any) => h.name === "Subject")?.value || "No Subject"
      const from = msgData.payload?.headers?.find((h: any) => h.name === "From")?.value || "Unknown"
      const date = msgData.payload?.headers?.find((h: any) => h.name === "Date")?.value || null
      const threadId = msgData.threadId

      const blockedSenders = ["noreply", "no-reply", "donotreply", "notifications", "mailer-daemon", "automated", "newsletter", "marketing", "news@", "updates@", "hello@em.", "mail@", "info@em."]
      const fromLower = from.toLowerCase()
      const isBlocked = blockedSenders.some(blocked => fromLower.includes(blocked))

      if (isBlocked) return null

      // Check if 48+ hours old
      const emailDate = date ? new Date(date) : null
      const hoursSince = emailDate ? (Date.now() - emailDate.getTime()) / (1000 * 60 * 60) : 0
      const isOld = hoursSince >= 48

      // Check sent folder for a reply in this thread
      let awaitingReply = false
      if (isOld && threadId) {
        const sentRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=in:sent+thread:${threadId}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        )
        const sentData = await sentRes.json()
        const hasSentReply = sentData.messages && sentData.messages.length > 0
        awaitingReply = !hasSentReply
      }

      return {
        id: msg.id,
        subject,
        from,
        snippet: msgData.snippet,
        date,
        awaitingReply,
      }
    })
  )

  return NextResponse.json({ emails: emails.filter(Boolean) })
}