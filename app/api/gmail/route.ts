import { getServerSession } from "next-auth"
import { authOptions } from "../auth/[...nextauth]/route"
import { NextResponse } from "next/server"
import { db } from "@/lib/firebase"
import { doc, getDoc } from "firebase/firestore"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const accessToken = (session as any).accessToken
  if (!accessToken) {
    return NextResponse.json({ error: "No access token" }, { status: 401 })
  }

  // Check if user is Pro
  const email = (session as any).user?.email
  let isPro = false
  if (email) {
    const userDoc = await getDoc(doc(db, "users", email))
    if (userDoc.exists()) {
      isPro = userDoc.data()?.isPro === true
    }
  }

  const maxResults = isPro ? 100 : 20

  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  if (!res.ok) {
    return NextResponse.json({ error: "Failed to fetch emails" }, { status: 500 })
  }

  const data = await res.json()
  const messageIds = data.messages || []
  const emails = await Promise.all(
    messageIds.map(async (msg: any) => {
      try {
        const msgRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        )
        if (!msgRes.ok) return null
        const msgData = await msgRes.json()
        const headers = msgData.payload?.headers || []
        const subject = headers.find((h: any) => h.name === "Subject")?.value || "No Subject"
        const from = headers.find((h: any) => h.name === "From")?.value || "Unknown"
        const date = headers.find((h: any) => h.name === "Date")?.value || null
        const snippet = msgData.snippet || ""
        return { id: msg.id, subject, from, snippet, date, awaitingReply: false }
      } catch {
        return null
      }
    })
  )

  const filteredEmails = emails.filter(Boolean)
  return NextResponse.json({ emails: filteredEmails, isPro })
}
