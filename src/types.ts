export type TrackSource = "local" | "spotify" | "synth" | "curated";

export interface Track {
  id: string;
  name: string;
  artist: string;
  album: string;
  duration: number; // in seconds
  artworkUrl?: string;
  url?: string; // audio source URL/Blob URL
  source: TrackSource;
  localFileBlobId?: string; // key pointer in IndexedDB
  spotifyId?: string;
  previewUrl?: string;
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  artworkUrl?: string;
  tracks: Track[];
  isSpotify?: boolean;
  spotifyId?: string;
  createdAt: number;
}

export interface SpotifyUser {
  id: string;
  displayName: string;
  email?: string;
  avatarUrl?: string;
  product?: string;
}

export interface EqualizerPreset {
  name: string;
  gains: number[]; // 5 band gains in dB: 60Hz, 230Hz, 910Hz, 4kHz, 14kHz
}

export interface PlayerState {
  currentTrack: Track | null;
  isPlaying: boolean;
  duration: number;
  currentTime: number;
  volume: number; // 0.0 to 1.0
  isMuted: boolean;
  queue: Track[];
  queueIndex: number;
  isLooping: boolean;
  isShuffle: boolean;
}
