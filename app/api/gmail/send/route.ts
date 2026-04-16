import { getServerSession } from "next-auth"
import { authOptions } from "../../auth/[...nextauth]/route"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const accessToken = (session as any).accessToken

  if (!accessToken) {
    return NextResponse.json({ error: "No access token" }, { status: 401 })
  }

  const { to, subject, message, threadId } = await req.json()

  const emailLines = [
    `To: ${to}`,
    `Subject: ${subject}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    ``,
    message,
  ]

  const raw = Buffer.from(emailLines.join("\n"))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")

  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw, threadId }),
    }
  )

  const data = await res.json()

  if (!res.ok) {
    return NextResponse.json({ error: data }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}