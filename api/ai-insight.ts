import Anthropic from "@anthropic-ai/sdk";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { childName, birthDate, summary } = req.body;

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: `Та хүүхдийн хөгжлийн мэргэжилтэн. Дараах хүүхдийн амжилтуудад үндэслэн монгол хэлээр богино, урам зориг өгөх зөвлөгөө өг (3-4 өгүүлбэр):

Хүүхэд: ${childName}, ${birthDate} настай
Амжилтууд:
${summary}`,
        },
      ],
    });

    const insight = message.content[0].type === "text" ? message.content[0].text : "";
    return res.status(200).json({ insight });
  } catch (error: unknown) {
    console.error("Anthropic error:", error);
    const msg = error instanceof Error ? error.message : "Тодорхойгүй алдаа";
    return res.status(500).json({ error: msg });
  }
}