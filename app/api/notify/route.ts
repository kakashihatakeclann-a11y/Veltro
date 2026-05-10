import { NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { data, error } = await resend.emails.send({
      from: 'Veltro <onboarding@resend.dev>',
      to: ['test@example.com'],
      subject: '⚠️ You have at-risk client emails waiting',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Don't let client emails slip through</h2>
          <p>You have unread emails from clients that may need urgent attention.</p>
          <a href="https://veltro-lime.vercel.app" 
             style="background: #000; color: #fff; padding: 12px 24px; 
                    text-decoration: none; border-radius: 6px; display: inline-block;">
            Check Veltro Now
          </a>
        </div>
      `,
    })

    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to send' }, { status: 500 })
  }
}
