import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
export async function POST(req: NextRequest) {
  try {
    const { subject, from, snippet, summary } = await req.json();
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: `You are writing a reply email on behalf of the user. Write in first person as if YOU are the user responding. Be professional, natural and concise. Never summarize the email — write an actual reply response. Start directly with the reply content, no subject line, no "Here is a reply", no preamble. Use "I" not "you" when referring to the sender's perspective.` },
        { role: "user", content: `Write a first-person reply to this email:\n\nFrom: ${from}\nSubject: ${subject}\n\n${summary || snippet}` }
      ],
      max_tokens: 300
    });
    const reply = completion.choices[0].message.content || "";
    return NextResponse.json({ reply });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}
