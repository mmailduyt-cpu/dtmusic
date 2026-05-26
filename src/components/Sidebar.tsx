import React, { useRef, useState, useEffect } from 'react';
import {
  Folder,
  Cloud,
  FileMusic,
  HardDrive,
  Link,
  Search,
  Filter,
  Trash2,
  AlertCircle,
  HelpCircle,
  CheckCircle,
  UploadCloud,
  Disc,
  Music,
  Pencil
} from 'lucide-react';
import { Track } from '../types';

interface SidebarProps {
  tracks: Track[];
  currentTrackIndex: number;
  onTrackSelect: (index: number) => void;
  onTrackRemove: (id: string) => void;
  onLocalFilesAdd: (files: FileList) => void;
  onCloudTrackAdd: (track: Omit<Track, 'id'>) => void;
  onR2BulkAdd: (url: string, files: string[]) => void;
  onRelinkLocalFile: (id: string, file: File) => void;
  onTrackUpdate?: (id: string, updatedFields: Partial<Track>) => void;
  isOpen?: boolean;
  onClose?: () => void;
  onClearAll?: () => void;
}

type TabType = 'local' | 'r2' | 'drive' | 'dropbox' | 'more';

export default function Sidebar({
  tracks,
  currentTrackIndex,
  onTrackSelect,
  onTrackRemove,
  onLocalFilesAdd,
  onCloudTrackAdd,
  onR2BulkAdd,
  onRelinkLocalFile,
  onTrackUpdate,
  isOpen,
  onClose,
  onClearAll,
}: SidebarProps) {
  const [activeTab, setActiveTab] = useState<TabType>('local');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSource, setFilterSource] = useState('all');
  const [isSourceExpanded, setIsSourceExpanded] = useState(() => tracks.length === 0);

  // Collapses source panel automatically if there are tracks, to optimize screen height for the playlist
  useEffect(() => {
    if (tracks.length > 0) {
      setIsSourceExpanded(false);
    } else {
      setIsSourceExpanded(true);
    }
  }, [tracks.length]);

  // R2 State
  const [r2Url, setR2Url] = useState(() => localStorage.getItem('snhac_r2_url') || '');
  const [r2Status, setR2Status] = useState<{ type: 'idle' | 'loading' | 'ok' | 'err'; msg: string }>({
    type: 'idle',
    msg: '',
  });
  const [r2FilesText, setR2FilesText] = useState<string>('');
  const [showCorsGuide, setShowCorsGuide] = useState(false);

  // Google Drive State
  const [driveUrl, setDriveUrl] = useState('');
  const [driveName, setDriveName] = useState('');

  // Dropbox State
  const [dropboxUrl, setDropboxUrl] = useState('');

  // OneDrive State
  const [onedriveUrl, setOnedriveUrl] = useState('');
  const [onedriveName, setOnedriveName] = useState('');

  // Direct URL State
  const [directUrl, setDirectUrl] = useState('');
  const [directName, setDirectName] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [editingTrack, setEditingTrack] = useState<{ id: string; title: string; artist: string } | null>(null);

  // File replacement ref mapping for lost local files
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [replaceTrackId, setReplaceTrackId] = useState<string | null>(null);

  // Drag and drop events
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
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onLocalFilesAdd(e.dataTransfer.files);
    }
  };

  // Connect cloud functions
    const handleConnectR2 = async () => {
      const trimmedR2Url = r2Url.trim();
      if (!trimmedR2Url) {
        setR2Status({ type: 'err', msg: 'Vui lòng cung cấp Public Bucket URL' });
        return;
      }

      setR2Status({ type: 'loading', msg: 'Đang kết nối...' });
      localStorage.setItem('snhac_r2_url', trimmedR2Url);

      try {
        const proxyListUrl = `/api/r2-list?url=${encodeURIComponent(trimmedR2Url)}`;
        const res = await fetch(proxyListUrl);
        if (!res.ok) {
          throw new Error('Không thể kết nối tải dữ liệu từ bucket của bạn qua máy chủ.');
        }
        const text = await res.text();
        const parser = new DOMParser();
        const xml = parser.parseFromString(text, 'text/xml');
        const keys = Array.from(xml.querySelectorAll('Key')).map((k) => k.textContent || '');
        const audioFiles = keys.filter((f) => /\.(mp3|flac|aac|ogg|wav|m4a)$/i.test(f));

        if (audioFiles.length === 0) {
          setR2Status({ type: 'err', msg: 'Không tìm thấy file nhạc phù hợp trong bucket (MP3, FLAC, AAC, WAV...)' });
          return;
        }

        onR2BulkAdd(trimmedR2Url, audioFiles);
        setR2Status({ type: 'ok', msg: `✅ Đã thêm ${audioFiles.length} bài hát từ R2` });
      } catch (err: any) {
        console.error(err);
        setR2Status({
          type: 'err',
          msg: `Lỗi kết nối: ${err.message || 'Hãy kiểm tra liên kết của bạn đã có quyền truy cập công khai.'}`,
        });
      }
    };

  const handleConnectR2Manual = () => {
    if (!r2Url.trim()) {
      setR2Status({ type: 'err', msg: 'Vui lòng cung cấp Public Bucket URL' });
      return;
    }
    if (!r2FilesText.trim()) {
      setR2Status({ type: 'err', msg: 'Vui lòng điền danh sách tên tệp nhạc để nạp' });
      return;
    }

    const lines = r2FilesText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && /\.(mp3|flac|aac|ogg|wav|m4a)$/i.test(l));

    if (lines.length === 0) {
      setR2Status({ type: 'err', msg: 'Không tìm thấy tên tệp nhạc hợp lệ nào trong danh sách (Đi kèm đuôi .mp3, .flac, .m4a...)' });
      return;
    }

    onR2BulkAdd(r2Url.trim(), lines);
    setR2Status({ type: 'ok', msg: `✅ Đã thêm ${lines.length} bài hát từ R2 thủ công!` });
    setR2FilesText('');
  };

  const handleConnectDropbox = () => {
    if (!dropboxUrl.trim()) return;

    // Convert standard Dropbox url to direct streaming url
    const directDropbox =
      dropboxUrl.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace('?dl=0', '').replace('?raw=1', '') +
      '?raw=1';

    const cleanName =
      dropboxUrl.split('/').pop()?.replace(/\?.*/, '').replace(/\.[^.]+$/, '') || 'Dropbox Shared Track';

    onCloudTrackAdd({
      source: 'Dropbox',
      title: `Dropbox - ${cleanName}`,
      artist: 'Dropbox Stream',
      url: directDropbox, // Original URL, will be proxied by App.tsx
    });

    setDropboxUrl('');
  };

  const handleConnectOneDrive = () => {
    if (!onedriveUrl.trim()) return;

    const rawTitle = onedriveName.trim() || 'Shared Track';
    const title = `OneDrive - ${rawTitle}`;
    onCloudTrackAdd({
      source: 'OneDrive',
      title,
      artist: 'OneDrive Stream',
      url: onedriveUrl, // Original URL, will be proxied by App.tsx
    });

    setOnedriveUrl('');
    setOnedriveName('');
  };

  const handleConnectDirectUrl = () => {
    if (!directUrl.trim()) return;

    const rawTitle =
      directName.trim() || directUrl.split('/').pop()?.replace(/\?.*/, '').replace(/\.[^.]+$/, '') || 'Audio Link';
    const title = `URL - ${rawTitle}`;
    onCloudTrackAdd({
      source: 'URL',
      title,
      artist: 'Trực Tiếp',
      url: directUrl, // Original URL, will be proxied by App.tsx
    });

    setDirectUrl('');
    setDirectName('');
  };

  const handleReplaceFileSelect = (id: string) => {
    setReplaceTrackId(id);
    replaceInputRef.current?.click();
  };

  const handleReplaceFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && replaceTrackId) {
      onRelinkLocalFile(replaceTrackId, file);
    }
    setReplaceTrackId(null);
  };

  // Filter playlist
  const filteredPlaylist = tracks.filter((t) => {
    const query = searchQuery.trim().toLowerCase();
    const matchesQuery =
      !query || t.title.toLowerCase().includes(query) || t.artist.toLowerCase().includes(query);
    const matchesSource = filterSource === 'all' || t.source === filterSource;
    return matchesQuery && matchesSource;
  });

  return (
    <aside
      id="sidebar"
      className={`h-full flex flex-col bg-secondary border-r border-border overflow-hidden select-none transition-transform duration-300 z-50
        fixed inset-y-0 left-0 w-[290px] md:static md:w-[300px] md:translate-x-0 ${
          isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }
      `}
    >
      {/* Brand logo */}
      <div className="sidebar-logo flex items-center justify-between px-4.5 py-3.5 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="relative w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center text-accent border border-accent/25 overflow-hidden shadow-[0_0_10px_rgba(168,85,247,0.3)] shrink-0">
            <Disc className="w-5 h-5 animate-spin" style={{ animationDuration: '4s' }} />
            <Music className="w-2.5 h-2.5 text-white absolute bottom-0.5 right-0.5" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-extrabold text-primary tracking-tight uppercase flex items-center gap-1.5 leading-none">
              DTMusic
              <span className="text-[8px] bg-accent/20 text-accent px-1.5 py-0.5 rounded font-black uppercase tracking-wide">HQ</span>
            </span>
            <span className="text-[8px] text-muted font-bold tracking-widest uppercase mt-0.5">Audiophile Player</span>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center border border-border/85 bg-primary/25 text-secondary hover:text-primary hover:bg-hover active:scale-95 transition-all cursor-pointer font-bold"
            title="Đóng danh sách"
          >
            ✕
          </button>
        )}
      </div>

      {/* Nguồn Nhạc Header Toggler */}
      <div 
        onClick={() => setIsSourceExpanded(!isSourceExpanded)}
        className="flex items-center justify-between px-4 py-2 bg-tertiary/20 hover:bg-tertiary/30 border-b border-border/40 cursor-pointer transition-all duration-200 select-none group"
      >
        <span className="text-[10px] font-extrabold text-secondary group-hover:text-primary uppercase tracking-wider flex items-center gap-1.5 align-middle">
          <HardDrive className="w-3.5 h-3.5 text-accent animate-pulse" />
          Bộ nguồn kết nối nhạc
        </span>
        <span className="text-secondary group-hover:text-primary text-[10px] font-bold flex items-center gap-1">
          {isSourceExpanded ? '▲ Thu gọn' : '▼ Cấu hình'}
        </span>
      </div>

      {/* Cloud source buttons tabs */}
      {isSourceExpanded && (
        <div className="sidebar-tabs flex p-2.5 gap-1 shrink-0 bg-tertiary/10 border-b border-border/45">
          {(['local', 'r2', 'drive', 'dropbox', 'more'] as TabType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all duration-250 cursor-pointer text-center relative border ${
                activeTab === tab
                  ? 'bg-accent/15 border-accent text-accent font-extrabold shadow-sm'
                  : 'bg-transparent border-transparent text-secondary hover:text-primary hover:bg-hover'
              }`}
            >
              {tab === 'local' ? '💻 Local' :
               tab === 'r2' ? '☁️ R2' :
               tab === 'drive' ? '📁 Drive' :
               tab === 'dropbox' ? '📦 Dropbox' : '➕ Khác'}
            </button>
          ))}
        </div>
      )}

      {/* Content panel based on active source tab */}
      {isSourceExpanded && (
        <div className="sidebar-panel shrink-0 max-h-[200px] overflow-y-auto scrollbar-none px-3.5 py-2.5 border-b border-border/40 bg-secondary/80 backdrop-blur-xl">
        {/* LOCAL TAB */}
        {activeTab === 'local' && (
          <div className="space-y-2">
            <div
              ref={dragRef}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border border-dashed rounded-xl p-3.5 text-center cursor-pointer transition-all duration-205 ${
                isDragging
                  ? 'border-accent bg-accent/10 shadow-[0_0_10px_var(--accent-glow)]'
                  : 'border-border bg-primary/10 hover:border-accent hover:bg-accent/5'
              }`}
            >
              <FileMusic className="w-7 h-7 text-accent/80 mx-auto mb-1 animate-bounce" style={{ animationDuration: '3s' }} />
              <p className="text-[11px] font-bold text-primary mb-0.5">Thả nhạc hoặc nhấp để mở</p>
              <span className="text-[9px] text-muted block font-medium">MP3, FLAC, WAV, AAC, M4A</span>
              <input
                type="file"
                ref={fileInputRef}
                multiple
                accept="audio/*"
                onChange={(e) => e.target.files && onLocalFilesAdd(e.target.files)}
                className="hidden"
              />
            </div>
            
            <div className="flex gap-1.5 bg-accent/5 p-2 rounded-lg border border-accent/10">
              <span className="text-xs shrink-0">💡</span>
              <p className="text-[9.5px] text-secondary leading-normal font-semibold">
                Nhạc cục bộ lưu trữ trên trình duyệt của bạn, bảo mật tuyệt đối 100%.
              </p>
            </div>
          </div>
        )}

        {/* CLOUDFLARE R2 / S3 TAB */}
        {activeTab === 'r2' && (
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <span className="text-[9px] inline-flex items-center gap-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded font-black uppercase tracking-wider">
                ⭐ Cloud Storage
              </span>
              <span className="text-[8px] text-muted">R2 Public Bucket</span>
            </div>

            {/* ─── R2 PUBLIC BUCKET ─── */}
              <div className="space-y-2">

                <div className="space-y-1">
                  <label className="block text-[9.5px] font-extrabold uppercase tracking-wider text-secondary/90">
                    R2 Public Bucket URL
                  </label>
                  <input
                    type="url"
                    value={r2Url}
                    onChange={(e) => setR2Url(e.target.value)}
                    placeholder="https://pub-xxx.r2.dev"
                    className="w-full bg-primary/40 border border-border/70 hover:border-accent/40 focus:border-accent focus:ring-1 focus:ring-accent rounded-lg px-3 py-1.5 text-xs text-primary placeholder-muted/65 outline-none transition-all duration-200"
                  />
                  <p className="text-[9px] text-muted leading-normal">
                    Nhạc từ R2 được proxy qua máy chủ (same-origin) để tương thích với <b>bộ EQ Web Audio</b>.
                    Yêu cầu bucket bật <b>"Public Access"</b> + <b>CORS Policy</b> như hướng dẫn bên dưới.
                  </p>
                </div>

                <div className="flex gap-1.5">
                  <button
                    onClick={handleConnectR2}
                    className="flex-1 py-1.5 px-3 rounded-lg text-xs font-bold uppercase tracking-wider bg-accent text-white hover:bg-accent-dim active:scale-[0.98] transition-all duration-200 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-sm"
                    disabled={r2Status.type === 'loading'}
                  >
                    {r2Status.type === 'loading' ? '⌛ Đang đọc...' : '⚡ Kết nối & Quét nhạc'}
                  </button>
                </div>

                <div className="space-y-1">
                  <label className="block text-[9.5px] font-extrabold uppercase tracking-wider text-secondary/90">
                    Hoặc dán tên tệp nhạc thủ công
                  </label>
                  <textarea
                    rows={3}
                    value={r2FilesText}
                    onChange={(e) => setR2FilesText(e.target.value)}
                    placeholder="song_01.mp3&#10;rap_lofi.flac&#10;chill_beat.m4a"
                    className="w-full bg-primary/40 border border-border/70 hover:border-accent/40 focus:border-accent focus:ring-1 focus:ring-accent rounded-lg p-2 text-xs text-primary placeholder-muted/65 outline-none transition-all duration-200 font-mono resize-none leading-relaxed"
                  />
                  <button
                    onClick={handleConnectR2Manual}
                    className="w-full py-1.5 px-3 rounded-lg text-xs font-bold uppercase tracking-wider bg-accent text-white hover:bg-accent-dim active:scale-[0.98] transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    💾 Nạp nhạc thủ công
                  </button>
                </div>

                <button
                  onClick={() => setShowCorsGuide(!showCorsGuide)}
                  className="w-full py-1 px-2 rounded-lg text-[8.5px] font-bold text-muted border border-border/50 hover:border-accent/30 hover:text-accent transition-all cursor-pointer flex items-center justify-center gap-1"
                >
                  {showCorsGuide ? '▲ Ẩn' : '▼'} Hướng dẫn cấu hình CORS cho R2
                </button>

                {showCorsGuide && (
                  <div className="bg-primary/40 border border-border/60 rounded-lg p-2.5 space-y-1.5">
                    <p className="text-[8.5px] text-secondary font-semibold leading-relaxed">
                      Vào tab <b>Settings</b> của Bucket trên Cloudflare &gt; <b>CORS Policy</b> &gt; bấm Edit và dán:
                    </p>
                    <div className="relative">
                      <pre className="text-[7.5px] font-mono text-primary bg-secondary/80 rounded p-2 overflow-x-auto leading-relaxed border border-border/40">
{`[
  {
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": [
      "Content-Range",
      "Content-Length",
      "Accept-Ranges"
    ]
  }
]`}
                      </pre>
                      <button
                        onClick={() => {
                          const corsText = `[\n  {\n    "AllowedOrigins": ["*"],\n    "AllowedMethods": ["GET", "HEAD"],\n    "AllowedHeaders": ["*"],\n    "ExposeHeaders": ["Content-Range", "Content-Length", "Accept-Ranges"]\n  }\n]`;
                          navigator.clipboard.writeText(corsText);
                        }}
                        className="absolute top-1 right-1 text-[8px] px-1.5 py-0.5 rounded bg-accent/20 text-accent hover:bg-accent/30 transition-all cursor-pointer font-bold"
                      >
                        📋 Copy
                      </button>
                    </div>
                  </div>
                )}

                {r2Status.type !== 'idle' && (
                  <div
                    className={`text-[9.5px] font-semibold p-2 rounded-lg border leading-snug ${
                      r2Status.type === 'ok' 
                        ? 'bg-emerald-500/5 text-emerald-400 border-emerald-500/15' 
                        : 'bg-rose-500/5 text-rose-400 border-rose-500/15'
                    }`}
                  >
                    {r2Status.msg}
                  </div>
                )}
              </div>
          </div>
        )}

        {/* GOOGLE DRIVE TAB */}
        {activeTab === 'drive' && (
          <div className="space-y-2">
            <div className="bg-accent/5 border border-accent/10 rounded-lg p-2 space-y-1.5">
              <div className="flex items-center gap-1">
                <span className="text-[9px] font-bold text-accent uppercase tracking-wider">Google Drive</span>
                <span className="text-[8px] text-muted">Dán link → phát nhạc</span>
              </div>
              <input
                type="url"
                value={driveUrl}
                onChange={(e) => setDriveUrl(e.target.value)}
                placeholder="https://drive.google.com/file/d/..."
                className="w-full bg-primary/40 border border-border/70 hover:border-accent/40 focus:border-accent focus:ring-1 focus:ring-accent rounded-lg px-3 py-1.5 text-xs text-primary placeholder-muted/65 outline-none transition-all duration-200"
              />
              <div className="flex gap-1">
                <input
                  type="text"
                  value={driveName}
                  onChange={(e) => setDriveName(e.target.value)}
                  placeholder="Tên bài (tùy chọn)"
                  className="flex-1 bg-primary/40 border border-border/70 hover:border-accent/40 focus:border-accent focus:ring-1 focus:ring-accent rounded-lg px-3 py-1.5 text-xs text-primary placeholder-muted/65 outline-none transition-all duration-200"
                />
                <button onClick={handleConnectDrive} className="px-3 rounded-lg text-xs font-bold bg-accent text-white hover:bg-accent-dim cursor-pointer shrink-0">
                  📥
                </button>
              </div>
            </div>
          </div>
        )}

        {/* DROPBOX TAB */}
        {activeTab === 'dropbox' && (
          <div className="space-y-2">
            <div className="space-y-1">
              <label className="block text-[9.5px] font-extrabold uppercase tracking-wider text-secondary/90">
                Dropbox Stream Link
              </label>
              <input
                type="url"
                value={dropboxUrl}
                onChange={(e) => setDropboxUrl(e.target.value)}
                placeholder="https://www.dropbox.com/s/..."
                className="w-full bg-primary/40 border border-border/70 hover:border-accent/40 focus:border-accent focus:ring-1 focus:ring-accent rounded-lg px-3 py-1.5 text-xs text-primary placeholder-muted/65 outline-none transition-all duration-200"
              />
                <p className="text-[9px] text-muted leading-normal">
                  <b>NOTE</b>: Đảm bảo rằng liên kết Dropbox của bạn là liên kết chia sẻ công khai. Ứng dụng sẽ tự động chuyển đổi nó thành liên kết truyền phát trực tiếp.
                </p>
            </div>

            <button 
              onClick={handleConnectDropbox} 
              className="w-full py-1.5 px-3 rounded-lg text-xs font-bold uppercase tracking-wider bg-accent text-white hover:bg-accent-dim active:scale-[0.98] transition-all duration-200 cursor-pointer shadow-sm"
            >
              📦 Nhập Dropbox Stream
            </button>
          </div>
        )}

        {/* ONEDRIVE & DIRECT TAB */}
        {activeTab === 'more' && (
          <div className="space-y-3 divide-y divide-border/40">
            {/* OneDrive Container */}
            <div className="space-y-1.5 pb-2">
              <h4 className="text-[10px] font-extrabold text-accent uppercase tracking-wider flex items-center gap-1">
                <span>Ⓜ️</span> Microsoft OneDrive
              </h4>
              
              <div className="space-y-1">
                <label className="block text-[9px] font-bold uppercase tracking-wider text-secondary/70">
                  OneDrive Download URL
                  <p className="text-[9px] text-muted leading-normal">
                    <b>NOTE</b>: Bạn cần cung cấp URL tải xuống trực tiếp từ OneDrive. Để lấy URL này, hãy chia sẻ tệp, sau đó nhấp vào "Tải xuống" và sao chép địa chỉ liên kết.
                  </p>
                </label>
                <input
                  type="url"
                  value={onedriveUrl}
                  onChange={(e) => setOnedriveUrl(e.target.value)}
                  placeholder="https://onedrive.live.com/download?..."
                  className="w-full bg-primary/40 border border-border/70 hover:border-accent/40 focus:border-accent focus:ring-1 focus:ring-accent rounded-lg px-2.5 py-1 text-xs text-primary placeholder-muted/60 outline-none transition-all duration-200"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[9px] font-bold uppercase tracking-wider text-secondary/70">
                  Tên hiển thị (Tùy chọn)
                </label>
                <input
                  type="text"
                  value={onedriveName}
                  onChange={(e) => setOnedriveName(e.target.value)}
                  placeholder="Tiêu đề bài hát"
                  className="w-full bg-primary/40 border border-border/70 hover:border-accent/40 focus:border-accent focus:ring-1 focus:ring-accent rounded-lg px-2.5 py-1 text-xs text-primary placeholder-muted/60 outline-none transition-all duration-200"
                />
              </div>

              <button 
                onClick={handleConnectOneDrive} 
                className="w-full py-1.5 px-3 rounded-lg text-xs font-bold uppercase tracking-wider bg-accent text-white hover:bg-accent-dim active:scale-[0.98] transition-all duration-205 cursor-pointer shadow-sm"
              >
                Thêm tệp OneDrive
              </button>
            </div>

            {/* Direct URL Container */}
            <div className="space-y-1.5 pt-2">
              <h4 className="text-[10px] font-extrabold text-accent uppercase tracking-wider flex items-center gap-1">
                <span>🔗</span> Liên kết trực tiếp (URL)
              </h4>

              <div className="space-y-1">
                <label className="block text-[9px] font-bold uppercase tracking-wider text-secondary/70">
                  Đường dẫn tệp (MP3, FLAC, WAV)
                  <p className="text-[9px] text-muted leading-normal">
                    Dán URL trực tiếp tệp âm thanh (.mp3, .flac...). URL sẽ được proxy qua Vercel hoặc Cloudflare Worker để tránh CORS.
                  </p>
                </label>
                <input
                  type="url"
                  value={directUrl}
                  onChange={(e) => setDirectUrl(e.target.value)}
                  placeholder="https://domain.com/sound.mp3"
                  className="w-full bg-primary/40 border border-border/70 hover:border-accent/40 focus:border-accent focus:ring-1 focus:ring-accent rounded-lg px-2.5 py-1 text-xs text-primary placeholder-muted/60 outline-none transition-all duration-200"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[9px] font-bold uppercase tracking-wider text-secondary/70">
                  Tên hiển thị (Tùy chọn)
                </label>
                <input
                  type="text"
                  value={directName}
                  onChange={(e) => setDirectName(e.target.value)}
                  placeholder="Ví dụ: Sound Beat"
                  className="w-full bg-primary/40 border border-border/70 hover:border-accent/40 focus:border-accent focus:ring-1 focus:ring-accent rounded-lg px-2.5 py-1 text-xs text-primary placeholder-muted/60 outline-none transition-all duration-200"
                />
              </div>

              <button 
                onClick={handleConnectDirectUrl} 
                className="w-full py-1.5 px-3 rounded-lg text-xs font-bold uppercase tracking-wider bg-accent text-white hover:bg-accent-dim active:scale-[0.98] transition-all duration-205 cursor-pointer shadow-sm"
              >
                Nhập link bài hát
              </button>
            </div>
          </div>
        )}
      </div>
    )}

        {/* PLAYLIST ENTRIES COUNTS */}
      <div className="playlist-area flex flex-col flex-1 min-h-0 border-t border-border bg-tertiary/25">
        <div className="playlist-header flex items-center gap-2 p-2.5 shrink-0">
          {tracks.length > 0 && (
            <button
              onClick={onClearAll}
              className="text-[9px] px-2 py-1 rounded border border-rose-500/20 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-all cursor-pointer font-bold shrink-0 flex items-center gap-1"
              title="Xóa tất cả"
            >
              <Trash2 className="w-3 h-3" /> Clear
            </button>
          )}
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm bài..."
              className="w-full text-xs pl-8 pr-2.5 py-1.5 rounded-lg border border-border bg-secondary text-primary focus:outline-none focus:border-accent"
            />
          </div>
          <div className="relative">
            <Filter className="w-3.5 h-3.5 text-secondary absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value)}
              className="text-[10px] pl-[22px] pr-2 py-1.5 rounded-lg border border-border bg-secondary text-secondary cursor-pointer focus:outline-none font-medium appearance-none"
            >
              <option value="all">Nguồn</option>
              <option value="local">Local</option>
              <option value="S3">S3 Cloud</option>
              <option value="R2">Cloud R2</option>
              <option value="Drive">Drive</option>
              <option value="Dropbox">Dropbox</option>
              <option value="OneDrive">OneDrive</option>
              <option value="URL">Direct Link</option>
            </select>
          </div>
        </div>

        {/* PLAYLIST ITEMS SCROLL LIST */}
        <div className="flex-1 overflow-y-auto min-h-0 px-2 pb-6">
          {filteredPlaylist.length === 0 ? (
            <div className="text-center py-10 px-4 text-muted text-xs">
              Thư viện còn trống.<br />Hãy kéo thả nhạc hoặc liên kết đám mây để khởi tạo.
            </div>
          ) : (
            <ul className="space-y-1">
              {filteredPlaylist.map((track) => {
                const originalIndex = tracks.findIndex((t) => t.id === track.id);
                const isActive = originalIndex === currentTrackIndex;

                return (
                  <li
                    key={track.id}
                    onClick={() => onTrackSelect(originalIndex)}
                    className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg cursor-pointer transition-all group ${
                      isActive
                        ? 'bg-accent/10 border border-accent/20'
                        : 'hover:bg-hover border border-transparent'
                    }`}
                  >
                    {/* Item Thumbnail */}
                    <div className={`w-8 h-8 rounded-md bg-secondary flex items-center justify-center shrink-0 overflow-hidden border border-border ${track.source === 'S3' ? 'border-accent/20' : ''}`}>
                      {track.art ? (
                        <img src={track.art} alt={track.title} className="w-full h-full object-cover" />
                      ) : track.source === 'S3' ? (
                        <Cloud className={`w-4 h-4 ${isActive ? 'text-accent' : 'text-muted'}`} />
                      ) : track.source === 'Drive' ? (
                        <HardDrive className={`w-4 h-4 ${isActive ? 'text-accent' : 'text-muted'}`} />
                      ) : track.source === 'Dropbox' ? (
                        <Folder className={`w-4 h-4 ${isActive ? 'text-accent' : 'text-muted'}`} />
                      ) : track.source === 'OneDrive' ? (
                        <Cloud className={`w-4 h-4 ${isActive ? 'text-accent' : 'text-cyan-400'}`} />
                      ) : track.source === 'R2' ? (
                        <Cloud className={`w-4 h-4 ${isActive ? 'text-accent' : 'text-orange-400'}`} />
                      ) : (
                        <FileMusic className={`w-4 h-4 ${isActive ? 'text-accent' : 'text-muted'}`} />
                      )}
                    </div>

                    {/* Meta info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs font-semibold truncate ${isActive ? 'text-accent' : 'text-primary'}`}>
                          {track.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] text-muted truncate max-w-[100px]">
                          {track.artist || (track.source === 'local' ? 'File đã tải' : 'Online Stream')}
                        </span>
                        <span className="text-[8px] px-1.5 py-[1px] border border-border rounded bg-secondary text-muted uppercase font-bold shrink-0">
                          {track.source}
                        </span>
                        {track.missing && (
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReplaceFileSelect(track.id);
                            }}
                            className="text-[8.5px] text-warning flex items-center gap-0.5 font-semibold hover:underline animate-pulse bg-warning/5 px-1 py-[1px] rounded"
                            title="Nhấp để tải lại tệp tin đã lưu"
                          >
                            <AlertCircle className="w-2.5 h-2.5 text-warning shrink-0" /> Cần chọn lại tệp
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Edit & Delete actions */}
                    <div className="flex items-center shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingTrack({
                            id: track.id,
                            title: track.title,
                            artist: track.artist || '',
                          });
                        }}
                        className="text-muted hover:text-accent p-1 rounded hover:bg-accent/10 transition-colors cursor-pointer opacity-0 group-hover:opacity-100 mr-0.5"
                        title="Sửa tên bài hát"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onTrackRemove(track.id);
                        }}
                        className="text-muted hover:text-danger p-1 rounded hover:bg-danger/8 transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                        title="Xoá khỏi danh sách"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Edit Track Info Dialog Overlays */}
      {editingTrack && (
        <div className="absolute inset-0 bg-secondary/95 backdrop-blur-md z-45 p-4.5 flex flex-col justify-center animate-in fade-in duration-200">
          <div className="bg-primary border border-border/80 p-4 rounded-xl space-y-3 shadow-xl">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-accent flex items-center gap-1">
              <span>📝</span> Sửa thông tin nhạc
            </h3>
            
            <div className="space-y-1">
              <label className="block text-[9.5px] text-secondary font-bold uppercase tracking-wider">Tên bài hát</label>
              <input
                type="text"
                value={editingTrack.title}
                onChange={(e) => setEditingTrack({ ...editingTrack, title: e.target.value })}
                className="w-full bg-secondary border border-border rounded-lg p-2 text-xs text-primary focus:outline-none focus:border-accent"
                placeholder="Tên bài hát..."
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[9.5px] text-secondary font-bold uppercase tracking-wider">Nghệ sĩ / Ca sĩ</label>
              <input
                type="text"
                value={editingTrack.artist}
                onChange={(e) => setEditingTrack({ ...editingTrack, artist: e.target.value })}
                className="w-full bg-secondary border border-border rounded-lg p-2 text-xs text-primary focus:outline-none focus:border-accent"
                placeholder="Tên ca sĩ..."
              />
            </div>

            <div className="flex gap-2 pt-1 justify-end">
              <button
                onClick={() => setEditingTrack(null)}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-secondary hover:text-primary transition-all cursor-pointer border border-border"
              >
                Hủy bỏ
              </button>
              <button
                onClick={() => {
                  if (editingTrack.title.trim() && onTrackUpdate) {
                    onTrackUpdate(editingTrack.id, {
                      title: editingTrack.title.trim(),
                      artist: editingTrack.artist.trim(),
                    });
                    setEditingTrack(null);
                  }
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-accent text-white hover:bg-accent-dim transition-all cursor-pointer"
              >
                Lưu lại
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Relink File Selector */}
      <input
        type="file"
        ref={replaceInputRef}
        onChange={handleReplaceFileChange}
        accept="audio/*"
        className="hidden"
      />
    </aside>
  );
}
