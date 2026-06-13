import type { VercelRequest, VercelResponse } from "@vercel/node";
import dotenv from "dotenv";

dotenv.config();

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || "";
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || "";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { code, state } = req.query;
  const host = req.headers.host || "localhost:3000";
  const protocol = (req.headers["x-forwarded-proto"] as string) || "http";
  
  const baseUrl = process.env.APP_URL ? process.env.APP_URL.replace(/\/+$/, "") : `${protocol}://${host}`;

  // Fallback target origin
  const targetOrigin = (state && state !== "null" && state !== "undefined" && (state as string).trim() !== "")
    ? (state as string)
    : baseUrl;
  
  const redirectUri = `${targetOrigin}/api/spotify/callback`;

  // 1. Handle Demo Mode bypass
  if (code === "demo_access_token_12345" || !SPOTIFY_CLIENT_ID) {
    const demoToken = "demo_access_token_" + Math.random().toString(36).substring(2);
    res.setHeader("Content-Type", "text/html");
    return res.status(200).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Spotify Auth Success</title>
          <style>
            body { background: #121212; color: white; font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
            .card { background: #181818; padding: 24px; border-radius: 12px; border: 1px solid #282828; max-width: 400px; }
            h2 { color: #1DB954; }
            p { color: #a7a7a7; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>Demo Spotify Connected</h2>
            <p>You connected with Demo Mode because client credentials are not configured yet.</p>
            <p>Closing authorization window...</p>
          </div>
          <script>
            setTimeout(() => {
              if (window.opener) {
                window.opener.postMessage({
                  type: "OAUTH_AUTH_SUCCESS",
                  accessToken: "${demoToken}",
                  isDemo: true
                }, "*");
                window.close();
              } else {
                const url = new URL("${targetOrigin}");
                url.searchParams.set("spotify_token", "${demoToken}");
                url.searchParams.set("spotify_is_demo", "true");
                window.location.href = url.toString();
              }
            }, 1000);
          </script>
        </body>
      </html>
    `);
  }

  // 2. Real Access Token Exchange
  try {
    const tokenResponse = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": "Basic " + Buffer.from(SPOTIFY_CLIENT_ID + ":" + SPOTIFY_CLIENT_SECRET).toString("base64")
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: code as string,
        redirect_uri: redirectUri
      })
    });

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      throw new Error(`Spotify token exchange error: ${errText}`);
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    res.setHeader("Content-Type", "text/html");
    return res.status(200).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Spotify Connection Success</title>
          <style>
            body { background: #121212; color: white; font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
            .card { background: #181818; padding: 24px; border-radius: 12px; border: 1px solid #282828; max-width: 400px; }
            h2 { color: #1DB954; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>Successfully Connected!</h2>
            <p>Your Spotify profile has been authorized.</p>
            <p>Finishing synchronization...</p>
          </div>
          <script>
            if (window.opener) {
              window.opener.postMessage({
                type: "OAUTH_AUTH_SUCCESS",
                accessToken: "${accessToken}",
                isDemo: false
              }, "*");
              window.close();
            } else {
              const url = new URL("${targetOrigin}");
              url.searchParams.set("spotify_token", "${accessToken}");
              url.searchParams.set("spotify_is_demo", "false");
              window.location.href = url.toString();
            }
          </script>
        </body>
      </html>
    `);
  } catch (err: any) {
    console.error("Token Exchange Failure:", err);
    res.setHeader("Content-Type", "text/html");
    return res.status(200).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Spotify Connection Failed</title>
          <style>
            body { background: #121212; color: white; font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
            .card { background: #181818; padding: 28px; border-radius: 16px; border: 1px solid #3a1515; max-width: 450px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
            h3 { color: #ff5555; margin-top: 0; font-size: 20px; }
            p { font-size: 14px; color: #b3b3b3; line-height: 1.5; }
            .btn { background: #1DB954; color: black; font-weight: bold; border: none; padding: 12px 24px; border-radius: 24px; cursor: pointer; font-size: 14px; margin-top: 15px; width: 100%; transition: all 0.2s; box-shadow: 0 4px 12px rgba(29, 185, 84, 0.3); }
            .btn:hover { background: #1ed760; transform: scale(1.02); }
            .footer-tip { font-size: 11px; color: #666; margin-top: 20px; font-weight: normal; }
          </style>
        </head>
        <body>
          <div class="card">
            <h3>Spotify Connection Mismatch</h3>
            <p>${err.message || err}</p>
            <p>This is usually due to redirect URIs or authorization sandbox restrictions.</p>
            <button class="btn" onclick="useSandboxFallback()">
              Continue with Sandbox / Demo Stream
            </button>
            <p class="footer-tip">Whitelisted redirect URI:<br/><code style="background: #282828; color: #1DB954; padding: 4px 8px; border-radius: 4px; display: block; margin-top: 5px; word-break: break-all;">${redirectUri}</code></p>
          </div>
          <script>
            function useSandboxFallback() {
              const demoToken = "demo_access_token_fallback_" + Math.random().toString(36).substring(2);
              if (window.opener) {
                window.opener.postMessage({
                  type: "OAUTH_AUTH_SUCCESS",
                  accessToken: demoToken,
                  isDemo: true
                }, "*");
                window.close();
              } else {
                const url = new URL("${targetOrigin}");
                url.searchParams.set("spotify_token", demoToken);
                url.searchParams.set("spotify_is_demo", "true");
                window.location.href = url.toString();
              }
            }
          </script>
        </body>
      </html>
    `);
  }
}
