# PageMedic

A modern, real-time web crawler built with Next.js and Playwright that crawls websites, detects broken links (internal & external), broken images, console errors, and navigation issues—streaming results live to your browser.

![PageMedic](https://img.shields.io/badge/PageMedic-v2.0-indigo?style=flat-square)
![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)
![Playwright](https://img.shields.io/badge/Playwright-Latest-green?style=flat-square)

## Overview

**PageMedic** is a powerful web health checker that uses Playwright's Chromium browser to diagnose your website. It detects broken internal and external links, broken images, console errors, and navigation issues—tracking where problems originate and displaying all events in real-time. Perfect for website auditing, SEO analysis, and quality assurance.

## Features

### 🔗 Broken Link Detection
- **Internal & External Links**: Checks both internal links and external links on your pages
- **Status Code Categorization**: Filter by status code type with built-in tabs:
  - **404 Not Found** — Truly broken links that need fixing
  - **401 Unauthorized** — Pages requiring authentication
  - **403 Forbidden** — Access denied (may be intentional)
  - **5xx Server Errors** — Server-side issues
- **Source Page Tracking**: Shows exactly which page contains the broken link
- **Link Text & Context**: Displays the anchor text and HTML element location (nav, footer, etc.)
- **Referrer Tracking**: When a page returns 404, see all pages that link to it
- **Smart External Checking**: Skips social media domains that block bots (Twitter, Facebook, etc.)

### 🖼️ Broken Image Detection
- **Failed Image Detection**: Finds images that fail to load
- **Alt Text Display**: Shows the image's alt attribute for identification
- **Element Context**: Shows which section of the page contains the broken image
- **Failure Reason**: Displays why the image failed (HTTP 404, zero width, incomplete load)

### ⚠️ Navigation Issues
- **Separate from Broken Links**: Timeouts and connection failures are tracked separately
- **False Positive Prevention**: Navigation issues may work when accessed directly
- **Grouped by Reason**: Issues are grouped by error type for easier analysis

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
- **Tabbed Interface**: Activity Log, Broken Links, Broken Images, Console Errors, Nav Issues
- **Live Statistics**: Track pages crawled, broken links, broken images, errors, and warnings
- **Expandable Details**: Click on any item to see full details
- **Copy URLs**: One-click copy for broken URLs
- **Clickable Source Pages**: Jump directly to the page containing the issue

### 🎨 User Experience
- **Light/Dark Theme**: Toggle between themes with smooth transitions
- **Scroll to Bottom Button**: Appears when scrolled up in the activity log
- **Auto-scroll**: Logs auto-scroll when at bottom, pause when reviewing
- **Live Indicator**: Pulsing indicator shows when crawling is active
- **Responsive Design**: Works on desktop and tablet screens
- **Form Submission**: Press Enter in URL fields to start crawling

### ⚙️ Smart Crawling
- **Sitemap Support**: Import URLs from sitemap.xml with sitemap index support
- **CSS Selector Scoping**: Only check links & images within a specific selector (e.g., `.main-content`)
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
- **Navigation vs Broken**: Timeouts tracked separately from actual 404s

## Screenshots

### Link Preview Mode
Before crawling, discover and select which pages to check:
- 🔍 Real-time link discovery with progress
- ✓ Select/deselect individual links or ranges
- 📊 Shows total links, sitemap links, and pages scanned

### Activity Log
Real-time crawling progress with live updates:
- 🔍 Currently crawling URL with spinner
- ✅ Successful operations
- ❌ Errors and broken resources
- 🌐 External link checking progress
- 📊 Queue and batch status

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

### Navigation Issues Panel
Separate tracking for:
- Timeout errors
- Connection failures
- Grouped by error reason
- Informational banner explaining these may be false positives

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

3. **Enter CSS Selector** (optional)
   - Only check links & images within specific elements
   - Examples:
     - `.main-content` — Only check inside elements with this class
     - `#article-body` — Only check inside element with this ID
     - `article, .post-content` — Multiple selectors supported
   - Great for ignoring navigation, footer, and sidebar links

4. **Click "Start Crawl" or press Enter**
   - PageMedic discovers all links first
   - Watch real-time discovery progress

5. **Select Pages to Crawl**
   - Review discovered links in the preview
   - Use checkboxes or Shift+Click to select ranges
   - Click "Start Crawl" to begin

6. **Review Issues**
   - Switch between tabs: Activity Log, Broken Links, Broken Images, Console Errors, Nav Issues
   - **Broken Links Tab**: Use sub-tabs to filter by status code (404, 401, 403, 5xx)
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

Each broken link shows:
- **Status Code**: HTTP error code with descriptive label
- **Broken URL**: The URL that returned an error (internal or external)
- **Source Page**: The page containing the link (where you need to fix it!)
- **Link Text**: The anchor text of the broken link
- **Element Location**: HTML context like `<nav>`, `<footer.links>`, etc.

#### Navigation Issues Panel
Separate from broken links, shows:
- **URL**: The URL that failed to load
- **Reason**: Why it failed (timeout, connection refused, etc.)
- **Source Page**: Where the link was found
- **Note**: These may work when accessed directly

#### Console Errors Panel
JavaScript and console errors:
- **Message**: The error message
- **Type**: Error, warning, or JS error
- **Page**: Where it occurred

### Log Message Reference

| Emoji | Meaning |
|-------|---------|
| 🚀 | PageMedic starting |
| 🎯 | CSS selector active |
| 📄 | Loading sitemap |
| ✅ | Success/completion |
| 🔍 | Currently crawling |
| 🔗 | Link information |
| ↳ | Internal link status details |
| 🔎 | Validating links |
| 🌐 | External link checking |
| 🖼️ | Image information |
| 🔗❌ | Broken link detected |
| 🖼️❌ | Broken image detected |
| 🚫 | Request failed |
| ❌ | Console error |
| 🔥 | JavaScript error |
| ⚠️ | Warning/navigation issue |
| 📋 | Queue status |
| 🏁 | Crawl complete |

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
2. User selects links → Crawl API receives selection via POST
3. Playwright launches headless Chromium
4. Each page visited → Extract links, check internal & external
5. Broken resources → Look up referrer, send to client
6. Client receives events → Updates UI in real-time

## Configuration

### Input Options

| Field | Required | Description |
|-------|----------|-------------|
| Start URL | Yes | The URL to begin crawling from |
| Sitemap URL | No | Path to sitemap.xml for comprehensive discovery |
| CSS Selector | No | Scope link/image checking to specific elements |

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
│   ├── NavigationIssuesPanel.tsx # Navigation issues display
│   ├── ContentPanel.tsx      # Tabbed content area
│   ├── ConfigCard.tsx        # URL input & stats
│   ├── LinkPreviewPanel.tsx  # Link selection preview
│   ├── StatsGrid.tsx         # Statistics cards
│   └── ...
├── hooks/
│   ├── useCrawler.ts         # Crawler state management
│   ├── useStats.ts           # Statistics calculation
│   ├── useTheme.ts           # Theme management
│   └── useAutoScroll.ts      # Scroll behavior
├── types/
│   └── crawler.ts            # TypeScript interfaces
├── utils/
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

- [ ] Export results to CSV/JSON
- [ ] Crawl depth limiting
- [ ] Authentication support (login flows)
- [ ] Screenshot capture on errors
- [ ] Performance metrics (Core Web Vitals)
- [ ] Parallel browser instances
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
