import { NextRequest, NextResponse } from "next/server"
import { adminDb } from "@/lib/firebaseAdmin"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    await adminDb.collection("events").add({
      type: body.event,
      timestamp: body.timestamp,
      userAgent: request.headers.get("user-agent") || "unknown",
    })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false })
  }
}
