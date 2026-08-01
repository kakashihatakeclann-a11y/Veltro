import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { NextRequest, NextResponse } from "next/server"
import { adminDb } from "@/lib/firebaseAdmin"
import * as admin from "firebase-admin"

// Extracts the bare email address out of a "Name <email@domain.com>" header value.
function extractSenderEmail(from: string): string {
  const match = from.match(/<([^>]+)>/)
  return (match ? match[1] : from).trim().toLowerCase()
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }
  const userEmail = (session as any).user?.email
  if (!userEmail) {
    return NextResponse.json({ error: "No user email on session" }, { status: 400 })
  }
  const { from, signal } = await req.json()
  if (!from || !signal || !["up", "down", "click"].includes(signal)) {
    return NextResponse.json({ error: "Expected { from, signal: 'up'|'down'|'click' }" }, { status: 400 })
  }
  const senderEmail = extractSenderEmail(from)
  if (!senderEmail) {
    return NextResponse.json({ error: "Could not parse sender email" }, { status: 400 })
  }
  const field = signal === "up" ? "up" : signal === "down" ? "down" : "clicks"
  try {
    const ref = adminDb
      .collection("users").doc(userEmail)
      .collection("feedback").doc(senderEmail)
    await ref.set(
      {
        [field]: admin.firestore.FieldValue.increment(1),
        lastSignal: signal,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    )
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Failed to record feedback:", err)
    return NextResponse.json({ error: "Failed to save feedback" }, { status: 500 })
  }
}
