import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { Readable } from "stream";
import { createHash, createHmac } from "crypto";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Lazy-initialized Gemini client to prevent startup crashes when API keys are absent
let ai: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!ai) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is required. Please set it in Secrets.");
    }
    ai = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return ai;
}

// AI Lyrics generator API Route
app.all("/api/proxy", async (req, res) => {
  const targetUrl = req.query.url as string;
  if (!targetUrl) {
    return res.status(400).send("No target URL parameter provided.");
  }

  // Handle immediate CORS and preflight
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges, Content-Type");

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }

  const abortController = new AbortController();
  req.on("close", () => {
    abortController.abort();
  });

  try {
    const headers: Record<string, string> = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    };

    if (req.query.access_token) {
      headers["Authorization"] = `Bearer ${req.query.access_token}`;
    }

    if (req.headers.range) {
      headers["Range"] = req.headers.range;
    }

    const response = await fetch(targetUrl, { 
      headers,
      signal: abortController.signal
    });

    // Copy remote response headers to support seeking
    const headersToForward = [
      "content-type",
      "content-length",
      "content-range",
      "accept-ranges",
      "cache-control",
    ];

    headersToForward.forEach((h) => {
      const val = response.headers.get(h);
      if (val) {
        res.setHeader(h, val);
      }
    });

    res.status(response.status);

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as any);
      nodeStream.pipe(res);
      req.on("close", () => {
        nodeStream.destroy();
      });
    } else {
      res.end();
    }
  } catch (err: any) {
    if (err.name === 'AbortError' || err.code === 'ERR_ABORTED') {
      // Connection closed by user, ignore
      return;
    }
    console.error("Express URL proxy stream error:", err);
    if (!res.headersSent) {
      res.status(500).send("Proxy streaming error: " + err.message);
    }
  }
});

app.get("/api/r2-list", async (req, res) => {
  const r2Url = req.query.url as string;
  if (!r2Url) {
    return res.status(400).json({ error: "Missing Cloudflare R2 bucket connection URL." });
  }

  try {
    const listUrl = `${r2Url.replace(/\/$/, '')}/?list-type=2`;
    const response = await fetch(listUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)"
      }
    });

    if (!response.ok) {
      throw new Error(`R2 returned connection code ${response.status}`);
    }

    const xmlText = await response.text();
    res.setHeader("Content-Type", "application/xml");
    res.send(xmlText);
  } catch (err: any) {
    console.error("R2 List retrieval proxy error:", err);
    res.status(500).json({ error: err.message || "Failed to scan R2 bucket file structure" });
  }
});

// ─── Lightweight S3 Client (AWS Signature V4) ───
// Uses only Node.js built-in crypto + fetch, no external SDK needed.
function sha256(data: string): string {
  return createHash('sha256').update(data, 'utf8').digest('hex');
}

function hmacSha256(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data, 'utf8').digest();
}

function getSignatureKey(secret: string, dateStamp: string, region: string, service: string): Buffer {
  const kDate = hmacSha256(`AWS4${secret}`, dateStamp);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, service);
  return hmacSha256(kService, 'aws4_request');
}

function s3SignRequest(
  method: string,
  endpoint: string,
  path: string,
  queryString: string,
  headers: Record<string, string>,
  body: string,
  accessKeyId: string,
  secretAccessKey: string,
  region: string,
): Record<string, string> {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const service = 's3';

  const allHeaders: Record<string, string> = { ...headers, 'x-amz-date': amzDate, host: new URL(endpoint).hostname };
  const sortedKeys = Object.keys(allHeaders).map(k => k.toLowerCase()).sort();
  const signedHeaders = sortedKeys.join(';');
  const canonicalHeaders = sortedKeys.map(k => `${k}:${allHeaders[k]?.trim() || ''}\n`).join('');
  const payloadHash = body ? sha256(body) : sha256('');
  const canonicalRequest = [method, path, queryString, canonicalHeaders, signedHeaders, payloadHash].join('\n');

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, sha256(canonicalRequest)].join('\n');
  const signingKey = getSignatureKey(secretAccessKey, dateStamp, region, service);
  const signature = hmacSha256(signingKey, stringToSign).toString('hex');
  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return { ...allHeaders, Authorization: authorization, 'x-amz-content-sha256': payloadHash };
}

function s3PresignUrl(
  endpoint: string,
  bucket: string,
  key: string,
  accessKeyId: string,
  secretAccessKey: string,
  region: string,
  expiresIn = 3600,
): string {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const service = 's3';

  const host = new URL(endpoint).hostname;
  const path = `/${bucket}/${encodeURI(key)}`;
  const signedHeaders = 'host';

  const params = new URLSearchParams({
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${accessKeyId}/${dateStamp}/${region}/${service}/aws4_request`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expiresIn),
    'X-Amz-SignedHeaders': signedHeaders,
  });

  const canonicalQuery = params.toString().replace(/\+/g, '%20');
  const canonicalHeaders = `host:${host}\n`;
  const canonicalRequest = ['GET', path, canonicalQuery, canonicalHeaders, signedHeaders, 'UNSIGNED-PAYLOAD'].join('\n');

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, sha256(canonicalRequest)].join('\n');
  const signingKey = getSignatureKey(secretAccessKey, dateStamp, region, service);
  const signature = hmacSha256(signingKey, stringToSign).toString('hex');

  const baseUrl = endpoint.replace(/\/$/, '');
  return `${baseUrl}${path}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

async function s3Request(endpoint: string, bucket: string, region: string, accessKeyId: string, secretAccessKey: string, queryString: string): Promise<string> {
  const baseUrl = endpoint.replace(/\/$/, '');
  const path = `/${bucket}`;
  const url = `${baseUrl}${path}?${queryString}`;
  const headers = s3SignRequest('GET', endpoint, path, queryString, {}, '', accessKeyId, secretAccessKey, region);
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
  const text = await res.text();
  if (!res.ok) {
    const code = text.match(/<Code>([^<]+)<\/Code>/)?.[1] || `HTTP${res.status}`;
    const msg = text.match(/<Message>([^<]+)<\/Message>/)?.[1] || res.statusText;
    throw new Error(`${code}: ${msg}`);
  }
  return text;
}

function parseS3Xml(xml: string): { key: string; size: number; lastModified: string }[] {
  const files: { key: string; size: number; lastModified: string }[] = [];
  const items = xml.split('<Contents>');
  for (let i = 1; i < items.length; i++) {
    const key = items[i].match(/<Key>([^<]*)<\/Key>/)?.[1];
    const size = parseInt(items[i].match(/<Size>(\d+)<\/Size>/)?.[1] || '0');
    const lastModified = items[i].match(/<LastModified>([^<]+)<\/LastModified>/)?.[1] || '';
    if (key) files.push({ key, size, lastModified });
  }
  return files;
}

// S3-Compatible Storage API Routes (Cloudflare R2, AWS S3, Backblaze B2)
app.post("/api/s3/test", async (req, res) => {
  try {
    const { endpoint, bucket, region, accessKeyId, secretAccessKey } = req.body;
    if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
      return res.status(400).json({ error: "Missing required parameters." });
    }
    const r = region || 'auto';
    await s3Request(endpoint, bucket, r, accessKeyId, secretAccessKey, 'list-type=2&max-keys=1');
    res.json({ success: true, message: "Kết nối thành công!" });
  } catch (err: any) {
    console.error("S3 test error:", err.message);
    let msg = err.message;
    if (msg.includes('InvalidAccessKeyId')) msg = "Access Key không hợp lệ.";
    else if (msg.includes('SignatureDoesNotMatch')) msg = "Secret Key không đúng.";
    else if (msg.includes('NoSuchBucket')) msg = "Bucket không tồn tại.";
    else if (msg.includes('AccessDenied')) msg = "Token không có quyền Read.";
    else if (msg.includes('ENOTFOUND') || msg.includes('Invalid URL') || msg.includes('fetch failed')) msg = "Endpoint URL không đúng. Với R2 dùng: https://<account-id>.r2.cloudflarestorage.com";
    res.status(400).json({ error: msg });
  }
});

app.post("/api/s3/list", async (req, res) => {
  try {
    const { endpoint, bucket, region, accessKeyId, secretAccessKey } = req.body;
    if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
      return res.status(400).json({ error: "Missing required parameters." });
    }
    const r = region || 'auto';
    const audioExt = new Set(['.mp3', '.flac', '.aac', '.ogg', '.wav', '.m4a', '.wma', '.opus']);
    let allFiles: { key: string; size: number; lastModified?: string }[] = [];
    let token = '';

    do {
      const qs = `list-type=2&max-keys=200${token ? `&continuation-token=${encodeURIComponent(token)}` : ''}`;
      const xml = await s3Request(endpoint, bucket, r, accessKeyId, secretAccessKey, qs);
      const parsed = parseS3Xml(xml).filter(f => audioExt.has(f.key.substring(f.key.lastIndexOf('.'))));
      allFiles = allFiles.concat(parsed);
      const tMatch = xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/);
      token = tMatch ? tMatch[1] : '';
    } while (token);

    res.json({ files: allFiles, total: allFiles.length });
  } catch (err: any) {
    console.error("S3 list error:", err.message);
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/s3/sign", async (req, res) => {
  try {
    const { endpoint, bucket, region, accessKeyId, secretAccessKey, fileKey } = req.body;
    if (!endpoint || !bucket || !accessKeyId || !secretAccessKey || !fileKey) {
      return res.status(400).json({ error: "Missing required parameters." });
    }
    const url = s3PresignUrl(endpoint, bucket, fileKey, accessKeyId, secretAccessKey, region || 'auto');
    res.json({ url });
  } catch (err: any) {
    console.error("S3 sign error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// --------------------------------------------------------------------------------
// FUTURE CLOUD STORAGE INTEGRATIONS (Google Drive, Amazon S3, OneDrive, etc.)
// These sections are placeholders for more advanced integrations that would
// involve OAuth authentication, API interactions, and potentially file browsing.
// Each service would typically require its own set of API routes (e.g., auth,
// token refresh, file listing, content streaming).
// --------------------------------------------------------------------------------

// ─── Google Drive OAuth & API Routes ───
// Google Drive OAuth Token Exchange
app.post("/api/drive/token", async (req, res) => {
  try {
    const { code, clientId, clientSecret, redirectUri } = req.body;
    if (!code || !clientId || !clientSecret || !redirectUri) {
      return res.status(400).json({ error: "Missing required OAuth parameters." });
    }

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokens = await tokenResponse.json();
    if (!tokenResponse.ok) {
      throw new Error(tokens.error_description || tokens.error || "Token exchange failed");
    }

    res.json({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || null,
      expires_in: tokens.expires_in,
    });
  } catch (err: any) {
    console.error("Drive token exchange error:", err);
    res.status(500).json({ error: err.message || "Lỗi trao đổi token Google" });
  }
});

// Google Drive Refresh Token
app.post("/api/drive/refresh", async (req, res) => {
  try {
    const { refreshToken, clientId, clientSecret } = req.body;
    if (!refreshToken || !clientId || !clientSecret) {
      return res.status(400).json({ error: "Missing required refresh parameters." });
    }

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
      }),
    });

    const tokens = await tokenResponse.json();
    if (!tokenResponse.ok) {
      throw new Error(tokens.error_description || tokens.error || "Token refresh failed");
    }

    res.json({
      access_token: tokens.access_token,
      expires_in: tokens.expires_in,
    });
  } catch (err: any) {
    console.error("Drive token refresh error:", err);
    res.status(500).json({ error: err.message || "Lỗi làm mới token Google" });
  }
});

// Google Drive File Listing (proxy for CORS)
app.post("/api/drive/list", async (req, res) => {
  try {
    const { accessToken, query } = req.body;
    if (!accessToken) {
      return res.status(400).json({ error: "Missing access token." });
    }

    const searchQuery = query || "mimeType contains 'audio/' and trashed = false";
    const driveResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(searchQuery)}&fields=files(id,name,size,mimeType,webContentLink,modifiedTime)&pageSize=1000`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const data = await driveResponse.json();
    if (!driveResponse.ok) {
      throw new Error(data.error?.message || "Drive API error");
    }

    const songs = (data.files || []).map((file: any) => ({
      id: file.id,
      title: file.name,
      size: parseInt(file.size || '0'),
      mimeType: file.mimeType,
      webContentLink: file.webContentLink,
      modifiedTime: file.modifiedTime,
    }));

    res.json({ files: songs, total: songs.length });
  } catch (err: any) {
    console.error("Drive list error:", err);
    res.status(500).json({ error: err.message || "Lỗi lấy danh sách Google Drive" });
  }
});

// Google Drive File Streaming via Proxy
app.get("/api/drive/stream/:fileId", async (req, res) => {
  const { accessToken } = req.query;
  if (!accessToken) {
    return res.status(400).send("Missing access token.");
  }

  try {
    const metaResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${req.params.fileId}?fields=webContentLink`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const meta = await metaResponse.json();
    if (!metaResponse.ok) throw new Error(meta.error?.message || "Failed to get file info");

    const streamUrl = `${meta.webContentLink}&access_token=${accessToken}`;
    const fileResponse = await fetch(streamUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!fileResponse.ok) {
      return res.status(fileResponse.status).send("Failed to stream file from Google Drive");
    }

    const headersToForward = ["content-type", "content-length", "content-range", "accept-ranges"];
    headersToForward.forEach((h) => {
      const val = fileResponse.headers.get(h);
      if (val) res.setHeader(h, val);
    });

    res.status(fileResponse.status);
    if (fileResponse.body) {
      const nodeStream = Readable.fromWeb(fileResponse.body as any);
      nodeStream.pipe(res);
      req.on("close", () => nodeStream.destroy());
    } else {
      res.end();
    }
  } catch (err: any) {
    console.error("Drive stream error:", err);
    if (!res.headersSent) res.status(500).send("Stream error: " + err.message);
  }
});

// Example Placeholder for Amazon S3 Integration:
/*
// S3 Setup: Requires AWS credentials (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
// configured in environment variables.

// S3 Bucket Listing API Route
app.get("/api/s3/list", async (req, res) => {
  // Use AWS SDK to list objects in a specified bucket
  // Filter for audio files, generate pre-signed URLs for playback
});

// S3 File Streaming API Route (Optional, if pre-signed URLs are not preferred)
app.get("/api/s3/stream/:bucketName/:key", async (req, res) => {
  // Use AWS SDK to stream content from S3 object
  // Handle range requests for seeking
});
*/

// Example Placeholder for Microsoft OneDrive Integration:
/*
// OneDrive OAuth Routes
app.get("/api/onedrive/auth", (req, res) => {
  // Redirect to Microsoft's OAuth consent screen
});

app.get("/api/onedrive/callback", async (req, res) => {
  // Handle OAuth callback, exchange code for tokens, store tokens securely
});

// OneDrive File Listing API Route
app.get("/api/onedrive/list", async (req, res) => {
  // Use stored tokens to interact with Microsoft Graph API
  // List files, filter for audio, return relevant metadata
});

// OneDrive File Streaming API Route (if direct links are not sufficient/secure)
app.get("/api/onedrive/stream/:fileId", async (req, res) => {
  // Use stored tokens to get a temporary direct link or stream file content
  // Pipe file content to response, handling range requests
});
*/

// AI Lyrics generator API Route
app.post("/api/lyrics", async (req, res) => {
  const { title, artist } = req.body;

  if (!title) {
    return res.status(400).json({ error: "Tiêu đề bài hát không được bỏ trống" });
  }

  try {
    const client = getGeminiClient();
    const prompt = `Tìm lời bài hát "${title}"${artist ? ` của nghệ sĩ "${artist}"` : ""}. 
Nếu bài hát có thật, hãy hiển thị lời chính thức bằng tiếng Việt (hoặc ngôn ngữ gốc).
Nếu không thể tìm thấy lời chính xác, hãy sáng tạo một bài thơ/lời bài hát chất lượng, giàu cảm xúc dựa trên tiêu đề và nghệ sĩ này để người dùng có thể nghe lướt theo nhạc.
Chỉ trả về lời bài hát thuần túy, tuyệt đối KHÔNG viết bất cứ câu thoại giải thích, nhận xét, tiêu đề phụ, ký tự gạch đầu dòng hứa hẹn, hoặc nhãn meta như [Verse], [Chorus]. Trình bày dạng các câu thơ liên tục phân tách dòng.`;

    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    });

    const parsedText = response.text || "";
    if (!parsedText.trim()) {
      return res.status(404).json({ error: "Không tìm thấy lời bài hát" });
    }

    res.json({
      plain: parsedText.trim(),
      source: "ai"
    });
  } catch (err: any) {
    console.error("Gemini server proxy error:", err);
    res.status(500).json({ 
      error: err.message || "Lỗi truy vấn lời từ AI. Vui lòng kiểm tra lại thiết lập khóa API." 
    });
  }
});

// Configure Vite or Static Asset Router
async function start() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server SóngNhạc running on http://0.0.0.0:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  start();
}

export default app;
