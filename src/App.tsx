import React, { useEffect, useRef, useState, ChangeEvent } from 'react';
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Shuffle,
  RotateCcw,
  Volume2,
  VolumeX,
  SlidersHorizontal,
  Disc,
  Languages,
  Moon,
  Sun,
  Music4,
  Sparkles
} from 'lucide-react';
import Sidebar from './components/Sidebar';
import EQPanel from './components/EQPanel';
import LyricSection from './components/LyricSection';
import MiniPlayer from './components/MiniPlayer';
import Visualizer from './components/Visualizer';

import { Track, EQPreset, EQ_BANDS, EQ_PRESETS, LyricMode, LyricLine } from './types';

export default function App() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(70);
  const [isMuted, setIsMuted] = useState(false);

  // EQ State
  const [showEQ, setShowEQ] = useState(false);
  const [activePreset, setActivePreset] = useState<EQPreset>('flat');
  const [eqGains, setEqGains] = useState<number[]>([0, 0, 0, 0, 0]);

  // Audio Enhancer States
  const [bassBoost, setBassBoost] = useState<number>(() => {
    const saved = localStorage.getItem('dt_bass_boost');
    return saved ? parseInt(saved) : 35; // Default is a warm boost (35%)
  });
  const [vocalClarity, setVocalClarity] = useState<number>(() => {
    const saved = localStorage.getItem('dt_vocal_clarity');
    return saved ? parseInt(saved) : 25; // Default is a crisp voice (25%)
  });
  const [surround3D, setSurround3D] = useState<number>(() => {
    const saved = localStorage.getItem('dt_surround_3d');
    return saved ? parseInt(saved) : 20; // Default is room surround (20%)
  });
  const [compressorEnabled, setCompressorEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('dt_compressor_enabled');
    return saved !== 'false'; // Default is true
  });

  // Playback Control States
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<0 | 1 | 2>(0); // 0 = no repeat, 1 = repeat all, 2 = repeat one

  // Lyric States
  const [showLyrics, setShowLyrics] = useState(false);
  const [lyricMode, setLyricMode] = useState<LyricMode>('scroll');
  const [lyricLines, setLyricLines] = useState<LyricLine[]>([]);
  const [lyricSource, setLyricSource] = useState<'lrclib' | 'ai' | 'manual' | null>(null);
  const [lyricLoading, setLyricLoading] = useState(false);

  // App Theme State
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  
  // Custom Dynamic Accent state
  const [accent, setAccent] = useState<string>(() => {
    return localStorage.getItem('snhac_accent') || 'violet';
  });

  // Background Customizer States
  const [bgType, setBgType] = useState<string>(() => localStorage.getItem('dt_bg_type') || 'preset');
  const [bgValue, setBgValue] = useState<string>(() => {
    return localStorage.getItem('dt_bg_value') || 'https://images.unsplash.com/photo-1518156677180-95a2893f3e9f?q=80&w=1920';
  });
  const [bgOpacity, setBgOpacity] = useState<number>(() => {
    const saved = localStorage.getItem('dt_bg_opacity');
    return saved ? parseFloat(saved) : 0.35;
  });
  const [showThemePanel, setShowThemePanel] = useState<boolean>(false);

  // Memory store for local File objects to stream on active session
  const [localFilesMap, setLocalFilesMap] = useState<Record<string, File>>({});

  // Toast System
  const [toast, setToast] = useState<{ show: boolean; msg: string }>({ show: false, msg: '' });
  const toastTimeoutRef = useRef<number | null>(null);

  // Refs for permanent Audio persistence
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const localAudioRef = useRef<HTMLAudioElement | null>(null);
  const cloudAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const filtersRef = useRef<BiquadFilterNode[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  // Advanced DSP Audio Enhancer nodes
  const bassFilterRef = useRef<BiquadFilterNode | null>(null);
  const trebleFilterRef = useRef<BiquadFilterNode | null>(null);
  const delayNodeRef = useRef<DelayNode | null>(null);
  const compressorNodeRef = useRef<DynamicsCompressorNode | null>(null);

  const prevObjectURLRef = useRef<string | null>(null);
  const bgUploadRef = useRef<HTMLInputElement>(null);

  const handleBgUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (prevObjectURLRef.current && prevObjectURLRef.current.startsWith('blob:')) {
        URL.revokeObjectURL(prevObjectURLRef.current);
      }
      const url = URL.createObjectURL(file);
      prevObjectURLRef.current = url;
      setBgType('custom');
      setBgValue(url);
      showToast('🌅 Đã tải ảnh nền của bạn thành công!');
    }
  };

  // Display Toast helper
  const showToast = (msg: string) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToast({ show: true, msg });
    toastTimeoutRef.current = window.setTimeout(() => {
      setToast({ show: false, msg: '' });
    }, 3000);
  };

  // Accent colors configuration mapping
  const accentColors: Record<string, { primary: string; dim: string; glow: string; glowStrong: string }> = {
    violet: {
      primary: '#a78bfa',
      dim: '#7c5cbf',
      glow: 'rgba(167, 139, 250, 0.18)',
      glowStrong: 'rgba(167, 139, 250, 0.45)'
    },
    emerald: {
      primary: '#10b981',
      dim: '#059669',
      glow: 'rgba(16, 185, 129, 0.18)',
      glowStrong: 'rgba(16, 185, 129, 0.45)'
    },
    amber: {
      primary: '#f59e0b',
      dim: '#d97706',
      glow: 'rgba(245, 158, 11, 0.18)',
      glowStrong: 'rgba(245, 158, 11, 0.45)'
    },
    rose: {
      primary: '#f43f5e',
      dim: '#e11d48',
      glow: 'rgba(244, 63, 94, 0.18)',
      glowStrong: 'rgba(244, 63, 94, 0.45)'
    },
    cyan: {
      primary: '#06b6d4',
      dim: '#0891b2',
      glow: 'rgba(6, 182, 212, 0.18)',
      glowStrong: 'rgba(6, 182, 212, 0.45)'
    }
  };

  // Sync style properties of Accent selections dynamically
  useEffect(() => {
    const colors = accentColors[accent] || accentColors.violet;
    document.documentElement.style.setProperty('--accent', colors.primary);
    document.documentElement.style.setProperty('--accent-dim', colors.dim);
    document.documentElement.style.setProperty('--accent-glow', colors.glow);
    document.documentElement.style.setProperty('--accent-glow-strong', colors.glowStrong);
    localStorage.setItem('snhac_accent', accent);
  }, [accent]);

  // Sync background settings to local storage
  useEffect(() => {
    localStorage.setItem('dt_bg_type', bgType);
    localStorage.setItem('dt_bg_value', bgValue);
    localStorage.setItem('dt_bg_opacity', bgOpacity.toString());
  }, [bgType, bgValue, bgOpacity]);

  // Sync Audio Enhancer settings to local storage
  useEffect(() => {
    localStorage.setItem('dt_bass_boost', bassBoost.toString());
    localStorage.setItem('dt_vocal_clarity', vocalClarity.toString());
    localStorage.setItem('dt_surround_3d', surround3D.toString());
    localStorage.setItem('dt_compressor_enabled', compressorEnabled.toString());
  }, [bassBoost, vocalClarity, surround3D, compressorEnabled]);

  // Restore Theme & Storage Playlist on mount
  useEffect(() => {
    // Theme configuration
    const savedTheme = localStorage.getItem('snhac_theme') as 'dark' | 'light' | null;
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.setAttribute('data-theme', savedTheme);
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
    }

    // Playlist loading
    const savedPlaylist = localStorage.getItem('snhac_playlist');
    if (savedPlaylist) {
      try {
        const parsed = JSON.parse(savedPlaylist) as Track[];
        // Mark all local files as missing originally on cold start
        const mapped = parsed.map((t) => {
          if (t.source === 'local') {
            return { ...t, missing: true };
          }
          return t;
        });
        setTracks(mapped);
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  // Save changes to local storage whenever tracklists adapt
  const savePlaylist = (updated: Track[]) => {
    setTracks(updated);
    // Strip file streams or lost object values before serializing
    const serializable = updated.map(({ id, source, title, artist, album, duration, art, url, missing, lyricData }) => ({
      id,
      source,
      title,
      artist,
      album,
      duration,
      art,
      url,
      missing,
      lyricData,
    }));
    localStorage.setItem('snhac_playlist', JSON.stringify(serializable));
  };

  // Initialize the native Audio instance ONCE on mount (Solves multi-context failures)
  useEffect(() => {
    const localAudio = new Audio();
    localAudio.crossOrigin = 'anonymous';
    localAudio.preload = 'metadata';
    localAudioRef.current = localAudio;

    const cloudAudio = new Audio();
    cloudAudio.preload = 'metadata';
    cloudAudioRef.current = cloudAudio;

    audioRef.current = localAudio;

    return () => {
      localAudio.pause();
      localAudio.src = '';
      cloudAudio.pause();
      cloudAudio.src = '';
      if (prevObjectURLRef.current) {
        URL.revokeObjectURL(prevObjectURLRef.current);
      }
    };
  }, []);

  // Sync listener callbacks to the persistent Audio element
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const onLoadedMetadata = () => {
      setDuration(audio.duration || 0);
    };

    const onEnded = () => {
      handleTrackEnded();
    };

    const onError = (e: any) => {
      console.error("Audio core error emitted:", e);
      
      const audioObj = audioRef.current;
      if (!audioObj) return;

      if (audioObj.crossOrigin === 'anonymous') {
        console.warn("CORS policy blocked direct access. Retrying in safe legacy streaming mode...");
        audioObj.crossOrigin = ''; // Reset CORS header settings
        
        // Reload source with fresh headers configuration
        const srcBackup = audioObj.src;
        audioObj.src = '';
        audioObj.load();
        
        audioObj.src = srcBackup;
        audioObj.load();
        
        audioObj.play()
          .then(() => {
            setIsPlaying(true);
            showToast('🎵 Chế độ tương thích: Đang phát (EQ & Visualizer tạm tắt cho nguồn trực tuyến này).');
          })
          .catch((retryErr) => {
            console.error("Safe mode fallback failure:", retryErr);
            showToast('❌ Lỗi liên kết: Link nhạc không phản hồi hoặc đã thay đổi mã bảo mật.');
            setIsPlaying(false);
          });
        return;
      }

      // Ensure we only emit CORS or faulty-link message when a valid stream is active
      if (audioObj.src && audioObj.src !== window.location.href) {
        showToast('❌ Không thể phát file âm thanh này. Hãy kiểm tra lại liên kết đám mây.');
      }
      setIsPlaying(false);
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
  }, [tracks, currentTrackIndex, repeatMode, isShuffle]);

  // Maintain Live Equalizer Node graph
  const initAudioGraph = () => {
    const audio = audioRef.current;
    if (!audio) return;

    // Do not re-create if the context is already running
    if (audioContextRef.current) return;

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    try {
      const ctx = new AudioContextClass();
      audioContextRef.current = ctx;

      const srcNode = ctx.createMediaElementSource(audio);
      sourceNodeRef.current = srcNode;

      // Analyser Node for visual spectrum
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128; // standard density
      analyserRef.current = analyser;

      // Volume Gain Node
      const gain = ctx.createGain();
      gain.gain.value = isMuted ? 0 : volume / 100;
      gainNodeRef.current = gain;

      // 5-band Equalizer Nodes
      const filters: BiquadFilterNode[] = [];
      EQ_BANDS.forEach((band, idx) => {
        const filter = ctx.createBiquadFilter();
        filter.type = 'peaking';
        filter.frequency.value = band.freq;
        filter.Q.value = 1.25;
        filter.gain.value = eqGains[idx] !== undefined ? eqGains[idx] : 0;
        filters.push(filter);
      });
      filtersRef.current = filters;

      // Super Bass Boost Node (lowshelf filter at 85Hz)
      const bassFilter = ctx.createBiquadFilter();
      bassFilter.type = 'lowshelf';
      bassFilter.frequency.value = 85;
      bassFilter.gain.value = (bassBoost / 100) * 11; // maps 0-100% to 0 to +11dB
      bassFilterRef.current = bassFilter;

      // Crisp Vocal Clarity Node (highshelf filter at 9500Hz)
      const trebleFilter = ctx.createBiquadFilter();
      trebleFilter.type = 'highshelf';
      trebleFilter.frequency.value = 9500;
      trebleFilter.gain.value = (vocalClarity / 100) * 9; // maps 0-100% to 0 to +9dB
      trebleFilterRef.current = trebleFilter;

      // 3D Surround Haas Effect delay spatializer
      const splitter = ctx.createChannelSplitter(2);
      const merger = ctx.createChannelMerger(2);
      const delayNode = ctx.createDelay();
      delayNode.delayTime.value = (surround3D / 100) * 0.025; // max 25ms delay
      delayNodeRef.current = delayNode;

      splitter.connect(merger, 0, 0); // Connect Left directly to Left merger input
      splitter.connect(delayNode, 1);  // Connect Right channel to interactive sub-ms Delay
      delayNode.connect(merger, 0, 1); // Connect delayed output to Right merger input

      // Smart AGC Studio Dynamics Compressor
      const compressor = ctx.createDynamicsCompressor();
      if (compressorEnabled) {
        compressor.threshold.value = -24;
        compressor.knee.value = 30;
        compressor.ratio.value = 4;
        compressor.attack.value = 0.01;
        compressor.release.value = 0.15;
      } else {
        compressor.threshold.value = 0;
        compressor.knee.value = 0;
        compressor.ratio.value = 1;
        compressor.attack.value = 1.0;
        compressor.release.value = 1.0;
      }
      compressorNodeRef.current = compressor;

      // Router Connections:
      // srcNode -> [5 filters] -> bassFilter -> trebleFilter -> splitter/merger -> gain -> analyser -> compressor -> destination
      let currentNode: AudioNode = srcNode;
      filters.forEach((f) => {
        currentNode.connect(f);
        currentNode = f;
      });

      currentNode.connect(bassFilter);
      bassFilter.connect(trebleFilter);
      trebleFilter.connect(splitter);

      // Merger goes to gain volume control, analyser, compressor and destination
      merger.connect(gain);
      gain.connect(analyser);
      analyser.connect(compressor);
      compressor.connect(ctx.destination);
    } catch (e) {
      console.warn("Web Audio initialization failure (Expected on user gesture constraint):", e);
    }
  };

  // Adjust volume levels on live nodes
  useEffect(() => {
    if (gainNodeRef.current && audioContextRef.current) {
      const targetGain = isMuted ? 0 : volume / 100;
      gainNodeRef.current.gain.setValueAtTime(targetGain, audioContextRef.current.currentTime);
    }
    if (localAudioRef.current) {
      localAudioRef.current.volume = isMuted ? 0 : volume / 100;
    }
    if (cloudAudioRef.current) {
      cloudAudioRef.current.volume = isMuted ? 0 : volume / 100;
    }
  }, [volume, isMuted]);

  // Fast Keyboard Shortcuts trigger panel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowRight':
          e.preventDefault();
          seekTime(Math.min((audioRef.current?.currentTime || 0) + 10, duration));
          break;
        case 'ArrowLeft':
          e.preventDefault();
          seekTime(Math.max((audioRef.current?.currentTime || 0) - 10, 0));
          break;
        case 'KeyM':
          e.preventDefault();
          toggleMute();
          break;
        case 'KeyN':
          e.preventDefault();
          skipNext();
          break;
        case 'KeyP':
          e.preventDefault();
          skipPrev();
          break;
        case 'KeyL':
          e.preventDefault();
          setShowLyrics((prev) => !prev);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [tracks, currentTrackIndex, isPlaying, duration, volume, isMuted]);

  // Load and play a specific track
  const playTrack = async (index: number) => {
    if (index < 0 || index >= tracks.length) return;

    setCurrentTrackIndex(index);
    const track = tracks[index];
    const isCloud = track.source !== 'local';

    // To avoid CORS block silencing in Web Audio contexts,
    // we play cloud-hosted (Drive, Dropbox, R2) tracks directly in an uncaptured cloud audio element,
    // while same-origin local files use the Web Audio-enabled graph for EQ/Visualizer analysis.
    if (isCloud) {
      if (localAudioRef.current) {
        localAudioRef.current.pause();
        localAudioRef.current.src = '';
      }
      audioRef.current = cloudAudioRef.current;
    } else {
      if (cloudAudioRef.current) {
        cloudAudioRef.current.pause();
        cloudAudioRef.current.src = '';
      }
      audioRef.current = localAudioRef.current;
    }

    const audio = audioRef.current;
    if (!audio) return;

    // Reset layout playback states
    setCurrentTime(0);
    setDuration(0);
    setLyricLines([]);
    setLyricSource(null);

    // Dynamic File Object binding with clean Revocation
    if (track.source === 'local') {
      const storedFile = localFilesMap[track.id];
      if (storedFile) {
        if (prevObjectURLRef.current) {
          URL.revokeObjectURL(prevObjectURLRef.current);
        }
        const objURL = URL.createObjectURL(storedFile);
        prevObjectURLRef.current = objURL;
        audio.crossOrigin = '';
        audio.src = objURL;
      } else {
        showToast('⚠️ Bài hát local bị thiếu tệp tin. Vui lòng nhấp "Cần chọn lại tệp" để tải lại.');
        setIsPlaying(false);
        return;
      }
    } else {
      audio.crossOrigin = ''; // Reset CORS header settings — fetch without CORS limits!
      if (track.url) {
        audio.src = track.url;
      } else {
        audio.src = '';
      }
    }

    // Auto-close sidebar drawer on mobile for smooth view transition
    setShowSidebar(false);

    try {
      if (!isCloud) {
        // Lazy start nodes only for local tracks supporting spectrum analyze
        initAudioGraph();
        if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume();
        }
      }

      await audio.play();
      setIsPlaying(true);
      fetchLyricsForTrack(track, index);
    } catch (e) {
      console.warn("Autoplay was prevented or audio failed:", e);
      setIsPlaying(false);
    }
  };

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      if (currentTrackIndex === -1 && tracks.length > 0) {
        playTrack(0);
        return;
      }
      try {
        initAudioGraph();
        if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume();
        }
        await audio.play();
        setIsPlaying(true);
      } catch (err) {
        console.warn("Playback activation failed:", err);
      }
    }
  };

  const skipNext = () => {
    if (tracks.length === 0) return;
    if (isShuffle) {
      const randomIdx = Math.floor(Math.random() * tracks.length);
      playTrack(randomIdx);
    } else {
      const nextIdx = (currentTrackIndex + 1) % tracks.length;
      playTrack(nextIdx);
    }
  };

  const skipPrev = () => {
    if (tracks.length === 0) return;
    if ((audioRef.current?.currentTime || 0) > 4) {
      seekTime(0);
      return;
    }
    const prevIdx = currentTrackIndex <= 0 ? tracks.length - 1 : currentTrackIndex - 1;
    playTrack(prevIdx);
  };

  const handleTrackEnded = () => {
    if (repeatMode === 2) {
      seekTime(0);
      audioRef.current?.play().catch(() => {});
    } else {
      skipNext();
    }
  };

  const seekTime = (seconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = seconds;
      setCurrentTime(seconds);
    }
  };

  const toggleMute = () => {
    setIsMuted((prev) => !prev);
    showToast(isMuted ? '🔊 Bật âm thanh' : '🔇 Tắt tiếng');
  };

  // Preset Equalizer configurations trigger
  const handlePresetChange = (preset: EQPreset) => {
    setActivePreset(preset);
    const gains = EQ_PRESETS[preset];
    setEqGains(gains);

    // Apply directly on the live Biquad Nodes
    if (filtersRef.current.length > 0) {
      filtersRef.current.forEach((filter, idx) => {
        if (gains[idx] !== undefined) {
          filter.gain.value = gains[idx];
        }
      });
    }
  };

  const handleGainChange = (bandIndex: number, val: number) => {
    setActivePreset('flat'); // Switch to custom edit mode
    const newGains = [...eqGains];
    newGains[bandIndex] = val;
    setEqGains(newGains);

    if (filtersRef.current[bandIndex]) {
      filtersRef.current[bandIndex].gain.value = val;
    }
  };

  const handleBassBoostChange = (val: number) => {
    setBassBoost(val);
    if (bassFilterRef.current && audioContextRef.current) {
      const db = (val / 100) * 11;
      bassFilterRef.current.gain.setValueAtTime(db, audioContextRef.current.currentTime);
    }
  };

  const handleVocalClarityChange = (val: number) => {
    setVocalClarity(val);
    if (trebleFilterRef.current && audioContextRef.current) {
      const db = (val / 100) * 9;
      trebleFilterRef.current.gain.setValueAtTime(db, audioContextRef.current.currentTime);
    }
  };

  const handleSurround3DChange = (val: number) => {
    setSurround3D(val);
    if (delayNodeRef.current && audioContextRef.current) {
      const delayTimeSecs = (val / 100) * 0.025;
      delayNodeRef.current.delayTime.setValueAtTime(delayTimeSecs, audioContextRef.current.currentTime);
    }
  };

  const handleCompressorToggle = () => {
    const nextVal = !compressorEnabled;
    setCompressorEnabled(nextVal);

    if (compressorNodeRef.current && audioContextRef.current) {
      const ctx = audioContextRef.current;
      if (nextVal) {
        compressorNodeRef.current.threshold.setValueAtTime(-24, ctx.currentTime);
        compressorNodeRef.current.knee.setValueAtTime(30, ctx.currentTime);
        compressorNodeRef.current.ratio.setValueAtTime(4, ctx.currentTime);
        compressorNodeRef.current.attack.setValueAtTime(0.01, ctx.currentTime);
        compressorNodeRef.current.release.setValueAtTime(0.15, ctx.currentTime);
      } else {
        compressorNodeRef.current.threshold.setValueAtTime(0, ctx.currentTime);
        compressorNodeRef.current.knee.setValueAtTime(0, ctx.currentTime);
        compressorNodeRef.current.ratio.setValueAtTime(1, ctx.currentTime);
        compressorNodeRef.current.attack.setValueAtTime(1.0, ctx.currentTime);
        compressorNodeRef.current.release.setValueAtTime(1.0, ctx.currentTime);
      }
    }
  };

  // LRCLIB and AI-based Lyric Parsing
  const fetchLyricsForTrack = async (track: Track, trackIdx: number) => {
    // Check local storage records
    if (track.lyricData) {
      parseAndSetLyrics(track.lyricData);
      return;
    }

    setLyricLoading(true);
    let lyricsPayload = null;

    try {
      // 1. Fetch from LRCLIB API first
      const query = new URLSearchParams({
        track_name: track.title,
        artist_name: track.artist || '',
      });
      const response = await fetch(`https://lrclib.net/api/search?${query}`, {
        headers: { 'Lrclib-Client': 'SongNhacMusicPlayer/1.1' },
      });

      if (response.ok) {
        const data = await response.json();
        if (data && data.length > 0) {
          const matched = data[0];
          lyricsPayload = {
            synced: matched.syncedLyrics || null,
            plain: matched.plainLyrics || null,
            source: 'lrclib' as const,
          };
        }
      }
    } catch (e) {
      console.warn("LRCLIB fetching error, falling back to Gemini:", e);
    }

    // 2. Fetch using Gemini back-end proxy if LRCLIB gave no match
    if (!lyricsPayload) {
      try {
        const aiResponse = await fetch('/api/lyrics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: track.title,
            artist: track.artist,
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          lyricsPayload = {
            synced: null,
            plain: aiData.plain,
            source: 'ai' as const,
          };
        }
      } catch (err) {
        console.error("Gemini proxy lyrics error:", err);
      }
    }

    setLyricLoading(false);

    if (lyricsPayload) {
      parseAndSetLyrics(lyricsPayload);
      // Save permanently in metadata playlist JSON record so we only query once
      const updatedTracks = [...tracks];
      updatedTracks[trackIdx] = { ...track, lyricData: lyricsPayload };
      savePlaylist(updatedTracks);
    }
  };

  const parseAndSetLyrics = (data: { synced?: string | null; plain?: string | null; source?: any }) => {
    setLyricSource(data.source || 'manual');

    if (data.synced) {
      // Synced LRC file formatting
      const lines: LyricLine[] = [];
      const linesArray = data.synced.split('\n');
      const regex = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/;

      linesArray.forEach((line) => {
        const match = line.match(regex);
        if (match) {
          const min = parseInt(match[1]);
          const sec = parseInt(match[2]);
          const ms = parseInt(match[3].padEnd(3, '0'));
          const time = min * 60 + sec + ms / 1000;
          lines.push({ time, text: match[4].trim() });
        }
      });

      setLyricLines(lines.sort((a, b) => a.time - b.time));
    } else if (data.plain) {
      // Static Lines mapping
      const lines = data.plain
        .split('\n')
        .filter((l) => l.trim().length > 0)
        .map((text, idx) => ({
          time: idx * 4, // fake auto-increment mapping space
          text: text.trim(),
        }));
      setLyricLines(lines);
    } else {
      setLyricLines([]);
    }
  };

  const handleManualLyricUpload = (text: string) => {
    const isLrc = text.includes('[');
    const payload = {
      synced: isLrc ? text : null,
      plain: isLrc ? null : text,
      source: 'manual' as const,
    };

    parseAndSetLyrics(payload);

    if (currentTrackIndex !== -1) {
      const updatedTracks = [...tracks];
      updatedTracks[currentTrackIndex] = { ...tracks[currentTrackIndex], lyricData: payload };
      savePlaylist(updatedTracks);
    }
  };

  // Importing Local MP3 files inside React context
  const handleLocalFilesAdd = (files: FileList) => {
    const newFilesMap = { ...localFilesMap };
    const importedTracks: Track[] = [];

    Array.from(files).forEach((file) => {
      const generatedId = `local_${file.name}_${file.size}_${Date.now()}`;
      newFilesMap[generatedId] = file;

      // Extract basic names
      const cleanTitle = file.name.replace(/\.[^.]+$/, '');
      importedTracks.push({
        id: generatedId,
        source: 'local',
        title: cleanTitle,
        artist: 'Nhạc cục bộ thiết bị',
        url: '', // Bound via Object URLs live during session
        missing: false,
      });
    });

    setLocalFilesMap(newFilesMap);
    const updated = [...tracks, ...importedTracks];
    savePlaylist(updated);
    showToast(`✅ Đã thêm ${importedTracks.length} bài hát vào danh sách`);
  };

  // Re-link missed files on browser cold restart
  const handleRelinkLocalFile = (id: string, file: File) => {
    const updatedMap = { ...localFilesMap, [id]: file };
    setLocalFilesMap(updatedMap);

    const updatedTracks = tracks.map((t) => (t.id === id ? { ...t, missing: false } : t));
    savePlaylist(updatedTracks);

    const idx = updatedTracks.findIndex((t) => t.id === id);
    if (idx !== -1 && idx === currentTrackIndex && audioRef.current) {
      audioRef.current.src = URL.createObjectURL(file);
      audioRef.current.play().catch(() => {});
    }

    showToast('✅ Tệp tin đã được kết nối khớp mượt mà!');
  };

  const handleCloudTrackAdd = (newTrack: Omit<Track, 'id'>) => {
    const generatedId = `cloud_${Date.now()}`;
    const trackWithId: Track = { ...newTrack, id: generatedId };
    const updated = [...tracks, trackWithId];
    savePlaylist(updated);
    showToast(`✅ Đã thêm bài hát: ${newTrack.title}`);
  };

  const handleR2BulkAdd = (url: string, files: string[]) => {
    const items: Track[] = files.map((fileName) => {
      const title = `R2 - ${fileName.replace(/\.[^.]+$/, '')}`;
      const fullUrl = `${url.replace(/\/$/, '')}/${encodeURIComponent(fileName)}`;
      return {
        id: `r2_${fileName}_${Date.now()}`,
        source: 'R2',
        title,
        artist: 'Cloudflare R2 Bucket',
        url: fullUrl,
      };
    });
    const updated = [...tracks, ...items];
    savePlaylist(updated);
  };

  const handleTrackUpdate = (id: string, updatedFields: Partial<Track>) => {
    const updated = tracks.map((t) => (t.id === id ? { ...t, ...updatedFields } : t));
    savePlaylist(updated);
    showToast('📝 Đã lưu thông tin bài hát!');
  };

  const handleTrackRemove = (id: string) => {
    const updated = tracks.filter((t) => t.id !== id);
    savePlaylist(updated);

    if (currentTrackIndex !== -1 && tracks[currentTrackIndex]?.id === id) {
      audioRef.current?.pause();
      setIsPlaying(false);
      setCurrentTrackIndex(-1);
    }
  };

  const toggleTheme = () => {
    const target = theme === 'dark' ? 'light' : 'dark';
    setTheme(target);
    document.documentElement.setAttribute('data-theme', target);
    localStorage.setItem('snhac_theme', target);
  };

  const activeTrack = currentTrackIndex !== -1 ? tracks[currentTrackIndex] : null;

  // Render Time string
  const formatTimeStr = (secs: number) => {
    if (isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div id="app" className="relative flex flex-col md:grid md:grid-cols-[300px_1fr] md:grid-rows-[1fr_68px] h-screen w-full bg-primary text-primary overflow-hidden font-sans select-none">
      
      {/* Mobile background backdrop overlay for sliding sidebar */}
      {showSidebar && (
        <div
          className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity"
          onClick={() => setShowSidebar(false)}
        />
      )}

      {/* ══ SIDEBAR LEFT PANEL ══ */}
      <Sidebar
        tracks={tracks}
        currentTrackIndex={currentTrackIndex}
        onTrackSelect={playTrack}
        onTrackRemove={handleTrackRemove}
        onLocalFilesAdd={handleLocalFilesAdd}
        onCloudTrackAdd={handleCloudTrackAdd}
        onR2BulkAdd={handleR2BulkAdd}
        onRelinkLocalFile={handleRelinkLocalFile}
        onTrackUpdate={handleTrackUpdate}
        isOpen={showSidebar}
        onClose={() => setShowSidebar(false)}
      />

      {/* ══ MAIN WORKSPACE ══ */}
      <main id="main" className="relative flex flex-col justify-center items-center bg-primary overflow-hidden md:border-l border-border px-4 py-4 md:p-8 w-full flex-1 md:h-full min-h-0">
        
        {/* Mobile menu floating toggle button on the top-left */}
        <div className="md:hidden absolute top-4 left-4 z-40">
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className="w-10 h-10 rounded-full bg-secondary/85 hover:bg-accent/25 border border-border/80 text-accent flex items-center justify-center shadow-lg backdrop-blur-xl transition-all duration-200 active:scale-95 cursor-pointer"
            title="Thư viện nhạc"
          >
            <SlidersHorizontal className="w-5 h-5 rotate-90 text-accent" />
          </button>
        </div>
        
        {/* Dynamic customized aesthetic background (Lofi Chill/Vapor) */}
        {bgType !== 'none' && bgValue && (
          <div
            className="absolute inset-0 z-0 bg-cover bg-center transition-all duration-700 pointer-events-none filter blur-[1px]"
            style={{
              backgroundImage: `url(${bgValue})`,
              opacity: bgOpacity,
            }}
          />
        )}

        {/* Dynamic blurred active ambient disk background */}
        {activeTrack?.art && (
          <div
            className="absolute inset-0 z-0 bg-cover bg-center filter blur-[100px] opacity-[0.14] saturate-[1.8] transition-all duration-1000 pointer-events-none"
            style={{ backgroundImage: `url(${activeTrack.art})` }}
          />
        )}

        {/* Hidden Background Image File Selector */}
        <input
          type="file"
          ref={bgUploadRef}
          onChange={handleBgUpload}
          accept="image/*"
          className="hidden"
        />

        {/* 🎨 PREMIUM DYNAMIC CUSTOMIZER FLUID BUTTON & POPOVER PANEL */}
        <div className="absolute top-4 right-4 z-40 relative">
          <button
            onClick={() => setShowThemePanel(!showThemePanel)}
            className="w-10 h-10 rounded-full bg-secondary/85 hover:bg-accent/20 border border-border/80 text-accent hover:text-accent-glow flex items-center justify-center shadow-[0_4px_15px_rgba(0,0,0,0.3)] backdrop-blur-xl transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer"
            title="Đổi chủ đề & nghệ thuật hình nền Lofi"
          >
            <Sparkles className="w-5 h-5 animate-pulse" />
          </button>

          {showThemePanel && (
            <div className="fixed md:absolute top-16 right-4 left-4 md:left-auto md:top-12 md:right-0 w-auto md:w-72 bg-secondary/95 backdrop-blur-3xl border border-border/90 p-4 rounded-2xl shadow-2xl space-y-4 animate-in fade-in slide-in-from-top-3 duration-200 text-left">
              <div className="flex items-center justify-between border-b border-border/60 pb-2">
                <span className="text-xs font-black uppercase text-primary tracking-wider flex items-center gap-1.5">
                  <span>🎨</span> Tùy biến giao diện
                </span>
                <span className="text-[9px] bg-accent/25 text-accent px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">v2.6</span>
              </div>

              {/* Theme Mode Switcher */}
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-secondary">Chế độ Sáng / Tối</span>
                <button
                  onClick={toggleTheme}
                  className="p-1 px-3 rounded-lg bg-primary/40 border border-border/50 hover:bg-primary/60 transition-all flex items-center gap-1.5 cursor-pointer font-bold text-primary"
                >
                  {theme === 'dark' ? (
                    <>
                      <Sun className="w-3.5 h-3.5 text-amber-400 animate-spin" style={{ animationDuration: '8s' }} />
                      <span>Sáng</span>
                    </>
                  ) : (
                    <>
                      <Moon className="w-3.5 h-3.5 text-indigo-500 animate-bounce" />
                      <span>Tối</span>
                    </>
                  )}
                </button>
              </div>

              {/* Accent Palette Picker */}
              <div className="space-y-1.5">
                <span className="block text-[10px] text-secondary font-bold uppercase tracking-wider">Sắc màu Neon</span>
                <div className="flex items-center gap-2.5">
                  {Object.keys(accentColors).map((colorKey) => {
                    const active = accent === colorKey;
                    const palette = accentColors[colorKey];
                    return (
                      <button
                        key={colorKey}
                        onClick={() => {
                          setAccent(colorKey);
                          showToast(`🎨 Màu nhấn: ${colorKey === 'violet' ? 'Tím Luminous' : colorKey === 'emerald' ? 'Xanh Ngọc' : colorKey === 'amber' ? 'Vàng Hổ Phách' : colorKey === 'rose' ? 'Đỏ Hồng' : 'Xanh Băng'}`);
                        }}
                        className={`w-5 h-5 rounded-full transition-all duration-300 hover:scale-120 cursor-pointer relative ${
                          active ? 'ring-2 ring-white scale-110 shadow-[0_0_12px_var(--accent)]' : 'opacity-65'
                        }`}
                        style={{ backgroundColor: palette.primary }}
                        title={colorKey}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Lofi Background select */}
              <div className="space-y-1.5">
                <span className="block text-[10px] text-secondary font-bold uppercase tracking-wider font-semibold">Mẫu nền Lofi Chill</span>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    onClick={() => {
                      setBgType('none');
                      setBgValue('none');
                      showToast('🌅 Đã khôi phục giao diện nền mặc định');
                    }}
                    className={`text-[9px] font-bold py-1.5 rounded-lg border text-center transition-all cursor-pointer ${
                      bgType === 'none' ? 'bg-accent/15 border-accent text-accent' : 'bg-primary/20 border-border hover:bg-primary/45 text-secondary'
                    }`}
                  >
                    Mặc định
                  </button>
                  <button
                    onClick={() => {
                      setBgType('preset');
                      setBgValue('https://images.unsplash.com/photo-1518156677180-95a2893f3e9f?q=80&w=1920');
                      showToast('🌅 Sunset lofi background loaded!');
                    }}
                    className={`text-[9px] font-bold py-1.5 rounded-lg border text-center transition-all cursor-pointer ${
                      bgType === 'preset' && bgValue.includes('photo-1518156677180-95a2893f3e9f') ? 'bg-accent/15 border-accent text-accent' : 'bg-primary/20 border-border hover:bg-primary/45 text-secondary'
                    }`}
                  >
                    🌅 Sunset
                  </button>
                  <button
                    onClick={() => {
                      setBgType('preset');
                      setBgValue('https://images.unsplash.com/photo-1515621061946-eff1c2a352bd?q=80&w=1920');
                      showToast('🌧️ Cyber Rain lofi background loaded!');
                    }}
                    className={`text-[9px] font-bold py-1.5 rounded-lg border text-center transition-all cursor-pointer ${
                      bgType === 'preset' && bgValue.includes('photo-1515621061946-eff1c2a352bd') ? 'bg-accent/15 border-accent text-accent' : 'bg-primary/20 border-border hover:bg-primary/45 text-secondary'
                    }`}
                  >
                    🌧️ Cyber
                  </button>
                  <button
                    onClick={() => {
                      setBgType('preset');
                      setBgValue('https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=1920');
                      showToast('❄️ Snowy Cabin background loaded!');
                    }}
                    className={`text-[9px] font-bold py-1.5 rounded-lg border text-center transition-all cursor-pointer ${
                      bgType === 'preset' && bgValue.includes('photo-1519681393784-d120267933ba') ? 'bg-accent/15 border-accent text-accent' : 'bg-primary/20 border-border hover:bg-primary/45 text-secondary'
                    }`}
                  >
                    ❄️ Snowy
                  </button>
                  <button
                    onClick={() => {
                      setBgType('preset');
                      setBgValue('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1920');
                      showToast('👾 Neon Dreamscape background loaded!');
                    }}
                    className={`text-[9px] font-bold py-1.5 rounded-lg border text-center transition-all cursor-pointer ${
                      bgType === 'preset' && bgValue.includes('photo-1618005182384-a83a8bd57fbe') ? 'bg-accent/15 border-accent text-accent' : 'bg-primary/20 border-border hover:bg-primary/45 text-secondary'
                    }`}
                  >
                    👾 Neon
                  </button>
                  <button
                    onClick={() => {
                      setBgType('preset');
                      setBgValue('https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?q=80&w=1920');
                      showToast('🌌 Cosmic Stardust background loaded!');
                    }}
                    className={`text-[9px] font-bold py-1.5 rounded-lg border text-center transition-all cursor-pointer ${
                      bgType === 'preset' && bgValue.includes('photo-1506318137071-a8e063b4bec0') ? 'bg-accent/15 border-accent text-accent' : 'bg-primary/20 border-border hover:bg-primary/45 text-secondary'
                    }`}
                  >
                    🌌 Cosmic
                  </button>
                </div>
              </div>

              {/* Custom Image URL / Upload from Local */}
              <div className="space-y-2 border-t border-border/40 pt-2.5">
                <span className="block text-[10px] text-secondary font-bold uppercase tracking-wider">Dán liên kết hình nền/GIF</span>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={bgType === 'custom' ? bgValue : ''}
                    onChange={(e) => {
                      setBgType('custom');
                      setBgValue(e.target.value);
                    }}
                    placeholder="Dán link ảnh gif lofi..."
                    className="flex-1 bg-primary/45 border border-border/75 rounded-lg p-1.5 px-2 text-[10px] text-primary focus:outline-none focus:border-accent"
                  />
                  <button
                    onClick={() => bgUploadRef.current?.click()}
                    className="p-1 px-3 bg-accent text-white hover:bg-accent-dim rounded-lg text-[9.5px] font-bold cursor-pointer transition-all border border-transparent hover:scale-103"
                    title="Tải ảnh lên từ máy"
                  >
                    Tải tệp
                  </button>
                </div>
              </div>

              {/* Opacity slider control */}
              <div className="space-y-1.5 border-t border-border/40 pt-2.5">
                <div className="flex items-center justify-between text-[10px] text-secondary font-bold uppercase tracking-wider">
                  <span>Mức độ sáng nền</span>
                  <span className="text-accent font-mono">{Math.round(bgOpacity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.05"
                  max="0.80"
                  step="0.05"
                  value={bgOpacity}
                  onChange={(e) => setBgOpacity(parseFloat(e.target.value))}
                  className="w-full h-1 bg-primary/60 border-transparent rounded-lg appearance-none cursor-pointer accent-accent"
                />
              </div>
            </div>
          )}
        </div>

        {/* EQ Popover Modal */}
        <EQPanel
          show={showEQ}
          onClose={() => setShowEQ(false)}
          gains={eqGains}
          onGainChange={handleGainChange}
          activePreset={activePreset}
          onPresetChange={handlePresetChange}
          bassBoost={bassBoost}
          onBassBoostChange={handleBassBoostChange}
          vocalClarity={vocalClarity}
          onVocalClarityChange={handleVocalClarityChange}
          surround3D={surround3D}
          onSurround3DChange={handleSurround3DChange}
          compressorEnabled={compressorEnabled}
          onCompressorToggle={handleCompressorToggle}
        />

        {/* Synchronized full lyrics modal */}
        <LyricSection
          show={showLyrics}
          onClose={() => setShowLyrics(false)}
          track={activeTrack}
          currentTime={currentTime}
          lyricLines={lyricLines}
          lyricMode={lyricMode}
          onModeChange={setLyricMode}
          lyricSource={lyricSource}
          isLoading={lyricLoading}
          onManualLyricUpload={handleManualLyricUpload}
          onSeek={seekTime}
        />

        {/* Visualizers canvas at the bottom */}
        <Visualizer analyser={analyserRef.current} isPlaying={isPlaying} />

        {/* Disc Rotate vinyl container centering */}
        <div className="relative z-10 flex flex-col items-center max-w-sm w-full h-[95%] md:h-full justify-center md:justify-between py-2 pb-6 md:py-6 md:pb-0 gap-3 md:gap-4">
          
          {/* Centered Vinyl disc block with Aura radial backdrop */}
          <div className="flex-1 flex items-center justify-center w-full min-h-[160px] md:min-h-[220px]">
            <div className="relative group cursor-pointer" onClick={togglePlay}>
              
              {/* Back glowing aura shadow linked to active track */}
              <div
                className={`absolute inset-[-12px] md:inset-[-20px] rounded-full blur-[24px] md:blur-[28px] transition-all duration-[1200ms] ${
                  isPlaying ? 'opacity-80 scale-105' : 'opacity-[0.14] scale-95'
                }`}
                style={{
                  background: `radial-gradient(circle, var(--accent) 0%, transparent 70%)`
                }}
              />
              
              {/* Double Vinyl groove orbit circles */}
              <div className="absolute inset-[-8px] md:inset-[-10px] border border-accent/15 rounded-full pointer-events-none z-0 animate-pulse" />
              <div className="absolute inset-[-15px] md:inset-[-20px] border border-accent/5 rounded-full pointer-events-none z-0" style={{ animationDelay: '0.8s' }} />

              {/* Carbon Plate design core with Vinyl concentric grooves */}
              <div
                className={`w-[150px] h-[150px] md:w-[220px] md:h-[220px] relative rounded-full bg-neutral-950 flex items-center justify-center shadow-[0_12px_40px_rgba(0,0,0,0.85)] border-4 border-neutral-900/60 z-10 overflow-hidden ${
                  isPlaying ? 'animate-spin' : 'paused-spin'
                }`}
                style={{
                  background: 'repeating-radial-gradient(circle, #242424, #121212 2.5px, #0f0f0f 5px, #1a1a1a 6px, #121212 7px)',
                }}
              >
                {/* Center Vinyl Sticker Label */}
                <div className="w-[60px] h-[60px] md:w-[96px] md:h-[96px] rounded-full bg-secondary border border-neutral-900 flex items-center justify-center overflow-hidden relative shadow-lg shrink-0">
                  {activeTrack?.art ? (
                    <img
                      src={activeTrack.art}
                      alt={activeTrack.title}
                      className="w-full h-full object-cover select-none"
                      style={{ referrerPolicy: "no-referrer" }}
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-tr from-accent/20 to-accent/5 flex flex-col items-center justify-center text-accent">
                      <Music4 className="w-5 h-5 text-accent animate-pulse" />
                      <span className="text-[7px] font-extrabold uppercase tracking-wider text-accent/80 mt-0.5">DTMusic</span>
                    </div>
                  )}

                  {/* Metal center dynamic spindle pin hole */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-4 h-4 md:w-5 md:h-5 rounded-full bg-secondary/90 border border-neutral-950 flex items-center justify-center shadow-inner">
                      <div className="w-1.5 h-1.5 md:w-2.5 md:h-2.5 rounded-full bg-black shadow-inner" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ACTIVE SONG INFO & CONTROLLER BOX (The Bento Hub) */}
          <div className="w-full glass-card glow-border p-4 rounded-2xl flex flex-col items-center shadow-2xl space-y-3 md:space-y-4">
            
            {/* TEXT HEADLINE */}
            <div className="text-center w-full px-1">
              <h2 className="text-xs md:text-md font-extrabold tracking-tight text-primary truncate max-w-xs mx-auto mb-0.5">
                {activeTrack ? activeTrack.title : 'DTMusic Player'}
              </h2>
              <p className="text-[9.5px] md:text-[11px] text-muted truncate max-w-xs mx-auto min-h-[14px]">
                {activeTrack ? activeTrack.artist : 'Thả nhạc hoặc nhập đường dẫn đám mây'}
              </p>

              {/* Badges list */}
              <div className="flex items-center justify-center gap-2 mt-2">
                <button
                  onClick={() => setShowEQ((prev) => !prev)}
                  className={`text-[8.5px] md:text-[9px] font-bold px-2.5 py-0.5 rounded-full transition-all cursor-pointer flex items-center gap-1 border border-border ${
                    showEQ ? 'bg-accent/20 border-accent text-accent font-extrabold shadow-sm' : 'text-secondary hover:text-primary hover:bg-hover'
                  }`}
                >
                  <span>🎛️</span>
                  <span>EQ {showEQ ? 'Bật' : 'Tắt'}</span>
                </button>
                <button
                  onClick={() => setShowLyrics(true)}
                  className="text-[8.5px] md:text-[9px] font-bold px-2.5 py-0.5 rounded-full text-secondary hover:text-primary hover:bg-hover border border-border/80 cursor-pointer flex items-center gap-1"
                >
                  <span>🎵</span>
                  <span>Lời hát</span>
                </button>
              </div>
            </div>

            {/* PROGRESS BAR TIMELINE */}
            <div className="w-full px-1 space-y-1">
              <input
                type="range"
                min="0"
                max={duration || 100}
                value={currentTime}
                onChange={(e) => seekTime(parseFloat(e.target.value))}
                disabled={tracks.length === 0}
                className="w-full h-1 bg-primary/40 border-transparent rounded-lg appearance-none cursor-pointer accent-accent slider-custom"
                style={{
                  background: `linear-gradient(to right, var(--accent) ${
                    duration ? (currentTime / duration) * 100 : 0
                  }%, var(--bg-tertiary) ${duration ? (currentTime / duration) * 100 : 0}%)`,
                }}
              />
              <div className="flex justify-between items-center text-[8.5px] text-muted font-bold font-mono px-0.5">
                <span>{formatTimeStr(currentTime)}</span>
                <span>{formatTimeStr(duration)}</span>
              </div>
            </div>

            {/* ACTION MUSIC BUTTONS CONTROLLERS */}
            <div className="flex items-center gap-3.5 md:gap-4.5 justify-center w-full">
              {/* Shuffle button */}
              <button
                onClick={() => setIsShuffle((prev) => !prev)}
                className={`p-1 hover:text-accent transition-colors cursor-pointer ${
                  isShuffle ? 'text-accent drop-shadow-[0_0_4px_rgba(167,139,250,0.6)]' : 'text-muted hover:text-primary'
                }`}
                title="Phát ngẫu nhiên"
              >
                <Shuffle className="w-3.5 h-3.5" />
              </button>

              {/* Prev button */}
              <button onClick={skipPrev} className="p-1 text-secondary hover:text-primary transition-colors cursor-pointer" title="Bài trước">
                <SkipBack className="w-4 h-4 fill-current" />
              </button>

              {/* Main Play/Pause Button */}
              <button
                onClick={togglePlay}
                className="w-10 h-10 md:w-11 md:h-11 rounded-full bg-accent hover:scale-105 active:scale-95 text-white flex items-center justify-center cursor-pointer transition-all shadow-[0_4px_15px_rgba(168,85,247,0.35)]"
                title="Phát/Tạm dừng (Phím Cách)"
              >
                {isPlaying ? (
                  <Pause className="w-4 h-4 fill-current" />
                ) : (
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                )}
              </button>

              {/* Next button */}
              <button onClick={skipNext} className="p-1 text-secondary hover:text-primary transition-colors cursor-pointer" title="Bài tiếp theo">
                <SkipForward className="w-4 h-4 fill-current" />
              </button>

              {/* Repeat button */}
              <button
                onClick={() => setRepeatMode((prev) => ((prev + 1) % 3) as 0 | 1 | 2)}
                className={`p-1 hover:text-accent transition-colors cursor-pointer relative ${
                  repeatMode > 0 ? 'text-accent' : 'text-muted hover:text-primary'
                }`}
                title={repeatMode === 1 ? 'Lặp lại toàn bộ' : repeatMode === 2 ? 'Lặp lại 1 bài' : 'Không lặp'}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                {repeatMode === 2 && (
                  <span className="absolute top-[-2px] right-[-2px] bg-accent text-[6.5px] text-white font-extrabold w-2.5 h-2.5 rounded-full flex items-center justify-center">
                    1
                  </span>
                )}
              </button>
            </div>

          </div>

        </div>
      </main>

      {/* ══ FOOTER BAR CONTROLS (Slim Modern Layout) ══ */}
      <footer id="player-bar" className="col-span-1 md:col-span-2 bg-secondary/95 backdrop-blur-md border-t border-border flex items-center justify-between px-4 md:px-6 py-2 z-20 select-none h-[60px] md:h-[68px]">
        
        {/* Left Side: Active track metadata */}
        <div className="flex items-center gap-3 w-full max-w-[200px] md:max-w-xs shrink-0">
          <div className="w-[36px] h-[36px] rounded-lg bg-tertiary/60 overflow-hidden shrink-0 border border-border flex items-center justify-center p-0.5">
            {activeTrack?.art ? (
              <img src={activeTrack.art} alt={activeTrack.title} className="w-full h-full object-cover rounded" />
            ) : (
              <Music4 className="w-4 h-4 text-muted/60 animate-pulse" />
            )}
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-semibold text-primary truncate max-w-[130px] md:max-w-[180px]">
              {activeTrack ? activeTrack.title : 'DTMusic Player'}
            </h4>
            <p className="text-[10px] text-muted truncate max-w-[130px] md:max-w-[180px]">
              {activeTrack ? activeTrack.artist : 'Chưa chọn bài hát'}
            </p>
          </div>
        </div>

        {/* Center: Beautiful interactive speaker patterns & geometric waveform lines */}
        <div className="hidden md:flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-secondary/60">
            <Volume2 className={`w-3.5 h-3.5 transition-all ${isPlaying ? 'text-accent scale-110 animate-bounce' : 'text-muted'}`} />
            <div className={`flex items-center gap-0.5 h-4 px-1 ${isPlaying ? 'opacity-100' : 'opacity-30'}`}>
              <span className="w-[1.5px] bg-accent/80 h-1 rounded animate-pulse" />
              <span className="w-[1.5px] bg-accent/80 h-3.5 rounded animate-bounce" style={{ animationDuration: '0.8s' }} />
              <span className="w-[1.5px] bg-accent/80 h-2 rounded animate-pulse" />
              <span className="w-[1.5px] bg-accent/80 h-4 rounded animate-bounce" style={{ animationDuration: '0.6s' }} />
              <span className="w-[1.5px] bg-accent/80 h-1.5 rounded animate-pulse" />
              <span className="w-[1.5px] bg-accent/80 h-3 rounded animate-bounce" style={{ animationDuration: '0.9s' }} />
              <span className="w-[1.5px] bg-accent/80 h-1 rounded animate-pulse" />
            </div>
            <Volume2 className={`w-3.5 h-3.5 transition-all hidden lg:block ${isPlaying ? 'text-accent scale-110 animate-pulse' : 'text-muted'}`} />
          </div>
          
          <div className="flex items-center gap-1 text-[10px] text-muted/50 font-mono tracking-widest select-none">
            <span>━━━</span>
            <span className="text-[8px] text-accent font-extrabold animate-pulse">✦ DT-STUDIO ✦</span>
            <span>━━━</span>
          </div>

          <div className="flex items-center gap-1.5 text-secondary/60">
            <Volume2 className={`w-3.5 h-3.5 transition-all hidden lg:block ${isPlaying ? 'text-accent scale-110 animate-pulse' : 'text-muted'}`} style={{ animationDelay: '0.2s' }} />
            <div className={`flex items-center gap-0.5 h-4 px-1 ${isPlaying ? 'opacity-100' : 'opacity-30'}`}>
              <span className="w-[1.5px] bg-accent/80 h-2.5 rounded animate-bounce" style={{ animationDuration: '0.7s' }} />
              <span className="w-[1.5px] bg-accent/80 h-1 rounded animate-pulse" />
              <span className="w-[1.5px] bg-accent/80 h-3.5 rounded animate-bounce" style={{ animationDuration: '0.9s' }} />
              <span className="w-[1.5px] bg-accent/80 h-1.5 rounded animate-pulse" />
              <span className="w-[1.5px] bg-accent/80 h-3 rounded animate-bounce" style={{ animationDuration: '0.5s' }} />
            </div>
            <Volume2 className={`w-3.5 h-3.5 transition-all ${isPlaying ? 'text-accent scale-110 animate-bounce' : 'text-muted'}`} style={{ animationDelay: '0.3s' }} />
          </div>
        </div>

        {/* Right Area: Spatial audio and Volume settings */}
        <div className="flex items-center gap-4 shrink-0">
          {/* Dolby badge */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-accent/5 rounded border border-accent/15">
            <Sparkles className="w-3 h-3 text-accent animate-spin" style={{ animationDuration: '6s' }} />
            <span className="text-[8.5px] text-accent font-extrabold uppercase font-mono tracking-wider">Dolby HQ Audio</span>
          </div>

          {/* Volume Control widget */}
          <div className="flex items-center gap-2 w-28 md:w-32 shrink-0">
            <button onClick={toggleMute} className="text-secondary hover:text-primary transition-colors cursor-pointer shrink-0">
              {isMuted ? <VolumeX className="w-3.5 h-3.5 text-rose-500" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={(e) => setVolume(parseInt(e.target.value))}
              className="flex-1 h-[2.5px] bg-border-hover rounded-lg accent-accent cursor-pointer slider-custom"
              style={{
                background: `linear-gradient(to right, var(--accent) ${volume}%, var(--bg-tertiary) ${volume}%)`,
              }}
            />
            <span className="text-[8.5px] font-bold font-mono text-muted w-6 text-right shrink-0">{volume}%</span>
          </div>
        </div>
      </footer>

      {/* Floating mini active lyrics controllers */}
      <MiniPlayer
        show={showLyrics}
        track={activeTrack}
        isPlaying={isPlaying}
        onTogglePlay={togglePlay}
        onRestoreView={() => setShowLyrics(false)}
      />

      {/* ══ DYNAMIC TOAST ALERT DIALOGS ══ */}
      <div
        id="toast-popup"
        className={`fixed bottom-[100px] left-1/2 -translate-x-1/2 z-50 bg-secondary/95 backdrop-blur-xl border border-border text-primary font-semibold text-xs px-4 py-2.5 rounded-xl shadow-2xl pointer-events-none transition-all duration-300 ${
          toast.show ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95'
        }`}
      >
        {toast.msg}
      </div>

    </div>
  );
}
