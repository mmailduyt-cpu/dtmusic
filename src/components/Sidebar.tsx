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
import { Track, S3Connection } from '../types';

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
  s3Connection?: S3Connection | null;
  onS3ConnectionChange?: (conn: S3Connection | null) => void;
  onS3BulkAdd?: (files: { key: string; size: number }[]) => void;
  driveClientId?: string;
  driveClientSecret?: string;
  onDriveClientIdChange?: (id: string) => void;
  onDriveClientSecretChange?: (secret: string) => void;
  driveToken?: { accessToken: string; refreshToken?: string; expiresIn: number } | null;
  onDriveDisconnect?: () => void;
  onDriveBulkAdd?: (files: { id: string; title: string; webContentLink: string }[]) => void;
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
  s3Connection,
  onS3ConnectionChange,
  onS3BulkAdd,
  driveClientId,
  driveClientSecret,
  onDriveClientIdChange,
  onDriveClientSecretChange,
  driveToken,
  onDriveDisconnect,
  onDriveBulkAdd,
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
  const [r2ManualMode, setR2ManualMode] = useState<boolean>(false);
  const [r2FilesText, setR2FilesText] = useState<string>('');

  // S3 Authenticated Connection State
  const [s3Endpoint, setS3Endpoint] = useState(() => s3Connection?.endpoint || '');
  const [s3Bucket, setS3Bucket] = useState(() => s3Connection?.bucket || '');
  const [s3Region, setS3Region] = useState(() => s3Connection?.region || 'auto');
  const [s3AccessKey, setS3AccessKey] = useState(() => s3Connection?.accessKeyId || '');
  const [s3SecretKey, setS3SecretKey] = useState(() => s3Connection?.secretAccessKey || '');
  const [s3Status, setS3Status] = useState<{ type: 'idle' | 'loading' | 'ok' | 'err' | 'scanning'; msg: string }>({
    type: 'idle',
    msg: '',
  });
  const [s3Mode, setS3Mode] = useState<'public' | 'auth'>('auth');
  const [s3ShowKeys, setS3ShowKeys] = useState(false);
  const [showCorsGuide, setShowCorsGuide] = useState(false);
  const [s3Files, setS3Files] = useState<{ key: string; size: number }[]>([]);
  const [s3SelectedFiles, setS3SelectedFiles] = useState<Set<string>>(new Set());

  // Google Drive State
  const [driveUrl, setDriveUrl] = useState('');
  const [driveName, setDriveName] = useState('');
  const [driveScanStatus, setDriveScanStatus] = useState<'idle' | 'loading' | 'ok' | 'err' | 'scanning'>('idle');
  const [driveScanMsg, setDriveScanMsg] = useState('');
  const [driveFiles, setDriveFiles] = useState<{ id: string; title: string; webContentLink: string }[]>([]);

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

<<<<<<< HEAD
  const handleConnectDrive = () => {
    if (!driveUrl.trim()) return;

    const match = driveUrl.match(/[-\w]{25,}/);
    const id = match ? match[0] : driveUrl;
    const streamUrl = `https://www.googleapis.com/drive/v3/files/${id}?alt=media&key=${(import.meta as any).env?.VITE_GOOGLE_API_KEY || ''}`;

    const rawTitle = driveName.trim() || `Tệp mã ${id.substring(0, 5)}`;
    onCloudTrackAdd({
      source: 'Drive',
      title: `Drive - ${rawTitle}`,
      artist: 'Google Drive Stream',
      url: streamUrl,
=======
  const handleS3Test = async () => {
    if (!s3Endpoint || !s3Bucket || !s3AccessKey || !s3SecretKey) {
      setS3Status({ type: 'err', msg: 'Vui lòng điền đầy đủ thông tin kết nối' });
      return;
    }
    setS3Status({ type: 'loading', msg: '⏳ Đang kiểm tra kết nối...' });
    try {
      const res = await fetch('/api/s3/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: s3Endpoint,
          bucket: s3Bucket,
          region: s3Region,
          accessKeyId: s3AccessKey,
          secretAccessKey: s3SecretKey,
        }),
      });
      let data;
      try { data = await res.json(); } catch { throw new Error('Server trả về dữ liệu không hợp lệ. Kiểm tra lại server hoặc Vercel logs.'); }
      if (!res.ok) throw new Error(data.error || 'Lỗi không xác định từ server');
      setS3Status({ type: 'ok', msg: '✅ Kết nối thành công! Bucket S3 có thể truy cập.' });
      onS3ConnectionChange?.({
        endpoint: s3Endpoint,
        bucket: s3Bucket,
        region: s3Region,
        accessKeyId: s3AccessKey,
        secretAccessKey: s3SecretKey,
      });
    } catch (err: any) {
      setS3Status({ type: 'err', msg: `❌ Lỗi: ${err.message || 'Không thể kết nối'}` });
    }
  };

  const handleS3Scan = async () => {
    if (!s3Connection) {
      setS3Status({ type: 'err', msg: 'Vui lòng kiểm tra kết nối trước khi quét' });
      return;
    }
    setS3Status({ type: 'scanning', msg: '🔍 Đang quét file nhạc...' });
    try {
      const res = await fetch('/api/s3/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(s3Connection),
      });
      let data;
      try { data = await res.json(); } catch { throw new Error('Server trả về dữ liệu không hợp lệ'); }
      if (!res.ok) throw new Error(data.error || 'Lỗi không xác định');
      if (data.files.length === 0) {
        setS3Status({ type: 'err', msg: 'Không tìm thấy file nhạc nào trong bucket' });
        return;
      }
      setS3Files(data.files);
      const allKeys = new Set<string>(data.files.map((f: any) => f.key));
      setS3SelectedFiles(allKeys);
      setS3Status({ type: 'ok', msg: `Tìm thấy ${data.total} file nhạc. Chọn file muốn import bên dưới.` });
    } catch (err: any) {
      setS3Status({ type: 'err', msg: `❌ Lỗi quét: ${err.message}` });
    }
  };

  const toggleS3File = (key: string) => {
    setS3SelectedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const importSelectedS3 = () => {
    const selected = s3Files.filter((f) => s3SelectedFiles.has(f.key));
    if (selected.length === 0) {
      setS3Status({ type: 'err', msg: 'Chưa chọn file nào' });
      return;
    }
    onS3BulkAdd?.(selected);
    setS3Status({ type: 'ok', msg: `✅ Đã thêm ${selected.length} bài hát từ S3` });
    setS3Files([]);
    setS3SelectedFiles(new Set());
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  const handleS3ClearConnection = () => {
    onS3ConnectionChange?.(null);
    setS3Endpoint('');
    setS3Bucket('');
    setS3Region('auto');
    setS3AccessKey('');
    setS3SecretKey('');
    setS3Status({ type: 'idle', msg: '' });
  };

  const handleConnectDrive = () => {
    if (!driveUrl.trim()) return;

    // Extract file ID
    const match = driveUrl.match(/[-\w]{25,}/);
    const id = match ? match[0] : driveUrl;
    // Dùng confirm=t để bỏ qua trang cảnh báo virus scanning của Google Drive
    const streamUrl = `https://drive.google.com/uc?export=download&confirm=t&id=${id}`;

    const rawTitle = driveName.trim() || `Tệp mã ${id.substring(0, 5)}`;
    const title = `Drive - ${rawTitle}`;
    onCloudTrackAdd({
      source: 'Drive',
      title,
      artist: 'Google Drive Stream',
      url: streamUrl, // Original URL, will be proxied by App.tsx
>>>>>>> parent of 7f098e5 (u)
    });

    setDriveUrl('');
    setDriveName('');
  };

<<<<<<< HEAD
=======
  const handleDriveOAuth = () => {
    if (!driveClientId || !driveClientSecret) {
      setDriveScanStatus('err');
      setDriveScanMsg('Vui lòng nhập Google Client ID và Client Secret');
      return;
    }
    const redirectUri = window.location.origin;
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(driveClientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent('https://www.googleapis.com/auth/drive.readonly')}&access_type=offline&prompt=consent`;
    sessionStorage.setItem('dt_drive_oauth_pending', 'true');
    window.location.href = authUrl;
  };

  const handleDriveScan = async () => {
    if (!driveToken?.accessToken) {
      setDriveScanStatus('err');
      setDriveScanMsg('Chưa có token truy cập. Vui lòng kết nối lại.');
      return;
    }
    setDriveScanStatus('scanning');
    setDriveScanMsg('🔍 Đang quét file nhạc từ Google Drive...');
    try {
      const res = await fetch('/api/drive/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: driveToken.accessToken }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.files.length === 0) {
        setDriveScanStatus('err');
        setDriveScanMsg('Không tìm thấy file nhạc nào trong Drive');
        return;
      }
      setDriveFiles(data.files);
      setDriveScanStatus('ok');
      setDriveScanMsg(`✅ Tìm thấy ${data.total} file nhạc. Nhấn "Import tất cả" để thêm vào danh sách.`);
    } catch (err: any) {
      setDriveScanStatus('err');
      setDriveScanMsg(`❌ Lỗi: ${err.message}`);
    }
  };

>>>>>>> parent of 7f098e5 (u)
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

        {/* CLOUDFLARE R2 TAB */}
        {activeTab === 'r2' && (
          <div className="space-y-2">
            {/* Mode Toggle: Public vs Authenticated */}
            <div className="flex items-center justify-between">
              <span className="text-[9px] inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-black uppercase tracking-wider">
                ⭐ Cloud Storage
              </span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setS3Mode('auth')}
                  className={`px-2 py-0.5 text-[8.5px] font-extrabold uppercase rounded border cursor-pointer ${
                    s3Mode === 'auth'
                      ? 'bg-accent/15 border-accent text-accent'
                      : 'border-border text-muted hover:text-secondary'
                  }`}
                >
                  🔐 Có khóa
                </button>
                <button
                  type="button"
                  onClick={() => setS3Mode('public')}
                  className={`px-2 py-0.5 text-[8.5px] font-extrabold uppercase rounded border cursor-pointer ${
                    s3Mode === 'public'
                      ? 'bg-accent/15 border-accent text-accent'
                      : 'border-border text-muted hover:text-secondary'
                  }`}
                >
                  🌐 Public
                </button>
              </div>
            </div>

            {/* ─── AUTHENTICATED S3 MODE ─── */}
            {s3Mode === 'auth' && (
              <div className="space-y-2">
                <div className="space-y-1">
                  <label className="block text-[9.5px] font-extrabold uppercase tracking-wider text-secondary/90">
                    S3 Endpoint URL
                  </label>
                  <input
                    type="url"
                    value={s3Endpoint}
                    onChange={(e) => setS3Endpoint(e.target.value)}
                    placeholder="https://<account-id>.r2.cloudflarestorage.com"
                    className="w-full bg-primary/40 border border-border/70 hover:border-accent/40 focus:border-accent focus:ring-1 focus:ring-accent rounded-lg px-3 py-1.5 text-xs text-primary placeholder-muted/65 outline-none transition-all duration-200"
                  />
                  <p className="text-[8.5px] text-muted leading-normal">
                    Cloudflare R2: Vào Cloudflare Dash &gt; R2 &gt; Chọn Bucket. Copy <b>'S3 API Endpoint'</b> ở cột phải.
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="block text-[9.5px] font-extrabold uppercase tracking-wider text-secondary/90">
                    Bucket Name
                  </label>
                  <input
                    type="text"
                    value={s3Bucket}
                    onChange={(e) => setS3Bucket(e.target.value)}
                    placeholder="my-music-bucket"
                    className="w-full bg-primary/40 border border-border/70 hover:border-accent/40 focus:border-accent focus:ring-1 focus:ring-accent rounded-lg px-3 py-1.5 text-xs text-primary placeholder-muted/65 outline-none transition-all duration-200"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[9.5px] font-extrabold uppercase tracking-wider text-secondary/90">
                    Region
                  </label>
                  <input
                    type="text"
                    value={s3Region}
                    onChange={(e) => setS3Region(e.target.value)}
                    placeholder="auto (mặc định)"
                    className="w-full bg-primary/40 border border-border/70 hover:border-accent/40 focus:border-accent focus:ring-1 focus:ring-accent rounded-lg px-3 py-1.5 text-xs text-primary placeholder-muted/65 outline-none transition-all duration-200"
                  />
                  <p className="text-[8.5px] text-muted leading-normal">
                    R2 dùng <b>auto</b>. AWS S3 dùng tên region như <b>us-east-1</b>, <b>ap-southeast-1</b>.
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="block text-[9.5px] font-extrabold uppercase tracking-wider text-secondary/90">
                    Access Key ID
                  </label>
                  <input
                    type={s3ShowKeys ? 'text' : 'password'}
                    value={s3AccessKey}
                    onChange={(e) => setS3AccessKey(e.target.value)}
                    placeholder="R2 Access Key ID"
                    className="w-full bg-primary/40 border border-border/70 hover:border-accent/40 focus:border-accent focus:ring-1 focus:ring-accent rounded-lg px-3 py-1.5 text-xs text-primary placeholder-muted/65 outline-none transition-all duration-200"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[9.5px] font-extrabold uppercase tracking-wider text-secondary/90">
                    Secret Access Key
                  </label>
                  <input
                    type={s3ShowKeys ? 'text' : 'password'}
                    value={s3SecretKey}
                    onChange={(e) => setS3SecretKey(e.target.value)}
                    placeholder="R2 Secret Access Key"
                    className="w-full bg-primary/40 border border-border/70 hover:border-accent/40 focus:border-accent focus:ring-1 focus:ring-accent rounded-lg px-3 py-1.5 text-xs text-primary placeholder-muted/65 outline-none transition-all duration-200"
                  />
                  <p className="text-[8.5px] text-muted leading-normal">
                    Vào R2 &gt; <b>Manage R2 API Tokens</b> &gt; Tạo Token mới với quyền <b>Read</b> để lấy cặp khóa.
                  </p>
                </div>

                {/* Show/Hide keys toggle */}
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={s3ShowKeys}
                    onChange={(e) => setS3ShowKeys(e.target.checked)}
                    className="w-3 h-3 accent-accent rounded"
                  />
                  <span className="text-[8.5px] text-muted font-medium">Hiện khóa API</span>
                </label>

                <div className="flex gap-1.5">
                  <button
                    onClick={handleS3Test}
                    disabled={s3Status.type === 'loading' || s3Status.type === 'scanning'}
                    className="flex-1 py-1.5 px-3 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-accent text-white hover:bg-accent-dim active:scale-[0.98] transition-all duration-200 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    {s3Status.type === 'loading' ? '⏳' : '🔍'} Kiểm tra kết nối
                  </button>
                  {s3Connection && (
                    <button
                      onClick={handleS3Scan}
                      disabled={s3Status.type === 'loading' || s3Status.type === 'scanning'}
                      className="py-1.5 px-3 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-accent/20 text-accent border border-accent/30 hover:bg-accent/30 active:scale-[0.98] transition-all duration-200 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {s3Status.type === 'scanning' ? '⏳' : '📡'} Quét
                    </button>
                  )}
                </div>

                {s3Connection && s3Status.type === 'ok' && (
                  <button
                    onClick={handleS3ClearConnection}
                    className="w-full py-1 px-3 rounded-lg text-[9px] font-bold text-rose-400 border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 active:scale-[0.98] transition-all duration-200 cursor-pointer"
                  >
                    ❌ Xóa thông tin kết nối
                  </button>
                )}

                {s3Files.length > 0 && (
                  <div className="space-y-1 border border-border/40 rounded-lg p-1.5 bg-primary/20">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[8.5px] text-secondary font-bold">{s3Files.length} files ({s3SelectedFiles.size} selected)</span>
                      <div className="flex gap-1">
                        <button onClick={() => setS3SelectedFiles(new Set(s3Files.map(f => f.key)))} className="text-[7.5px] px-1.5 py-0.5 rounded bg-accent/10 text-accent cursor-pointer font-bold">All</button>
                        <button onClick={() => setS3SelectedFiles(new Set())} className="text-[7.5px] px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 cursor-pointer font-bold">None</button>
                        <button onClick={importSelectedS3} className="text-[7.5px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 cursor-pointer font-bold">📥 Import</button>
                      </div>
                    </div>
                    <div className="max-h-[100px] overflow-y-auto space-y-0.5">
                      {s3Files.map((f) => (
                        <label key={f.key} className="flex items-center gap-1.5 px-1 py-0.5 rounded hover:bg-hover cursor-pointer text-[8px]">
                          <input
                            type="checkbox"
                            checked={s3SelectedFiles.has(f.key)}
                            onChange={() => toggleS3File(f.key)}
                            className="w-2.5 h-2.5 accent-accent"
                          />
                          <span className="truncate flex-1 text-primary">{f.key.split('/').pop() || f.key}</span>
                          <span className="text-muted shrink-0 font-mono">{formatFileSize(f.size)}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {s3Status.type !== 'idle' && s3Files.length === 0 && (
                  <div
                    className={`text-[9.5px] font-semibold p-2 rounded-lg border leading-snug ${
                      s3Status.type === 'ok'
                        ? 'bg-emerald-500/5 text-emerald-400 border-emerald-500/15'
                        : s3Status.type === 'scanning'
                        ? 'bg-blue-500/5 text-blue-400 border-blue-500/15'
                        : 'bg-rose-500/5 text-rose-400 border-rose-500/15'
                    }`}
                  >
                    {s3Status.msg}
                  </div>
                )}
              </div>
            )}

            {/* ─── PUBLIC BUCKET MODE ─── */}
            {s3Mode === 'public' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] inline-flex items-center gap-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded font-black uppercase tracking-wider">
                    ⚠️ Public
                  </span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setR2ManualMode(false)}
                      className={`px-2 py-0.5 text-[8.5px] font-extrabold uppercase rounded border cursor-pointer ${
                        !r2ManualMode
                          ? 'bg-accent/15 border-accent text-accent'
                          : 'border-border text-muted hover:text-secondary'
                      }`}
                    >
                      Tự động quét
                    </button>
                    <button
                      type="button"
                      onClick={() => setR2ManualMode(true)}
                      className={`px-2 py-0.5 text-[8.5px] font-extrabold uppercase rounded border cursor-pointer ${
                        r2ManualMode
                          ? 'bg-accent/15 border-accent text-accent'
                          : 'border-border text-muted hover:text-secondary'
                      }`}
                    >
                      Dán tên tệp
                    </button>
                  </div>
                </div>
                
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

                {!r2ManualMode ? (
                  <>
                    <p className="text-[9px] text-muted leading-relaxed">
                      Quét tự động yêu cầu bật <b>"Bucket Listing"</b> trong R2 Bucket → Settings.
                    </p>
                    <button
                      onClick={handleConnectR2}
                      className="w-full py-1.5 px-3 rounded-lg text-xs font-bold uppercase tracking-wider bg-accent text-white hover:bg-accent-dim active:scale-[0.98] transition-all duration-200 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-sm"
                      disabled={r2Status.type === 'loading'}
                    >
                      {r2Status.type === 'loading' ? '⌛ Đang đọc...' : '⚡ Kết nối & Quét nhạc'}
                    </button>
                  </>
                ) : (
                  <>
                    <div className="space-y-1">
                      <label className="block text-[9.5px] font-extrabold uppercase tracking-wider text-secondary/90">
                        Danh sách tên tệp nhạc
                      </label>
                      <textarea
                        rows={3}
                        value={r2FilesText}
                        onChange={(e) => setR2FilesText(e.target.value)}
                        placeholder="song_01.mp3&#10;rap_lofi.flac&#10;chill_beat.m4a"
                        className="w-full bg-primary/40 border border-border/70 hover:border-accent/40 focus:border-accent focus:ring-1 focus:ring-accent rounded-lg p-2 text-xs text-primary placeholder-muted/65 outline-none transition-all duration-200 font-mono resize-none leading-relaxed"
                      />
                    </div>
                    <button
                      onClick={handleConnectR2Manual}
                      className="w-full py-1.5 px-3 rounded-lg text-xs font-bold uppercase tracking-wider bg-accent text-white hover:bg-accent-dim active:scale-[0.98] transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      💾 Nạp nhạc thủ công
                    </button>
                  </>
                )}

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
                    className={`text-[9.5px] font-semibold p-2 rounded-lg border leading-snug space-y-1 ${
                      r2Status.type === 'ok' 
                        ? 'bg-emerald-500/5 text-emerald-400 border-emerald-500/15' 
                        : 'bg-rose-500/5 text-rose-400 border-rose-500/15'
                    }`}
                  >
                    <div>{r2Status.msg}</div>
                    {r2Status.type === 'err' && !r2ManualMode && (
                      <div className="text-[8.5px] text-muted border-t border-rose-500/10 pt-1 leading-normal font-sans">
                        💡 Thử chuyển sang tab <b>"Dán tên tệp"</b> để nạp thủ công, hoặc dùng chế độ <b>"Có khóa"</b> ở trên.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* GOOGLE DRIVE TAB */}
        {activeTab === 'drive' && (
          <div className="space-y-2">
            {/* Drive OAuth Connect / Status */}
            {driveToken ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between bg-emerald-500/5 border border-emerald-500/15 rounded-lg p-2">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[9.5px] text-emerald-400 font-bold">Đã kết nối Google Drive</span>
                  </div>
                  <button
                    onClick={onDriveDisconnect}
                    className="text-[9px] px-2 py-0.5 rounded border border-rose-500/20 text-rose-400 hover:bg-rose-500/10 cursor-pointer font-bold"
                  >
                    ❌ Ngắt
                  </button>
                </div>

                <button
                  onClick={handleDriveScan}
                  disabled={driveScanStatus === 'loading'}
                  className="w-full py-1.5 px-3 rounded-lg text-xs font-bold uppercase tracking-wider bg-accent text-white hover:bg-accent-dim active:scale-[0.98] transition-all duration-200 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-sm"
                >
                  {driveScanStatus === 'loading' ? '⏳' : '📡'} Quét file nhạc từ Drive
                </button>

                {driveScanStatus !== 'idle' && (
                  <div
                    className={`text-[9.5px] font-semibold p-2 rounded-lg border leading-snug ${
                      driveScanStatus === 'ok'
                        ? 'bg-emerald-500/5 text-emerald-400 border-emerald-500/15'
                        : driveScanStatus === 'scanning'
                        ? 'bg-blue-500/5 text-blue-400 border-blue-500/15'
                        : 'bg-rose-500/5 text-rose-400 border-rose-500/15'
                    }`}
                  >
                    {driveScanMsg}
                  </div>
                )}

                {driveFiles.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[9.5px] text-secondary font-bold">
                        Tìm thấy {driveFiles.length} file nhạc
                      </span>
                      <button
                        onClick={() => {
                          onDriveBulkAdd?.(driveFiles);
                          setDriveFiles([]);
                          setDriveScanStatus('ok');
                          setDriveScanMsg(`✅ Đã thêm ${driveFiles.length} bài hát vào danh sách`);
                        }}
                        className="text-[9px] px-2 py-0.5 rounded bg-accent text-white hover:bg-accent-dim cursor-pointer font-bold"
                      >
                        📥 Import tất cả
                      </button>
                    </div>
                    <div className="max-h-[120px] overflow-y-auto space-y-0.5 border border-border/40 rounded-lg p-1">
                      {driveFiles.map((f) => (
                        <div key={f.id} className="text-[8.5px] text-primary truncate px-1.5 py-0.5 hover:bg-hover rounded">
                          🎵 {f.title.replace(/\.[^.]+$/, '')}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {/* Single URL import (existing method) */}
                <div className="bg-accent/5 border border-accent/10 rounded-lg p-2 space-y-1.5">
                  <span className="text-[9px] font-bold text-accent uppercase tracking-wider">Nhập nhanh từ URL</span>
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

                {/* OAuth Connect Section */}
                <div className="border-t border-border/40 pt-2 space-y-2">
                  <div className="flex items-center gap-1">
                    <span className="text-[11px]">🟦</span>
                    <span className="text-[9.5px] font-bold text-primary uppercase tracking-wider">Kết nối OAuth</span>
                    <span className="text-[8px] text-muted font-medium">(quét toàn bộ Drive)</span>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[9px] font-bold uppercase tracking-wider text-secondary/80">
                      Google Client ID
                    </label>
                    <input
                      type="text"
                      value={driveClientId}
                      onChange={(e) => onDriveClientIdChange?.(e.target.value)}
                      placeholder="123456.apps.googleusercontent.com"
                      className="w-full bg-primary/40 border border-border/70 hover:border-accent/40 focus:border-accent focus:ring-1 focus:ring-accent rounded-lg px-3 py-1.5 text-xs text-primary placeholder-muted/65 outline-none transition-all duration-200"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[9px] font-bold uppercase tracking-wider text-secondary/80">
                      Google Client Secret
                    </label>
                    <input
                      type="password"
                      value={driveClientSecret}
                      onChange={(e) => onDriveClientSecretChange?.(e.target.value)}
                      placeholder="GOCSPX-..."
                      className="w-full bg-primary/40 border border-border/70 hover:border-accent/40 focus:border-accent focus:ring-1 focus:ring-accent rounded-lg px-3 py-1.5 text-xs text-primary placeholder-muted/65 outline-none transition-all duration-200"
                    />
                  </div>

                  <button
                    onClick={handleDriveOAuth}
                    disabled={!driveClientId || !driveClientSecret}
                    className="w-full py-1.5 px-3 rounded-lg text-xs font-bold uppercase tracking-wider bg-[#4285F4] text-white hover:bg-[#3367D6] active:scale-[0.98] transition-all duration-200 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <span>🟦</span> Kết nối với Google Drive
                  </button>

                  <div className="flex flex-col gap-1">
                    <a
                      href="https://console.cloud.google.com/apis/credentials"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[9px] text-[#4285F4] hover:text-[#3367D6] underline font-medium"
                    >
                      🔑 Mở Google Cloud Console → Credentials
                    </a>
                    <p className="text-[8px] text-muted leading-normal">
                      Tạo <b>OAuth Client ID</b> loại <b>Web application</b>, thêm <code className="text-accent">{window.location.origin}</code> vào <b>Authorized redirect URIs</b> rồi copy Client ID và Secret vào ô trên.
                    </p>
                  </div>
                </div>
              </div>
            )}
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
                    <div className="w-8 h-8 rounded-md bg-secondary flex items-center justify-center shrink-0 overflow-hidden border border-border">
                      {track.art ? (
                        <img src={track.art} alt={track.title} className="w-full h-full object-cover" />
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
