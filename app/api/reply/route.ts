import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { subject, from, snippet, summary } = await req.json();
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: `You are a professional email assistant. Write a concise, helpful reply to the email below. Be professional but natural. Just write the reply body — no subject line, no preamble.` },
        { role: "user", content: `From: ${from}\nSubject: ${subject}\n\n${summary || snippet}` }
      ],
      max_tokens: 300
    });
    const reply = completion.choices[0].message.content || "";
    return NextResponse.json({ reply });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}
