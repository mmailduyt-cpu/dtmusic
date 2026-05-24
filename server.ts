import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { Readable } from "stream";

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

// --------------------------------------------------------------------------------
// FUTURE CLOUD STORAGE INTEGRATIONS (Google Drive, Amazon S3, OneDrive, etc.)
// These sections are placeholders for more advanced integrations that would
// involve OAuth authentication, API interactions, and potentially file browsing.
// Each service would typically require its own set of API routes (e.g., auth,
// token refresh, file listing, content streaming).
// --------------------------------------------------------------------------------

// Example Placeholder for Google Drive Integration:
/*
// Google Drive OAuth Routes
app.get("/api/drive/auth", (req, res) => {
  // Redirect to Google's OAuth consent screen
});

app.get("/api/drive/callback", async (req, res) => {
  // Handle OAuth callback, exchange code for tokens, store tokens securely
});

// Google Drive File Listing API Route
app.get("/api/drive/list", async (req, res) => {
  // Use stored tokens to interact with Google Drive API
  // List files, filter for audio, return relevant metadata
});

// Google Drive File Streaming API Route (if direct links are not sufficient/secure)
app.get("/api/drive/stream/:fileId", async (req, res) => {
  // Use stored tokens to get a temporary direct link or stream file content
  // Pipe file content to response, handling range requests
});
*/

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
