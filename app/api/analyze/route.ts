import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { emailText } = await req.json();

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an email analyzer. Return ONLY valid JSON, no extra text, no markdown. Use this exact format:
          {
            "category": "Important" or "Action Needed" or "Other",
            "summary": "one sentence summary",
            "tasks": ["task 1", "task 2"]
          }`
        },
        { role: "user", content: emailText }
      ]
    });

    const raw = completion.choices[0].message.content || "{}";
    const result = JSON.parse(raw);
    return NextResponse.json(result);

  } catch (error: any) {
    console.error("OpenAI error:", error?.message);
    return NextResponse.json({ error: error?.message || "Analysis failed" }, { status: 500 });
  }
}