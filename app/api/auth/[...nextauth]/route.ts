import NextAuth from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "openid email profile https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.modify",
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
      }
      return token
    },
    async session({ session, token }: any) {
      session.accessToken = token.accessToken
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
