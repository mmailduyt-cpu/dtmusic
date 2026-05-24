import { useEffect, useRef } from 'react';

interface VisualizerProps {
  analyser: AnalyserNode | null;
  isPlaying: boolean;
}

export default function Visualizer({ analyser, isPlaying }: VisualizerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameId = useRef<number | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    // Handle canvas resizing gracefully
    const handleResize = () => {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    };

    const observer = new ResizeObserver(() => {
      handleResize();
    });
    observer.observe(container);
    handleResize();

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Drawing process
    const renderFrame = () => {
      animationFrameId.current = requestAnimationFrame(renderFrame);

      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      if (!analyser) {
        if (!isPlaying) {
          // Draw standard subtle idle wave
          ctx.beginPath();
          ctx.strokeStyle = 'rgba(167, 139, 250, 0.15)'; // Tailwind violet-400
          ctx.lineWidth = 2;
          ctx.moveTo(0, height / 2);
          for (let i = 0; i < width; i++) {
            const y = height / 2 + Math.sin(i * 0.02 + Date.now() * 0.001) * 2;
            ctx.lineTo(i, y);
          }
          ctx.stroke();
          return;
        }

        // Draw multiple beautiful, dynamic simulated waveforms representing active cloud stream action
        const time = Date.now() * 0.003;
        const waves = [
          { freq: 0.012, amp: height * 0.35, speed: 1.2, color: 'rgba(167, 139, 250, 0.6)' }, // violet-400
          { freq: 0.022, amp: height * 0.25, speed: -0.9, color: 'rgba(216, 180, 254, 0.4)' }, // purple-300
          { freq: 0.007, amp: height * 0.20, speed: 1.8, color: 'rgba(124, 58, 237, 0.3)' }   // violet-600
        ];

        waves.forEach((w) => {
          ctx.beginPath();
          ctx.strokeStyle = w.color;
          ctx.lineWidth = 2;
          ctx.moveTo(0, height / 2);
          for (let i = 0; i < width; i++) {
            const y = height / 2 + Math.sin(i * w.freq + time * w.speed) * w.amp;
            ctx.lineTo(i, y);
          }
          ctx.stroke();
        });
        return;
      }

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyser.getByteFrequencyData(dataArray);

      // Render vertical equalizer visualizer bars
      const barWidth = (width / bufferLength) * 2.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const value = dataArray[i];
        const barHeight = (value / 255) * height * 0.95;

        // Gradient coloring matching the violet theme
        const gradient = ctx.createLinearGradient(0, height, 0, height - barHeight);
        gradient.addColorStop(0, 'rgba(124, 58, 237, 0.45)');   // violet-600
        gradient.addColorStop(0.5, 'rgba(167, 139, 250, 0.7)'); // violet-400
        gradient.addColorStop(1, 'rgba(216, 180, 254, 0.95)');  // purple-300

        ctx.fillStyle = gradient;
        ctx.fillRect(x, height - barHeight, barWidth - 1, barHeight);

        x += barWidth;
      }
    };

    renderFrame();

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [analyser, isPlaying]);

  return (
    <div id="visualizer-container" ref={containerRef} className="absolute inset-x-0 bottom-0 h-20 opacity-40 pointer-events-none z-10 overflow-hidden">
      <canvas id="visualizer" ref={canvasRef} className="w-full h-full block" />
    </div>
  );
}
