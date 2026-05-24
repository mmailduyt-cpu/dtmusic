export interface LyricLine {
  time: number; // in seconds
  text: string;
}

export interface LyricData {
  synced?: string | null;
  plain?: string | null;
  source?: 'lrclib' | 'ai' | 'manual' | null;
}

export interface Track {
  id: string;
  source: 'local' | 'R2' | 'Drive' | 'Dropbox' | 'OneDrive' | 'URL';
  title: string;
  artist: string;
  album?: string;
  duration?: number;
  art?: string | null; // Cover art URL or base64 string
  url?: string; // Audio URL (can be stream link, object URL, etc.)
  missing?: boolean;
  lyricData?: LyricData | null;
}

export interface CloudConfig {
  r2BucketUrl?: string;
}

export type LyricMode = 'static' | 'scroll' | 'karaoke';

export type EQPreset = 'flat' | 'tiktok' | 'bass' | 'studio';

export interface EQBand {
  freq: number;
  label: string;
}

export const EQ_BANDS: EQBand[] = [
  { freq: 80, label: 'Bass (80Hz)' },
  { freq: 250, label: 'Low mid (250Hz)' },
  { freq: 1000, label: 'Mid (1kHz)' },
  { freq: 4000, label: 'High mid (4kHz)' },
  { freq: 12000, label: 'Treble (12kHz)' },
];

export const EQ_PRESETS: Record<EQPreset, number[]> = {
  flat: [0, 0, 0, 0, 0],
  tiktok: [4, 2, 1, 3, 5],
  bass: [8, 4, 0, -1, -2],
  studio: [2, 1, 0, 2, 3],
};
