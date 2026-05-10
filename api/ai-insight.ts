// api/ai-insight.ts — Vercel Serverless Function
// Хэл автоматаар тодорхойлж, тохирох хэлээр хариу өгнө

import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { childName, birthDate, summary, language } = req.body ?? {};

  if (!childName || !summary) {
    return res.status(400).json({ error: "childName and summary are required" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY ?? process.env.VITE_ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "API key not configured" });
  }

  // Хэл тодорхойлох: frontend-ээс "mn" эсвэл "en" илгээнэ, эсвэл default монгол
  const lang = language === "en" ? "en" : "mn";

  const systemPrompt =
    lang === "en"
      ? `You are a supportive children's achievement coach. 
Analyze the child's achievements and give warm, encouraging, personalized advice in English.
Be specific about what they've accomplished. Keep it to 3-4 sentences.
Do NOT use Mongolian — respond ONLY in English.`
      : `Та хүүхдийн амжилтыг дэмжих мэргэжлийн зөвлөх.
Хүүхдийн амжилтуудыг шинжилж, дулаан, урамшуулалтай, хувийн зөвлөгөө монгол хэлээр өг.
Тодорхой амжилтуудыг дурдаж, цаашид юу хийж болохыг хэлж өг.
3-4 өгүүлбэрт багтаа.
Зөвхөн монгол хэлээр хариулна уу.`;

  const userMessage =
    lang === "en"
      ? `Child's name: ${childName}
Date of birth: ${birthDate ?? "unknown"}
Recent achievements:
${summary}

Please provide 3-4 sentences of warm, specific, encouraging advice in English.`
      : `Хүүхдийн нэр: ${childName}
Төрсөн огноо: ${birthDate ?? "мэдэгдэхгүй"}
Сүүлийн амжилтууд:
${summary}

3-4 өгүүлбэрт дулаан, тодорхой, урамшуулалтай зөвлөгөө монгол хэлээр өгнө үү.`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 400,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic API error:", response.status, errText);
      return res.status(502).json({ error: "Anthropic API error", detail: errText });
    }

    const data = await response.json();
    const insight = data?.content?.[0]?.text ?? "";

    return res.status(200).json({ insight });
  } catch (err) {
    console.error("ai-insight handler error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
