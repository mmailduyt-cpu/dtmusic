// Cloudflare Worker — Universal Audio Proxy cho DTMusic
// Bypass Vercel free tier limits (10s timeout, 4.5MB response)
// Deploy: `npx wrangler deploy` hoặc paste vào Cloudflare Dashboard
// Worker URL: https://proxy.<your-subdomain>.workers.dev

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get('url');

    if (!targetUrl) {
      return new Response('Missing ?url= parameter', { status: 400 });
    }

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: corsHeaders(request),
      });
    }

    try {
      // Forward the request with same headers (Range, etc.)
      const headers = new Headers(request.headers);
      headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

      // Forward access_token if present
      const accessToken = url.searchParams.get('access_token');
      if (accessToken) {
        headers.set('Authorization', `Bearer ${accessToken}`);
      }

      const response = await fetch(targetUrl, {
        method: request.method,
        headers,
      });

      // Build response with CORS headers
      const responseHeaders = new Headers(response.headers);

      // Forward essential headers for audio streaming
      const essentialHeaders = [
        'content-type', 'content-length', 'content-range',
        'accept-ranges', 'cache-control', 'etag',
      ];
      for (const h of essentialHeaders) {
        const val = response.headers.get(h);
        if (val) responseHeaders.set(h, val);
      }

      // Add CORS headers
      const cors = corsHeaders(request);
      for (const [key, val] of cors) {
        responseHeaders.set(key, val);
      }

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    } catch (err) {
      return new Response(`Proxy error: ${err.message}`, { status: 502 });
    }
  },
};

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '*';
  return new Headers({
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges, Content-Type, Etag',
    'Access-Control-Max-Age': '86400',
  });
}
