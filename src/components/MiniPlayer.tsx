import { Play, Pause, Disc } from 'lucide-react';
import { Track } from '../types';

interface MiniPlayerProps {
  show: boolean;
  track: Track | null;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onRestoreView: () => void;
}

export default function MiniPlayer({
  show,
  track,
  isPlaying,
  onTogglePlay,
  onRestoreView,
}: MiniPlayerProps) {
  if (!show || !track) return null;

  return (
    <div
      id="mini-player"
      onClick={onRestoreView}
      className="fixed bottom-[104px] right-4 z-50 bg-secondary border border-border rounded-2xl p-2.5 flex items-center gap-3.5 shadow-xl hover:border-border-hover cursor-pointer transition-all animate-in slide-in-from-bottom-5 duration-200 w-[240px]"
    >
      {/* Mini Cover Art */}
      <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 bg-tertiary border border-border flex items-center justify-center">
        {track.art ? (
          <img src={track.art} alt={track.title} className="w-full h-full object-cover" />
        ) : (
          <Disc className="w-5 h-5 text-muted animate-spin" style={{ animationDuration: '6s' }} />
        )}
      </div>

      {/* Title & Artist */}
      <div className="flex-1 min-width-0">
        <h4 className="text-xs font-semibold text-primary truncate max-w-[130px]">{track.title}</h4>
        <p className="text-[10px] text-muted truncate max-w-[130px]">
          {track.artist || (track.source === 'local' ? 'File cục bộ' : track.source)}
        </p>
      </div>

      {/* Mini Toggle Play Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onTogglePlay();
        }}
        className="w-8 h-8 rounded-full bg-accent/10 hover:bg-accent/20 border border-accent/25 flex items-center justify-center text-accent transition-all cursor-pointer shrink-0"
        title="Phát/Dừng"
      >
        {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
      </button>
    </div>
  );
}
