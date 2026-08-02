import NextAuth from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)

async function refreshAccessToken(token: any) {
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: "refresh_token",
        refresh_token: token.refreshToken,
      }),
    })
    const refreshed = await res.json()
    if (!res.ok) throw refreshed

    return {
      ...token,
      accessToken: refreshed.access_token,
      accessTokenExpires: Date.now() + refreshed.expires_in * 1000,
      refreshToken: refreshed.refresh_token ?? token.refreshToken,
      error: undefined,
    }
  } catch (error) {
    console.error("Failed to refresh Google access token:", error)
    return { ...token, error: "RefreshAccessTokenError" }
  }
}

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "openid email profile https://www.googleapis.com/auth/gmail.readonly",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }: any) {
      if (account) {
        token.accessToken = account.access_token
        token.refreshToken = account.refresh_token
        token.accessTokenExpires = account.expires_at
          ? account.expires_at * 1000
          : Date.now() + 3600 * 1000
        return token
      }

      if (Date.now() < (token.accessTokenExpires ?? 0)) {
        return token
      }

      if (!token.refreshToken) {
        return { ...token, error: "RefreshAccessTokenError" }
      }

      return refreshAccessToken(token)
    },
    async session({ session, token }: any) {
      session.accessToken = token.accessToken
      session.error = token.error
      return session
    },
    async signIn({ user }: any) {
      try {
        await resend.contacts.create({
          email: user.email,
          firstName: user.name?.split(" ")[0] || "",
          unsubscribed: false,
          audienceId: process.env.RESEND_AUDIENCE_ID!,
        })
      } catch (error) {
        console.error("Failed to add to Resend audience:", error)
      }
      return true
    },
  },
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
