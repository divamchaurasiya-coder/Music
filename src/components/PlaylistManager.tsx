import React, { useState } from "react";
import { ListMusic, Plus, Play, Trash2, Library, Check, RefreshCw } from "lucide-react";
import { Playlist, Track } from "../types";
import { savePlaylist, deletePlaylist } from "../utils/db";

interface PlaylistManagerProps {
  playlists: Playlist[];
  onPlaylistsUpdated: () => void;
  onSelectPlaylist: (playlist: Playlist) => void;
  selectedPlaylist: Playlist | null;
  onPlayTrack: (track: Track, newQueue?: Track[]) => void;
  isSpotifyConnected: boolean; // to offer syncing logic
  onTriggerSpotifySync?: (playlist: Playlist) => void;
  syncingPlaylistId?: string | null;
}

export const PlaylistManager: React.FC<PlaylistManagerProps> = ({
  playlists,
  onPlaylistsUpdated,
  onSelectPlaylist,
  selectedPlaylist,
  onPlayTrack,
  isSpotifyConnected,
  onTriggerSpotifySync,
  syncingPlaylistId
}) => {
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [newPlaylistDesc, setNewPlaylistDesc] = useState("");
  const [isCreating, setIsCreating] = useState(false);

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
      <div className="md:col-span-2 bg-black/20 border border-white/5 rounded-2xl p-5 flex flex-col min-h-[350px] md:h-[400px]">
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

            {/* Track entries */}
            <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar pr-1">
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
