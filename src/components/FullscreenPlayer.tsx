import React, { useState, useEffect } from "react";
import { 
  Play, Pause, SkipForward, SkipBack, Shuffle, Repeat, 
  Volume2, VolumeX, Maximize2, Minimize2, Heart, Plus, ListMusic
} from "lucide-react";
import { useAudioPlayer } from "../context/AudioPlayerContext";
import { Track } from "../types";

interface FullscreenPlayerProps {
  onMinimize: () => void;
  onAddTrackToPlaylist: (track: Track) => void;
}

export const FullscreenPlayer: React.FC<FullscreenPlayerProps> = ({ onMinimize, onAddTrackToPlaylist }) => {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    isLooping,
    isShuffle,
    playTrack,
    togglePlay,
    nextTrack,
    prevTrack,
    seek,
    setVolume,
    toggleMute,
    toggleLoop,
    toggleShuffle,
    toggleFavorite,
    favorites
  } = useAudioPlayer();

  const [lyricsActive, setLyricsActive] = useState(false);

  // Dynamic aesthetic lyric content mapping based on name
  const getSimulatedLyrics = (trackName: string) => {
    const defaultLyrics = [
      "Walking down the neon streets...",
      "Searching for a cozy state of mind.",
      "The raindrops beat on our window sill.",
      "No rush. No pressure. Let the rhythm flow.",
      "And the night fades slowly into coffee mugs...",
      "Yeah, we are home."
    ];

    if (trackName.toLowerCase().includes("rain") || trackName.toLowerCase().includes("lofi")) {
      return [
        "Soft acoustic static in the background...",
        "Cup of jasmine tea warm in both hands.",
        "The sky is slate grey but we have each other.",
        "Pages turning, thoughts unwinding.",
        "Take a breath. Hold it. Release.",
        "Just lofi raindrops doing their magic."
      ];
    }

    if (trackName.toLowerCase().includes("racer") || trackName.toLowerCase().includes("neon") || trackName.toLowerCase().includes("grid")) {
      return [
        "Engines roaring in the synthetic glow...",
        "We are accelerating past the cyber grid.",
        "Laser light reflections on the windshield.",
        "Retro future frequencies filling the air.",
        "No limits now. Just speed and synth.",
        "Ride the digital wave into the endless light."
      ];
    }

    return defaultLyrics;
  };

  const activeLyrics = currentTrack ? getSimulatedLyrics(currentTrack.name) : [];

  // Format second timestamps to MM:SS string
  const formatTime = (timeInSecs: number) => {
    if (isNaN(timeInSecs)) return "0:00";
    const mins = Math.floor(timeInSecs / 60);
    const secs = Math.floor(timeInSecs % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const isFav = currentTrack ? favorites.includes(currentTrack.id) : false;

  if (!currentTrack) {
    return (
      <div className="flex flex-col items-center justify-center text-center h-full text-zinc-500">
        <p>No track active</p>
      </div>
    );
  }

  return (
    <div 
      id="fullscreen-player-layout" 
      className="relative w-full h-full min-h-screen text-white overflow-hidden flex flex-col justify-between"
    >
      {/* Blurred Album Artwork Background with glowing ambient light */}
      <div 
        id="fs-background-gradient"
        className="absolute inset-0 bg-cover bg-center scale-110 filter blur-[90px] brightness-[0.22] saturate-[1.6] opacity-90 transition-all duration-1000 ease-in-out pointer-events-none select-none z-0"
        style={{ backgroundImage: `url(${currentTrack.artworkUrl || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=600&q=80'})` }}
      />
      
      {/* Absolute dark mask to guarantee high-contrast text */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/50 to-black/90 pointer-events-none select-none z-0" />

      {/* Header Controls */}
      <header className="relative z-10 flex items-center justify-between p-6 select-none border-b border-white/5">
        <button 
          id="minimize-player-btn"
          onClick={onMinimize}
          className="p-2.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-zinc-300 hover:text-white transition-all cursor-pointer active:scale-95"
        >
          <Minimize2 className="w-5 h-5" />
        </button>
        <div className="text-center">
          <span className="text-[10px] font-mono tracking-widest text-[#1DB954] font-bold uppercase">NOW STREAMING</span>
          <p className="text-xs text-zinc-400 mt-0.5 truncate max-w-xs">{currentTrack.album}</p>
        </div>
        <button 
          id="add-playlist-fs-btn"
          onClick={() => onAddTrackToPlaylist(currentTrack)}
          className="p-2.5 rounded-full bg-white/5 border border-white/10 hover:bg-[#1DB954]/20 hover:border-[#1DB954]/40 text-zinc-300 hover:text-[#1DB954] transition-all cursor-pointer active:scale-95"
          title="Add to Custom Playlist"
        >
          <Plus className="w-5 h-5" />
        </button>
      </header>

      {/* Immersive Center Layout Grid */}
      <main className="relative z-10 flex-1 grid grid-cols-1 md:grid-cols-2 gap-8 items-center px-6 max-w-5xl mx-auto w-full select-none">
        
        {/* Left Side: Artwork Plate */}
        <div id="immersive-artwork-plate" className="flex flex-col items-center justify-center space-y-6">
          <div 
            id="artwork-rotator" 
            className={`relative w-48 h-48 sm:w-64 sm:h-64 md:w-80 md:h-80 rounded-full border-[8px] border-black/80 shadow-[0_25px_60px_rgba(0,0,0,0.8)] overflow-hidden flex items-center justify-center transition-transform duration-1000 ${
              isPlaying ? "animate-spin" : ""
            }`}
            style={{ animationDuration: "25s", animationTimingFunction: "linear" }}
          >
            {/* Center Spindle pinhole holes matching a physical music vinyl CD */}
            <div className="absolute inset-0 bg-cover bg-center rounded-full pointer-events-none" style={{ backgroundImage: `url(${currentTrack.artworkUrl || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=400&q=80'})` }} />
            <div className="absolute w-12 h-12 bg-black/90 rounded-full border border-white/10 flex items-center justify-center z-10">
              <div className="w-3 h-3 bg-[#111] rounded-full" />
            </div>
          </div>

          {/* Interactive metadata details */}
          <div className="text-center space-y-1.5 w-full max-w-md">
            <h2 className="text-white text-xl sm:text-2xl font-black tracking-tight truncate px-4">{currentTrack.name}</h2>
            <p className="text-zinc-400 text-sm truncate px-4">{currentTrack.artist}</p>
          </div>
        </div>

        {/* Right Side: Interactive Lyrics or Active Audio EQ/Details */}
        <div id="immersive-meta-panel" className="flex flex-col space-y-6 justify-center h-full max-w-md mx-auto w-full">
          {/* Tabs */}
          <div className="flex border-b border-white/10 text-xs font-mono">
            <button
              id="lyrics-tab-btn"
              onClick={() => setLyricsActive(true)}
              className={`pb-2.5 px-4 font-bold tracking-wider select-none cursor-pointer transition-colors ${
                lyricsActive ? "border-b-[3px] border-[#1DB954] text-[#1DB954]" : "text-zinc-500 hover:text-white"
              }`}
            >
              LYRICS SYNC
            </button>
            <button
              id="amplifier-tab-btn"
              onClick={() => setLyricsActive(false)}
              className={`pb-2.5 px-4 font-bold tracking-wider select-none cursor-pointer transition-colors ${
                !lyricsActive ? "border-b-[3px] border-[#1DB954] text-[#1DB954]" : "text-zinc-500 hover:text-white"
              }`}
            >
              SONG INFO
            </button>
          </div>

          <div className="flex-1 min-h-[180px] bg-black/25 backdrop-blur-md rounded-2xl border border-white/5 p-5 overflow-y-auto max-h-[220px] scrollbar-thin">
            {lyricsActive ? (
              <div id="lyrics-scroller" className="space-y-4 text-center font-medium md:text-left transition-all duration-300">
                {activeLyrics.map((line, idx) => (
                  <p 
                    key={idx} 
                    className={`text-sm tracking-wide leading-relaxed font-semibold transition-all duration-300 ${
                      idx === 2 && isPlaying ? "text-[#1DB954] scale-[1.03] drop-shadow-[0_0_8px_rgba(29,185,84,0.4)]" : "text-white/40"
                    }`}
                  >
                    {line}
                  </p>
                ))}
              </div>
            ) : (
              <div id="ambient-specifications" className="space-y-3.5 text-xs text-zinc-400 font-mono">
                <div className="flex justify-between border-b border-white/5 pb-1">
                  <span>Track Provider:</span>
                  <span className="text-[#1DB954] font-bold uppercase">{currentTrack.source}</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-1">
                  <span>Codec Format:</span>
                  <span className="text-white font-medium">MPEG-Layer-3 Lossy</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-1">
                  <span>Frequency Sample:</span>
                  <span className="text-white font-medium">44,100 Hz</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-1">
                  <span>Bitrate Transmission:</span>
                  <span className="text-white font-medium">320kbps High Fidelity</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-1">
                  <span>Streaming Channel:</span>
                  <span className="text-white font-medium">Dual-Stereo Ambient</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-1">
                  <span>Persistent ID:</span>
                  <span className="text-zinc-500 text-[10px] break-all max-w-[200px] text-right">{currentTrack.id}</span>
                </div>
              </div>
            )}
          </div>
        </div>

      </main>

      {/* Footer Interface Controls (TimeSeek, Player Mechanics) */}
      <footer className="relative z-10 bg-black/35 backdrop-blur-xl border-t border-white/5 p-6 select-none space-y-4">
        <div className="max-w-4xl mx-auto space-y-4">
          {/* Playback Seek Bar slider */}
          <div id="playback-seek-container" className="flex items-center space-x-3.5">
            <span className="text-[10px] font-mono text-zinc-400">{formatTime(currentTime)}</span>
            
            <div id="seek-bar-track" className="relative group w-full h-1.5 bg-zinc-800 rounded-full cursor-pointer">
              <input
                type="range"
                id="playback-seek-range"
                min="0"
                max={duration || 100}
                value={currentTime}
                onChange={(e) => seek(parseFloat(e.target.value))}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div 
                className="bg-gradient-to-r from-[#1DB954] to-[#a6ff1a] h-full rounded-full transition-all duration-75 relative"
                style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
              >
                {/* Glowing seek knob */}
                <span className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white border border-[#1DB954] rounded-full shadow-[0_0_10px_#1DB954] group-hover:scale-110 transition-transform" />
              </div>
            </div>

            <span className="text-[10px] font-mono text-zinc-400">{formatTime(duration)}</span>
          </div>

          {/* Master Controller Grid */}
          <div id="master-footer-controller" className="grid grid-cols-3 items-center">
            
            {/* Left side: Favorites trigger */}
            <div className="flex items-center space-x-3 justify-start">
              <button
                id="fav-fs-btn"
                onClick={() => toggleFavorite(currentTrack.id)}
                className="p-2.5 rounded-full hover:bg-white/5 text-zinc-400 hover:text-red-500 transition-colors cursor-pointer"
              >
                <Heart className={`w-5 h-5 ${isFav ? "fill-red-500 text-red-500" : ""}`} />
              </button>
            </div>

            {/* Center Controls: Standard mechanics */}
            <div className="flex items-center justify-center space-x-5">
              <button
                id="shuffle-fs-btn"
                onClick={toggleShuffle}
                className={`p-2.5 rounded-full hover:bg-white/5 transition-all cursor-pointer ${
                  isShuffle ? "text-[#1DB954] drop-shadow-[0_0_6px_rgba(29,185,84,0.4)] md:scale-105" : "text-zinc-500 hover:text-white"
                }`}
                title="Shuffle Queue"
              >
                <Shuffle className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>

              <button
                id="prev-fs-btn"
                onClick={prevTrack}
                className="p-2.5 rounded-full hover:bg-white/5 text-zinc-300 hover:text-white transition-colors cursor-pointer"
              >
                <SkipBack className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>

              <button
                id="play-fs-btn"
                onClick={togglePlay}
                className="p-4 bg-white text-black hover:bg-zinc-200 rounded-full shadow-[0_10px_25px_rgba(255,255,255,0.2)] hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center justify-center border border-white/5"
              >
                {isPlaying ? <Pause className="w-5 h-5 sm:w-6 sm:h-6 fill-current" /> : <Play className="w-5 h-5 sm:w-6 sm:h-6 fill-current ml-0.5" />}
              </button>

              <button
                id="next-fs-btn"
                onClick={nextTrack}
                className="p-2.5 rounded-full hover:bg-white/5 text-zinc-300 hover:text-white transition-colors cursor-pointer"
              >
                <SkipForward className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>

              <button
                id="loop-fs-btn"
                onClick={toggleLoop}
                className={`p-2.5 rounded-full hover:bg-white/5 transition-all cursor-pointer ${
                  isLooping ? "text-[#1DB954] drop-shadow-[0_0_6px_rgba(29,185,84,0.4)] md:scale-105" : "text-zinc-500 hover:text-white"
                }`}
                title="Loop Current Track"
              >
                <Repeat className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>

            {/* Right Side: Volume seek controls */}
            <div className="flex items-center space-x-2.5 justify-end">
              <button
                id="mute-fs-btn"
                onClick={toggleMute}
                className="text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                {isMuted ? <VolumeX className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" /> : <Volume2 className="w-4 h-4 sm:w-5 sm:h-5 text-[#1DB954]" />}
              </button>
              <div className="relative group w-16 sm:w-24 h-1 bg-zinc-800 rounded-full cursor-pointer hidden sm:block">
                <input
                  type="range"
                  id="volume-fs-slider"
                  min="0"
                  max="100"
                  value={isMuted ? 0 : Math.round(volume * 100)}
                  onChange={(e) => setVolume(parseFloat(e.target.value) / 100)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div 
                  className="bg-[#1DB954] h-full rounded-full relative"
                  style={{ width: `${isMuted ? 0 : volume * 100}%` }}
                />
              </div>
            </div>

          </div>
        </div>
      </footer>
    </div>
  );
};
