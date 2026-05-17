import { NextResponse } from "next/server"
import { db } from "@/lib/firebase"
import { doc, setDoc } from "firebase/firestore"

export async function POST(req: Request) {
  const body = await req.json()

  const eventName = body.meta?.event_name
  const userEmail = body.data?.attributes?.user_email

  if (!userEmail) {
    return NextResponse.json({ error: "No email" }, { status: 400 })
  }

  if (eventName === "subscription_created" || eventName === "subscription_resumed") {
    await setDoc(doc(db, "users", userEmail), { isPro: true }, { merge: true })
  }

  if (eventName === "subscription_cancelled" || eventName === "subscription_expired") {
    await setDoc(doc(db, "users", userEmail), { isPro: false }, { merge: true })
  }

  return NextResponse.json({ success: true })
}
