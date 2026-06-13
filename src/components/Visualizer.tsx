import React, { useEffect, useRef, useState } from "react";
import { useAudioPlayer } from "../context/AudioPlayerContext";

type VisualizerMode = "radial" | "waveform" | "bars";

export const Visualizer: React.FC = () => {
  const { analyser, isPlaying } = useAudioPlayer();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [mode, setMode] = useState<VisualizerMode>("radial");
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resizeCanvas = () => {
      canvas.width = container.clientWidth * window.devicePixelRatio;
      canvas.height = container.clientHeight * window.devicePixelRatio;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      }
    };

    const observer = new ResizeObserver(() => {
      resizeCanvas();
    });

    observer.observe(container);
    resizeCanvas(); // initial

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let bufferLength = analyser ? analyser.frequencyBinCount : 128;
    let dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);

      const width = canvas.width / window.devicePixelRatio;
      const height = canvas.height / window.devicePixelRatio;

      // Draw background
      ctx.fillStyle = "rgba(18, 18, 18, 0.4)";
      ctx.fillRect(0, 0, width, height);

      if (analyser && isPlaying) {
        if (mode === "waveform") {
          analyser.getByteTimeDomainData(dataArray);
          
          ctx.lineWidth = 3;
          const grad = ctx.createLinearGradient(0, 0, width, 0);
          grad.addColorStop(0, "#1DB954");
          grad.addColorStop(0.5, "#a6ff1a");
          grad.addColorStop(1, "#1db999");
          ctx.strokeStyle = grad;
          ctx.shadowBlur = 15;
          ctx.shadowColor = "#1DB954";

          ctx.beginPath();
          const sliceWidth = width / bufferLength;
          let x = 0;

          for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0;
            const y = (v * height) / 2;

            if (i === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }

            x += sliceWidth;
          }

          ctx.lineTo(width, height / 2);
          ctx.stroke();
          ctx.shadowBlur = 0;
        } else if (mode === "radial") {
          analyser.getByteFrequencyData(dataArray);
          
          const centerX = width / 2;
          const centerY = height / 2;
          const baseRadius = Math.max(10, Math.min(width, height) * 0.25);

          let sum = 0;
          for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
          }
          const avg = sum / bufferLength;
          const pulse = (avg / 255) * 20;

          const radius = Math.max(5, baseRadius + pulse);

          const radialGrad = ctx.createRadialGradient(centerX, centerY, Math.max(0.1, radius * 0.5), centerX, centerY, radius);
          radialGrad.addColorStop(0, "rgba(29, 185, 84, 0.15)");
          radialGrad.addColorStop(1, "rgba(18, 18, 18, 0)");
          ctx.fillStyle = radialGrad;
          ctx.beginPath();
          ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
          ctx.fill();

          ctx.lineWidth = 2.5;
          ctx.strokeStyle = "#1DB954";
          ctx.shadowBlur = 20;
          ctx.shadowColor = "#1DB954";
          ctx.beginPath();

          const bars = Math.min(bufferLength, 80);
          for (let i = 0; i < bars; i++) {
            const angle = (i / bars) * Math.PI * 2;
            const val = dataArray[i];
            const length = (val / 255) * 60;

            const x1 = centerX + Math.cos(angle) * radius;
            const y1 = centerY + Math.sin(angle) * radius;
            const x2 = centerX + Math.cos(angle) * (radius + length);
            const y2 = centerY + Math.sin(angle) * (radius + length);

            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
          }
          ctx.stroke();
          ctx.shadowBlur = 0;

          ctx.lineWidth = 1;
          ctx.strokeStyle = "rgba(166, 255, 26, 0.4)";
          ctx.beginPath();
          ctx.arc(centerX, centerY, Math.max(0.1, radius - 4), 0, Math.PI * 2);
          ctx.stroke();

        } else if (mode === "bars") {
          analyser.getByteFrequencyData(dataArray);
          
          const barWidth = (width / bufferLength) * 2.5;
          let barHeight;
          let x = 0;

          ctx.shadowBlur = 10;
          ctx.shadowColor = "#1DB954";

          for (let i = 0; i < bufferLength; i++) {
            barHeight = (dataArray[i] / 255) * (height * 0.7);

            const r = 29;
            const g = Math.floor(185 + (i / bufferLength) * 70);
            const b = Math.floor(84 - (i / bufferLength) * 50);

            ctx.fillStyle = `rgb(${r},${g},${b})`;
            ctx.fillRect(x, height - barHeight, barWidth - 2, barHeight);

            x += barWidth;
          }
          ctx.shadowBlur = 0;
        }
      } else {
        const time = Date.now() * 0.001;
        ctx.lineWidth = 2;
        ctx.strokeStyle = "rgba(255, 255, 255, 0.07)";
        ctx.beginPath();
        for (let x = 0; x < width; x++) {
          const y = height / 2 + Math.sin(x * 0.01 + time) * 15 + Math.cos(x * 0.005 - time) * 10;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        ctx.strokeStyle = "rgba(29, 185, 84, 0.15)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(width / 2, height / 2, Math.max(0.1, Math.min(width, height) * 0.28), 0, Math.PI * 2);
        ctx.stroke();
      }
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [analyser, isPlaying, mode]);

  return (
    <div id="visualizer-container" ref={containerRef} className="relative w-full h-48 sm:h-64 rounded-2xl overflow-hidden bg-black/40 border border-white/5 shadow-2xl backdrop-blur-md flex flex-col justify-end">
      <canvas ref={canvasRef} className="w-full h-full block" />
      
      <div id="visualizer-mode-selector" className="absolute top-3 right-3 flex items-center space-x-1 bg-black/60 p-1 rounded-full border border-white/10 text-[10px] sm:text-xs z-10 backdrop-blur-md">
        <button
          onClick={() => setMode("radial")}
          className={`px-3 py-1 rounded-full transition-all duration-300 font-medium ${
            mode === "radial"
              ? "bg-[#1DB954] text-black shadow-lg"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          Radial
        </button>
        <button
          onClick={() => setMode("waveform")}
          className={`px-3 py-1 rounded-full transition-all duration-300 font-medium ${
            mode === "waveform"
              ? "bg-[#1DB954] text-black shadow-lg"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          Waveform
        </button>
        <button
          onClick={() => setMode("bars")}
          className={`px-3 py-1 rounded-full transition-all duration-300 font-medium ${
            mode === "bars"
              ? "bg-[#1DB954] text-black shadow-lg"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          Spectrum
        </button>
      </div>

      <div className="absolute top-3 left-4 text-xs font-medium text-zinc-500 font-mono tracking-wider pointer-events-none select-none">
        REAL-TIME ANALYZER
      </div>
    </div>
  );
};
