import { NextRequest, NextResponse } from "next/server"
import { adminDb } from "@/lib/firebaseAdmin"

const ALLOWED_EVENTS = new Set(["google_click"])

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    if (typeof body.event !== "string" || !ALLOWED_EVENTS.has(body.event)) {
      return NextResponse.json({ success: false }, { status: 400 })
    }
    const timestamp = new Date(body.timestamp)
    await adminDb.collection("events").add({
      type: body.event,
      timestamp: isNaN(timestamp.getTime()) ? new Date().toISOString() : timestamp.toISOString(),
      userAgent: (request.headers.get("user-agent") || "unknown").slice(0, 300),
    })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false })
  }
}
