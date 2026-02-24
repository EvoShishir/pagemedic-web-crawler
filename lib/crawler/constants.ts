export const NON_HTML_EXTENSIONS = [
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
  ".zip", ".rar", ".7z", ".tar", ".gz",
  ".mp3", ".mp4", ".avi", ".mov", ".wmv", ".wav", ".ogg", ".webm",
  ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".ico", ".bmp", ".tiff", ".tif",
  ".eps", ".ai", ".psd",
  ".css", ".js", ".json", ".xml", ".txt", ".csv",
  ".woff", ".woff2", ".ttf", ".eot", ".otf",
];

// Domains that commonly block automated requests (false positives)
export const SKIP_EXTERNAL_DOMAINS = [
  "twitter.com", "x.com", "linkedin.com", "facebook.com", "instagram.com",
  "tiktok.com", "youtube.com", "pinterest.com", "reddit.com", "discord.com",
  "whatsapp.com", "t.me", "telegram.org", "snapchat.com", "medium.com",
  "apple.com", "apps.apple.com", "play.google.com",
];

// Error messages to ignore (not actual broken resources)
export const IGNORE_ERROR_PATTERNS = [
  /CORS/i,
  /Access-Control-Allow-Origin/i,
  /cross-origin/i,
  /net::ERR_ABORTED/i,
  /net::ERR_BLOCKED/i,
  /net::ERR_FAILED/i,
  /SecurityError/i,
  /Mixed Content/i,
  /insecure content/i,
];
