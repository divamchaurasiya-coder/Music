import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { Track, PlayerState } from "../types";
import { getLocalAudioBlob, saveUserSetting, getUserSetting } from "../utils/db";

interface AudioPlayerContextType {
  playerState: PlayerState;
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isLooping: boolean;
  isShuffle: boolean;
  eqGains: number[]; // 5 bands in dB
  analyser: AnalyserNode | null;
  favorites: string[];
  recentlyPlayed: Track[];
  playTrack: (track: Track, newQueue?: Track[]) => void;
  togglePlay: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  toggleLoop: () => void;
  toggleShuffle: () => void;
  updateEqGain: (bandIndex: number, gain: number) => void;
  addToQueue: (track: Track) => void;
  removeFromQueue: (trackId: string) => void;
  toggleFavorite: (trackId: string) => void;
  addRecentlyPlayed: (track: Track) => void;
}

const AudioPlayerContext = createContext<AudioPlayerContextType | undefined>(undefined);

// 5-band equalizer frequencies
const EQ_FREQS = [60, 230, 910, 4000, 14000];

export const AudioPlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [playerState, setPlayerState] = useState<PlayerState>({
    currentTrack: null,
    isPlaying: false,
    duration: 0,
    currentTime: 0,
    volume: 0.8,
    isMuted: false,
    queue: [],
    queueIndex: -1,
    isLooping: false,
    isShuffle: false,
  });

  const [favorites, setFavorites] = useState<string[]>([]);
  const [recentlyPlayed, setRecentlyPlayed] = useState<Track[]>([]);
  const [eqGains, setEqGains] = useState<number[]>([4, 2, 0, 1, 3]); // default warm preset
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const filtersRef = useRef<BiquadFilterNode[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  // Initialize standard audio element
  useEffect(() => {
    const audio = new Audio();
    audio.crossOrigin = "anonymous";
    audioRef.current = audio;

    // Load initial user state (volume, favorites) from DB
    const loadSavedState = async () => {
      const savedVol = await getUserSetting<number>("volume", 0.8);
      const savedMute = await getUserSetting<boolean>("isMuted", false);
      const savedFavs = await getUserSetting<string[]>("favorites", []);
      const savedRecents = await getUserSetting<Track[]>("recentlyPlayed", []);
      const savedEq = await getUserSetting<number[]>("eqGains", [4, 2, 0, 1, 3]);

      setFavorites(savedFavs);
      setRecentlyPlayed(savedRecents);
      setEqGains(savedEq);
      
      setPlayerState(prev => ({
        ...prev,
        volume: savedVol,
        isMuted: savedMute
      }));

      if (audioRef.current) {
        audioRef.current.volume = savedMute ? 0 : savedVol;
      }
    };
    loadSavedState();

    return () => {
      if (audio) {
        audio.pause();
        audio.src = "";
      }
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, []);

  // Web Audio Context initialization on user action
  const initWebAudio = () => {
    if (audioCtxRef.current || !audioRef.current) return;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;

      // Create source
      const source = ctx.createMediaElementSource(audioRef.current);
      sourceRef.current = source;

      // Create 5 equalizer band filters
      const filters = EQ_FREQS.map((freq, index) => {
        const filter = ctx.createBiquadFilter();
        // first band is low shelf, last band is high shelf, middle are peaking
        if (index === 0) {
          filter.type = "lowshelf";
        } else if (index === EQ_FREQS.length - 1) {
          filter.type = "highshelf";
        } else {
          filter.type = "peaking";
        }
        filter.frequency.value = freq;
        filter.Q.value = 1.0;
        filter.gain.value = eqGains[index];
        return filter;
      });
      filtersRef.current = filters;

      // Create analyser node
      const analyserNode = ctx.createAnalyser();
      analyserNode.fftSize = 256;
      analyserRef.current = analyserNode;
      setAnalyser(analyserNode);

      // Connect pipeline: source -> filter0 -> filter1 -> ... -> filter4 -> analyser -> destination
      let currentOutput: AudioNode = source;
      filters.forEach(filter => {
        currentOutput.connect(filter);
        currentOutput = filter;
      });
      currentOutput.connect(analyserNode);
      analyserNode.connect(ctx.destination);
    } catch (e) {
      console.error("Failed to initialize Web Audio API pipeline:", e);
    }
  };

  // Sync EQ levels with state changes
  useEffect(() => {
    if (filtersRef.current.length > 0) {
      filtersRef.current.forEach((filter, index) => {
        filter.gain.setValueAtTime(eqGains[index], audioCtxRef.current?.currentTime || 0);
      });
    }
    saveUserSetting("eqGains", eqGains);
  }, [eqGains]);

  // Audio Event Listeners hooked helper
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      setPlayerState(prev => ({ ...prev, currentTime: audio.currentTime }));
    };

    const onDurationChange = () => {
      setPlayerState(prev => ({ ...prev, duration: audio.duration || 0 }));
    };

    const onEnded = () => {
      // Loop or next track
      if (playerState.isLooping) {
        audio.currentTime = 0;
        audio.play().catch(e => console.log("Replay failed:", e));
      } else {
        nextTrack();
      }
    };

    const onError = (e: any) => {
      console.error("Audio error event:", e);
      setPlayerState(prev => ({ ...prev, isPlaying: false }));
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("durationchange", onDurationChange);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("durationchange", onDurationChange);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  }, [playerState.isLooping, playerState.queue, playerState.queueIndex, playerState.isShuffle]);

  const playTrack = async (track: Track, newQueue?: Track[]) => {
    initWebAudio();
    if (audioCtxRef.current && audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    let urlToPlay = track.url || track.previewUrl || "";
    
    // Resolve offline database blob if local
    if (track.source === "local" && (track.localFileBlobId || track.id)) {
      try {
        const blob = await getLocalAudioBlob(track.localFileBlobId || track.id);
        if (blob) {
          const blobUrl = URL.createObjectURL(blob);
          objectUrlRef.current = blobUrl;
          urlToPlay = blobUrl;
        }
      } catch (err) {
        console.error("Failed to load local blob for track:", err);
      }
    }

    if (!audioRef.current) return;

    // Remove crossorigin attribute for blob/local URLs to prevent browser CORS playback blockages
    if (track.source === "local" || urlToPlay.startsWith("blob:") || urlToPlay.startsWith("data:")) {
      audioRef.current.removeAttribute("crossorigin");
    } else {
      audioRef.current.crossOrigin = "anonymous";
    }

    audioRef.current.src = urlToPlay;
    audioRef.current.load();

    // Setup queue
    let nextQueue = playerState.queue;
    let nextIndex = playerState.queueIndex;

    if (newQueue) {
      nextQueue = newQueue;
      nextIndex = newQueue.findIndex(t => t.id === track.id);
    } else {
      // Add if missing
      const index = nextQueue.findIndex(t => t.id === track.id);
      if (index === -1) {
        nextQueue = [...nextQueue, track];
        nextIndex = nextQueue.length - 1;
      } else {
        nextIndex = index;
      }
    }

    setPlayerState(prev => ({
      ...prev,
      currentTrack: track,
      isPlaying: true,
      queue: nextQueue,
      queueIndex: nextIndex,
      currentTime: 0
    }));

    audioRef.current.play()
      .then(() => {
        addRecentlyPlayed(track);
      })
      .catch(e => {
        console.error("Playback failed, likely due to browser autoplay protections:", e);
        setPlayerState(prev => ({ ...prev, isPlaying: false }));
      });
  };

  const togglePlay = () => {
    if (!audioRef.current || !playerState.currentTrack) return;
    initWebAudio();

    if (audioCtxRef.current && audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }

    if (playerState.isPlaying) {
      audioRef.current.pause();
      setPlayerState(prev => ({ ...prev, isPlaying: false }));
    } else {
      audioRef.current.play()
        .then(() => {
          setPlayerState(prev => ({ ...prev, isPlaying: true }));
        })
        .catch(e => {
          console.error("Resume audio failed:", e);
        });
    }
  };

  const nextTrack = () => {
    const { queue, queueIndex, isShuffle } = playerState;
    if (queue.length === 0) return;

    let nextIndex = queueIndex + 1;
    if (isShuffle) {
      nextIndex = Math.floor(Math.random() * queue.length);
    } else if (nextIndex >= queue.length) {
      nextIndex = 0; // Wrap around
    }

    const nextTrackObj = queue[nextIndex];
    if (nextTrackObj) {
      playTrack(nextTrackObj);
    }
  };

  const prevTrack = () => {
    const { queue, queueIndex } = playerState;
    if (queue.length === 0) return;

    let prevIndex = queueIndex - 1;
    if (prevIndex < 0) {
      prevIndex = queue.length - 1; // Wrap around
    }

    const prevTrackObj = queue[prevIndex];
    if (prevTrackObj) {
      playTrack(prevTrackObj);
    }
  };

  const seek = (time: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = time;
    setPlayerState(prev => ({ ...prev, currentTime: time }));
  };

  const setVolume = (vol: number) => {
    const normalizedVol = Math.max(0, Math.min(1, vol));
    if (audioRef.current) {
      audioRef.current.volume = playerState.isMuted ? 0 : normalizedVol;
    }
    setPlayerState(prev => ({ ...prev, volume: normalizedVol }));
    saveUserSetting("volume", normalizedVol);
  };

  const toggleMute = () => {
    const nextMuted = !playerState.isMuted;
    if (audioRef.current) {
      audioRef.current.volume = nextMuted ? 0 : playerState.volume;
    }
    setPlayerState(prev => ({ ...prev, isMuted: nextMuted }));
    saveUserSetting("isMuted", nextMuted);
  };

  const toggleLoop = () => {
    setPlayerState(prev => ({ ...prev, isLooping: !prev.isLooping }));
  };

  const toggleShuffle = () => {
    setPlayerState(prev => ({ ...prev, isShuffle: !prev.isShuffle }));
  };

  const updateEqGain = (bandIndex: number, gain: number) => {
    setEqGains(prev => {
      const updated = [...prev];
      updated[bandIndex] = gain;
      return updated;
    });
  };

  const addToQueue = (track: Track) => {
    setPlayerState(prev => {
      if (prev.queue.some(t => t.id === track.id)) return prev;
      return {
        ...prev,
        queue: [...prev.queue, track]
      };
    });
  };

  const removeFromQueue = (trackId: string) => {
    setPlayerState(prev => {
      const nextQueue = prev.queue.filter(t => t.id !== trackId);
      let nextIndex = prev.queueIndex;
      if (prev.currentTrack?.id === trackId) {
        nextIndex = -1;
      } else {
        nextIndex = nextQueue.findIndex(t => t.id === prev.currentTrack?.id);
      }
      return {
        ...prev,
        queue: nextQueue,
        queueIndex: nextIndex
      };
    });
  };

  const toggleFavorite = async (trackId: string) => {
    let nextFavorites: string[];
    if (favorites.includes(trackId)) {
      nextFavorites = favorites.filter(id => id !== trackId);
    } else {
      nextFavorites = [...favorites, trackId];
    }
    setFavorites(nextFavorites);
    await saveUserSetting("favorites", nextFavorites);
  };

  const addRecentlyPlayed = async (track: Track) => {
    setRecentlyPlayed(prev => {
      const filtered = prev.filter(t => t.id !== track.id);
      const nextRecents = [track, ...filtered].slice(0, 20);
      saveUserSetting("recentlyPlayed", nextRecents);
      return nextRecents;
    });
  };

  // HTML5 Media Session API registration for persistent background lock-screen support
  useEffect(() => {
    if (!("mediaSession" in navigator) || !playerState.currentTrack) return;

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: playerState.currentTrack.name,
        artist: playerState.currentTrack.artist,
        album: playerState.currentTrack.album || "Local Library",
        artwork: [
          {
            src: playerState.currentTrack.artworkUrl || "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=512&q=80",
            sizes: "512x512",
            type: "image/jpeg"
          }
        ]
      });
    } catch (e) {
      console.error("Crashed updating Media Session Artwork details:", e);
    }
  }, [playerState.currentTrack]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.playbackState = playerState.isPlaying ? "playing" : "paused";
  }, [playerState.isPlaying]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;

    try {
      navigator.mediaSession.setActionHandler("play", () => {
        if (audioRef.current && playerState.currentTrack) {
          audioRef.current.play()
            .then(() => setPlayerState(prev => ({ ...prev, isPlaying: true })))
            .catch(e => console.log("Media session play block failed", e));
        }
      });
      navigator.mediaSession.setActionHandler("pause", () => {
        if (audioRef.current) {
          audioRef.current.pause();
          setPlayerState(prev => ({ ...prev, isPlaying: false }));
        }
      });
      navigator.mediaSession.setActionHandler("previoustrack", () => {
        prevTrack();
      });
      navigator.mediaSession.setActionHandler("nexttrack", () => {
        nextTrack();
      });
      navigator.mediaSession.setActionHandler("seekto", (details) => {
        if (details.seekTime !== undefined) {
          seek(details.seekTime);
        }
      });
    } catch (e) {
      console.error("Failed to register background Media Session controls:", e);
    }

    return () => {
      if (!("mediaSession" in navigator)) return;
      try {
        navigator.mediaSession.setActionHandler("play", null);
        navigator.mediaSession.setActionHandler("pause", null);
        navigator.mediaSession.setActionHandler("previoustrack", null);
        navigator.mediaSession.setActionHandler("nexttrack", null);
        navigator.mediaSession.setActionHandler("seekto", null);
      } catch (err) {}
    };
  }, [playerState.currentTrack, playerState.isPlaying]);

  return (
    <AudioPlayerContext.Provider
      value={{
        playerState,
        currentTrack: playerState.currentTrack,
        isPlaying: playerState.isPlaying,
        currentTime: playerState.currentTime,
        duration: playerState.duration,
        volume: playerState.volume,
        isMuted: playerState.isMuted,
        isLooping: playerState.isLooping,
        isShuffle: playerState.isShuffle,
        eqGains,
        analyser,
        favorites,
        recentlyPlayed,
        playTrack,
        togglePlay,
        nextTrack,
        prevTrack,
        seek,
        setVolume,
        toggleMute,
        toggleLoop,
        toggleShuffle,
        updateEqGain,
        addToQueue,
        removeFromQueue,
        toggleFavorite,
        addRecentlyPlayed
      }}
    >
      {children}
    </AudioPlayerContext.Provider>
  );
};

export const useAudioPlayer = () => {
  const context = useContext(AudioPlayerContext);
  if (context === undefined) {
    throw new Error("useAudioPlayer must be used within an AudioPlayerProvider");
  }
  return context;
};
