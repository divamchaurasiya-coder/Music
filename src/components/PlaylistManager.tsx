import React, { useState, useRef } from "react";
import { ListMusic, Plus, Play, Trash2, Library, Check, RefreshCw, Search, Upload } from "lucide-react";
import { Playlist, Track } from "../types";
import { savePlaylist, deletePlaylist, saveLocalTrack } from "../utils/db";

interface PlaylistManagerProps {
  playlists: Playlist[];
  onPlaylistsUpdated: () => void;
  onSelectPlaylist: (playlist: Playlist) => void;
  selectedPlaylist: Playlist | null;
  onPlayTrack: (track: Track, newQueue?: Track[]) => void;
  isSpotifyConnected: boolean; // to offer syncing logic
  onTriggerSpotifySync?: (playlist: Playlist) => void;
  syncingPlaylistId?: string | null;
  localTracks?: Track[];
  spotifyToken?: string | null;
}

export const PlaylistManager: React.FC<PlaylistManagerProps> = ({
  playlists,
  onPlaylistsUpdated,
  onSelectPlaylist,
  selectedPlaylist,
  onPlayTrack,
  isSpotifyConnected,
  onTriggerSpotifySync,
  syncingPlaylistId,
  localTracks = [],
  spotifyToken = null,
}) => {
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [newPlaylistDesc, setNewPlaylistDesc] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // States for adding tracks
  const [isAddPanelOpen, setIsAddPanelOpen] = useState(false);
  const [addTab, setAddTab] = useState<"device" | "spotify">("device");
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [spotifySearchQuery, setSpotifySearchQuery] = useState("");
  const [spotifyResults, setSpotifyResults] = useState<Track[]>([]);
  const [isSearchingSpotify, setIsSearchingSpotify] = useState(false);

  // Manual fallback inputs
  const [manualTitle, setManualTitle] = useState("");
  const [manualArtist, setManualArtist] = useState("");
  const [manualUrl, setManualUrl] = useState("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const getAbsoluteApiUrl = (apiPath: string) => {
    if (typeof window !== "undefined") {
      return `${window.location.origin}${apiPath}`;
    }
    return apiPath;
  };

  const handleCreatePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;

    const newPlaylist: Playlist = {
      id: `pl_${Date.now()}`,
      name: newPlaylistName.trim(),
      description: newPlaylistDesc.trim() || undefined,
      artworkUrl: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&q=80", // standard dj/audio artwork
      tracks: [],
      createdAt: Date.now()
    };

    await savePlaylist(newPlaylist);
    setNewPlaylistName("");
    setNewPlaylistDesc("");
    setIsCreating(false);
    onPlaylistsUpdated();
  };

  const parseFileInfo = (filename: string): { name: string; artist: string } => {
    const cleanName = filename.replace(/\.[^/.]+$/, "");
    if (cleanName.includes(" - ")) {
      const parts = cleanName.split(" - ");
      const artist = parts[0].trim();
      const name = parts.slice(1).join(" - ").trim();
      return { name, artist };
    }
    return { name: cleanName, artist: "Local Artist" };
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !selectedPlaylist) return;
    setIsUploadingFile(true);
    const file = e.target.files[0];
    const { name, artist } = parseFileInfo(file.name);
    const trackId = `local_tr_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

    const newTrack: Track = {
      id: trackId,
      name,
      artist,
      album: "Local Storage",
      duration: 180,
      source: "local",
      artworkUrl: "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=300&q=80",
    };

    try {
      const getDuration = (): Promise<number> => {
        return new Promise((resolve) => {
          const tempAudio = new Audio();
          const objectUrl = URL.createObjectURL(file);
          tempAudio.src = objectUrl;
          tempAudio.addEventListener("loadedmetadata", () => {
            resolve(Math.round(tempAudio.duration) || 180);
            URL.revokeObjectURL(objectUrl);
          });
          tempAudio.addEventListener("error", () => {
            resolve(180);
            URL.revokeObjectURL(objectUrl);
          });
        });
      };

      const parsedDuration = await getDuration();
      newTrack.duration = parsedDuration;

      await saveLocalTrack(newTrack, file);

      const updatedPlaylist = {
        ...selectedPlaylist,
        tracks: [...selectedPlaylist.tracks, newTrack]
      };
      await savePlaylist(updatedPlaylist);
      onPlaylistsUpdated();
    } catch (err) {
      console.error("Failed to upload song to playlist:", err);
      alert("Failed to read audio metadata. Track could not be saved.");
    } finally {
      setIsUploadingFile(false);
    }
  };

  const handleAddExistingLocal = async (track: Track) => {
    if (!selectedPlaylist) return;
    if (selectedPlaylist.tracks.some(t => t.id === track.id)) {
      alert("Track already exists in this playlist.");
      return;
    }
    const updatedPlaylist = {
      ...selectedPlaylist,
      tracks: [...selectedPlaylist.tracks, track]
    };
    await savePlaylist(updatedPlaylist);
    onPlaylistsUpdated();
  };

  const handleAddSpotifyTrack = async (track: Track) => {
    if (!selectedPlaylist) return;
    if (selectedPlaylist.tracks.some(t => t.id === track.id)) {
      alert("Track already exists in this playlist.");
      return;
    }
    const updatedPlaylist = {
      ...selectedPlaylist,
      tracks: [...selectedPlaylist.tracks, track]
    };
    await savePlaylist(updatedPlaylist);
    onPlaylistsUpdated();
  };

  const handleAddManualTrack = async () => {
    if (!selectedPlaylist || !manualTitle.trim()) return;
    const trackId = `synth_tr_${Date.now()}`;
    const newTrack: Track = {
      id: trackId,
      name: manualTitle.trim(),
      artist: manualArtist.trim() || "Unknown Artist",
      album: "Local Manual Collection",
      duration: 180,
      source: "synth",
      artworkUrl: "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=100&q=80",
      previewUrl: manualUrl.trim() || `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-12.mp3`
    };

    const updatedPlaylist = {
      ...selectedPlaylist,
      tracks: [...selectedPlaylist.tracks, newTrack]
    };
    await savePlaylist(updatedPlaylist);
    setManualTitle("");
    setManualArtist("");
    setManualUrl("");
    onPlaylistsUpdated();
  };

  const handleSpotifySearch = async (query: string) => {
    setSpotifySearchQuery(query);
    if (!query.trim()) {
      setSpotifyResults([]);
      return;
    }

    if (!spotifyToken) {
      const mocks: Track[] = [
        {
          id: `sp_mock_1_${Date.now()}`,
          name: query.trim() + " (Retro Edit)",
          artist: "Neon Syndicate",
          album: "Midnight Drive",
          duration: 195,
          source: "spotify",
          previewUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
          artworkUrl: "https://images.unsplash.com/photo-1515462277126-270d878326e5?w=150&q=80"
        },
        {
          id: `sp_mock_2_${Date.now()}`,
          name: "Chilled Vibes: " + query.trim(),
          artist: "Lofi Cafe Horizon",
          album: "Study Buddy",
          duration: 215,
          source: "spotify",
          previewUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
          artworkUrl: "https://images.unsplash.com/photo-1541167760496-1628856ab772?w=150&q=80"
        }
      ];
      setSpotifyResults(mocks);
      return;
    }

    setIsSearchingSpotify(true);
    try {
      const response = await fetch(getAbsoluteApiUrl("/api/spotify/proxy"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: `search?q=${encodeURIComponent(query)}&type=track&limit=5`,
          token: spotifyToken
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}`);
      }

      const data = await response.json();
      if (data && data.tracks && data.tracks.items) {
        const parsed: Track[] = data.tracks.items.map((t: any) => ({
          id: t.id || `sp_tr_${Date.now()}`,
          name: t.name,
          artist: t.artists?.[0]?.name || "Unknown Artist",
          album: t.album?.name || "Single",
          duration: Math.round(t.duration_ms / 1000) || 180,
          artworkUrl: t.album?.images?.[0]?.url || "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=100&q=80",
          source: "spotify" as const,
          previewUrl: t.preview_url || `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${Math.floor(Math.random() * 12) + 1}.mp3`
        }));
        setSpotifyResults(parsed);
      }
    } catch (err) {
      console.warn("Spotify search query failed:", err);
    } finally {
      setIsSearchingSpotify(false);
    }
  };

  const handleDeletePlaylist = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this custom playlist?")) {
      await deletePlaylist(id);
      if (selectedPlaylist?.id === id) {
        onSelectPlaylist(playlists.find(p => p.id !== id) || null as any);
      }
      onPlaylistsUpdated();
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full">
      {/* Playlists Left List Panel */}
      <div className="md:col-span-1 bg-black/20 border border-white/5 rounded-2xl p-4 flex flex-col h-[250px] md:h-[400px]">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-white text-xs font-semibold tracking-wider uppercase flex items-center space-x-2">
            <Library className="w-4 h-4 text-[#1DB954]" />
            <span>My Library ({playlists.length})</span>
          </h4>
          <button
            id="open-create-playlist"
            onClick={() => setIsCreating(!isCreating)}
            className="p-1 rounded-full hover:bg-white/10 text-[#1DB954] transition-all cursor-pointer"
            title="Create Custom Playlist"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {isCreating && (
          <form id="create-playlist-form" onSubmit={handleCreatePlaylist} className="mb-4 bg-white/5 p-3 rounded-xl border border-white/10 space-y-2.5">
            <input
              type="text"
              id="new-playlist-name"
              placeholder="Playlist name..."
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              className="w-full text-xs p-2 rounded bg-black/50 border border-white/10 text-white placeholder-zinc-500 focus:outline-none focus:border-[#1DB954]"
              required
            />
            <input
              type="text"
              id="new-playlist-desc"
              placeholder="Description (optional)"
              value={newPlaylistDesc}
              onChange={(e) => setNewPlaylistDesc(e.target.value)}
              className="w-full text-xs p-2 rounded bg-black/50 border border-white/10 text-white placeholder-zinc-500 focus:outline-none focus:border-[#1DB954]"
            />
            <div className="flex items-center justify-end space-x-2 text-[10px]">
              <button
                type="button"
                id="cancel-create-playlist"
                onClick={() => setIsCreating(false)}
                className="text-zinc-400 hover:text-white py-1 px-2.5 font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                id="submit-create-playlist"
                className="bg-[#1DB954] text-black py-1 px-3.5 rounded-full font-bold shadow-md hover:scale-105 active:scale-95 transition-all"
              >
                Create
              </button>
            </div>
          </form>
        )}

        <div className="flex-1 overflow-y-auto space-y-1.5 custom-scrollbar pr-1">
          {playlists.map((pl) => {
            const isSelected = selectedPlaylist?.id === pl.id;
            return (
              <div
                key={pl.id}
                id={`playlist-item-${pl.id}`}
                onClick={() => onSelectPlaylist(pl)}
                className={`flex items-center justify-between p-2 rounded-xl cursor-pointer group transition-all duration-300 ease-out transform hover:scale-[1.02] hover:shadow-md hover:shadow-black/20 ${
                  isSelected
                    ? "bg-[#1DB954]/15 border border-[#1DB954]/30"
                    : "hover:bg-white/5 border border-transparent"
                }`}
              >
                <div className="flex items-center space-x-3 truncate">
                  <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-zinc-800">
                    <img
                      src={pl.artworkUrl || "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=100&q=80"}
                      alt={pl.name}
                      className="w-full h-full object-cover transition-transform duration-550 ease-out group-hover:scale-110"
                    />
                  </div>
                  <div className="truncate">
                    <p className={`text-xs font-semibold truncate ${isSelected ? "text-[#1DB954]" : "text-white"}`}>
                      {pl.name}
                    </p>
                    <p className="text-[10px] text-zinc-400 truncate">
                      {pl.isSpotify ? "Spotify Sync" : `${pl.tracks.length} tracks`}
                    </p>
                  </div>
                </div>

                {!pl.isSpotify && (
                  <button
                    id={`delete-playlist-${pl.id}`}
                    onClick={(e) => handleDeletePlaylist(pl.id, e)}
                    className="p-1 rounded text-zinc-500 hover:text-red-400 hover:bg-white/5 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Playlist Tracks Right Panel */}
      <div className="md:col-span-2 bg-black/20 border border-white/5 rounded-2xl p-5 flex flex-col min-h-[420px] md:min-h-[520px] md:h-auto">
        {selectedPlaylist ? (
          <>
            {/* Header */}
            <div className="flex items-start justify-between border-b border-white/10 pb-4 mb-4 select-none">
              <div className="flex space-x-4">
                <div className="w-16 h-16 rounded-xl overflow-hidden shadow-2xl shrink-0">
                  <img
                    src={selectedPlaylist.artworkUrl || "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=150&q=80"}
                    alt={selectedPlaylist.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <h3 className="text-white text-base font-bold">{selectedPlaylist.name}</h3>
                  <p className="text-zinc-400 text-xs mt-1">
                    {selectedPlaylist.description || "Collection of premium tracks"}
                  </p>
                  <p className="text-[#1DB954] text-[10px] font-mono mt-2 uppercase tracking-wide">
                    {selectedPlaylist.isSpotify ? "SPOTIFY API SOURCE" : "LOCAL CUSTOM LIST"}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {/* Add Song Button */}
                {!selectedPlaylist.isSpotify && (
                  <button
                    id="toggle-add-song-panel-btn"
                    onClick={() => setIsAddPanelOpen(!isAddPanelOpen)}
                    className={`flex items-center space-x-1 py-1.5 px-3 rounded-full text-[10px] font-bold tracking-wider transition-all cursor-pointer ${
                      isAddPanelOpen
                        ? "bg-zinc-800 text-white"
                        : "bg-[#1DB954] hover:bg-[#1ed760] text-black active:scale-[0.98]"
                    }`}
                  >
                    <Plus className={`w-3.5 h-3.5 transition-transform ${isAddPanelOpen ? "rotate-45" : ""}`} />
                    <span>{isAddPanelOpen ? "CANCEL" : "ADD SONG"}</span>
                  </button>
                )}

                {/* Sync Button if Spotify integration is possible */}
                {selectedPlaylist.isSpotify && onTriggerSpotifySync && (
                  <button
                    id={`sync-playlist-btn-${selectedPlaylist.id}`}
                    onClick={() => onTriggerSpotifySync(selectedPlaylist)}
                    disabled={syncingPlaylistId === selectedPlaylist.id}
                    className={`flex items-center space-x-1 py-1.5 px-3 rounded-full text-[10px] font-bold tracking-wider transition-all cursor-pointer ${
                      syncingPlaylistId === selectedPlaylist.id
                        ? "bg-zinc-800 text-zinc-500 animate-pulse"
                        : isSpotifyConnected
                        ? "bg-[#1DB954] hover:bg-[#1ed760] text-black active:scale-95"
                        : "bg-white/5 hover:bg-white/10 text-zinc-400"
                    }`}
                    title={isSpotifyConnected ? "Re-sync Playlist" : "Authorize Spotify first to sync"}
                  >
                    <RefreshCw className={`w-3 h-3 ${syncingPlaylistId === selectedPlaylist.id ? "animate-spin" : ""}`} />
                    <span>{syncingPlaylistId === selectedPlaylist.id ? "SYNCING..." : "SYNC NOW"}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Collapsible Add Panel */}
            {isAddPanelOpen && !selectedPlaylist.isSpotify && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-4 space-y-4 animate-fade-in">
                {/* Tab selector */}
                <div className="flex border-b border-white/15">
                  <button
                    type="button"
                    onClick={() => setAddTab("device")}
                    className={`flex-1 pb-2 text-center text-xs font-bold border-b-2 tracking-wide uppercase transition-all ${
                      addTab === "device"
                        ? "border-[#1DB954] text-[#1DB954]"
                        : "border-transparent text-zinc-400 hover:text-white"
                    }`}
                  >
                    From Device Memory
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddTab("spotify")}
                    className={`flex-1 pb-2 text-center text-xs font-bold border-b-2 tracking-wide uppercase transition-all ${
                      addTab === "spotify"
                        ? "border-[#1DB954] text-[#1DB954]"
                        : "border-transparent text-zinc-400 hover:text-white"
                    }`}
                  >
                    From Spotify
                  </button>
                </div>

                {/* Tab A Content: Device Memory */}
                {addTab === "device" && (
                  <div className="space-y-4">
                    {/* Option 1: Direct File upload picker */}
                    <div className="space-y-2">
                      <p className="text-[10px] text-zinc-400 font-mono uppercase tracking-wider">
                        Upload New Audio File directly
                      </p>
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="border border-dashed border-white/15 rounded-xl p-3 bg-zinc-950/20 text-center hover:bg-zinc-950/40 hover:border-[#1DB954]/50 cursor-pointer transition-all duration-200 flex flex-col items-center justify-center space-y-1"
                      >
                        <input
                          type="file"
                          id="playlist-file-uploader"
                          ref={fileInputRef}
                          onChange={handleFileChange}
                          accept="audio/*"
                          className="hidden"
                          disabled={isUploadingFile}
                        />
                        {isUploadingFile ? (
                          <>
                            <RefreshCw className="w-5 h-5 text-[#1DB954] animate-spin mb-1" />
                            <p className="text-[11px] font-bold text-white">Importing metadata...</p>
                          </>
                        ) : (
                          <>
                            <Upload className="w-5 h-5 text-[#1DB954] mb-1" />
                            <p className="text-[11px] font-bold text-white">Click or drag mp3/wav/m4a file</p>
                            <p className="text-[9px] text-zinc-500">Loads to device DB and appends to current playlist</p>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Option 2: Choose from preloaded scanned list */}
                    {localTracks && localTracks.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[10px] text-zinc-400 font-mono uppercase tracking-wider">
                          Or add from local library ({localTracks.filter(t => !selectedPlaylist.tracks.some(p => p.id === t.id)).length})
                        </p>
                        <div className="max-h-24 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                          {localTracks
                            .filter(t => !selectedPlaylist.tracks.some(p => p.id === t.id))
                            .map(t => (
                              <div key={t.id} className="flex items-center justify-between p-1.5 rounded-lg bg-black/40 border border-white/5 text-xs">
                                <div className="truncate pr-2">
                                  <p className="text-white text-[11px] font-semibold truncate">{t.name}</p>
                                  <p className="text-zinc-500 text-[10px] truncate">{t.artist}</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleAddExistingLocal(t)}
                                  className="py-1 px-3 bg-[#1DB954] hover:bg-[#1ed760] text-black font-bold text-[10px] rounded"
                                >
                                  + Add
                                </button>
                              </div>
                            ))}
                          {localTracks.filter(t => !selectedPlaylist.tracks.some(p => p.id === t.id)).length === 0 && (
                            <p className="text-[10px] text-zinc-500 italic">All library tracks are already in this playlist.</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Tab B Content: Spotify */}
                {addTab === "spotify" && (
                  <div className="space-y-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
                      <input
                        type="text"
                        placeholder="Search Spotify tracks..."
                        value={spotifySearchQuery}
                        onChange={(e) => handleSpotifySearch(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#1DB954]"
                      />
                    </div>

                    {/* Spotify Real connection Search results or fallback */}
                    {isSearchingSpotify ? (
                      <div className="flex items-center justify-center py-4 space-x-2">
                        <RefreshCw className="w-4 h-4 text-[#1DB954] animate-spin" />
                        <span className="text-[11px] text-zinc-400 font-mono font-bold">SEARCHING...</span>
                      </div>
                    ) : spotifyResults.length > 0 ? (
                      <div className="space-y-1 max-h-36 overflow-y-auto pr-1 custom-scrollbar">
                        {spotifyResults.map(t => {
                          const isAlreadyIn = selectedPlaylist.tracks.some(track => track.id === t.id);
                          return (
                            <div key={t.id} className="flex items-center justify-between p-1.5 rounded-lg bg-black/40 hover:bg-white/5 border border-white/5 text-xs">
                              <div className="flex items-center space-x-2 truncate pr-2">
                                <div className="w-6 h-6 rounded overflow-hidden shadow bg-zinc-800 shrink-0">
                                  <img src={t.artworkUrl || "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=50&q=80"} alt="" className="w-full h-full object-cover" />
                                </div>
                                <div className="truncate">
                                  <p className="text-white text-[11px] font-semibold truncate">{t.name}</p>
                                  <p className="text-zinc-500 text-[10px] truncate">{t.artist}</p>
                                </div>
                              </div>
                              <button
                                type="button"
                                disabled={isAlreadyIn}
                                onClick={() => handleAddSpotifyTrack(t)}
                                className={`py-1 px-3 text-[10px] font-bold rounded ${
                                  isAlreadyIn 
                                    ? "bg-zinc-800 text-zinc-500 cursor-not-allowed" 
                                    : "bg-[#1DB954] hover:bg-[#1ed760] text-black"
                                }`}
                              >
                                {isAlreadyIn ? "In Playlist" : "+ Add"}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ) : spotifySearchQuery.trim() !== "" ? (
                      <p className="text-[10px] text-amber-400/80 font-mono italic">No instant tracks. Try another query or manually add below:</p>
                    ) : (
                      <p className="text-[10px] text-zinc-500 font-medium font-semibold">
                        {spotifyToken 
                          ? "Enter song metadata to search from official Spotify API servers live."
                          : "Explore and search from connected account streams instantly!"
                        }
                      </p>
                    )}

                    {/* Manual Fallback form if no token or custom name is preferred */}
                    <div className="bg-black/40 border border-white/5 rounded-lg p-2.5 space-y-2 mt-2">
                      <p className="text-[10px] text-[#1DB954] font-mono uppercase tracking-wider font-bold">Manual Details Fallback</p>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="Song Title"
                          value={manualTitle}
                          onChange={(e) => setManualTitle(e.target.value)}
                          className="bg-zinc-900 border border-white/10 rounded px-2 py-1 text-[11px] text-white focus:outline-none focus:border-[#1DB954]"
                        />
                        <input
                          type="text"
                          placeholder="Artist Name"
                          value={manualArtist}
                          onChange={(e) => setManualArtist(e.target.value)}
                          className="bg-zinc-900 border border-white/10 rounded px-2 py-1 text-[11px] text-white focus:outline-none focus:border-[#1DB954]"
                        />
                      </div>

                      <div className="flex space-x-2">
                        <input
                          type="text"
                          placeholder="Custom Audio URL or Source file link (optional)"
                          value={manualUrl}
                          onChange={(e) => setManualUrl(e.target.value)}
                          className="flex-1 bg-zinc-900 border border-white/10 rounded px-2 py-1 text-[11px] text-white focus:outline-none focus:border-[#1DB954]"
                        />
                        <button
                          type="button"
                          id="manual-song-add-btn"
                          disabled={!manualTitle.trim()}
                          onClick={handleAddManualTrack}
                          className="bg-[#1DB954] hover:bg-[#1ed760] disabled:opacity-40 text-black text-[10px] font-bold px-3 py-1 rounded transition-all cursor-pointer"
                        >
                          Add Custom
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Track entries */}
            <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar pr-1 max-h-[350px]">
              {selectedPlaylist.tracks.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6">
                  <ListMusic className="w-10 h-10 text-zinc-600 mb-2" />
                  <p className="text-zinc-400 text-xs font-semibold">This playlist is empty</p>
                  <p className="text-zinc-500 text-[10px] mt-1 max-w-xs">
                    Find and select tracks in search or local libraries, then context-add them here.
                  </p>
                </div>
              ) : (
                selectedPlaylist.tracks.map((track, index) => (
                  <div
                    key={track.id}
                    id={`track-item-${selectedPlaylist.id}-${track.id}`}
                    onClick={() => onPlayTrack(track, selectedPlaylist.tracks)}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 hover:scale-[1.01] hover:shadow-md hover:shadow-black/20 group/track cursor-pointer transition-all duration-300 ease-out transform"
                  >
                    <div className="flex items-center space-x-3 truncate">
                      <span className="text-[10px] font-mono text-zinc-500 w-4 pl-1">
                        {index + 1}
                      </span>
                      <div className="w-8 h-8 rounded overflow-hidden shadow shrink-0 bg-zinc-800">
                        <img
                          src={track.artworkUrl || "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=80&q=80"}
                          alt={track.name}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover/track:scale-110"
                        />
                      </div>
                      <div className="truncate">
                        <p className="text-white text-xs font-bold truncate group-hover/track:text-[#1DB954]">
                          {track.name}
                        </p>
                        <p className="text-zinc-400 text-[10px] truncate">{track.artist}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      <span className="text-[10px] text-zinc-500 font-mono">
                        {Math.floor(track.duration / 60)}:{(track.duration % 60).toString().padStart(2, "0")}
                      </span>
                      <div className="w-5 h-5 flex items-center justify-center rounded-full bg-[#1DB954] text-black scale-0 group-hover/track:scale-100 transition-all shadow-md">
                        <Play className="w-2.5 h-2.5 fill-current" />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 select-none">
            <ListMusic className="w-12 h-12 text-zinc-600 mb-3" />
            <p className="text-zinc-400 text-sm font-semibold">No playlist selected</p>
            <p className="text-zinc-500 text-xs mt-1 max-w-xs">
              Select or create a playlist on the left panel to browse and play stored collection tracks.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
