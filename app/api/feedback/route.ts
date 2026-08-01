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
  if (!from || !signal || !["up", "down", "click
