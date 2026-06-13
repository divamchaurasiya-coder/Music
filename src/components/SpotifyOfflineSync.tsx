import React, { useState, useEffect } from "react";
import { 
  SpotifyUser, Track, Playlist 
} from "../types";
import { 
  FolderDown, Music, Check, RefreshCw, AlertTriangle, Play, HelpCircle, HardDrive, Smartphone, Sparkles, LogIn, Trash2
} from "lucide-react";
import { 
  saveLocalTrack, deleteLocalTrack, getAllLocalTracks, savePlaylist 
} from "../utils/db";

interface SpotifyOfflineSyncProps {
  spotifyUser: SpotifyUser | null;
  spotifyToken: string | null;
  spotifyPlaylists: Playlist[];
  playlists: Playlist[];
  connectSpotify: () => void;
  isConnectingSpotify: boolean;
  onPlayTrack: (track: Track, newQueue?: Track[]) => void;
  onLocalTracksRefreshed: () => void;
  onTriggerSpotifySync: (playlist: Playlist) => Promise<void>;
  syncingPlaylistId: string | null;
}

export const SpotifyOfflineSync: React.FC<SpotifyOfflineSyncProps> = ({
  spotifyUser,
  spotifyToken,
  spotifyPlaylists,
  playlists,
  connectSpotify,
  isConnectingSpotify,
  onPlayTrack,
  onLocalTracksRefreshed,
  onTriggerSpotifySync,
  syncingPlaylistId,
}) => {
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [offlineTrackIds, setOfflineTrackIds] = useState<Set<string>>(new Set());
  const [downloadingTrackIds, setDownloadingTrackIds] = useState<Record<string, "downloading" | "failed" | "done">>({});
  const [downloadProgress, setDownloadProgress] = useState<string>("");
  const [showConfigTips, setShowConfigTips] = useState(false);

  // Load existing offline track IDs
  const loadOfflineTracks = async () => {
    try {
      const tracks = await getAllLocalTracks();
      const ids = new Set(tracks.map(t => t.id));
      setOfflineTrackIds(ids);
    } catch (e) {
      console.error("Failed to load local track list:", e);
    }
  };

  useEffect(() => {
    loadOfflineTracks();
  }, [playlists]);

  // Construct absolute API URL if needed
  const getAbsoluteApiUrl = (apiPath: string) => {
    if (apiPath.startsWith("http://") || apiPath.startsWith("https://")) {
      return apiPath;
    }
    try {
      const parsed = new URL(window.location.href);
      const cleanPath = apiPath.startsWith("/") ? apiPath : `/${apiPath}`;
      return `${parsed.protocol}//${parsed.host}${cleanPath}`;
    } catch (e) {
      return apiPath;
    }
  };

  // Download single track to IndexedDB
  const handleDownloadTrack = async (track: Track) => {
    if (!track.previewUrl) {
      alert("No audio preview stream available from Spotify for this song.");
      return;
    }

    setDownloadingTrackIds(prev => ({ ...prev, [track.id]: "downloading" }));
    setDownloadProgress(`Syncing "${track.name}"...`);

    try {
      const proxyUrl = getAbsoluteApiUrl(`/api/spotify/download-proxy?url=${encodeURIComponent(track.previewUrl)}`);
      const response = await fetch(proxyUrl);
      
      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      const audioBlob = await response.blob();
      if (audioBlob.size < 100) {
        throw new Error("Transferred audio payload is empty or invalid.");
      }

      // Convert track source to local so audio element loads from browser IndexedDB
      const offlineTrack: Track = {
        ...track,
        source: "local",
        localFileBlobId: track.id
      };

      await saveLocalTrack(offlineTrack, audioBlob);
      
      // Also update its playlist array if matched
      if (selectedPlaylist) {
        const updatedTracksInPlaylist = selectedPlaylist.tracks.map(t => 
          t.id === track.id ? { ...t, source: "local" as const, localFileBlobId: track.id } : t
        );
        const updatedPl = { ...selectedPlaylist, tracks: updatedTracksInPlaylist };
        await savePlaylist(updatedPl);
        setSelectedPlaylist(updatedPl);
      }

      setOfflineTrackIds(prev => {
        const next = new Set(prev);
        next.add(track.id);
        return next;
      });
      setDownloadingTrackIds(prev => ({ ...prev, [track.id]: "done" }));
      onLocalTracksRefreshed();
    } catch (err: any) {
      console.error("Offline track transmission failure:", err);
      setDownloadingTrackIds(prev => ({ ...prev, [track.id]: "failed" }));
    } finally {
      // Clear specific log shortly after
      setTimeout(() => setDownloadProgress(""), 2000);
    }
  };

  // Remove track from Offline Local database
  const handleRemoveOfflineTrack = async (track: Track) => {
    if (confirm(`Remove offline cache for "${track.name}"? Track will revert to online-only stream.`)) {
      try {
        await deleteLocalTrack(track.id);
        
        // Re-align track source states
        if (selectedPlaylist) {
          const updatedTracks = selectedPlaylist.tracks.map(t => 
            t.id === track.id ? { ...t, source: "spotify" as const, localFileBlobId: undefined } : t
          );
          const updatedPl = { ...selectedPlaylist, tracks: updatedTracks };
          await savePlaylist(updatedPl);
          setSelectedPlaylist(updatedPl);
        }

        setOfflineTrackIds(prev => {
          const next = new Set(prev);
          next.delete(track.id);
          return next;
        });
        setDownloadingTrackIds(prev => {
          const next = { ...prev };
          delete next[track.id];
          return next;
        });
        onLocalTracksRefreshed();
      } catch (e) {
        console.error("Deletion failure:", e);
      }
    }
  };

  // Download All Tracks sequentially
  const handleDownloadAllTracks = async () => {
    if (!selectedPlaylist || selectedPlaylist.tracks.length === 0) return;
    
    const unDownloaded = selectedPlaylist.tracks.filter(t => !offlineTrackIds.has(t.id) && t.previewUrl);
    if (unDownloaded.length === 0) {
      alert("All available tracks in this playlist are already saved offline!");
      return;
    }

    if (confirm(`Do you wish to download ${unDownloaded.length} tracks offline for this playlist?`)) {
      for (const track of unDownloaded) {
        await handleDownloadTrack(track);
      }
    }
  };

  // Select playlist and automatically sync metadata if empty
  const handleSelectPlaylist = async (pl: Playlist) => {
    setSelectedPlaylist(pl);
    if (pl.tracks.length === 0 && spotifyToken) {
      await onTriggerSpotifySync(pl);
    }
  };

  return (
    <div className="space-y-6">
      {/* Tab Top Hero Area */}
      <div className="bg-gradient-to-r from-black/40 via-zinc-900/40 to-black/30 border border-white/5 rounded-2xl p-5 md:p-6 shadow-xl select-none relative overflow-hidden">
        <div className="absolute right-4 top-4 text-[#1DB954]/10 pointer-events-none">
          <FolderDown className="w-48 h-48" />
        </div>
        <div className="relative z-10 max-w-xl space-y-2">
          <div className="flex items-center space-x-2 bg-[#1DB954]/10 text-[#1DB954] border border-[#1DB954]/25 py-1 px-3 rounded-full text-[10px] font-bold font-mono tracking-wider w-fit uppercase">
            <HardDrive className="w-3.5 h-3.5 shrink-0" />
            <span>Browser Sandbox Sync Hub</span>
          </div>
          <h2 className="text-xl md:text-2xl font-black text-white tracking-tight uppercase">
            Spotify Offline Downloader
          </h2>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Download your beloved Spotify music inside your browser database (<code className="text-[#1DB954] bg-[#1DB954]/5 px-1 py-0.5 rounded font-mono">IndexedDB</code>).
            Once saved, they are 100% playable without any internet connection, anytime you open this player app!
          </p>
        </div>
      </div>

      {/* Spotify Connection States Screen */}
      {!spotifyToken ? (
        <div className="bg-black/20 border border-white/5 rounded-2xl p-6 text-center space-y-5 max-w-2xl mx-auto py-10">
          <div className="w-16 h-16 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-500">
            <Smartphone className="w-8 h-8 animate-pulse" />
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-black text-white uppercase tracking-wider">
              Authorize Spotify to Synch songs
            </h3>
            <p className="text-xs text-zinc-400 max-w-md mx-auto">
              Please authenticate with Spotify first so we can pull your real playlist structures and retrieve audio sync links dynamically.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={connectSpotify}
              disabled={isConnectingSpotify}
              className="flex items-center space-x-2 bg-[#1DB954] hover:bg-[#1ed760] disabled:bg-zinc-800 text-black font-extrabold text-xs py-3 px-6 rounded-full shadow-lg hover:scale-105 active:scale-95 transition-all cursor-pointer uppercase tracking-wider"
            >
              <LogIn className="w-4 h-4 shrink-0" />
              <span>{isConnectingSpotify ? "Spawning Setup..." : "Connect Spotify Account"}</span>
            </button>

            <button
              onClick={() => setShowConfigTips(!showConfigTips)}
              className="flex items-center space-x-2 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold text-xs py-3 px-6 rounded-full transition-all cursor-pointer uppercase tracking-wider"
            >
              <HelpCircle className="w-4 h-4 text-[#1DB954]" />
              <span>Config & Mismatch Tips</span>
            </button>
          </div>

          {/* Config tips explaining how to resolve "redirect_uri" mismatches */}
          {(showConfigTips || !spotifyToken) && (
            <div className="bg-zinc-900/60 border border-[#1DB954]/25 text-left p-5 rounded-2xl mt-4 font-sans space-y-3.5 max-w-xl mx-auto">
              <div className="flex items-center space-x-2.5 text-zinc-200">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                <h4 className="text-xs font-bold uppercase tracking-wider">How to Fix "redirect_uri: Not matching configuration"</h4>
              </div>

              <div className="text-[11px] text-zinc-400 space-y-2.5 leading-normal">
                <p>
                  If you received a <b>redirect_uri mismatch</b> error while trying to connect Spotify, it is because your <b>Spotify Developer App setup</b> has different redirect URLs whitelisted. Here's how to resolve it in under 60 seconds:
                </p>
                
                <ol className="list-decimal pl-5 space-y-2 text-zinc-300">
                  <li>
                    Go to the <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noreferrer" className="text-[#1DB954] hover:underline font-bold">Spotify Developer Dashboard</a> and log in.
                  </li>
                  <li>
                    Select your app card, and click on the <b>Settings</b> button in the top right.
                  </li>
                  <li>
                    Locate the <b>Redirect URIs</b> field.
                  </li>
                  <li>
                    Add this exact redirect address:
                    <div className="bg-black/50 border border-white/5 p-2 rounded text-[#1DB954] font-mono mt-1 select-all break-all text-[10px]">
                      {getAbsoluteApiUrl("/api/spotify/callback")}
                    </div>
                  </li>
                  <li>
                    Also add your production Vercel address if deploying there:
                    <div className="bg-black/50 border border-white/5 p-1.5 rounded text-zinc-400 font-mono mt-1 text-[10px] break-all">
                      https://[your-vercel-deployment-domain-url]/api/spotify/callback
                    </div>
                  </li>
                  <li>
                    Save your changes, wait about 10 seconds, and refresh this page to connect!
                  </li>
                </ol>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Connected Spotify View */
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          
          {/* Playlists Left Side Rack */}
          <div className="md:col-span-4 bg-black/20 border border-white/5 rounded-2xl p-4 flex flex-col h-[280px] md:h-[450px]">
            <div className="flex items-center space-x-2 mb-3 px-1">
              <Sparkles className="w-4 h-4 text-[#1DB954]" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                My Spotify playlists ({spotifyPlaylists.length})
              </h3>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5 custom-scrollbar-light select-none">
              {spotifyPlaylists.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-4">
                  <RefreshCw className="w-6 h-6 text-zinc-600 animate-spin mb-2" />
                  <p className="text-xs text-zinc-500">Retrieving account streams...</p>
                </div>
              ) : (
                spotifyPlaylists.map((pl) => {
                  const isSelected = selectedPlaylist?.id === pl.id;
                  const inLocalLib = playlists.some(p => p.spotifyId === pl.id);

                  return (
                    <div
                      key={pl.id}
                      onClick={() => handleSelectPlaylist(pl)}
                      className={`flex items-center space-x-3 p-2 rounded-xl cursor-pointer group transition-all duration-200 transform hover:scale-[1.01] ${
                        isSelected
                          ? "bg-[#1DB954]/15 border border-[#1DB954]/30"
                          : "hover:bg-white/5 border border-transparent"
                      }`}
                    >
                      <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 bg-zinc-800">
                        <img
                          src={pl.artworkUrl || "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100&q=80"}
                          alt={pl.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="truncate flex-1">
                        <p className={`text-xs font-semibold truncate ${isSelected ? "text-[#1DB954]" : "text-white"}`}>
                          {pl.name}
                        </p>
                        <p className="text-[9px] text-zinc-400 mt-0.5 truncate flex items-center space-x-1">
                          <span>Verified Spotify Library</span>
                          {inLocalLib && <span className="text-[8px] bg-[#1DB954]/10 text-[#1DB954] py-0.2 px-1 rounded font-mono font-bold">Imported</span>}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Playlist detail Offline downloader view */}
          <div className="md:col-span-8 bg-black/20 border border-white/5 rounded-2xl p-5 flex flex-col min-h-[350px] md:h-[450px]">
            {selectedPlaylist ? (
              <>
                {/* Detailed Playlist Header card */}
                <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between border-b border-white/10 pb-4 mb-4 gap-3 select-none">
                  <div className="flex items-center space-x-4">
                    <div className="w-14 h-14 rounded-xl overflow-hidden shadow shrink-0">
                      <img
                        src={selectedPlaylist.artworkUrl || "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100&q=80"}
                        alt={selectedPlaylist.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="text-center sm:text-left">
                      <h3 className="text-white text-sm font-black uppercase tracking-tight">{selectedPlaylist.name}</h3>
                      <p className="text-zinc-400 text-[10px] mt-0.5 truncate max-w-[280px]">
                        {selectedPlaylist.description || "Browse and download tracks with precise client state representation."}
                      </p>
                      <p className="text-zinc-500 text-[9px] font-mono mt-1">
                        Tracks: {selectedPlaylist.tracks.length} | Offline-ready: {selectedPlaylist.tracks.filter(t => offlineTrackIds.has(t.id)).length}
                      </p>
                    </div>
                  </div>

                  {selectedPlaylist.tracks.length > 0 && (
                    <button
                      onClick={handleDownloadAllTracks}
                      className="bg-[#1DB954] text-black text-[10px] font-bold py-2 px-4 rounded-full flex items-center space-x-1.5 shadow-md active:scale-95 transition-all cursor-pointer hover:bg-[#1ed760] font-sans tracking-wide uppercase"
                    >
                      <FolderDown className="w-3.5 h-3.5" />
                      <span>Download All Offline</span>
                    </button>
                  )}
                </div>

                {/* Local Download progress status indicator bar */}
                {downloadProgress && (
                  <div className="bg-[#1DB954]/10 border border-[#1DB954]/30 rounded-xl p-2 mb-3 text-center text-[10px] font-mono text-[#1DB954] flex items-center justify-center space-x-2 animate-pulse">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    <span>{downloadProgress}</span>
                  </div>
                )}

                {/* Syncing loader block */}
                {syncingPlaylistId === selectedPlaylist.id ? (
                  <div className="flex-1 flex flex-col items-center justify-center py-10">
                    <RefreshCw className="w-8 h-8 text-[#1DB954] animate-spin mb-3" />
                    <p className="text-zinc-400 text-xs font-semibold">Pulling full Spotify tracks meta-payload...</p>
                    <p className="text-zinc-600 text-[10px] font-mono">Connecting with API proxy stream</p>
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto space-y-1.5 custom-scrollbar pr-1">
                    {selectedPlaylist.tracks.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-500">
                        <Music className="w-8 h-8 opacity-30 mb-2" />
                        <p className="text-xs">This Spotify playlist details are empty.</p>
                        <button
                          onClick={() => onTriggerSpotifySync(selectedPlaylist)}
                          className="mt-3 text-[#1DB954] font-bold text-[10px] border border-[#1DB954]/30 hover:bg-[#1DB954]/5 py-1.5 px-4 rounded-full uppercase tracking-wider cursor-pointer"
                        >
                          Pull Playlist Tracks
                        </button>
                      </div>
                    ) : (
                      selectedPlaylist.tracks.map((track, idx) => {
                        const isOffline = offlineTrackIds.has(track.id);
                        const downloadState = downloadingTrackIds[track.id];

                        return (
                          <div
                            key={track.id}
                            className={`flex items-center justify-between p-2 rounded-xl group/track transition-all bg-zinc-900/40 border border-white/5 hover:border-zinc-800 ${
                              isOffline ? "border-[#1DB954]/10" : ""
                            }`}
                          >
                            <div className="flex items-center space-x-3 truncate">
                              <span className="text-[9px] font-mono text-zinc-500 w-4 select-none">
                                {(idx + 1).toString().padStart(2, "0")}
                              </span>

                              <div className="w-8 h-8 rounded overflow-hidden shrink-0 bg-zinc-800 shadow relative">
                                <img
                                  src={track.artworkUrl || "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=100&q=80"}
                                  alt={track.name}
                                  className="w-full h-full object-cover"
                                />
                                {isOffline && (
                                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                    <Check className="w-4 h-4 text-[#1DB954]" />
                                  </div>
                                )}
                              </div>

                              <div className="truncate shrink-0 max-w-[140px] sm:max-w-[200px]">
                                <p className="text-xs font-bold truncate text-white leading-tight">
                                  {track.name}
                                </p>
                                <p className="text-[10px] text-zinc-400 truncate leading-none mt-1">
                                  {track.artist}
                                </p>
                              </div>
                            </div>

                            {/* End Controls panel for downloading tracks */}
                            <div className="flex items-center space-x-2 shrink-0">
                              <button
                                onClick={() => onPlayTrack(track, selectedPlaylist.tracks)}
                                className="p-1.5 rounded-full hover:bg-white/5 text-zinc-300 hover:text-[#1DB954] cursor-pointer"
                                title="Preview / Play Stream"
                              >
                                <Play className="w-3.5 h-3.5 fill-current" />
                              </button>

                              {isOffline ? (
                                <button
                                  onClick={() => handleRemoveOfflineTrack(track)}
                                  className="p-1.5 rounded-full hover:bg-red-500/10 text-zinc-500 hover:text-red-400 cursor-pointer transition-colors"
                                  title="Delete Offline Cached local copy"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              ) : downloadState === "downloading" ? (
                                <div className="p-1.5 shrink-0 select-none">
                                  <RefreshCw className="w-3.5 h-3.5 text-[#1DB954] animate-spin" />
                                </div>
                              ) : downloadState === "failed" ? (
                                <button
                                  onClick={() => handleDownloadTrack(track)}
                                  className="p-1.5 rounded-full text-red-400 hover:bg-red-500/10 shrink-0 cursor-pointer"
                                  title="Download failed. Click to Retry."
                                >
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleDownloadTrack(track)}
                                  className="p-1.5 rounded-full bg-zinc-800 text-zinc-300 hover:bg-[#1DB954] hover:text-black transition-all shrink-0 cursor-pointer"
                                  title="Download for offline access"
                                >
                                  <FolderDown className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-500 select-none">
                <Music className="w-10 h-10 mb-2 stroke-[1.5]" />
                <p className="text-xs font-semibold">Select a Spotify playlist from the left list</p>
                <p className="text-[10px] text-zinc-600 mt-1 max-w-xs">
                  See songs list, play drafts online, and convert files into robust offline databases files.
                </p>
              </div>
            )}
          </div>

        </div>
      )}

    </div>
  );
};
