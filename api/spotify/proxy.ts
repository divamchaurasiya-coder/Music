import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(45).json({ error: "Only POST requests are supported" });
  }

  const { endpoint, token } = req.body;
  if (!endpoint || !token) {
    return res.status(400).json({ error: "Missing parameters: endpoint or token" });
  }

  const normalizedEndpoint = endpoint.trim().toLowerCase();

  // A. ALWAYS intercept pre-seeded / demo playlists
  if (
    normalizedEndpoint.startsWith("playlists/4cbxjfrfkvum9e7asvars6") ||
    normalizedEndpoint.startsWith("playlists/demo_lofi_vibes")
  ) {
    return res.status(200).json({
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
          },
          {
            track: {
              id: "demo_tr_l5",
              name: "Morning Brew Espresso",
              duration_ms: 168000,
              artists: [{ name: "Sonder Cafe Lofi" }],
              album: { name: "Daily Rituals", images: [{ url: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=150&q=80" }] },
              preview_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"
            }
          },
          {
            track: {
              id: "demo_tr_l6",
              name: "Neon Cyber Boulevard",
              duration_ms: 215000,
              artists: [{ name: "Volt Deluxe" }],
              album: { name: "Megacity Grid", images: [{ url: "https://images.unsplash.com/photo-1515462277126-270d878326e5?w=150&q=80" }] },
              preview_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3"
            }
          },
          {
            track: {
              id: "demo_tr_l7",
              name: "Midnight Coffee Roasters",
              duration_ms: 198000,
              artists: [{ name: "Sonder Cafe Lofi" }],
              album: { name: "Daily Rituals", images: [{ url: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=150&q=80" }] },
              preview_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3"
            }
          },
          {
            track: {
              id: "demo_tr_l8",
              name: "Ethereal Ambient Echoes",
              duration_ms: 232000,
              artists: [{ name: "Ambient Explorer" }],
              album: { name: "Infinite Voids", images: [{ url: "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=150&q=80" }] },
              preview_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-12.mp3"
            }
          }
        ]
      }
    });
  }

  if (normalizedEndpoint.startsWith("playlists/demo_retro_cyber")) {
    return res.status(200).json({
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

  // B. Return default custom playlists if using demo token
  if (token.startsWith("demo_access_token_")) {
    if (normalizedEndpoint === "me/playlists") {
      return res.status(200).json({
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

    return res.status(200).json({ tracks: { items: [] } });
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
    return res.status(200).json(data);
  } catch (err: any) {
    console.error("Spotify API Proxy Error:", err);
    return res.status(500).json({ error: err.message || "Failed to make Spotify proxy request" });
  }
}
