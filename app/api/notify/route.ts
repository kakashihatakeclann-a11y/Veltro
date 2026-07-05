import { NextRequest, NextResponse } from "next/server"
import { Resend } from "resend"
import { adminDb } from "@/lib/firebaseAdmin"

const resend = new Resend(process.env.RESEND_API_KEY)

function renderEmailShell(bodyHtml: string) {
  return `
    <div style="font-family: 'DM Sans', sans-serif; max-width: 560px; margin: 0 auto; background: #060606; color: #f0f0f0; padding: 40px 32px; border-radius: 12px;">
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 32px;">
        <div style="width: 28px; height: 28px; background: #534AB7; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center;">
          <span style="color: #fff; font-weight: 700; font-size: 14px;">V</span>
        </div>
        <span style="font-weight: 700; font-size: 16px; color: #f0f0f0;">Veltro</span>
      </div>

      ${bodyHtml}

      <p style="font-size: 12px; color: #333; margin-top: 32px;">
        You're receiving this because you signed up for Veltro.
      </p>
    </div>
  `
}

function day6EmailHtml() {
  return renderEmailShell(`
    <h1 style="font-size: 22px; font-weight: 700; color: #f0f0f0; margin-bottom: 12px; line-height: 1.3;">
      Your trial ends tomorrow.
    </h1>

    <p style="font-size: 15px; color: #888; line-height: 1.7; margin-bottom: 24px;">
      You've been using Veltro Pro for 6 days. Tomorrow your trial expires and you'll lose access to:
    </p>

    <div style="background: #0d0d0d; border: 1px solid #1a1a1a; border-radius: 10px; padding: 20px; margin-bottom: 24px;">
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
        <span style="color: #E24B4A; font-size: 16px;">⚠️</span>
        <span style="font-size: 14px; color: #f0f0f0;">Unlimited At Risk deadline alerts</span>
      </div>
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
        <span style="font-size: 16px;">📧</span>
        <span style="font-size: 14px; color: #f0f0f0;">Unlimited email analysis every day</span>
      </div>
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
        <span style="font-size: 16px;">⏰</span>
        <span style="font-size: 14px; color: #f0f0f0;">Deadline + awaiting reply detection</span>
      </div>
      <div style="display: flex; align-items: center; gap: 10px;">
        <span style="font-size: 16px;">🎯</span>
        <span style="font-size: 14px; color: #f0f0f0;">Smarter priority categorization</span>
      </div>
    </div>

    <p style="font-size: 14px; color: #888; line-height: 1.7; margin-bottom: 28px;">
      Freelancers don't lose clients over bad work. They lose them over missed emails. Don't go back to a chaotic inbox.
    </p>

    <a href="https://veltro.lemonsqueezy.com/checkout/buy/516e106c-4b5a-42eb-8a08-a209c900c5d8"
       style="display: inline-block; background: linear-gradient(135deg, #534AB7, #7F77DD); color: #fff; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-size: 15px; font-weight: 600;">
      Upgrade to Pro — NZ$29.99/mo
    </a>
  `)
}

function day7EmailHtml() {
  return renderEmailShell(`
    <div style="background: rgba(226,75,74,0.08); border: 1px solid rgba(226,75,74,0.2); border-radius: 10px; padding: 16px 20px; margin-bottom: 28px;">
      <p style="font-size: 14px; color: #E24B4A; margin: 0; font-weight: 600;">
        ⚠️ Your trial has expired. You're back on the free plan.
      </p>
    </div>

    <h1 style="font-size: 22px; font-weight: 700; color: #f0f0f0; margin-bottom: 12px; line-height: 1.3;">
      Your inbox goes back to chaos today — unless you upgrade.
    </h1>

    <p style="font-size: 15px; color: #888; line-height: 1.7; margin-bottom: 28px;">
      Without Pro, Veltro can only show you 5 At Risk alerts and 20 emails per day. The deadlines buried in your inbox? You're on your own again.
    </p>

    <a href="https://veltro.lemonsqueezy.com/checkout/buy/516e106c-4b5a-42eb-8a08-a209c900c5d8"
       style="display: inline-block; background: linear-gradient(135deg, #534AB7, #7F77DD); color: #fff; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-size: 15px; font-weight: 600;">
      Upgrade Now — NZ$29.99/mo
    </a>

    <p style="font-size: 13px; color: #555; margin-top: 20px;">
      Takes 30 seconds. Cancel anytime.
    </p>
  `)
}

function reengagementEmailHtml(atRiskCount: number) {
  const plural = atRiskCount > 1 ? "s" : ""
  return renderEmailShell(`
    <div style="background: rgba(226,75,74,0.08); border: 1px solid rgba(226,75,74,0.2); border-radius: 10px; padding: 16px 20px; margin-bottom: 28px; display: flex; align-items: center; gap: 12px;">
      <span style="font-size: 24px; font-weight: 800; color: #E24B4A;">${atRiskCount}</span>
      <p style="font-size: 14px; color: #E24B4A; margin: 0;">
        at-risk email${plural} detected in your inbox
      </p>
    </div>

    <h1 style="font-size: 22px; font-weight: 700; color: #f0f0f0; margin-bottom: 12px; line-height: 1.3;">
      Don't let these slip through.
    </h1>

    <p style="font-size: 15px; color: #888; line-height: 1.7; margin-bottom: 28px;">
      Veltro has flagged ${atRiskCount} email${plural} that could cost you a client if left unattended. Open Veltro now to see what needs your attention.
    </p>

    <a href="https://useveltro.app"
       style="display: inline-block; background: linear-gradient(135deg, #534AB7, #7F77DD); color: #fff; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-size: 15px; font-weight: 600;">
      Check Veltro Now →
    </a>
  `)
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const usersSnapshot = await adminDb.collection("users").get()
    const results: any[] = []

    for (const doc of usersSnapshot.docs) {
      const data = doc.data()
      const email = doc.id
      const isPro = data?.isPro === true

      if (isPro) continue

      if (!data?.trialStartDate) continue

      const trialStart = new Date(data.trialStartDate)
      const now = new Date()
      const daysSinceStart = Math.floor(
        (now.getTime() - trialStart.getTime()) / (1000 * 60 * 60 * 24)
      )
      const trialDaysLeft = Math.max(0, 7 - daysSinceStart)

      // Day 6 — trial ends tomorrow
      if (daysSinceStart === 6) {
        const { error } = await resend.emails.send({
          from: "Veltro <hey@useveltro.app>",
          to: email,
          subject: "⚠️ Your Veltro trial ends tomorrow",
          html: day6EmailHtml(),
        })
        results.push({ email, type: "day6", error })
      }

      // Day 7 — trial expired today
      else if (daysSinceStart === 7) {
        const { error } = await resend.emails.send({
          from: "Veltro <hey@useveltro.app>",
          to: email,
          subject: "Your Veltro trial just ended — your inbox is unprotected",
          html: day7EmailHtml(),
        })
        results.push({ email, type: "day7", error })
      }

      // Re-engagement — every 3 days after signup if not pro
      else if (daysSinceStart > 0 && daysSinceStart % 3 === 0 && trialDaysLeft > 0) {
        const atRiskCount = data?.lastAtRiskCount || 0
        if (atRiskCount > 0) {
          const { error } = await resend.emails.send({
            from: "Veltro <hey@useveltro.app>",
            to: email,
            subject: `🚨 Veltro caught ${atRiskCount} at-risk email${atRiskCount > 1 ? "s" : ""} in your inbox`,
            html: reengagementEmailHtml(atRiskCount),
          })
          results.push({ email, type: "reengagement", error })
        }
      }
    }

    return NextResponse.json({ success: true, results })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message }, { status: 500 })
  }
}
