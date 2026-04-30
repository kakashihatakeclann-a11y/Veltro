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
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )

  if (!res.ok) {
    return NextResponse.json({ error: "Failed to fetch emails" }, { status: 500 })
  }

  const data = await res.json()
  const messageIds = data.messages || []
  const emails = []

  for (const msg of messageIds) {
    try {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )

      if (!msgRes.ok) continue

      const msgData = await msgRes.json()
      const headers = msgData.payload?.headers || []

      const subject = headers.find((h: any) => h.name === "Subject")?.value || "No Subject"
      const from = headers.find((h: any) => h.name === "From")?.value || "Unknown"
      const date = headers.find((h: any) => h.name === "Date")?.value || null

      emails.push({
        id: msg.id,
        subject,
        from,
        snippet: msgData.snippet,
        date,
        awaitingReply: false,
      })

    } catch {
      continue
    }
  }

  return NextResponse.json({ emails })
}
