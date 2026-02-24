import https from "https";
import http from "http";

export async function checkUrlStatus(
  url: string
): Promise<{ status: number; ok: boolean }> {
  return new Promise((resolve) => {
    const protocol = url.startsWith("https") ? https : http;
    try {
      const parsedUrl = new URL(url);
      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (url.startsWith("https") ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: "HEAD",
        timeout: 10000,
        rejectUnauthorized: false,
      };
      const req = protocol.request(options, (res) => {
        resolve({ status: res.statusCode || 0, ok: (res.statusCode || 0) < 400 });
      });
      req.on("error", () => resolve({ status: 0, ok: false }));
      req.on("timeout", () => {
        req.destroy();
        resolve({ status: 0, ok: false });
      });
      req.end();
    } catch {
      resolve({ status: 0, ok: false });
    }
  });
}

// Fetch raw text from a URL, following redirects (up to 5)
export async function fetchXml(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const options = { rejectUnauthorized: false };

    const makeRequest = (targetUrl: string, redirectCount = 0) => {
      if (redirectCount > 5) {
        reject(new Error("Too many redirects"));
        return;
      }

      const reqProtocol = targetUrl.startsWith("https") ? https : http;
      reqProtocol
        .get(targetUrl, options, (res) => {
          if (
            res.statusCode &&
            res.statusCode >= 300 &&
            res.statusCode < 400 &&
            res.headers.location
          ) {
            const redirectUrl = new URL(res.headers.location, targetUrl).toString();
            makeRequest(redirectUrl, redirectCount + 1);
            return;
          }
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => resolve(data));
        })
        .on("error", reject);
    };

    makeRequest(url);
  });
}
