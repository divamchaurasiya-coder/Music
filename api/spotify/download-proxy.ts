import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { url } = req.query;
  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "Missing 'url' parameter" });
  }

  try {
    const audioRes = await fetch(url);
    if (!audioRes.ok) {
      throw new Error(`Failed to fetch audio stream: ${audioRes.status}`);
    }

    const arrayBuffer = await audioRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    return res.status(200).send(buffer);
  } catch (err: any) {
    console.error("Download proxy failure:", err);
    return res.status(500).json({ error: err.message || "Failed to proxy stream" });
  }
}
