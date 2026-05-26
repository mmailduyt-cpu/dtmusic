import React, { useEffect, useRef, useState } from 'react';
import { X, Upload, Music } from 'lucide-react';
import { LyricMode, Track } from '../types';

interface LyricLine {
  time: number;
  text: string;
}

interface LyricSectionProps {
  show: boolean;
  onClose: () => void;
  track: Track | null;
  currentTime: number;
  lyricLines: LyricLine[];
  lyricMode: LyricMode;
  onModeChange: (mode: LyricMode) => void;
  lyricSource: 'lrclib' | 'ai' | 'manual' | null;
  isLoading: boolean;
  onManualLyricUpload: (text: string) => void;
  onSeek?: (seconds: number) => void;
  inline?: boolean;
}

export default function LyricSection({
  show,
  onClose,
  track,
  currentTime,
  lyricLines,
  lyricMode,
  onModeChange,
  lyricSource,
  isLoading,
  onManualLyricUpload,
  onSeek,
  inline = false,
}: LyricSectionProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeIdx, setActiveIdx] = useState<number>(-1);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [pastedLyric, setPastedLyric] = useState('');

  // Synchronize dynamic highlighted lines
  useEffect(() => {
    if (!lyricLines.length) {
      setActiveIdx(-1);
      return;
    }

    let foundIdx = -1;
    for (let i = 0; i < lyricLines.length; i++) {
      if (lyricLines[i].time <= currentTime) {
        foundIdx = i;
      } else {
        break;
      }
    }

    setActiveIdx(foundIdx);
  }, [lyricLines, currentTime]);

  // Handle smooth auto centering scrolling
  useEffect(() => {
    if (!show || activeIdx === -1 || lyricMode === 'static') return;

    const body = bodyRef.current;
    if (!body) return;

    const activeEl = body.querySelector(`[data-line-idx="${activeIdx}"]`);
    if (activeEl) {
      activeEl.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeIdx, show, lyricMode]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        onManualLyricUpload(text);
      }
    };
    reader.readAsText(file);
  };

  if (!show) return null;

  return (
    <div
      id="lyric-section"
      className={`${inline ? 'w-full h-full' : 'absolute inset-0 z-40 bg-primary'} flex flex-col items-center overflow-hidden animate-in fade-in duration-200`}
    >
      {/* Lyric Header bar */}
      <div className="w-full flex items-center justify-between border-b border-border px-4 py-3 bg-secondary shrink-0">
        <div className="flex flex-col">
          <h3 className="text-sm font-semibold text-primary flex items-center gap-1.5">
            <Music className="w-4 h-4 text-accent" /> Lời bài hát DTMusic
          </h3>
          {track && (
            <p className="text-[10px] text-muted truncate max-w-[150px] sm:max-w-xs">
              {track.title} {track.artist ? `— ${track.artist}` : ''}
            </p>
          )}
        </div>

        {/* View Mode Switchers */}
        <div className="flex items-center gap-1.5">
          <div className="flex gap-1.5 bg-tertiary p-1 rounded-full border border-border">
            {(['static', 'scroll', 'karaoke'] as LyricMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => onModeChange(mode)}
                className={`text-[10px] px-3 py-1 rounded-full capitalize cursor-pointer font-medium transition-all ${
                  lyricMode === mode
                    ? 'bg-accent text-white font-semibold'
                    : 'text-muted hover:text-secondary'
                }`}
              >
                {mode === 'static' ? 'Tĩnh' : mode === 'scroll' ? 'Dòng trôi' : 'Karaoke'}
              </button>
            ))}
          </div>

          <button
            onClick={onClose}
            className="text-muted hover:text-primary transition-colors p-1 rounded-md hover:bg-hover"
            title="Đóng lyric"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Lyric Displays */}
      <div
        ref={bodyRef}
        id="lyric-body"
        className={`flex-1 w-full overflow-y-auto scrollbar-none ${inline ? 'px-4 py-4 pb-8' : 'px-6 py-12 pb-24'}`}
      >
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted text-xs animate-pulse">
            <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
            <span>Đang tìm kiếm lời bài hát tự động...</span>
          </div>
        ) : lyricLines.length > 0 ? (
          <div
            className={`w-full max-w-xl mx-auto space-y-6 ${
              lyricMode === 'static' ? 'lyric-static' : lyricMode === 'scroll' ? 'lyric-scroll' : 'lyric-karaoke'
            }`}
          >
            {lyricLines.map((line, idx) => {
              const isActive = idx === activeIdx;
              const isPrev = idx === activeIdx - 1;
              const isNext = idx === activeIdx + 1;

              const lineTime = line.time ?? 0;
              const nextLineTime = lyricLines[idx + 1]?.time ?? lineTime + 5;

              let textClass = 'text-center transition-all duration-300 ';
              if (lyricMode === 'static') {
                textClass += isActive
                  ? 'text-accent text-lg font-bold scale-102'
                  : 'text-muted text-base hover:text-secondary';
              } else if (lyricMode === 'scroll') {
                textClass += isActive
                  ? 'text-primary text-xl font-bold md:text-2xl scale-105'
                  : isPrev
                  ? 'text-secondary text-base font-medium opacity-80'
                  : isNext
                  ? 'text-secondary text-base font-medium opacity-80'
                  : 'text-muted text-sm opacity-50';
              } else {
                textClass += isActive
                  ? 'text-accent text-2xl font-extrabold md:text-3xl scale-110 drop-shadow-md'
                  : isPrev
                  ? 'text-secondary/50 text-base scale-95'
                  : isNext
                  ? 'text-secondary text-lg font-semibold'
                  : 'text-muted text-xs opacity-30';
              }

              // Karaoke word-by-word highlight
              const words = line.text.split(' ');
              const karaokeProgress = isActive && lyricMode === 'karaoke'
                ? Math.min(1, Math.max(0, (currentTime - lineTime) / Math.max(0.1, nextLineTime - lineTime)))
                : -1;

              return (
                <p
                  key={idx}
                  data-line-idx={idx}
                  onClick={() => {
                    if (onSeek && line.time !== undefined) {
                      onSeek(line.time);
                    }
                  }}
                  className={`${textClass} leading-relaxed py-1 block origin-center cursor-pointer hover:text-accent font-semibold transition-all duration-200 active:scale-95`}
                  title="Nhấp để nhảy nhạc đến đoạn này"
                >
                  {karaokeProgress >= 0 ? (
                    words.map((word, wi) => {
                      const wordProgress = (wi + 1) / words.length;
                      return (
                        <span
                          key={wi}
                          className={`transition-all duration-150 ${wordProgress <= karaokeProgress ? 'text-accent drop-shadow-[0_0_6px_var(--accent)] scale-105' : 'text-foreground/30'}`}
                        >
                          {word}{wi < words.length - 1 ? ' ' : ''}
                        </span>
                      );
                    })
                  ) : (
                    line.text
                  )}
                </p>
              );
            })}

            {/* Lyric Source Badge & Quick edit trigger */}
            <div className="w-full text-center pt-8 flex flex-col items-center gap-3">
              <span className="text-[10px] bg-tertiary border border-border text-muted px-2.5 py-1 rounded-full uppercase tracking-wider">
                {lyricSource === 'lrclib'
                  ? 'Nguồn lyrics: LRCLIB API'
                  : lyricSource === 'ai'
                  ? '✨ Sáng viết bởi Gemini AI'
                  : 'Nguồn lyrics: Thủ công tải lên/Nhập tay'}
              </span>

              <button
                onClick={() => {
                  setPastedLyric(lyricLines.map(l => l.text).join('\n'));
                  setIsFormOpen(true);
                }}
                className="text-[9.5px] font-bold text-accent hover:underline flex items-center gap-1.5 opacity-75 hover:opacity-100 cursor-pointer"
              >
                ✍️ Sửa đổi / dán lại lời bài hát
              </button>
            </div>
          </div>
        ) : isFormOpen ? (
          /* Inline Manual lyric copy paste box */
          <div className="w-full max-w-md mx-auto bg-secondary/80 border border-border p-5 rounded-2xl shadow-xl space-y-4 animate-in fade-in duration-200 mt-6 text-left">
            <h4 className="text-xs font-black uppercase text-accent tracking-wider flex items-center gap-1">
              <span>✍️</span> Nhập / Dán lời bài hát tự do
            </h4>
            <p className="text-[10.5px] text-muted leading-relaxed">
              Bạn có thể dán bất kỳ lời bài hát thô dạng văn bản xuôi nào ở đây (hoặc dán định dạng .lrc có chứa mốc thời gian [00:12.34]).
            </p>
            <textarea
              value={pastedLyric}
              onChange={(e) => setPastedLyric(e.target.value)}
              placeholder="Nhập lời bài hát dòng tiếp dòng tại đây..."
              className="w-full h-44 bg-primary border border-border rounded-xl p-3 text-xs text-primary focus:outline-none focus:border-accent font-medium leading-relaxed resize-none"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setIsFormOpen(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary hover:text-primary transition-all cursor-pointer border border-border"
              >
                Hủy bỏ
              </button>
              <button
                onClick={() => {
                  if (pastedLyric.trim()) {
                    onManualLyricUpload(pastedLyric.trim());
                    setIsFormOpen(false);
                  }
                }}
                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-accent text-white hover:bg-accent-dim transition-all cursor-pointer"
              >
                Lưu lời bài hát
              </button>
            </div>
          </div>
        ) : (
          /* Empty Lyric file upload view & Write option */
          <div className="h-full flex flex-col items-center justify-center p-8 text-center text-muted max-w-sm mx-auto">
            <div className="w-12 h-12 rounded-full bg-tertiary flex items-center justify-center mb-4 border border-border">
              <Upload className="w-6 h-6 text-secondary" />
            </div>
            <p className="text-sm font-semibold text-primary mb-1">Không tìm thấy lời bài hát tự động</p>
            <p className="text-xs mb-6 text-muted">
              Hệ thống không tìm thấy lyrics. Bạn có thể tải lên file .LRC/.TXT hoặc tự dán văn bản lời bài hát để hiển thị cuộn dọc.
            </p>

            <div className="flex flex-col sm:flex-row gap-2.5 w-full justify-center">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-xs font-bold px-4 py-2 border border-border hover:border-accent text-secondary hover:text-accent rounded-lg bg-hover transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" /> Tải tệp lên (.lrc, .txt)
              </button>
              <button
                onClick={() => {
                  setPastedLyric('');
                  setIsFormOpen(true);
                }}
                className="text-xs font-bold px-4 py-2 bg-accent text-white hover:bg-accent-dim rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                ✍️ Tự dán lời nhanh
              </button>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".lrc,.txt"
              className="hidden"
            />
          </div>
        )}
      </div>

      {/* Floating paste lyric modal backdrop */}
      {isFormOpen && lyricLines.length > 0 && (
        <div className="absolute inset-0 bg-primary/90 backdrop-blur-md z-50 p-6 flex items-center justify-center animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-secondary border border-border/80 p-5 rounded-2xl shadow-2xl space-y-4 text-left">
            <h4 className="text-xs font-black uppercase text-accent tracking-wider flex items-center gap-1.5">
              <span>✍️</span> Nhập / Dán lời bài hát tự do
            </h4>
            <p className="text-[10.5px] text-muted leading-relaxed">
              Dán bất kỳ lời bài hát thô dạng văn bản xuôi nào ở đây (hoặc dán định dạng .lrc có chứa mốc thời gian [00:12.34]).
            </p>
            <textarea
              value={pastedLyric}
              onChange={(e) => setPastedLyric(e.target.value)}
              placeholder="Nhập lời bài hát dòng tiếp dòng tại đây..."
              className="w-full h-44 bg-primary border border-border rounded-xl p-3 text-xs text-primary focus:outline-none focus:border-accent font-medium leading-relaxed resize-none"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setIsFormOpen(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-tertiary hover:text-primary transition-all cursor-pointer border border-border"
              >
                Hủy bỏ
              </button>
              <button
                onClick={() => {
                  if (pastedLyric.trim()) {
                    onManualLyricUpload(pastedLyric.trim());
                    setIsFormOpen(false);
                  }
                }}
                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-accent text-white hover:bg-accent-dim transition-all cursor-pointer"
              >
                Lưu lời bài hát
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
