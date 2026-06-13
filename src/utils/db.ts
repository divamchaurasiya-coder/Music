import { Track, Playlist } from "../types";

const DB_NAME = "CrossPlatformMusicPlayerDB";
const DB_VERSION = 1;

export function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = request.result;

      // Store local track metadata
      if (!db.objectStoreNames.contains("tracks")) {
        db.createObjectStore("tracks", { keyPath: "id" });
      }

      // Store actual raw audio Blobs to enable offline-ready audio playback
      if (!db.objectStoreNames.contains("audio_files")) {
        db.createObjectStore("audio_files"); // key is trackId string
      }

      // Store playlists info
      if (!db.objectStoreNames.contains("playlists")) {
        db.createObjectStore("playlists", { keyPath: "id" });
      }

      // Store metadata/settings like favorites, recently played and volume state
      if (!db.objectStoreNames.contains("user_data")) {
        db.createObjectStore("user_data");
      }
    };
  });
}

// Store a track and its audio Blob
export async function saveLocalTrack(track: Track, audioBlob: Blob): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["tracks", "audio_files"], "readwrite");
    
    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => resolve();

    const tracksStore = tx.objectStore("tracks");
    const audioStore = tx.objectStore("audio_files");

    tracksStore.put({
      ...track,
      localFileBlobId: track.id
    });
    audioStore.put(audioBlob, track.id);
  });
}

// Retrieve audio Blob for a track
export async function getLocalAudioBlob(trackId: string): Promise<Blob | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("audio_files", "readonly");
    const store = tx.objectStore("audio_files");
    const request = store.get(trackId);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || null);
  });
}

// Get all offline tracks
export async function getAllLocalTracks(): Promise<Track[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("tracks", "readonly");
    const store = tx.objectStore("tracks");
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
}

// Delete a local track
export async function deleteLocalTrack(trackId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["tracks", "audio_files"], "readwrite");
    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => resolve();

    tx.objectStore("tracks").delete(trackId);
    tx.objectStore("audio_files").delete(trackId);
  });
}

// Save all playlists
export async function savePlaylist(playlist: Playlist): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("playlists", "readwrite");
    const store = tx.objectStore("playlists");
    const request = store.put(playlist);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function deletePlaylist(playlistId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("playlists", "readwrite");
    const store = tx.objectStore("playlists");
    const request = store.delete(playlistId);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

// Get all saved playlists
export async function getAllPlaylists(): Promise<Playlist[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("playlists", "readonly");
    const store = tx.objectStore("playlists");
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
}

// General User Settings storage (Favorites, Recents, Volume)
export async function saveUserSetting(key: string, value: any): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("user_data", "readwrite");
    const store = tx.objectStore("user_data");
    const request = store.put(value, key);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function getUserSetting<T>(key: string, defaultValue: T): Promise<T> {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction("user_data", "readonly");
    const store = tx.objectStore("user_data");
    const request = store.get(key);

    request.onerror = () => resolve(defaultValue);
    request.onsuccess = () => {
      if (request.result !== undefined) {
        resolve(request.result as T);
      } else {
        resolve(defaultValue);
      }
    };
  });
}
