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
  // custom_data carries the email of the Veltro account that started checkout —
  // set by the app itself, so it can't drift from what the customer types/edits
  // into LemonSqueezy's checkout email field. Fall back to the checkout email
  // for older links or purchases made outside the app's own checkout flow.
  const userEmail: string | undefined =
    body.meta?.custom_data?.user_email || body.data?.attributes?.user_email

  if (!userEmail) {
    return NextResponse.json({ error: "No email" }, { status: 400 })
  }

  try {
    if (eventName === "subscription_created" || eventName === "subscription_resumed") {
      await adminDb.collection("users").doc(userEmail).set({ isPro: true }, { merge: true })
    }

    if (eventName === "subscription_cancelled" || eventName === "subscription_expired") {
      await adminDb.collection("users").doc(userEmail).set({ isPro: false }, { merge: true })
    }
  } catch (error: any) {
    console.error("Failed to update user pro status:", error)
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
