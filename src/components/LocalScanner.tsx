import React, { useState, useRef } from "react";
import { FolderUp, Loader2, Music, Check, Trash2, Play, Pause, Volume2 } from "lucide-react";
import { saveLocalTrack, getAllLocalTracks, deleteLocalTrack } from "../utils/db";
import { Track } from "../types";
import { useAudioPlayer } from "../context/AudioPlayerContext";

interface LocalScannerProps {
  onTracksUpdated: () => void;
  localTracks: Track[];
}

export const LocalScanner: React.FC<LocalScannerProps> = ({ onTracksUpdated, localTracks }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [justUploaded, setJustUploaded] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { currentTrack, isPlaying, playTrack, togglePlay } = useAudioPlayer();

  const handlePlayTrack = (track: Track) => {
    if (currentTrack?.id === track.id) {
      togglePlay();
    } else {
      playTrack(track, localTracks);
    }
  };

  // Parse artist and title from file name
  const parseFileInfo = (filename: string): { name: string; artist: string } => {
    // strip extension (e.g., .mp3, .wav, .m4a)
    const cleanName = filename.replace(/\.[^/.]+$/, "");
    
    // Check if filename contains separator " - " (Artist - Title)
    if (cleanName.includes(" - ")) {
      const parts = cleanName.split(" - ");
      const artist = parts[0].trim();
      const name = parts.slice(1).join(" - ").trim();
      return { name, artist };
    }
    
    return {
      name: cleanName,
      artist: "Local Artist"
    };
  };

  const processFiles = async (files: FileList) => {
    setIsScanning(true);
    setScanProgress(0);
    const audioFiles = Array.from(files).filter(file => file.type.startsWith("audio/"));

    if (audioFiles.length === 0) {
      setIsScanning(false);
      return;
    }

    const uploadedList: string[] = [];

    for (let i = 0; i < audioFiles.length; i++) {
      const file = audioFiles[i];
      const { name, artist } = parseFileInfo(file.name);
      
      const trackId = `local_tr_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      
      const newTrack: Track = {
        id: trackId,
        name,
        artist,
        album: "Local Storage",
        duration: 180, // Default duration fallback (can get updated on play)
        source: "local",
        artworkUrl: "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=300&q=80", // colorful abstract vinyl cover
      };

      try {
        // Read file duration dynamically if possible before saving
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
        uploadedList.push(newTrack.name);
        
        // Simulating progressive scanning feel 
        setScanProgress(Math.round(((i + 1) / audioFiles.length) * 100));
      } catch (err) {
        console.error("Failed to store audio file:", file.name, err);
      }
    }

    setJustUploaded(uploadedList);
    onTracksUpdated();
    setIsScanning(false);

    // Fade out connection toast
    setTimeout(() => {
      setJustUploaded([]);
    }, 4000);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      processFiles(e.dataTransfer.files);
    }
  };

  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(e.target.files);
    }
  };

  const handleDelete = async (trackId: string, name: string) => {
    if (confirm(`Are you sure you want to remove "${name}" from offline library?`)) {
      await deleteLocalTrack(trackId);
      onTracksUpdated();
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Zone */}
      <div
        id="local-dropzone"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={triggerFileInput}
        className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-300 backdrop-blur-md flex flex-col items-center justify-center ${
          isDragging
            ? "border-[#1DB954] bg-[#1DB954]/10 scale-[1.02]"
            : "border-white/10 hover:border-white/25 bg-white/5"
        }`}
      >
        <input
          type="file"
          id="local-file-input"
          ref={fileInputRef}
          onChange={handleFileChange}
          multiple
          accept="audio/*"
          className="hidden"
        />

        {isScanning ? (
          <div className="flex flex-col items-center space-y-3">
            <Loader2 className="w-10 h-10 text-[#1DB954] animate-spin" />
            <div className="text-white font-medium">Scanning local files...</div>
            <div className="w-48 bg-zinc-800 h-2 rounded-full overflow-hidden">
              <div
                className="bg-[#1DB954] h-full transition-all duration-300"
                style={{ width: `${scanProgress}%` }}
              />
            </div>
            <span className="text-xs text-zinc-400">{scanProgress}% completed</span>
          </div>
        ) : (
          <div className="flex flex-col items-center space-y-3">
            <div className="w-12 h-12 bg-[#1DB954]/10 rounded-full flex items-center justify-center text-[#1DB954]">
              <FolderUp className="w-6 h-6" />
            </div>
            <div>
              <p className="text-white font-medium text-sm">Drag & Drop Local Track Files</p>
              <p className="text-xs text-zinc-400 mt-1">Supports MP3, WAV, M4A, OGG up to 50MB</p>
            </div>
            <button
              id="browse-local-files"
              type="button"
              className="mt-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-semibold text-xs py-2 px-5 rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95"
            >
              Browse Files
            </button>
          </div>
        )}
      </div>

      {/* Connection notification */}
      {justUploaded.length > 0 && (
        <div id="upload-toast" className="bg-[#1DB954]/25 border border-[#1DB954] rounded-xl p-3 flex items-start space-x-2 text-xs text-white">
          <Check className="w-4 h-4 text-[#1DB954] shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-[#1DB954]">Successfully Sync'd Offline!</div>
            <div className="text-zinc-300 mt-0.5">Parsed and organized {justUploaded.length} local track(s).</div>
          </div>
        </div>
      )}

      {/* Local Track List Management */}
      <div className="bg-black/20 border border-white/5 rounded-2xl p-4">
        <h4 className="text-white text-xs font-semibold tracking-wider mb-3 uppercase flex items-center space-x-2">
          <Music className="w-4 h-4 text-[#1DB954]" />
          <span>Local Offline Audio Library ({localTracks.length})</span>
        </h4>

        {localTracks.length === 0 ? (
          <p className="text-zinc-500 text-xs py-4 text-center">
            No local offline files imported yet. Drag and drop audio files above to start!
          </p>
        ) : (
          <div className="max-h-60 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
            {localTracks.map((track) => {
              const isCurrent = currentTrack?.id === track.id;
              return (
                <div
                  key={track.id}
                  id={`local-item-${track.id}`}
                  className={`flex items-center justify-between p-2 rounded-lg group transition-all cursor-pointer ${
                    isCurrent ? "bg-[#1DB954]/10 border border-[#1DB954]/20" : "bg-white/5 hover:bg-white/10 border border-transparent"
                  }`}
                  onClick={() => handlePlayTrack(track)}
                >
                  <div className="flex items-center space-x-3 truncate flex-1">
                    <div className="w-8 h-8 rounded bg-zinc-800 flex items-center justify-center text-zinc-400 shrink-0 relative overflow-hidden">
                      {isCurrent && isPlaying ? (
                        <div className="absolute inset-0 bg-[#1DB954]/20 flex items-center justify-center text-[#1DB954]">
                          <Volume2 className="w-4 h-4 animate-bounce" />
                        </div>
                      ) : isCurrent ? (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-[#1DB954]">
                          <Play className="w-4 h-4" />
                        </div>
                      ) : (
                        <>
                          <Music className="w-4 h-4 group-hover:hidden" />
                          <Play className="w-4 h-4 text-white hidden group-hover:block" />
                        </>
                      )}
                    </div>
                    <div className="truncate">
                      <p className={`text-xs font-semibold truncate ${isCurrent ? "text-[#1DB954]" : "text-white"}`}>{track.name}</p>
                      <p className="text-zinc-400 text-[10px] truncate">{track.artist}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {Math.floor(track.duration / 60)}:{(track.duration % 60).toString().padStart(2, "0")}
                    </span>
                    <button
                      id={`delete-local-btn-${track.id}`}
                      onClick={() => handleDelete(track.id, track.name)}
                      className="p-1 rounded text-zinc-500 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all duration-250 cursor-pointer"
                      title="Remove File Offline"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
