# PageMedic

A modern, real-time web crawler built with Next.js and Playwright that crawls websites, detects broken links (internal & external), broken images, console errors, and meta tag URLs—streaming results live to your browser.

![PageMedic](https://img.shields.io/badge/PageMedic-v2.0-indigo?style=flat-square)
![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)
![Playwright](https://img.shields.io/badge/Playwright-Latest-green?style=flat-square)

## Overview

**PageMedic** is a powerful web health checker that uses Playwright's Chromium browser to diagnose your website. It detects broken internal and external links, broken images, console errors, and meta tag URLs—tracking where problems originate and displaying all events in real-time. Perfect for website auditing, SEO analysis, and quality assurance.

## Features

### 🔗 Broken Link Detection
- **Internal & External Links**: Checks both internal links and external links on your pages
- **Timeout & Connection Failures**: Unreachable URLs (timeouts, connection refused) are reported as broken links with status 0
- **Status Code Categorization**: Filter by status code type with built-in tabs:
  - **404 Not Found** — Truly broken links that need fixing
  - **401 Unauthorized** — Pages requiring authentication
  - **403 Forbidden** — Access denied (may be intentional)
  - **5xx Server Errors** — Server-side issues
  - **Unreachable (0)** — Timeouts and connection failures
- **Source Page Tracking**: Shows exactly which page contains the broken link
- **Link Text & Context**: Displays the anchor text and HTML element location (nav, footer, etc.)
- **Referrer Tracking**: When a page returns 404, see all pages that link to it
- **Smart External Checking**: Skips social media domains that block bots (Twitter, Facebook, etc.)

### 🖼️ Broken Image Detection
- **Failed Image Detection**: Finds images that fail to load
- **Alt Text Display**: Shows the image's alt attribute for identification
- **Element Context**: Shows which section of the page contains the broken image
- **Failure Reason**: Displays why the image failed (HTTP 404, zero width, incomplete load)

### 🔗 Meta Tag URL Verification
- **Open Graph & Twitter Cards**: Validates `og:url`, `og:image`, `twitter:image`, etc.
- **Canonical & Alternate Links**: Checks `<link rel="canonical">`, `<link rel="alternate">`, hreflang links
- **JSON-LD Structured Data**: Recursively extracts and validates URLs from `<script type="application/ld+json">`
- **Meta Refresh**: Validates redirect URLs in `<meta http-equiv="refresh">`
- **Deduplication**: Each URL is checked only once across all sources (links, images, meta tags)

### 🖥️ Console Errors
- **JavaScript Error Detection**: Captures runtime JS errors
- **Console Warnings**: Tracks console.warn and console.error messages
- **Error Context**: Shows which page triggered the error

### 🔎 Link Preview Mode
- **Discover Before Crawling**: See all discovered links before starting the crawl
- **Sitemap Integration**: Automatically parses sitemap.xml and sitemap index files
- **Selective Crawling**: Choose which pages to crawl from the discovered links
- **Real-time Discovery Progress**: Watch as links are discovered with live counters
- **Shift+Click Selection**: Select ranges of links with visual feedback
- **Select All / Deselect All**: Quickly manage large link lists

### 📊 Real-time Dashboard
- **Tabbed Interface**: Activity Log, Broken Links, Broken Images, Console Errors
- **Live Statistics**: Track pages crawled, broken links, broken images, errors, and warnings
- **Crawl Timer**: Shows total elapsed time after crawling completes
- **Expandable Details**: Click on any item to see full details
- **Copy URLs**: One-click copy for broken URLs
- **Clickable Source Pages**: Jump directly to the page containing the issue

### 🎨 User Experience
- **Light/Dark Theme**: Toggle between themes with smooth transitions
- **React Icons**: All UI icons use react-icons (Heroicons 2) instead of emojis for a clean, consistent look
- **Scroll to Bottom Button**: Appears when scrolled up in the activity log
- **Smart Auto-scroll**: Logs auto-scroll when at bottom, pauses when scrolled up, re-locks on "scroll to bottom" click
- **Live Indicator**: Pulsing indicator shows when crawling is active
- **Responsive Design**: Works on desktop and tablet screens
- **Form Submission**: Press Enter in URL fields to start crawling

### ⚙️ Smart Crawling
- **Parallel Workers**: Configurable 1–20 concurrent browser pages for faster crawling
- **Sitemap Support**: Import URLs from sitemap.xml with sitemap index support
- **CSS Selector Scoping**: Set in the Link Preview panel before crawling to scope link & image checking
- **Meta Tag Crawling**: Extracts and validates URLs from Open Graph, Twitter Cards, canonical, hreflang, JSON-LD, and meta refresh tags
- **HTTP/1.1 Mode**: Disables HTTP/2 to prevent `ERR_HTTP2_PROTOCOL_ERROR` with concurrent workers
- **Retry Logic**: Automatic retries with exponential backoff for transient network errors
- **HEAD Request Fallback**: When page navigation fails, verifies the URL via a HEAD request before reporting it broken
- **No Page Limit**: Crawl your entire site without artificial limits
- **Header Link Handling**: Intelligently handles navigation/header links
- **SSL Certificate Handling**: Works with self-signed certificates
- **Origin Isolation**: Only queues same-domain links for crawling
- **Batch Processing**: Crawls in batches for efficiency
- **Resource Type Detection**: Distinguishes between pages, images, and documents
- **Detailed Link Tracking**: See what happens to each internal link (validated, in sitemap, skipped)

### 🛡️ False Positive Prevention
- **Social Media Skip List**: Doesn't flag Twitter, LinkedIn, Facebook, etc. (they block bots)
- **CORS Error Filtering**: Ignores cross-origin resource errors
- **ERR_ABORTED Filtering**: Ignores navigation cancellation errors
- **PDF/Document Handling**: Checks documents via HEAD request instead of navigation
- **HEAD Fallback**: Unreachable pages verified via HEAD request before marking broken

## Screenshots

### Link Preview Mode
Before crawling, discover and select which pages to check:
- Real-time link discovery with progress
- Select/deselect individual links or ranges
- Shows total links, sitemap links, and pages scanned

### Activity Log
Real-time crawling progress with live updates and elapsed timer:
- Currently crawling URL with spinner and worker ID
- Successful operations
- Errors and broken resources
- External link checking progress
- Queue and worker status

### Broken Links Panel
Categorized by status code with filterable tabs:
- **All** — View all HTTP errors
- **404** — Truly broken links (Not Found)
- **401** — Authentication required
- **403** — Access denied
- **5xx** — Server errors

Each card shows:
- Status code with descriptive label
- Broken URL (internal or external)
- **Source page** (where to fix it)
- Link text and element location
- Color-coded by severity (red for 404, amber for auth, purple for server errors)

## Installation

### Prerequisites
- Node.js 18+ 
- pnpm, npm, yarn, or bun

### Setup

1. Clone the repository:
```bash
git clone https://github.com/EvoShishir/playwright-web-crawler.git
cd playwright-web-crawler
```

2. Install dependencies:
```bash
pnpm install
```

3. Install Playwright browsers:
```bash
pnpm exec playwright install chromium
```

## Usage

### Development

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to launch PageMedic.

### Production

```bash
pnpm build
pnpm start
```

### Using PageMedic

1. **Enter Start URL** (required)
   - Example: `https://example.com`

2. **Enter Sitemap URL** (optional)
   - Example: `https://example.com/sitemap.xml`
   - Supports sitemap index files

3. **Set Parallel Workers** (optional, default 3)
   - Drag the slider to choose 1–20 concurrent browser pages
   - Higher values crawl faster but use more RAM
   - See the [Parallel Workers Guide](#parallel-workers-guide) for recommendations

4. **Click "Start Crawl" or press Enter**
   - PageMedic discovers all links first
   - Watch real-time discovery progress

5. **Select Pages to Crawl**
   - Review discovered links in the preview
   - Use checkboxes or Shift+Click to select ranges
   - Optionally set a **CSS Selector** to scope link/image checking
   - Click "Start Crawl" to begin

6. **Review Issues**
   - Switch between tabs: Activity Log, Broken Links, Broken Images, Console Errors
   - **Broken Links Tab**: Use sub-tabs to filter by status code (404, 401, 403, 5xx, Unreachable)
   - Completion time shows how long the crawl took
   - Click on any card to expand details
   - "FIX HERE" label shows which page to edit
   - Click source page link to visit it directly

7. **Stop Anytime**
   - Click "Stop" to halt crawling gracefully

### Understanding the Results

#### Broken Links Panel
Filter by status code using the tabs at the top:
- **404 Not Found**: Pages that don't exist — fix or remove these links
- **401 Unauthorized**: Pages requiring login — may not be broken
- **403 Forbidden**: Access denied — could be intentional (admin areas)
- **5xx Server Errors**: Server issues — usually temporary
- **Unreachable (0)**: Timeouts and connection failures — verified via HEAD request fallback

Each broken link shows:
- **Status Code**: HTTP error code with descriptive label
- **Broken URL**: The URL that returned an error (internal or external)
- **Source Page**: The page containing the link (where you need to fix it!)
- **Link Text**: The anchor text of the broken link
- **Element Location**: HTML context like `<nav>`, `<footer.links>`, etc.

#### Console Errors Panel
JavaScript and console errors:
- **Message**: The error message
- **Type**: Error, warning, or JS error
- **Page**: Where it occurred

### Log Message Reference

Log messages use react-icons (Heroicons 2) in the UI. The table below shows the icon meaning:

| Icon | Meaning |
|------|---------|
| RocketLaunch | PageMedic starting |
| CursorArrowRays | CSS selector active |
| DocumentText | Loading sitemap |
| CheckCircle | Success/completion |
| MagnifyingGlass | Currently crawling |
| Link | Link information |
| ArrowUturnRight | Internal link status details |
| MagnifyingGlassPlus | Validating links |
| GlobeAlt | External link checking |
| Photo | Image information |
| Link + XCircle | Broken link detected |
| Photo + XCircle | Broken image detected |
| NoSymbol | Request failed |
| XCircle | Console error |
| Fire | JavaScript error |
| ExclamationTriangle | Warning/navigation issue |
| ClipboardDocumentList | Queue status |
| Flag | Crawl complete |

## Architecture

### Frontend
- **React 19** with hooks for state management
- **Server-Sent Events (SSE)** for real-time streaming
- **Tailwind CSS** for styling
- **Shadcn UI** for dialog components
- **React Icons** for iconography
- **Component-based** architecture with TypeScript

### Backend
- **Next.js 16** App Router API routes
- **Playwright** for browser automation
- **Streaming responses** via SSE
- **Link registry** for referrer tracking
- **HEAD requests** for efficient link validation

### Data Flow
1. User submits start URL → Discovery API streams found links
2. User selects links and optionally sets CSS selector → Crawl API receives selection via POST
3. Playwright launches headless Chromium (HTTP/1.1) with N worker pages
4. Workers pull from a shared queue → Extract links, images, and meta tag URLs
5. Each URL is deduplicated and validated (HEAD fallback for failed navigations)
6. Broken resources → Look up referrer, send to client
7. Client receives events → Updates UI in real-time, shows elapsed time on completion

## Configuration

### Input Options

| Field | Required | Description |
|-------|----------|-------------|
| Start URL | Yes | The URL to begin crawling from |
| Sitemap URL | No | Path to sitemap.xml for comprehensive discovery |
| CSS Selector | No | Scope link/image checking to specific elements (set in Link Preview panel) |
| Parallel Workers | No | Number of concurrent browser pages (1–20, default 3) |

### CSS Selector Examples

| Selector | Effect |
|----------|--------|
| `.main-content` | Only check links/images inside `.main-content` |
| `#article-body` | Only check inside element with ID `article-body` |
| `article` | Only check inside `<article>` elements |
| `.content, main` | Check inside `.content` OR `<main>` |
| `.wrapper .inner` | Check inside `.inner` that's inside `.wrapper` |

### Adjustable Parameters

In `app/api/crawl/route.ts`:
- `BATCH_SIZE`: URLs per batch (default: 100)
- `timeout`: Navigation timeout (default: 30000ms)

### Parallel Workers Guide

| VPS RAM | Recommended Workers | Notes |
|---------|-------------------|-------|
| 2 GB | 1–3 | Minimal headroom, use conservatively |
| 4 GB | 3–10 | Good for most sites |
| 8 GB | 10–20 | Fast crawling for large sites |

Each worker opens a Chromium tab (~50–150 MB RAM). The slider in the UI lets you pick 1–20 workers.

### Skip Lists

Social media domains that PageMedic skips for external link checking:
- Twitter/X, LinkedIn, Facebook, Instagram
- YouTube, TikTok, Pinterest, Reddit
- Discord, WhatsApp, Telegram, Medium
- Apple App Store, Google Play Store

### Ignored Error Patterns
- CORS policy errors
- `net::ERR_ABORTED`
- `net::ERR_BLOCKED`
- Mixed content warnings
- Security errors

## Technical Stack

| Technology | Purpose |
|------------|---------|
| [Next.js 16](https://nextjs.org) | React framework with App Router |
| [TypeScript](https://www.typescriptlang.org) | Type-safe JavaScript |
| [Playwright](https://playwright.dev) | Browser automation |
| [Tailwind CSS](https://tailwindcss.com) | Utility-first styling |
| [Shadcn UI](https://ui.shadcn.com) | UI components |
| [React Icons](https://react-icons.github.io/react-icons/) | Icon library |
| Server-Sent Events | Real-time streaming |

## Project Structure

```
app/
├── api/
│   ├── crawl/
│   │   └── route.ts          # Crawler API endpoint
│   └── discover/
│       └── route.ts          # Link discovery API endpoint
├── components/
│   ├── ActivityLog.tsx       # Log viewer component
│   ├── BrokenLinksPanel.tsx  # Broken links display
│   ├── BrokenImagesPanel.tsx # Broken images display
│   ├── ConsoleErrorsPanel.tsx # Console errors display
│   ├── ContentPanel.tsx      # Tabbed content area
│   ├── ConfigCard.tsx        # URL input & stats
│   ├── LinkPreviewPanel.tsx  # Link selection preview
│   ├── StatsGrid.tsx         # Statistics cards
│   └── ...
├── hooks/
│   ├── useCrawler.ts         # Crawler state management
│   ├── useCrawlTimer.ts      # Elapsed time tracking
│   ├── useStats.ts           # Statistics calculation
│   ├── useTheme.ts           # Theme management
│   └── useAutoScroll.ts      # Scroll behavior
├── types/
│   └── crawler.ts            # TypeScript interfaces
├── utils/
│   ├── emojiIcons.tsx         # Emoji-to-react-icon mapping
│   ├── logParser.ts          # Log message parsing
│   └── logStyles.ts          # Log styling utilities
├── page.tsx                  # Main PageMedic component
├── layout.tsx                # Root layout
└── globals.css               # Global styles
```

## Limitations

- 30-second timeout per page
- Headless mode only
- No authentication support (public pages only)
- External links to social media are not verified (they block bots)

## Future Enhancements

- [x] Export results to CSV
- [x] Parallel browser workers (1–20 concurrent pages)
- [x] Crawl timer with completion time
- [x] React Icons replacing emojis
- [x] Meta tag URL verification (OG, canonical, hreflang, JSON-LD)
- [x] HTTP/2 error mitigation and retry logic
- [x] HEAD request fallback for unreachable pages
- [ ] Crawl depth limiting
- [ ] Authentication support (login flows)
- [ ] Screenshot capture on errors
- [ ] Performance metrics (Core Web Vitals)
- [ ] Pause/resume functionality
- [ ] Historical crawl comparison
- [ ] Custom ignore patterns
- [ ] Webhook notifications
- [ ] Force validation of sitemap links (currently assumed valid)

## Contributing

Contributions to PageMedic are welcome! Please feel free to submit a Pull Request.

## License

MIT License - feel free to use PageMedic for personal or commercial purposes.

## Support

- [Next.js Documentation](https://nextjs.org/docs)
- [Playwright Documentation](https://playwright.dev)
- [TypeScript Documentation](https://www.typescriptlang.org/docs)

---

**PageMedic** - Diagnose your website's health in real-time 🩺
