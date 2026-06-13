import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Spotify Developer Credentials
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || "";
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || "";

// Custom server session tracking (optional state)
app.get("/api/health", (req, res) => {
  res.json({ status: "healthy", timestamp: Date.now() });
});

// GET /api/spotify/auth-url
app.get("/api/spotify/auth-url", (req, res) => {
  const host = req.headers.host || "localhost:3000";
  const protocol = req.headers["x-forwarded-proto"] || "http";
  
  // Spotify Dashboard requires this exact URI registered.
  // Use official APP_URL if set, otherwise fallback to request headers.
  const baseUrl = process.env.APP_URL ? process.env.APP_URL.replace(/\/+$/, "") : `${protocol}://${host}`;
  const defaultRedirectUri = `${baseUrl}/api/spotify/callback`;
  
  const scopes = [
    "user-read-private",
    "user-read-email",
    "playlist-read-private",
    "playlist-read-collaborative"
  ].join(" ");

  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
    // Return a working Demo Flow if API credentials aren't configured yet!
    // This allows the user to test the UI immediately without setup friction.
    const demoUrl = `/api/spotify/callback?code=demo_access_token_12345&state=${encodeURIComponent(baseUrl)}`;
    return res.json({
      url: demoUrl,
      demoUrl: demoUrl,
      isDemo: true,
      message: "To connect real Spotify data, configure SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in .env"
    });
  }

  // Real OAuth authorize URL
  const spotifyAuthUrl = `https://accounts.spotify.com/authorize?${new URLSearchParams({
    response_type: "code",
    client_id: SPOTIFY_CLIENT_ID,
    scope: scopes,
    redirect_uri: defaultRedirectUri,
    state: baseUrl // Pass target origin as state to safely handle redirect back
  }).toString()}`;

  res.json({ url: spotifyAuthUrl, isDemo: false });
});

// GET /api/spotify/callback
app.get("/api/spotify/callback", async (req, res) => {
  const { code, state } = req.query;
  const host = req.headers.host || "localhost:3000";
  const protocol = req.headers["x-forwarded-proto"] || "http";
  
  const baseUrl = process.env.APP_URL ? process.env.APP_URL.replace(/\/+$/, "") : `${protocol}://${host}`;
  const redirectUri = `${baseUrl}/api/spotify/callback`;

  // Fallback state if undefined
  const targetOrigin = (state as string) || baseUrl;

  // 1. Handle Demo Mode bypass
  if (code === "demo_access_token_12345" || !SPOTIFY_CLIENT_ID) {
    const demoToken = "demo_access_token_" + Math.random().toString(36).substring(2);
    return res.send(`
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
              window.opener.postMessage({
                type: "OAUTH_AUTH_SUCCESS",
                accessToken: "${demoToken}",
                isDemo: true
              }, "${targetOrigin}");
              window.close();
            }, 1500);
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

    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Spotify Connnection Success</title>
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
            window.opener.postMessage({
              type: "OAUTH_AUTH_SUCCESS",
              accessToken: "${accessToken}",
              isDemo: false
            }, "${targetOrigin}");
            window.close();
          </script>
        </body>
      </html>
    `);
  } catch (err: any) {
    console.error("Token Exchange Failure:", err);
    res.status(500).send(`
      <html>
        <body style="background: #121212; color: #ff5555; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh;">
          <div style="background: #1c1c1c; padding: 20px; border: 1px solid #ff0000; border-radius: 8px; max-width: 450px;">
            <h3>Spotify Connection Failed</h3>
            <p>${err.message || err}</p>
            <p style="font-size: 12px; color: #888;">Please verify that the redirect URI is added to your Spotify Developer Dashboard settings.</p>
          </div>
        </body>
      </html>
    `);
  }
});

// POST /api/spotify/proxy
app.post("/api/spotify/proxy", async (req, res) => {
  const { endpoint, token } = req.body;
  if (!endpoint || !token) {
    return res.status(400).json({ error: "Missing parameters: endpoint or token" });
  }

  // 1. Return high-quality pre-seeded demo lists if using demo token
  if (token.startsWith("demo_access_token_")) {
    if (endpoint === "me/playlists") {
      return res.json({
        items: [
          {
            id: "4CbXJfRFkVum9E7asvARS6",
            name: "Featured Vibes (Premade Playlist)",
            description: "Ready-to-sync showcase compilation via real Spotify API",
            images: [{ url: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&q=80" }]
          },
          {
            id: "demo_lofi_vibes",
            name: "Study Chill (Demo)",
            description: "Curated late night lo-fi recordings",
            images: [{ url: "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=300&q=80" }]
          },
          {
            id: "demo_retro_cyber",
            name: "Outrun Electro Drive (Demo)",
            description: "High velocity neon retro synthwaves",
            images: [{ url: "https://images.unsplash.com/photo-1515462277126-270d878326e5?w=300&q=80" }]
          }
        ]
      });
    }

    if (endpoint.startsWith("playlists/demo_lofi_vibes") || endpoint.startsWith("playlists/4CbXJfRFkVum9E7asvARS6")) {
      return res.json({
        tracks: {
          items: [
            {
              track: {
                id: "demo_tr_l1",
                name: "Late Night Hot Chocolate",
                duration_ms: 195000,
                artists: [{ name: "Sonder Cafe Lofi" }],
                album: { name: "Study Companion", images: [{ url: "https://images.unsplash.com/photo-1541167760496-1628856ab772?w=150&q=80" }] },
                preview_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3"
              }
            },
            {
              track: {
                id: "demo_tr_l2",
                name: "Sleepy Train Window",
                duration_ms: 224000,
                artists: [{ name: "Midnight Beats" }],
                album: { name: "Sleepy Rails", images: [{ url: "https://images.unsplash.com/photo-1474487548417-781cb71495f3?w=150&q=80" }] },
                preview_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3"
              }
            },
            {
              track: {
                id: "demo_tr_l3",
                name: "Retro City Rain",
                duration_ms: 245000,
                artists: [{ name: "Neon Rainmakers" }],
                album: { name: "Midnight Grid", images: [{ url: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=150&q=80" }] },
                preview_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3"
              }
            },
            {
              track: {
                id: "demo_tr_l4",
                name: "Sunset Waves",
                duration_ms: 185000,
                artists: [{ name: "Pacific Breeze" }],
                album: { name: "Golden Hour", images: [{ url: "https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=150&q=80" }] },
                preview_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3"
              }
            }
          ]
        }
      });
    }

    if (endpoint.startsWith("playlists/demo_retro_cyber")) {
      return res.json({
        tracks: {
          items: [
            {
              track: {
                id: "demo_tr_s1",
                name: "Synth Highway 1984",
                duration_ms: 211000,
                artists: [{ name: "Volt Deluxe" }],
                album: { name: "Megacity Grid", images: [{ url: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=150&q=80" }] },
                preview_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3"
              }
            },
            {
              track: {
                id: "demo_tr_s2",
                name: "Laser Horizon",
                duration_ms: 182000,
                artists: [{ name: "Sunset Cruiser" }],
                album: { name: "Velocity Zero", images: [{ url: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=150&q=80" }] },
                preview_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3"
              }
            }
          ]
        }
      });
    }

    // Default response for other playlists
    return res.json({ tracks: { items: [] } });
  }

  // 2. Real API proxy to official Spotify servers
  try {
    const rawUrl = `https://api.spotify.com/v1/${endpoint}`;
    const result = await fetch(rawUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    });

    if (!result.ok) {
      const errText = await result.text();
      return res.status(result.status).json({ error: `Spotify API Error: ${errText}` });
    }

    const data = await result.json();
    return res.json(data);
  } catch (err: any) {
    console.error("Spotify API Proxy Error:", err);
    return res.status(500).json({ error: err.message || "Failed to make Spotify proxy request" });
  }
});

// Configure Vite integration
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    // Production path serving
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express Hi-Fi server running on http://localhost:${PORT}`);
  });
}

startServer();
