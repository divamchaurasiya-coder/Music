import type { VercelRequest, VercelResponse } from "@vercel/node";
import dotenv from "dotenv";

dotenv.config();

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || "";
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || "";

export default function handler(req: VercelRequest, res: VercelResponse) {
  const queryOrigin = req.query.origin as string;
  const host = req.headers.host || "localhost:3000";
  const protocol = (req.headers["x-forwarded-proto"] as string) || "http";
  
  // Clean up origin
  let baseUrl = "";
  if (queryOrigin && queryOrigin !== "null" && queryOrigin !== "undefined" && queryOrigin.trim() !== "") {
    baseUrl = queryOrigin.replace(/\/+$/, "");
  } else if (process.env.APP_URL) {
    baseUrl = process.env.APP_URL.replace(/\/+$/, "");
  } else {
    baseUrl = `${protocol}://${host}`;
  }
  
  const defaultRedirectUri = `${baseUrl}/api/spotify/callback`;
  
  const scopes = [
    "user-read-private",
    "user-read-email",
    "playlist-read-private",
    "playlist-read-collaborative"
  ].join(" ");

  // Fallback if client credentials are not configured
  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
    const demoUrl = `/api/spotify/callback?code=demo_access_token_12345&state=${encodeURIComponent(baseUrl)}`;
    return res.status(200).json({
      url: demoUrl,
      demoUrl: demoUrl,
      isDemo: true,
      message: "To connect real Spotify data, configure SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in environmental configurations."
    });
  }

  // Generate real Spotify authorize URL
  const spotifyAuthUrl = `https://accounts.spotify.com/authorize?${new URLSearchParams({
    response_type: "code",
    client_id: SPOTIFY_CLIENT_ID,
    scope: scopes,
    redirect_uri: defaultRedirectUri,
    state: baseUrl
  }).toString()}`;

  res.status(200).json({ url: spotifyAuthUrl, isDemo: false });
}
