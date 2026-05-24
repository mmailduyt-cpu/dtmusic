import { X } from 'lucide-react';
import { EQPreset, EQ_BANDS, EQ_PRESETS } from '../types';

interface EQPanelProps {
  show: boolean;
  onClose: () => void;
  gains: number[];
  onGainChange: (index: number, value: number) => void;
  activePreset: EQPreset;
  onPresetChange: (preset: EQPreset) => void;
  bassBoost: number;
  onBassBoostChange: (value: number) => void;
  vocalClarity: number;
  onVocalClarityChange: (value: number) => void;
  surround3D: number;
  onSurround3DChange: (value: number) => void;
  compressorEnabled: boolean;
  onCompressorToggle: () => void;
}

export default function EQPanel({
  show,
  onClose,
  gains,
  onGainChange,
  activePreset,
  onPresetChange,
  bassBoost,
  onBassBoostChange,
  vocalClarity,
  onVocalClarityChange,
  surround3D,
  onSurround3DChange,
  compressorEnabled,
  onCompressorToggle,
}: EQPanelProps) {
  if (!show) return null;

  return (
    <div
      id="eq-panel"
      className="absolute top-14 right-4 md:right-14 z-50 bg-secondary border border-border/80 rounded-2xl p-4.5 w-[290px] shadow-2xl animate-in fade-in slide-in-from-top-4 duration-200"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[13px] font-black text-primary flex items-center gap-1.5 uppercase tracking-wide">
          🎛️ BỘ CHỈNH ÂM CAO CẤP
        </h3>
        <button
          onClick={onClose}
          className="text-muted hover:text-primary transition-colors p-1 rounded-md hover:bg-hover cursor-pointer"
          title="Đóng EQ"
          id="eq-close-btn"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Presets List */}
      <div className="flex flex-wrap gap-1.5 mb-4 border-b border-border/30 pb-3">
        {(Object.keys(EQ_PRESETS) as EQPreset[]).map((p) => (
          <button
            key={p}
            onClick={() => onPresetChange(p)}
            className={`text-[9.5px] px-2.5 py-1 rounded-full border transition-all cursor-pointer capitalize font-bold ${
              activePreset === p
                ? 'bg-accent/15 border-accent text-accent'
                : 'border-border text-muted hover:border-border-hover hover:text-secondary'
            }`}
          >
            {p === 'flat' ? 'mặc định' : p === 'tiktok' ? 'remix tiktok' : p === 'bass' ? 'bass nặng' : 'phòng thu'}
          </button>
        ))}
      </div>

      {/* Sliders BANDS */}
      <div className="space-y-2.5 pb-4.5 border-b border-border/30">
        <div className="text-[9.5px] font-extrabold uppercase tracking-widest text-muted mb-1.5">Tần số chính (5-Band EQ)</div>
        {EQ_BANDS.map((band, i) => {
          const currentGain = gains[i] !== undefined ? gains[i] : 0;
          return (
            <div key={band.freq} className="flex items-center gap-3">
              <label className="text-[10px] font-bold text-secondary w-[80px] truncate">
                {band.label}
              </label>
              <input
                type="range"
                min="-12"
                max="12"
                step="1"
                value={currentGain}
                onChange={(e) => onGainChange(i, parseInt(e.target.value))}
                className="flex-1 h-[3px] accent-accent rounded-lg cursor-pointer bg-border-hover slider-custom"
                style={{
                  background: `linear-gradient(to right, var(--accent) ${
                    ((currentGain + 12) / 24) * 100
                  }%, var(--bg-tertiary) ${((currentGain + 12) / 24) * 100}%)`,
                }}
              />
              <span className="text-[9.5px] font-mono text-muted w-[30px] text-right font-semibold">
                {currentGain > 0 ? `+${currentGain}` : currentGain}dB
              </span>
            </div>
          );
        })}
      </div>

      {/* Kỹ Thuật Âm Thanh Cao Cấp */}
      <div className="my-4 space-y-4">
        <h4 className="text-[10.5px] font-extrabold uppercase text-accent tracking-wider flex items-center gap-1">
          <span>✨</span> CHẤT ÂM TIKTOK / AUDIOPHILE
        </h4>

        {/* Super Bass Slide */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px] font-bold">
            <span className="text-secondary flex items-center gap-1 text-[9.5px] uppercase tracking-wide">
              🔊 Siêu trầm Bass TikTok
            </span>
            <span className="font-mono text-accent font-black">
              {bassBoost}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={bassBoost}
            onChange={(e) => onBassBoostChange(parseInt(e.target.value))}
            className="w-full h-[3px] accent-accent rounded-lg cursor-pointer bg-border-hover"
            style={{
              background: `linear-gradient(to right, var(--accent) ${bassBoost}%, var(--bg-tertiary) ${bassBoost}%)`,
            }}
          />
          <p className="text-[8.5px] text-muted leading-tight font-medium">
            Kích dải âm trầm sâu lắng, nén bóng bẩy không làm bể loa.
          </p>
        </div>

        {/* Vocal Clarity Slide */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px] font-bold">
            <span className="text-secondary flex items-center gap-1 text-[9.5px] uppercase tracking-wide">
              🎙️ Sáng giọng ca sĩ (Clarity)
            </span>
            <span className="font-mono text-accent font-black">
              {vocalClarity}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={vocalClarity}
            onChange={(e) => onVocalClarityChange(parseInt(e.target.value))}
            className="w-full h-[3px] accent-accent rounded-lg cursor-pointer bg-border-hover"
            style={{
              background: `linear-gradient(to right, var(--accent) ${vocalClarity}%, var(--bg-tertiary) ${vocalClarity}%)`,
            }}
          />
          <p className="text-[8.5px] text-muted leading-tight font-medium">
            Lọc tiếng ca sĩ trong vắt, dải cao (Treble) sáng nét lôi cuốn.
          </p>
        </div>

        {/* Surround 3D Stereo Slide */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px] font-bold">
            <span className="text-secondary flex items-center gap-1 text-[9.5px] uppercase tracking-wide">
              🎧 Sân khấu vòm 3D Surround
            </span>
            <span className="font-mono text-accent font-black">
              {surround3D}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={surround3D}
            onChange={(e) => onSurround3DChange(parseInt(e.target.value))}
            className="w-full h-[3px] accent-accent rounded-lg cursor-pointer bg-border-hover"
            style={{
              background: `linear-gradient(to right, var(--accent) ${surround3D}%, var(--bg-tertiary) ${surround3D}%)`,
            }}
          />
          <p className="text-[8.5px] text-muted leading-tight font-medium">
            Bộ trễ Haas 3D Stereo mở rộng chiều rộng âm trường cực đã qua tai nghe.
          </p>
        </div>

        {/* Smart AGC Compressor Switch */}
        <div className="flex items-center justify-between bg-primary/45 p-2 rounded-xl border border-border/55">
          <div className="flex flex-col min-w-0 pr-2">
            <span className="text-[9.5px] font-extrabold text-primary uppercase">💿 Bộ nén Studio thích ứng (AGC)</span>
            <span className="text-[8.5px] text-muted leading-snug">Kết dính các dải tần dày dặn, ngăn chặn méo rè vỡ âm.</span>
          </div>
          <button
            onClick={onCompressorToggle}
            className={`px-3 py-1 text-[9.5px] font-black uppercase tracking-wider rounded-lg border transition-all cursor-pointer ${
              compressorEnabled
                ? 'bg-accent/15 border-accent text-accent'
                : 'border-border text-muted hover:text-secondary'
            }`}
          >
            {compressorEnabled ? 'BẬT' : 'TẮT'}
          </button>
        </div>
      </div>
    </div>
  );
}
