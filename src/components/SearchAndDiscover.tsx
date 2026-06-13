import React, { useState } from "react";
import { Search, Music, Heart, Plus, Library, Sparkles } from "lucide-react";
import { Track } from "../types";
import { useAudioPlayer } from "../context/AudioPlayerContext";

interface SearchAndDiscoverProps {
  localTracks: Track[];
  onPlayTrack: (track: Track, newQueue?: Track[]) => void;
  spotifyTracks: Track[]; // retrieved from connected Spotify API
  onAddTrackToPlaylist: (track: Track) => void;
}

export const SearchAndDiscover: React.FC<SearchAndDiscoverProps> = ({
  localTracks,
  onPlayTrack,
  spotifyTracks,
  onAddTrackToPlaylist
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const { toggleFavorite, favorites } = useAudioPlayer();

  const playlistId = '4CbXJfRFkVum9E7asvARS6';

  // Combine local tracks and Spotify tracks for general search
  const allTracks = [
    ...localTracks,
    ...spotifyTracks
  ];

  // Simple localized matching
  const filteredTracks = searchQuery.trim() === ""
    ? []
    : allTracks.filter(track => 
        track.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        track.artist.toLowerCase().includes(searchQuery.toLowerCase()) ||
        track.album.toLowerCase().includes(searchQuery.toLowerCase())
      );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Search Input and Results Panel */}
      <div id="search-section" className="lg:col-span-7 space-y-5">
        {/* Search bar */}
        <div className="relative w-full">
          <Search className="absolute left-4 top-3.5 w-5 h-5 text-zinc-400 pointer-events-none" />
          <input
            type="text"
            id="global-search-bar"
            placeholder="Search tracks, artists, albums, or local offline library..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/5 hover:bg-white/10 active:bg-black/40 text-sm text-white py-3.5 pl-12 pr-4 rounded-full border border-white/10 focus:border-[#1DB954] focus:outline-none transition-all duration-300"
          />
        </div>

        {/* Results */}
        {searchQuery.trim() !== "" ? (
          <div id="search-results" className="bg-black/20 border border-white/5 rounded-2xl p-5 min-h-[300px]">
            <h4 className="text-white text-xs font-semibold tracking-wider mb-4 uppercase flex items-center space-x-2">
              <Music className="w-4 h-4 text-[#1DB954]" />
              <span>STRIKING MATCHES ({filteredTracks.length})</span>
            </h4>

            {filteredTracks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Music className="w-10 h-10 text-zinc-600 mb-2" />
                <p className="text-zinc-400 text-xs font-semibold">No results found</p>
                <p className="text-zinc-500 text-[10px] mt-1 max-w-xs">
                  Ensure files are fully synced offline or verify your connected Spotify parameters.
                </p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[320px] overflow-y-auto custom-scrollbar pr-1">
                {filteredTracks.map((track) => {
                  const isFav = favorites.includes(track.id);
                  return (
                    <div
                      key={track.id}
                      id={`search-result-item-${track.id}`}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 hover:bg-white/10 hover:scale-[1.01] hover:shadow-md hover:shadow-black/20 group transition-all duration-300 ease-out transform"
                    >
                      <div
                        onClick={() => onPlayTrack(track)}
                        className="flex items-center space-x-3.5 truncate cursor-pointer flex-1"
                      >
                        <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 bg-zinc-800 shadow-md">
                          <img
                            src={track.artworkUrl || "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=100&q=80"}
                            alt={track.name}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                          />
                        </div>
                        <div className="truncate">
                          <p className="text-white text-xs font-bold truncate group-hover:text-[#1DB954]">
                            {track.name}
                          </p>
                          <p className="text-zinc-400 text-[10px] truncate">{track.artist}</p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        {/* Source Tag badge */}
                        <span className={`text-[8px] font-mono font-bold tracking-wider uppercase px-1.5 py-0.5 rounded ${
                          track.source === "local" 
                            ? "bg-[#1DB954]/25 text-[#1DB954]" 
                            : "bg-[#172554] text-[#38bdf8]"
                        }`}>
                          {track.source}
                        </span>

                        {/* Favorite button */}
                        <button
                          id={`fav-btn-search-${track.id}`}
                          onClick={() => toggleFavorite(track.id)}
                          className="p-1 rounded hover:bg-white/5 text-zinc-400 hover:text-red-500 transition-colors"
                        >
                          <Heart className={`w-3.5 h-3.5 ${isFav ? "fill-red-500 text-red-500" : ""}`} />
                        </button>

                        {/* Add to Playlist button */}
                        <button
                          id={`add-playlist-search-${track.id}`}
                          onClick={() => onAddTrackToPlaylist(track)}
                          className="p-1 rounded hover:bg-white/5 text-zinc-400 hover:text-white transition-colors"
                          title="Add to Custom Playlist"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* Idle Screen Curated Discoveries */
          <div className="bg-black/20 border border-white/5 rounded-2xl p-5 space-y-4">
            <h4 className="text-white text-xs font-semibold tracking-wider uppercase flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-[#1DB954]" />
              <span>Curated Quick Picks</span>
            </h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Lofi */}
              <div 
                id="pick-card-lofi"
                onClick={() => onPlayTrack({
                  id: "synth_lofi_rain",
                  name: "Cozy Study Rain",
                  artist: "Tokyo Cafe Lofi",
                  album: "Curated Beats",
                  duration: 210,
                  source: "synth",
                  artworkUrl: "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=300&q=80",
                  previewUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"
                })}
                className="bg-white/5 border border-white/10 p-3 rounded-xl hover:bg-white/10 hover:border-[#1DB954]/50 cursor-pointer transition-all duration-300 flex items-center space-x-3 group hover:scale-[1.03] hover:shadow-lg hover:shadow-black/30 transform ease-out"
              >
                <div className="w-10 h-10 rounded overflow-hidden shadow bg-zinc-800 shrink-0">
                  <img src="https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=100&q=80" alt="Lofi" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                </div>
                <div>
                  <p className="text-white text-xs font-bold truncate">Cozy Study Rain</p>
                  <p className="text-zinc-500 text-[10px] truncate font-medium">Tokyo Cafe Lofi</p>
                </div>
              </div>

              {/* Synthwave */}
              <div 
                id="pick-card-synthwave"
                onClick={() => onPlayTrack({
                  id: "synth_outrun_sunset",
                  name: "Grid Racer",
                  artist: "RetroWave Sunset",
                  album: "Curated Beats",
                  duration: 180,
                  source: "synth",
                  artworkUrl: "https://images.unsplash.com/photo-1515462277126-270d878326e5?w=300&q=80",
                  previewUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3"
                })}
                className="bg-white/5 border border-white/10 p-3 rounded-xl hover:bg-white/10 hover:border-[#1DB954]/50 cursor-pointer transition-all duration-300 flex items-center space-x-3 group hover:scale-[1.03] hover:shadow-lg hover:shadow-black/30 transform ease-out"
              >
                <div className="w-10 h-10 rounded overflow-hidden shadow bg-zinc-800 shrink-0">
                  <img src="https://images.unsplash.com/photo-1515462277126-270d878326e5?w=100&q=80" alt="Synth" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                </div>
                <div>
                  <p className="text-white text-xs font-bold truncate">Grid Racer</p>
                  <p className="text-zinc-500 text-[10px] truncate font-medium">RetroWave Sunset</p>
                </div>
              </div>

              {/* Jazz Cafe */}
              <div 
                id="pick-card-jazz"
                onClick={() => onPlayTrack({
                  id: "synth_jazz_trio",
                  name: "Blue Indigo Cafe",
                  artist: "Miles Solo Ensemble",
                  album: "Curated Beats",
                  duration: 254,
                  source: "synth",
                  artworkUrl: "https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=300&q=80",
                  previewUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-11.mp3"
                })}
                className="bg-white/5 border border-white/10 p-3 rounded-xl hover:bg-white/10 hover:border-[#1DB954]/50 cursor-pointer transition-all duration-300 flex items-center space-x-3 group hover:scale-[1.03] hover:shadow-lg hover:shadow-black/30 transform ease-out"
              >
                <div className="w-10 h-10 rounded overflow-hidden shadow bg-zinc-800 shrink-0">
                  <img src="https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=100&q=80" alt="Jazz" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                </div>
                <div>
                  <p className="text-white text-xs font-bold truncate">Blue Indigo Cafe</p>
                  <p className="text-zinc-500 text-[10px] truncate font-medium">Miles Ensemble</p>
                </div>
              </div>

              {/* Ambient Focus */}
              <div 
                id="pick-card-ambient"
                onClick={() => onPlayTrack({
                  id: "synth_ambient_aurora",
                  name: "Golden Slumber",
                  artist: "Nebula Ambient",
                  album: "Curated Beats",
                  duration: 290,
                  source: "synth",
                  artworkUrl: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=300&q=80",
                  previewUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3"
                })}
                className="bg-white/5 border border-white/10 p-3 rounded-xl hover:bg-white/10 hover:border-[#1DB954]/50 cursor-pointer transition-all duration-300 flex items-center space-x-3 group hover:scale-[1.03] hover:shadow-lg hover:shadow-black/30 transform ease-out"
              >
                <div className="w-10 h-10 rounded overflow-hidden shadow bg-zinc-800 shrink-0">
                  <img src="https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=100&q=80" alt="Ambient" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                </div>
                <div>
                  <p className="text-white text-xs font-bold truncate">Golden Slumber</p>
                  <p className="text-zinc-500 text-[10px] truncate font-medium">Nebula Ambient</p>
                </div>
              </div>
            </div>

            <p className="text-[10px] text-zinc-500 font-mono italic">
              These pre-curated channels feature lossless audio synthesized globally for full-range test pipelines.
            </p>
          </div>
        )}
      </div>

      {/* Spotify Embedded Live Player - Required Segment */}
      <div id="embed-spotify" className="lg:col-span-5 flex flex-col space-y-4">
        <h4 className="text-white text-xs font-semibold tracking-wider uppercase flex items-center space-x-2">
          <Library className="w-4 h-4 text-[#1DB954]" />
          <span>Live Featured Feed</span>
        </h4>
        
        <div id="spotify-iframe-embed" className="rounded-2xl overflow-hidden shadow-2xl border border-white/15 bg-black">
          <iframe
            title="Spotify Embed: Recommendation Playlist"
            src={`https://open.spotify.com/embed/playlist/${playlistId}?utm_source=generator&theme=0`}
            width="100%"
            height="150%"
            style={{ minHeight: '360px' }}
            frameBorder="0"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
          />
        </div>
      </div>
    </div>
  );
};
