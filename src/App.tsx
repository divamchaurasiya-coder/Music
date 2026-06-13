/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { AudioPlayerProvider, useAudioPlayer } from "./context/AudioPlayerContext";
import { Visualizer } from "./components/Visualizer";
import { Equalizer } from "./components/Equalizer";
import { LocalScanner } from "./components/LocalScanner";
import { PlaylistManager } from "./components/PlaylistManager";
import { SearchAndDiscover } from "./components/SearchAndDiscover";
import { FullscreenPlayer } from "./components/FullscreenPlayer";
import { SpotifyOfflineSync } from "./components/SpotifyOfflineSync";
import { SpotifyImportPopup } from "./components/SpotifyImportPopup";
import { 
  Music, LogIn, Library, Sliders, FolderUp, RefreshCw, Heart, 
  Play, Pause, SkipForward, SkipBack, Sparkles, Volume2, Search, Maximize2, X, FolderDown
} from "lucide-react";
import { Track, Playlist, SpotifyUser } from "./types";
import { getAllLocalTracks, getAllPlaylists, savePlaylist, getUserSetting, saveUserSetting, openDB } from "./utils/db";

const getAbsoluteApiUrl = (apiPath: string) => {
  if (apiPath.startsWith("http://") || apiPath.startsWith("https://")) {
    return apiPath;
  }
  try {
    const currentUrl = window.location.href;
    if (currentUrl && currentUrl.startsWith("http")) {
      const parsed = new URL(currentUrl);
      const cleanPath = apiPath.startsWith("/") ? apiPath : `/${apiPath}`;
      return `${parsed.protocol}//${parsed.host}${cleanPath}`;
    }
  } catch (e) {
    console.warn("Failed to construct absolute api URL from window.location.href:", e);
  }
  return apiPath;
};

function MainAppLayout() {
  const [activeTab, setActiveTab] = useState<"discover" | "library" | "scanner" | "equalizer" | "spotify-sync">("discover");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [localTracks, setLocalTracks] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [spotifyPlaylists, setSpotifyPlaylists] = useState<Playlist[]>([]);
  const [spotifyToken, setSpotifyToken] = useState<string | null>(null);
  const [spotifyUser, setSpotifyUser] = useState<SpotifyUser | null>(null);
  const [isConnectingSpotify, setIsConnectingSpotify] = useState(false);
  const [spotifyError, setSpotifyError] = useState<string | null>(null);
  const [syncingPlaylistId, setSyncingPlaylistId] = useState<string | null>(null);
  const [selectPlaylistModalOpen, setSelectPlaylistModalOpen] = useState(false);
  const [showSpotifyImportPopup, setShowSpotifyImportPopup] = useState(false);
  const [trackToAdd, setTrackToAdd] = useState<Track | null>(null);
  
  // Custom enhanced Spotify states
  const [spotifyPlaylistsError, setSpotifyPlaylistsError] = useState<string | null>(null);
  const [isImportingUrl, setIsImportingUrl] = useState(false);
  const [playlistUrlInput, setPlaylistUrlInput] = useState("");
  const [importStatusMsg, setImportStatusMsg] = useState("");

  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    togglePlay,
    nextTrack,
    prevTrack,
    playTrack,
    seek,
    favorites
  } = useAudioPlayer();

  // Load database files and playlists on boot
  const refreshLocalData = async () => {
    try {
      const tracks = await getAllLocalTracks();
      setLocalTracks(tracks);

      const savedPlaylists = await getAllPlaylists();
      
      // Seed default favorite playlist if zero playlists exist
      if (savedPlaylists.length === 0) {
        const defaultPl: Playlist = {
          id: "pl_favorites",
          name: "My Favorites ❤️",
          description: "Your top starred tracks accumulated natively",
          artworkUrl: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&q=80",
          tracks: [],
          createdAt: Date.now()
        };
        await savePlaylist(defaultPl);
        setPlaylists([defaultPl]);
      } else {
        // Sync favorite tracks metadata status live 
        const favoriteTracks = allAvailableTracks().filter(t => favorites.includes(t.id));
        const updatedPlaylists = savedPlaylists.map(pl => {
          if (pl.id === "pl_favorites") {
            return { ...pl, tracks: favoriteTracks };
          }
          return pl;
        });
        setPlaylists(updatedPlaylists);
        
        if (selectedPlaylist) {
          const currentFresh = updatedPlaylists.find(p => p.id === selectedPlaylist.id);
          if (currentFresh) {
            setSelectedPlaylist(currentFresh);
          }
        }
      }
    } catch (e) {
      console.error("Failed to load IndexedDB on startup:", e);
    }
  };

  useEffect(() => {
    refreshLocalData();
  }, [favorites]);

  // Fetch Spotify user profile info (or fallback to mockup if in Demo Mode)
  const fetchSpotifyUserProfile = async (token: string, isDemo: boolean): Promise<SpotifyUser> => {
    if (isDemo || token.startsWith("demo_access_token_")) {
      const userDetails: SpotifyUser = {
        id: "spotify_sync_user",
        displayName: "Demo User 🎵",
        avatarUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&q=80",
        product: "Demo Mode"
      };
      setSpotifyUser(userDetails);
      await saveUserSetting("spotify_user", userDetails);
      return userDetails;
    }

    try {
      const response = await fetch(getAbsoluteApiUrl("/api/spotify/proxy"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: "me",
          token: token
        })
      });

      if (!response.ok) {
        throw new Error(`Profile fetch response failed (HTTP ${response.status})`);
      }
      const data = await response.json();
      
      const userDetails: SpotifyUser = {
        id: data.id || "spotify_sync_user",
        displayName: data.display_name || "Spotify Member",
        avatarUrl: data.images?.[0]?.url || data.images?.[1]?.url || "https://images.unsplash.com/photo-1541167760496-1628856ab772?w=100&q=80",
        product: data.product || "Premium"
      };

      setSpotifyUser(userDetails);
      await saveUserSetting("spotify_user", userDetails);
      return userDetails;
    } catch (err: any) {
      console.warn("Retrieve Profile failed, using cached or fallback name:", err);
      // Fallback
      const userDetails: SpotifyUser = {
        id: "spotify_sync_user",
        displayName: "Spotify Member",
        avatarUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&q=80",
        product: "Premium"
      };
      setSpotifyUser(userDetails);
      await saveUserSetting("spotify_user", userDetails);
      return userDetails;
    }
  };

  // Load Spotify persistence on start
  useEffect(() => {
    const loadSpotifySession = async () => {
      // 1. Check query parameters first in case of a same-tab authorization redirection fallback
      const params = new URLSearchParams(window.location.search);
      const queryToken = params.get("spotify_token");
      const isQueryDemo = params.get("spotify_is_demo") === "true";

      if (queryToken) {
        setSpotifyToken(queryToken);
        
        // Strip the token from the browser location bar for security and cleanliness
        const cleanedUrl = new URL(window.location.href);
        cleanedUrl.searchParams.delete("spotify_token");
        cleanedUrl.searchParams.delete("spotify_is_demo");
        window.history.replaceState({}, document.title, cleanedUrl.toString());

        await saveUserSetting("spotify_token", queryToken);
        await fetchSpotifyUserProfile(queryToken, isQueryDemo);
        await fetchSpotifyPlaylists(queryToken);
        setShowSpotifyImportPopup(true);
        return;
      }

      // 2. Otherwise, load from local database persistence
      const savedToken = await getUserSetting<string | null>("spotify_token", null);
      if (savedToken) {
        setSpotifyToken(savedToken);
        await fetchSpotifyUserProfile(savedToken, savedToken.startsWith("demo_access_token_"));
        await fetchSpotifyPlaylists(savedToken);
      }
    };
    loadSpotifySession();
  }, []);

  // Listen to popup Message communication for Spotify connection
  useEffect(() => {
    const handleAuthMessage = async (event: MessageEvent) => {
      // Validate host origin is development run.app container, standard localhost, or exact current browser origin
      const origin = event.origin;
      if (!origin.endsWith(".run.app") && !origin.includes("localhost") && origin !== window.location.origin) {
        return;
      }

      if (event.data && event.data.type === "OAUTH_AUTH_SUCCESS") {
        const token = event.data.accessToken;
        setSpotifyToken(token);
        
        await saveUserSetting("spotify_token", token);
        await fetchSpotifyUserProfile(token, event.data.isDemo);
        await fetchSpotifyPlaylists(token);
        setShowSpotifyImportPopup(true);
      }
    };

    window.addEventListener("message", handleAuthMessage);
    return () => window.removeEventListener("message", handleAuthMessage);
  }, []);

  // Fetch playlists from Spotify (or mock response via Server proxy)
  const fetchSpotifyPlaylists = async (token: string) => {
    setSpotifyPlaylistsError(null);
    try {
      const response = await fetch(getAbsoluteApiUrl("/api/spotify/proxy"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: "me/playlists",
          token: token
        })
      });

      if (!response.ok) {
        const errObj = await response.json().catch(() => ({}));
        throw new Error(errObj.error || `HTTP error ${response.status}`);
      }
      const data = await response.json();
      
      if (data && data.items) {
        let items = data.items;

        // Always ensure the showcase premade playlist is first
        const premadePlaylistId = "4CbXJfRFkVum9E7asvARS6";
        const hasPremade = items.some((item: any) => item.id === premadePlaylistId);
        if (!hasPremade) {
          items = [
            {
              id: premadePlaylistId,
              name: "Featured Vibes (Premade Playlist)",
              description: "Ready-to-sync showcase compilation via real Spotify API",
              images: [{ url: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&q=80" }]
            },
            ...items
          ];
        }

        const parsedPlaylists: Playlist[] = items.map((item: any) => ({
          id: item.id,
          name: item.name,
          description: item.description,
          artworkUrl: item.images?.[0]?.url || "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&q=80",
          tracks: [], // load on selection/sync
          isSpotify: true,
          spotifyId: item.id,
          createdAt: Date.now()
        }));

        setSpotifyPlaylists(parsedPlaylists);
        
        // Combine into general libraries representation
        setPlaylists(prev => {
          const locals = prev.filter(p => !p.isSpotify);
          return [...locals, ...parsedPlaylists];
        });
      } else {
        setSpotifyPlaylists([]);
      }
    } catch (err: any) {
      console.error("Spotify playlists loading failed:", err);
      setSpotifyPlaylistsError(
        `Failed to retrieve account playlists: ${err.message || err}. ` +
        `Note: In Spotify Developer sandbox mode, only whitelisted accounts can retrieve developer resources. See Configuration tips below.`
      );
    }
  };

  // Sync / Load single Spotify playlist tracks
  const triggerSpotifySync = async (playlist: Playlist) => {
    if (!spotifyToken) return;
    setSyncingPlaylistId(playlist.id);

    try {
      const response = await fetch(getAbsoluteApiUrl("/api/spotify/proxy"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: `playlists/${playlist.spotifyId}`,
          token: spotifyToken
        })
      });

      if (!response.ok) throw new Error("Sync failure");
      const data = await response.json();

      if (data && data.tracks && data.tracks.items) {
        const syncedTracks: Track[] = data.tracks.items.map((entry: any, index: number) => {
          const t = entry.track;
          return {
            id: t.id || `sp_tr_${index}_${Date.now()}`,
            name: t.name,
            artist: t.artists?.[0]?.name || "Unknown Artist",
            album: t.album?.name || "Single",
            duration: Math.round(t.duration_ms / 1000) || 180,
            artworkUrl: t.album?.images?.[0]?.url || "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=100&q=80",
            source: "spotify",
            previewUrl: t.preview_url || `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${(index % 12) + 1}.mp3` // fallback test audio so players always sound glorious!
          };
        });

        const updatedPlaylist = {
          ...playlist,
          tracks: syncedTracks
        };

        // Cache synced state in IndexedDB so it's fully viewable offline!
        await savePlaylist(updatedPlaylist);

        setPlaylists(prev => prev.map(p => p.id === playlist.id ? updatedPlaylist : p));
        setSelectedPlaylist(updatedPlaylist);
      }
    } catch (e) {
      console.error("Playlist alignment sync error:", e);
    } finally {
      setSyncingPlaylistId(null);
    }
  };

  const allAvailableTracks = (): Track[] => {
    const list: Track[] = [...localTracks];
    playlists.forEach(pl => {
      pl.tracks.forEach(tr => {
        if (!list.some(l => l.id === tr.id)) {
          list.push(tr);
        }
      });
    });
    return list;
  };

  // Generate / Handle Spotify connection popup with same-tab redirect fallback for sandboxed iframe environments
  const connectSpotify = async () => {
    setIsConnectingSpotify(true);
    setSpotifyError(null);

    const width = 550;
    const height = 650;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    // 1. Immediately spawn the window context synchronously within the user click gesture!
    // This makes modern browsers treat the window as high priority and bypass popup blockers.
    let authWindow: Window | null = null;
    try {
      authWindow = window.open(
        "about:blank",
        "spotify_oauth_popup",
        `width=${width},height=${height},top=${top},left=${left},scrollbars=yes,resizable=yes`
      );
    } catch (e) {
      console.warn("Same-origin context blocked standard window.open synchronous invocation.", e);
    }

    try {
      let clientOrigin = window.location.origin === "null" ? "" : window.location.origin;
      if (!clientOrigin || !clientOrigin.startsWith("http")) {
        try {
          const parsed = new URL(window.location.href);
          if (parsed.protocol && parsed.protocol.startsWith("http")) {
            clientOrigin = `${parsed.protocol}//${parsed.host}`;
          } else {
            clientOrigin = "";
          }
        } catch (e) {
          clientOrigin = "";
        }
      }
      const res = await fetch(getAbsoluteApiUrl(`/api/spotify/auth-url?origin=${encodeURIComponent(clientOrigin)}`));
      
      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }
      
      const data = await res.json();
      const authUrl = data.url || data.demoUrl;
      
      // Passing origin as state so callback redirects accurately
      const stateParam = clientOrigin;
      const finalUrl = authUrl.includes("state=")
        ? authUrl // Already has state constructed on server
        : authUrl.includes("?") 
        ? `${authUrl}&state=${encodeURIComponent(stateParam)}`
        : `${authUrl}?state=${encodeURIComponent(stateParam)}`;

      if (authWindow && !authWindow.closed) {
        // Update the location of the pre-opened synchronous window reference
        authWindow.location.href = finalUrl;
      } else {
        // Fallback to direct window location navigation for sandboxed environments
        window.location.href = finalUrl;
      }
    } catch (e: any) {
      console.error("Failed to fetch Spotify Redirect parameters:", e);
      setSpotifyError(e.message || "Failed to fetch connection URL from server.");
      if (authWindow && !authWindow.closed) {
        authWindow.close();
      }
    } finally {
      setIsConnectingSpotify(false);
    }
  };

  const handleDisconnectSpotify = () => {
    if (confirm("Disconnect connected Spotify Account? Cached playlists remain saved.")) {
      setSpotifyToken(null);
      setSpotifyUser(null);
      saveUserSetting("spotify_token", null);
      saveUserSetting("spotify_user", null);
      // Remove spotify tracks from active display loop
      setPlaylists(prev => prev.filter(p => !p.isSpotify));
    }
  };

  // Dialog Playlist Modal triggers
  const promptAddTrackToPlaylist = (track: Track) => {
    setTrackToAdd(track);
    setSelectPlaylistModalOpen(true);
  };

  const handleAddTrackToPlaylistConfirm = async (playlistId: string) => {
    if (!trackToAdd) return;
    const playlistSpec = playlists.find(p => p.id === playlistId);
    if (!playlistSpec) return;

    if (playlistSpec.tracks.some(t => t.id === trackToAdd.id)) {
      alert("This track is already present in this playlist.");
      setSelectPlaylistModalOpen(false);
      return;
    }

    const updatedPlaylist = {
      ...playlistSpec,
      tracks: [...playlistSpec.tracks, trackToAdd]
    };

    await savePlaylist(updatedPlaylist);
    refreshLocalData();
    setSelectPlaylistModalOpen(false);
    setTrackToAdd(null);
  };

  const handleImportSpotifyPlaylist = async (playlist: Playlist) => {
    const alreadySaved = playlists.some(p => p.spotifyId === playlist.id || p.id === playlist.id);
    if (alreadySaved) return;

    const copyPlaylist: Playlist = {
      ...playlist,
      createdAt: Date.now()
    };
    await savePlaylist(copyPlaylist);
    await refreshLocalData();
    
    await triggerSpotifySync(copyPlaylist);
  };

  const handleImportPlaylistByUrl = async (inputUrl: string) => {
    if (!inputUrl.trim()) return;
    if (!spotifyToken) {
      alert("Please connect Spotify first to import playlists.");
      return;
    }

    setIsImportingUrl(true);
    setImportStatusMsg("Analyzing Spotify URL...");

    try {
      // Extract Playlist ID from URL (e.g. 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGsy3gvl?si=...')
      let playlistId = inputUrl.trim();
      if (playlistId.includes("playlist/")) {
        const parts = playlistId.split("playlist/");
        if (parts[1]) {
          playlistId = parts[1].split("?")[0].split("/")[0];
        }
      }

      if (!playlistId || playlistId.length < 15) {
        throw new Error("Invalid playlist URL or ID format. Please copy a correct Link from Spotify.");
      }

      setImportStatusMsg("Querying Spotify API for metadata...");

      // Fetch playlist details from proxy
      const response = await fetch(getAbsoluteApiUrl("/api/spotify/proxy"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: `playlists/${playlistId}`,
          token: spotifyToken
        })
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Failed to fetch (HTTP ${response.status})`);
      }

      const data = await response.json();
      
      // Parse playlist metadata and sync tracks
      const plId = data.id || `sp_pl_${Date.now()}`;
      
      const syncedTracks: Track[] = (data.tracks?.items || []).map((entry: any, index: number) => {
        const t = entry.track;
        if (!t) return null;
        return {
          id: t.id || `sp_tr_${index}_${Date.now()}`,
          name: t.name,
          artist: t.artists?.[0]?.name || "Unknown Artist",
          album: t.album?.name || "Single",
          duration: Math.round(t.duration_ms / 1000) || 180,
          artworkUrl: t.album?.images?.[0]?.url || "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=100&q=80",
          source: "spotify" as const,
          previewUrl: t.preview_url || `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${(index % 12) + 1}.mp3`
        };
      }).filter(Boolean) as Track[];

      const importedPlaylist: Playlist = {
        id: plId,
        name: data.name || "Imported Playlist",
        description: data.description || "Synthesizer Import from Spotify link",
        artworkUrl: data.images?.[0]?.url || "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&q=80",
        tracks: syncedTracks,
        isSpotify: true,
        spotifyId: plId,
        createdAt: Date.now()
      };

      // Check if already in playlists state
      const alreadyExists = playlists.some(p => p.spotifyId === plId || p.id === plId);
      if (alreadyExists) {
        setImportStatusMsg("Already imported! Check your collection.");
        setTimeout(() => setImportStatusMsg(""), 3000);
        return;
      }

      // Save to IndexedDB
      await savePlaylist(importedPlaylist);
      
      // Append matching lists in memory state
      setSpotifyPlaylists(prev => {
        if (prev.some(p => p.id === plId)) return prev;
        return [importedPlaylist, ...prev];
      });

      setPlaylists(prev => {
        const clean = prev.filter(p => p.id !== plId);
        return [importedPlaylist, ...clean];
      });

      setImportStatusMsg("Playlist sync completed successfully!");
      setPlaylistUrlInput("");

      // Automatically select this playlist
      setActiveTab("spotify-sync");
      // Give UI some feedback time
      setTimeout(() => {
        setImportStatusMsg("");
      }, 4000);

    } catch (err: any) {
      console.error("Manual Import failed:", err);
      setImportStatusMsg(`Import failed: ${err.message || err}`);
    } finally {
      setIsImportingUrl(false);
    }
  };

  // Format MM:SS
  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Get active tab view components
  const renderActiveTabContents = () => {
    switch (activeTab) {
      case "discover":
        return (
          <SearchAndDiscover
            localTracks={localTracks}
            onPlayTrack={(track, queue) => playTrack(track, queue || [track])}
            spotifyTracks={playlists.flatMap(p => p.isSpotify ? p.tracks : [])}
            onAddTrackToPlaylist={promptAddTrackToPlaylist}
          />
        );
      case "library":
        return (
          <PlaylistManager
            playlists={playlists}
            onPlaylistsUpdated={refreshLocalData}
            onSelectPlaylist={(pl) => {
              setSelectedPlaylist(pl);
              if (pl && pl.isSpotify && pl.tracks.length === 0 && spotifyToken) {
                // Auto trigger sync on select if empty
                triggerSpotifySync(pl);
              }
            }}
            selectedPlaylist={selectedPlaylist}
            onPlayTrack={(track, queue) => playTrack(track, queue || [track])}
            isSpotifyConnected={!!spotifyToken}
            onTriggerSpotifySync={triggerSpotifySync}
            syncingPlaylistId={syncingPlaylistId}
            localTracks={localTracks}
            spotifyToken={spotifyToken}
          />
        );
      case "scanner":
        return (
          <LocalScanner
            onTracksUpdated={refreshLocalData}
            localTracks={localTracks}
          />
        );
      case "equalizer":
        return (
          <div className="max-w-md mx-auto space-y-6">
            <Equalizer />
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-xs text-zinc-400 font-mono">
              <p className="font-bold text-white mb-2 uppercase text-[10px] tracking-wider text-[#1DB954]">Equalizer Operations</p>
              Applying custom presets filters physical audio nodes processing in the Web Audio context pipeline live. Keeps vocals crispy and sub-bass booming.
            </div>
          </div>
        );
      case "spotify-sync":
        return (
          <SpotifyOfflineSync
            spotifyUser={spotifyUser}
            spotifyToken={spotifyToken}
            spotifyPlaylists={spotifyPlaylists}
            playlists={playlists}
            connectSpotify={connectSpotify}
            isConnectingSpotify={isConnectingSpotify}
            onPlayTrack={(track, queue) => playTrack(track, queue || [track])}
            onLocalTracksRefreshed={refreshLocalData}
            onTriggerSpotifySync={triggerSpotifySync}
            syncingPlaylistId={syncingPlaylistId}
            spotifyPlaylistsError={spotifyPlaylistsError}
            playlistUrlInput={playlistUrlInput}
            setPlaylistUrlInput={setPlaylistUrlInput}
            isImportingUrl={isImportingUrl}
            importStatusMsg={importStatusMsg}
            onImportPlaylistByUrl={handleImportPlaylistByUrl}
          />
        );
    }
  };

  return (
    <div id="application-shell" className="min-h-screen bg-[#121212] flex flex-col justify-between font-sans text-white selection:bg-[#1DB954]/40">
      
      {/* Fullscreen view state overlay */}
      {isFullscreen && currentTrack && (
        <div className="fixed inset-0 z-50 bg-[#121212]">
          <FullscreenPlayer
            onMinimize={() => setIsFullscreen(false)}
            onAddTrackToPlaylist={promptAddTrackToPlaylist}
          />
        </div>
      )}

      {/* Main Top Header Block */}
      <header id="main-global-header" className="bg-[#121212]/80 backdrop-blur-xl border-b border-white/5 py-4 px-6 sticky top-0 z-40 flex items-center justify-between">
        <div className="flex items-center space-x-3.5 select-none">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#1DB954] to-[#a6ff1a] flex items-center justify-center text-black shadow-lg">
            <Music className="w-5.5 h-5.5 animate-pulse" />
          </div>
          <div>
            <h1 className="text-sm font-black tracking-widest text-white uppercase flex items-center space-x-1.5">
              <span>PREMIUM PLAYER</span>
              <span className="text-[9px] bg-[#1DB954]/25 text-[#1DB954] font-mono leading-none py-1 px-1.5 rounded">V1.5</span>
            </h1>
            <p className="text-[10px] text-zinc-400 font-mono">Hi-Fi Audio Web Client Space</p>
          </div>
        </div>

        {/* Spotify OAuth Trigger bar */}
        <div id="spotify-connection-header" className="flex flex-col items-end">
          {spotifyToken ? (
            <div className="flex items-center space-x-3 text-xs bg-black/40 border border-[#1DB954]/30 rounded-full py-1.5 pl-3 pr-4 shadow-lg select-none">
              {spotifyUser?.avatarUrl ? (
                <div className="w-6 h-6 rounded-full overflow-hidden border border-[#1DB954]/30 shrink-0">
                  <img src={spotifyUser.avatarUrl} alt={spotifyUser.displayName} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-6 h-6 rounded-full bg-[#1DB954]/10 border border-[#1DB954]/40 flex items-center justify-center shrink-0">
                  <span className="text-[10px] text-[#1DB954] font-bold">SP</span>
                </div>
              )}
              <div className="hidden sm:block">
                <p className="text-white font-bold leading-none truncate max-w-[100px]">{spotifyUser?.displayName || "Connected"}</p>
                <p className="text-[8px] text-zinc-500 font-mono mt-0.5 uppercase tracking-wide leading-none">{spotifyUser?.product || "Premium"}</p>
              </div>
              <button
                id="disconnect-spotify-btn"
                onClick={handleDisconnectSpotify}
                className="text-[9px] font-mono font-bold text-red-400 hover:text-red-300 transition-colors cursor-pointer border border-red-500/20 hover:border-red-500/50 py-0.5 px-2 bg-red-500/10 rounded-full ml-1"
              >
                DISCONNECT
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-end">
              <button
                id="connect-spotify-btn"
                onClick={connectSpotify}
                disabled={isConnectingSpotify}
                className="flex items-center space-x-2 bg-[#1DB954] hover:bg-[#1ed760] disabled:bg-zinc-800 text-black font-bold text-[11px] py-2 px-4 rounded-full shadow-lg transition-all active:scale-95 cursor-pointer leading-none uppercase tracking-wider"
              >
                {isConnectingSpotify ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <LogIn className="w-3.5 h-3.5 shrink-0" />
                )}
                <span>Connect Spotify</span>
              </button>
              {spotifyError && (
                <span className="text-[9px] text-red-400 font-mono bg-red-950/40 border border-red-500/20 py-0.5 px-2 rounded mt-1.5 text-right max-w-[220px]">
                  {spotifyError}
                </span>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Mobile Horizontal Navigation Tabs Row */}
      <div className="md:hidden sticky top-[73px] z-30 bg-[#121212]/95 backdrop-blur-md border-b border-white/5 py-3 px-4 flex items-center space-x-2 overflow-x-auto scrollbar-none scroll-smooth">
        <button
          id="tab-discover-mobile-btn"
          onClick={() => setActiveTab("discover")}
          className={`px-4 py-2 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeTab === "discover"
              ? "bg-[#1DB954] text-black shadow-lg shadow-[#1DB954]/25"
              : "bg-white/5 text-zinc-400 hover:text-white"
          }`}
        >
          Discover
        </button>
        <button
          id="tab-library-mobile-btn"
          onClick={() => setActiveTab("library")}
          className={`px-4 py-2 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeTab === "library"
              ? "bg-[#1DB954] text-black shadow-lg shadow-[#1DB954]/25"
              : "bg-white/5 text-zinc-400 hover:text-white"
          }`}
        >
          Playlists
        </button>
        <button
          id="tab-scanner-mobile-btn"
          onClick={() => setActiveTab("scanner")}
          className={`px-4 py-2 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeTab === "scanner"
              ? "bg-[#1DB954] text-black shadow-lg shadow-[#1DB954]/25"
              : "bg-white/5 text-zinc-400 hover:text-white"
          }`}
        >
          Offline Scanner
        </button>
        <button
          id="tab-equalizer-mobile-btn"
          onClick={() => setActiveTab("equalizer")}
          className={`px-4 py-2 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeTab === "equalizer"
              ? "bg-[#1DB954] text-black shadow-lg shadow-[#1DB954]/25"
              : "bg-white/5 text-zinc-400 hover:text-white"
          }`}
        >
          Pro Equalizer
        </button>
        <button
          id="tab-spotify-sync-mobile-btn"
          onClick={() => setActiveTab("spotify-sync")}
          className={`px-4 py-2 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeTab === "spotify-sync"
              ? "bg-[#1DB954] text-black shadow-lg shadow-[#1DB954]/25"
              : "bg-white/5 text-zinc-400 hover:text-white"
          }`}
        >
          Spotify Sync
        </button>
      </div>

      {/* Main Grid Wrapper with responsive sidebar */}
      <div className="flex-1 max-w-7xl mx-auto w-full grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6 p-4 md:p-6">
        
        {/* Navigation Sidebar Panel - Desktop Only */}
        <aside id="nav-navigation-sidebar" className="hidden md:flex md:col-span-3 space-y-6 flex-col justify-start">
          <div className="bg-black/25 border border-white/5 rounded-2xl p-4 flex flex-col space-y-1.5 select-none text-sm shadow-xl backdrop-blur-md">
            <span className="text-[10px] text-zinc-500 font-mono font-bold tracking-widest pl-3 pb-2 uppercase">MAIN HUD</span>
            
            <button
              id="tab-discover-btn"
              onClick={() => setActiveTab("discover")}
              className={`flex items-center space-x-3.5 p-3 rounded-xl transition-all cursor-pointer ${
                activeTab === "discover"
                  ? "bg-gradient-to-r from-white/10 to-white/5 border border-white/10 text-[#1DB954]"
                  : "text-zinc-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Sparkles className="w-4.5 h-4.5 shrink-0" />
              <span className="font-semibold tracking-wide">Search & Discover</span>
            </button>

            <button
              id="tab-library-btn"
              onClick={() => setActiveTab("library")}
              className={`flex items-center space-x-3.5 p-3 rounded-xl transition-all cursor-pointer ${
                activeTab === "library"
                  ? "bg-gradient-to-r from-white/10 to-white/5 border border-white/10 text-[#1DB954]"
                  : "text-zinc-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Library className="w-4.5 h-4.5 shrink-0" />
              <span className="font-semibold tracking-wide">Playlists & Library</span>
            </button>

            <button
              id="tab-scanner-btn"
              onClick={() => setActiveTab("scanner")}
              className={`flex items-center space-x-3.5 p-3 rounded-xl transition-all cursor-pointer ${
                activeTab === "scanner"
                  ? "bg-gradient-to-r from-white/10 to-white/5 border border-white/10 text-[#1DB954]"
                  : "text-zinc-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <FolderUp className="w-4.5 h-4.5 shrink-0" />
              <span className="font-semibold tracking-wide">Offline Scanner</span>
            </button>

            <button
              id="tab-equalizer-btn"
              onClick={() => setActiveTab("equalizer")}
              className={`flex items-center space-x-3.5 p-3 rounded-xl transition-all cursor-pointer ${
                activeTab === "equalizer"
                  ? "bg-gradient-to-r from-white/10 to-white/5 border border-white/10 text-[#1DB954]"
                  : "text-zinc-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Sliders className="w-4.5 h-4.5 shrink-0" />
              <span className="font-semibold tracking-wide">Pro Equalizer</span>
            </button>

            <button
              id="tab-spotify-sync-btn"
              onClick={() => setActiveTab("spotify-sync")}
              className={`flex items-center space-x-3.5 p-3 rounded-xl transition-all cursor-pointer ${
                activeTab === "spotify-sync"
                  ? "bg-gradient-to-r from-white/10 to-white/5 border border-white/10 text-[#1DB954]"
                  : "text-zinc-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <FolderDown className="w-4.5 h-4.5 shrink-0" />
              <span className="font-semibold tracking-wide">Offline Downloader</span>
            </button>
          </div>

          {/* Interactive Dynamic Spectrum Visualizer container */}
          <Visualizer />
        </aside>

        {/* View Frame Panel content */}
        <main id="active-panel-frame" className="md:col-span-9 h-full">
          {renderActiveTabContents()}
        </main>

      </div>

      {/* Global Interactive Bottom Mini Player */}
      <footer id="bottom-mini-player" className="sticky bottom-0 z-40 bg-[#121212]/95 backdrop-blur-xl border-t border-white/5 py-3.5 px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          
          {/* Left: Active Track Plate metadata */}
          <div 
            onClick={() => currentTrack && setIsFullscreen(true)}
            className="flex items-center space-x-3.5 truncate w-[180px] sm:w-[240px] cursor-pointer group"
          >
            <div className="w-11 h-11 rounded-lg overflow-hidden shrink-0 bg-zinc-800 shadow-md relative">
              {currentTrack ? (
                <img
                  src={currentTrack.artworkUrl || "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=100&q=80"}
                  alt={currentTrack.name}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-300"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-500">
                  <Music className="w-4.5 h-4.5" />
                </div>
              )}
            </div>
            
            <div className="truncate">
              {currentTrack ? (
                <>
                  <p className="text-white text-xs font-bold truncate group-hover:text-[#1DB954] flex items-center space-x-1.5">
                    <span>{currentTrack.name}</span>
                    {isPlaying && (
                      <span className="flex space-x-[2px] items-end h-2.5 w-2 shrink-0">
                        <span className="bg-[#1DB954] w-[1px] h-full animate-[bounce_1s_infinite_100ms]" />
                        <span className="bg-[#1DB954] w-[1px] h-[60%] animate-[bounce_0.8s_infinite]" />
                        <span className="bg-[#1DB954] w-[1px] h-[80%] animate-[bounce_1.2s_infinite_200ms]" />
                      </span>
                    )}
                  </p>
                  <p className="text-zinc-400 text-[10px] mt-0.5 truncate">{currentTrack.artist}</p>
                </>
              ) : (
                <>
                  <p className="text-zinc-400 text-xs font-bold italic select-none">No Track Loaded</p>
                  <p className="text-zinc-600 text-[9px] select-none">Select audio source to stream</p>
                </>
              )}
            </div>
          </div>

          {/* Center Playback control mechanism */}
          <div className="flex flex-col items-center space-y-2 flex-1 max-w-[400px] px-4 self-center">
            <div className="flex items-center space-x-4">
              <button
                id="mini-prev-btn"
                onClick={prevTrack}
                disabled={!currentTrack}
                className="p-1 rounded-full text-zinc-400 hover:text-white transition-colors disabled:text-zinc-700 cursor-pointer"
              >
                <SkipBack className="w-4.5 h-4.5" />
              </button>

              <button
                id="mini-play-btn"
                onClick={togglePlay}
                disabled={!currentTrack}
                className="p-2 bg-white text-black hover:bg-zinc-200 rounded-full shadow transition-all hover:scale-105 active:scale-95 disabled:bg-zinc-700 disabled:text-zinc-500 cursor-pointer"
              >
                {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
              </button>

              <button
                id="mini-next-btn"
                onClick={nextTrack}
                disabled={!currentTrack}
                className="p-1 rounded-full text-zinc-400 hover:text-white transition-colors disabled:text-zinc-700 cursor-pointer"
              >
                <SkipForward className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Micro progress Seek line */}
            <div className="hidden sm:flex items-center space-x-2.5 w-full text-[9px] font-mono select-none">
              <span className="text-zinc-500">{formatTime(currentTime)}</span>
              <div 
                className="relative flex-1 bg-zinc-800 h-1 rounded-full overflow-hidden cursor-pointer"
                onClick={(e) => {
                  if (!currentTrack) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const fraction = (e.clientX - rect.left) / rect.width;
                  seek(fraction * (duration || 1));
                }}
              >
                <div 
                  className="bg-gradient-to-r from-[#1DB954] to-[#a6ff1a] h-full rounded-full transition-all duration-75"
                  style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                />
              </div>
              <span className="text-zinc-500">{formatTime(duration)}</span>
            </div>
          </div>

          {/* Right Volume / Maximize Options */}
          <div className="flex items-center space-x-3 justify-end w-[100px] sm:w-[180px]">
            <button
              id="mini-maximize-trigger"
              onClick={() => currentTrack && setIsFullscreen(true)}
              disabled={!currentTrack}
              className="p-2 rounded-full text-zinc-400 hover:text-white bg-white/5 border border-transparent hover:border-white/10 hover:bg-white/10 transition-all disabled:opacity-30 cursor-pointer"
              title="Expand Immersive Frame"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>

        </div>
      </footer>

      {/* Select Playlist modal picker */}
      {selectPlaylistModalOpen && (
        <div id="playlist-picker-modal" className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-6 select-none animate-fadeIn">
          <div className="bg-[#121212] border border-white/10 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl relative">
            <button
              id="close-playlist-picker"
              onClick={() => {
                setSelectPlaylistModalOpen(false);
                setTrackToAdd(null);
              }}
              className="absolute top-4 right-4 p-1 rounded-full text-zinc-400 hover:text-white hover:bg-white/5 cursor-pointer"
            >
              <X className="w-4.5 h-4.5" />
            </button>

            <div>
              <h4 className="text-white font-black tracking-tight text-sm uppercase">Add track to playlist</h4>
              <p className="text-zinc-400 text-[10px] mt-1 font-mono">Select a destination custom playlist</p>
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto scrollbar-thin">
              {playlists.filter(p => !p.isSpotify).map(p => (
                <button
                  key={p.id}
                  id={`modal-select-pl-btn-${p.id}`}
                  onClick={() => handleAddTrackToPlaylistConfirm(p.id)}
                  className="w-full text-left p-2.5 rounded-xl hover:bg-[#1DB954]/10 hover:text-[#1DB954] text-xs font-semibold text-white/80 transition-all border border-transparent hover:border-[#1DB954]/30"
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Spotify Connection Celebratory Pop up and Playlist importer */}
      <SpotifyImportPopup
        isOpen={showSpotifyImportPopup}
        onClose={() => setShowSpotifyImportPopup(false)}
        playlists={spotifyPlaylists}
        savedPlaylists={playlists}
        onImport={handleImportSpotifyPlaylist}
        syncingPlaylistId={syncingPlaylistId}
        spotifyPlaylistsError={spotifyPlaylistsError}
        playlistUrlInput={playlistUrlInput}
        setPlaylistUrlInput={setPlaylistUrlInput}
        isImportingUrl={isImportingUrl}
        importStatusMsg={importStatusMsg}
        onImportPlaylistByUrl={handleImportPlaylistByUrl}
      />

    </div>
  );
}

export default function App() {
  return (
    <AudioPlayerProvider>
      <MainAppLayout />
    </AudioPlayerProvider>
  );
}
