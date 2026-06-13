import React from "react";
import { Sparkles, Music, Check, X, RefreshCw, AlertTriangle, Link as LinkIcon } from "lucide-react";
import { Playlist } from "../types";

interface SpotifyImportPopupProps {
  isOpen: boolean;
  onClose: () => void;
  playlists: Playlist[];
  savedPlaylists: Playlist[];
  onImport: (playlist: Playlist) => void;
  syncingPlaylistId: string | null;
  spotifyPlaylistsError?: string | null;
  onImportPlaylistByUrl?: (url: string) => Promise<void>;
  isImportingUrl?: boolean;
  importStatusMsg?: string;
  playlistUrlInput?: string;
  setPlaylistUrlInput?: (val: string) => void;
}

export const SpotifyImportPopup: React.FC<SpotifyImportPopupProps> = ({
  isOpen,
  onClose,
  playlists,
  savedPlaylists,
  onImport,
  syncingPlaylistId,
  spotifyPlaylistsError,
  onImportPlaylistByUrl,
  isImportingUrl,
  importStatusMsg,
  playlistUrlInput,
  setPlaylistUrlInput,
}) => {
  if (!isOpen) return null;

  return (
    <div
      id="spotify-import-popup-mask"
      className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fadeIn"
    >
      <div
        id="spotify-import-popup-container"
        className="bg-[#181818] border border-[#1DB954]/30 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative flex flex-col max-h-[85vh] text-white"
      >
        {/* Close Button */}
        <button
          id="close-import-popup"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-white/5 cursor-pointer transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Celebrating Header */}
        <div className="flex flex-col items-center text-center space-y-2 pb-4 border-b border-white/5">
          <div className="w-12 h-12 rounded-full bg-[#1DB954]/20 border border-[#1DB954] flex items-center justify-center text-[#1DB954] mb-1">
            <Sparkles className="w-6 h-6 animate-pulse" />
          </div>
          <h2 className="text-lg font-black tracking-tight text-white uppercase sm:text-xl">
            Spotify Account Connected!
          </h2>
          <p className="text-zinc-400 text-xs max-w-md">
            Import your playlists to download tracks natively inside your device database.
          </p>
        </div>

        {/* Playlist Grid */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 scrollbar-thin">
          {/* Error Alert Info Block */}
          {spotifyPlaylistsError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-[11px] text-red-400 font-mono space-y-1">
              <div className="flex items-center space-x-1.5 font-bold">
                <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                <span>PLAYLIST POLLING RESTRICTIONS</span>
              </div>
              <p>{spotifyPlaylistsError}</p>
            </div>
          )}

          {/* Quick Manual URL Import fallback form */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center space-x-1.5">
              <LinkIcon className="w-3.5 h-3.5 text-[#1DB954]" />
              <p className="text-[10px] text-[#1DB954] font-mono uppercase tracking-wider font-bold">Paste Spotify Playlist Link</p>
            </div>
            <p className="text-[10px] text-zinc-400">
              Not seeing your playlist above? Paste any public Spotify Playlist URL to load and import it:
            </p>
            <div className="flex space-x-2">
              <input
                type="text"
                placeholder="e.g. https://open.spotify.com/playlist/37i9dQZF1DXcBWIGsy3gvl"
                value={playlistUrlInput || ""}
                onChange={(e) => setPlaylistUrlInput?.(e.target.value)}
                className="flex-1 bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-[#1DB954]"
              />
              <button
                id="popup-url-import-submit-btn"
                disabled={isImportingUrl || !playlistUrlInput?.trim()}
                onClick={() => onImportPlaylistByUrl?.(playlistUrlInput || "")}
                className="bg-[#1DB954] text-black font-bold text-xs py-1.5 px-3.5 rounded-lg hover:bg-[#1ed760] disabled:opacity-40 transition-all cursor-pointer whitespace-nowrap"
              >
                {isImportingUrl ? "Syncing..." : "Import"}
              </button>
            </div>
            {importStatusMsg && (
              <p className="text-[9px] text-amber-400 font-mono italic animate-pulse">{importStatusMsg}</p>
            )}
          </div>

          <div>
            <p className="text-[10px] text-[#1DB954] font-mono uppercase tracking-wider pl-1 mb-2">
              SELECT PLAYLISTS FROM ACCOUNT ({playlists.length})
            </p>

            {playlists.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 border border-dashed border-white/5 rounded-xl text-zinc-500">
                <Music className="w-8 h-8 mb-2 stroke-[1.5]" />
                <p className="text-xs">No matching auto-fetched playlists found.</p>
                <p className="text-[10px] text-zinc-600 mt-0.5">Paste a link above to import any playlist directly.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1">
                {playlists.map((pl) => {
                  const isAlreadySaved = savedPlaylists.some(
                    (saved) => saved.spotifyId === pl.id || saved.id === pl.id
                  );
                  const isSyncing = syncingPlaylistId === pl.id;

                  return (
                    <div
                      key={pl.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900 border border-white/5 hover:border-zinc-700 transition-all duration-200"
                    >
                      <div className="flex items-center space-x-3.5 truncate">
                        <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 bg-zinc-800">
                          <img
                            src={pl.artworkUrl || "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100&q=80"}
                            alt={pl.name}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="truncate">
                          <p className="text-xs font-bold truncate text-white">
                            {pl.name}
                          </p>
                          <p className="text-[9px] text-zinc-400 truncate">
                            {pl.description || "Spotify Playlist Source"}
                          </p>
                        </div>
                      </div>

                      <button
                        id={`import-popup-btn-${pl.id}`}
                        disabled={isAlreadySaved || isSyncing}
                        onClick={() => onImport(pl)}
                        className={`text-[9px] font-bold py-1.5 px-3.5 rounded-full flex items-center space-x-1 uppercase tracking-wider transition-all cursor-pointer ${
                          isAlreadySaved
                            ? "bg-zinc-800 text-zinc-500 border border-transparent"
                            : isSyncing
                            ? "bg-zinc-800 text-[#1DB954] border border-transparent animate-pulse"
                            : "bg-[#1DB954] hover:bg-[#1ed760] text-black active:scale-95"
                        }`}
                      >
                        {isAlreadySaved ? (
                          <>
                            <Check className="w-3.5 h-3.5 mr-0.5" />
                            <span>Imported</span>
                          </>
                        ) : isSyncing ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin mr-0.5" />
                            <span>Syncing</span>
                          </>
                        ) : (
                          <span>Import</span>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-white/5 flex items-center justify-end">
          <button
            id="close-import-popup-confirm"
            onClick={onClose}
            className="bg-white/10 hover:bg-white/15 text-white text-xs font-bold py-2 px-6 rounded-full uppercase tracking-wider transition-all cursor-pointer"
          >
            Go to Player
          </button>
        </div>
      </div>
    </div>
  );
};
