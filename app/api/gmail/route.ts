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
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      )
      const msgData = await msgRes.json()
      const subject = msgData.payload?.headers?.find((h: any) => h.name === "Subject")?.value || "No Subject"
      const from = msgData.payload?.headers?.find((h: any) => h.name === "From")?.value || "Unknown"
      const blockedSenders = ["noreply", "no-reply", "donotreply", "notifications", "mailer-daemon", "automated"]
      const fromLower = from.toLowerCase()
      const isBlocked = blockedSenders.some(blocked => fromLower.includes(blocked))

      if (isBlocked) return null

      return {
        id: msg.id,
        subject,
        from,
        snippet: msgData.snippet,
      }
    })
  )

return NextResponse.json({ emails: emails.filter(Boolean) })
}