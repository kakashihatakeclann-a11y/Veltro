import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { adminDb } from "@/lib/firebaseAdmin"

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get("x-signature")
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET

  if (!secret) {
    console.error("LEMONSQUEEZY_WEBHOOK_SECRET is not configured")
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 })
  }

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 401 })
  }

  const expectedSignature = crypto.createHmac("sha256", secret).update(rawBody).digest("hex")
  const signatureBuffer = Buffer.from(signature, "utf8")
  const expectedBuffer = Buffer.from(expectedSignature, "utf8")

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  let body: any
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const eventName = body.meta?.event_name
  const userEmail = body.data?.attributes?.user_email

  if (!userEmail) {
    return NextResponse.json({ error: "No email" }, { status: 400 })
  }

  const GRANT_EVENTS = ["subscription_created", "subscription_resumed", "subscription_unpaused"]
  const REVOKE_EVENTS = ["subscription_cancelled", "subscription_expired", "subscription_paused"]
  const STATUS_DRIVEN_EVENTS = ["subscription_updated", "subscription_payment_success", "subscription_payment_failed"]
  const ACTIVE_STATUSES = ["active", "on_trial"]

  let isPro: boolean | undefined
  if (GRANT_EVENTS.includes(eventName)) {
    isPro = true
  } else if (REVOKE_EVENTS.includes(eventName)) {
    isPro = false
  } else if (STATUS_DRIVEN_EVENTS.includes(eventName)) {
    const status = body.data?.attributes?.status
    isPro = ACTIVE_STATUSES.includes(status)
  }

  if (isPro === undefined) {
    return NextResponse.json({ success: true })
  }

  try {
    await adminDb.collection("users").doc(userEmail).set({ isPro }, { merge: true })
  } catch (error: any) {
    console.error("Failed to update user pro status:", error)
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
