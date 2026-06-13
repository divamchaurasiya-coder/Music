import React from "react";
import { useAudioPlayer } from "../context/AudioPlayerContext";
import { Sliders, Volume2 } from "lucide-react";

interface Preset {
  name: string;
  gains: number[];
}

const PRESETS: Preset[] = [
  { name: "Flat", gains: [0, 0, 0, 0, 0] },
  { name: "Bass Boost", gains: [8, 5, 1, 0, 0] },
  { name: "Vocal", gains: [-2, 1, 6, 4, -1] },
  { name: "Warm", gains: [4, 2, 0, 1, 3] },
  { name: "Treble Boost", gains: [-1, 0, 1, 5, 8] },
  { name: "Electronic", gains: [6, 2, -1, 3, 5] },
];

const BAND_LABELS = ["Sub-Bass (60Hz)", "Bass (230Hz)", "Midrange (910Hz)", "Presence (4kHz)", "Brilliance (14kHz)"];

export const Equalizer: React.FC = () => {
  const { eqGains, updateEqGain } = useAudioPlayer();

  const applyPreset = (presetGains: number[]) => {
    presetGains.forEach((gain, idx) => {
      updateEqGain(idx, gain);
    });
  };

  // Compute a SVG path representing the continuous EQ response curve for modern visualization
  const getCurvePath = () => {
    const width = 280;
    const height = 80;
    const padding = 20;
    const usableWidth = width - padding * 2;
    const centerY = height / 2;
    
    // Scale gain (-12dB to +12dB) to Y coordinates
    const scaleY = (db: number) => {
      const maxDb = 12;
      const normalized = -db / maxDb; // invert because SVG y increases downwards
      return centerY + (normalized * (height - 24)) / 2;
    };

    const points = eqGains.map((gain, index) => {
      const x = padding + (index / (eqGains.length - 1)) * usableWidth;
      const y = scaleY(gain);
      return { x, y };
    });

    if (points.length === 0) return "";

    // Build cubic bezier curve through points
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cpX1 = p0.x + (p1.x - p0.x) / 3;
      const cpY1 = p0.y;
      const cpX2 = p0.x + (2 * (p1.x - p0.x)) / 3;
      const cpY2 = p1.y;
      d += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${p1.x} ${p1.y}`;
    }
    return d;
  };

  return (
    <div id="equalizer-card" className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-md shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Sliders id="eq-icon-sliders" className="w-5 h-5 text-[#1DB954]" />
          <h3 className="font-semibold text-white text-sm tracking-wider">PRO 5-BAND EQUALIZER</h3>
        </div>
        <span className="text-[10px] text-zinc-500 font-mono">12dB / -12dB</span>
      </div>

      {/* Modern EQ Curve path visualization */}
      <div id="eq-curve-visualization" className="w-full bg-black/40 rounded-xl p-2 border border-white/5 mb-5 flex justify-center">
        <svg width="280" height="80" className="overflow-visible">
          {/* Grid lines */}
          <line x1="10" y1="40" x2="270" y2="40" stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
          <line x1="10" y1="20" x2="270" y2="20" stroke="rgba(255,255,255,0.03)" />
          <line x1="10" y1="60" x2="270" y2="60" stroke="rgba(255,255,255,0.03)" />
          
          {/* Curve fill for ambient glow */}
          <path
            d={`${getCurvePath()} L 260 80 L 20 80 Z`}
            fill="url(#eq-glow-grad)"
            className="transition-all duration-300 ease-out"
          />

          {/* Core Curve */}
          <path
            d={getCurvePath()}
            fill="none"
            stroke="#1DB954"
            strokeWidth="3"
            className="transition-all duration-300 ease-out"
          />

          {/* Individual Band Points */}
          {eqGains.map((gain, index) => {
            const width = 280;
            const height = 80;
            const padding = 20;
            const usableWidth = width - padding * 2;
            const x = padding + (index / (eqGains.length - 1)) * usableWidth;
            const centerY = height / 2;
            const maxDb = 12;
            const y = centerY + ((-gain / maxDb) * (height - 24)) / 2;

            return (
              <circle
                key={index}
                cx={x}
                cy={y}
                r="4.5"
                fill="#ffffff"
                stroke="#1DB954"
                strokeWidth="2.5"
                className="transition-all duration-300 ease-out shadow-lg"
              />
            );
          })}

          <defs>
            <linearGradient id="eq-glow-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(29, 185, 84, 0.25)" />
              <stop offset="100%" stopColor="rgba(29, 185, 84, 0)" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Preset Pickers */}
      <div id="eq-preset-list" className="grid grid-cols-3 gap-1.5 mb-5">
        {PRESETS.map((p) => {
          const isCurrent = eqGains.every((v, i) => v === p.gains[i]);
          return (
            <button
              key={p.name}
              id={`preset-btn-${p.name.replace(/\s+/g, '-').toLowerCase()}`}
              onClick={() => applyPreset(p.gains)}
              className={`text-[10px] py-1 px-2 rounded-md transition-all duration-200 font-medium ${
                isCurrent
                  ? "bg-[#1DB954]/20 border border-[#1DB954] text-[#1DB954]"
                  : "bg-white/5 border border-transparent text-zinc-400 hover:text-white hover:bg-white/10"
              }`}
            >
              {p.name}
            </button>
          );
        })}
      </div>

      {/* Equalizer Frequency Sliders */}
      <div id="eq-sliders-grid" className="flex justify-between items-center px-1">
        {eqGains.map((gain, index) => (
          <div key={index} className="flex flex-col items-center space-y-2.5 h-36">
            <span className="text-[9px] text-zinc-500 font-mono font-bold tracking-tighter">
              {gain > 0 ? `+${gain}` : gain}
            </span>
            <div className="relative group w-3 flex-1 flex justify-center bg-black/40 rounded-full overflow-visible border border-white/5">
              <input
                type="range"
                id={`eq-band-${index}`}
                min="-12"
                max="12"
                step="1"
                value={gain}
                onChange={(e) => updateEqGain(index, parseInt(e.target.value))}
                className="absolute inset-0 cursor-ns-resize opacity-0 orientation-vertical w-full h-full"
                style={{ WebkitAppearance: "slider-vertical" }}
              />
              <div
                className="absolute bottom-0 w-1.5 bg-gradient-to-t from-[#1DB954] to-[#a6ff1a] rounded-full"
                style={{ height: `${((gain + 12) / 24) * 100}%` }}
              />
              <div
                className="absolute w-3 h-3 bg-white border border-[#1DB954] rounded-full shadow-md cursor-pointer transition-all duration-75"
                style={{ bottom: `calc(${((gain + 12) / 24) * 100}% - 6px)` }}
              />
            </div>
            <span className="text-[8px] text-zinc-400 font-mono w-10 text-center truncate select-none">
              {["60Hz", "230Hz", "910Hz", "4kHz", "14kHz"][index]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
