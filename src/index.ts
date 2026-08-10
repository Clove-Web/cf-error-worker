export interface Env {
  // Add bindings here later if you need them (KV, env vars, etc.)
}

const CONTACT_DISCORD = "doughmination";
const CONTACT_DISCORD_ID = "1464890289922641993";
const CONTACT_EMAIL = "admin@doughmination.win";

type OriginState = "unreachable" | "5xx";

/** Max number of characters of the origin's error body we keep. */
const MAX_ORIGIN_BODY = 2048;

interface ErrorDetails {
  status: number;
  origin: OriginState;
  request: Request;
  originBody?: string | null;
  originBodyTruncated?: boolean;
  originHeaders?: Record<string, string> | null;
}

interface ErrorReport {
  error: {
    status: number;
    statusText: string;
    timestamp: string;
  };
  request: {
    method: string;
    url: string;
    path: string;
    cfRay: string | null;
    userAgent: string | null;
  };
  origin: {
    reachable: boolean;
    /** null when the origin never responded (connection refused, DNS, etc.) */
    status: number | null;
    /** The origin's raw error body, capped; null if unreachable/empty. */
    body: string | null;
    bodyTruncated: boolean;
    /** Allowlisted origin response headers (content-type + x-*). */
    headers: Record<string, string> | null;
  };
  contact: {
    discord: string;
    discordId: string;
    email: string;
  };
}

const STATUS_TEXT: Record<number, string> = {
  500: "Internal Server Error",
  501: "Not Implemented",
  502: "Bad Gateway",
  503: "Service Unavailable",
  504: "Gateway Timeout",
  520: "Web Server Returned an Unknown Error",
  521: "Web Server Is Down",
  522: "Connection Timed Out",
  523: "Origin Is Unreachable",
  524: "A Timeout Occurred",
};

function buildReport({
  status,
  origin,
  request,
  originBody,
  originBodyTruncated,
  originHeaders,
}: ErrorDetails): ErrorReport {
  const url = new URL(request.url);
  return {
    error: {
      status,
      statusText: STATUS_TEXT[status] ?? "Server Error",
      timestamp: new Date().toISOString(),
    },
    request: {
      method: request.method,
      url: request.url,
      path: url.pathname + url.search,
      cfRay: request.headers.get("cf-ray"),
      userAgent: request.headers.get("user-agent"),
    },
    origin: {
      reachable: origin !== "unreachable",
      status: origin === "unreachable" ? null : status,
      body: originBody ?? null,
      bodyTruncated: originBodyTruncated ?? false,
      headers: originHeaders ?? null,
    },
    contact: {
      discord: CONTACT_DISCORD,
      discordId: CONTACT_DISCORD_ID,
      email: CONTACT_EMAIL,
    },
  };
}

/** Escape a string so it is safe to drop inside an HTML text node. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Read an origin error body, capped to MAX_ORIGIN_BODY characters. */
async function readBodyCapped(
  response: Response,
): Promise<{ text: string; truncated: boolean }> {
  let text: string;
  try {
    text = await response.text();
  } catch {
    return { text: "", truncated: false };
  }
  if (text.length > MAX_ORIGIN_BODY) {
    return { text: text.slice(0, MAX_ORIGIN_BODY), truncated: true };
  }
  return { text, truncated: false };
}

/** Keep only content-type and x-* headers; never expose set-cookie. */
function pickOriginHeaders(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    const k = key.toLowerCase();
    if (k === "set-cookie") return;
    if (k === "content-type" || k.startsWith("x-")) {
      out[k] = value;
    }
  });
  return out;
}

function errorPage(details: ErrorDetails): string {
  const report = buildReport(details);
  const status = report.error.status;
  // Only expose the debug JSON when the owner opts in via a request header.
  // Set "X-Dough-Owner: true" (e.g. with a header-editor extension) to see it.
  const showDebug = details.request.headers.get("x-dough-owner") === "true";
  const reportJson = JSON.stringify(report, null, 2);
  const reportJsonHtml = escapeHtml(reportJson);
  // Safe to embed in a <script> tag: JSON.stringify already escapes quotes,
  // and we neutralise the only sequence that could close the tag early.
  const reportJsonScript = reportJson.replace(/</g, "\\u003c");

  const debugBlock = showDebug
    ? `
      <details class="debug" open>
        <summary>
          <span>Debug info (for the site owner)</span>
          <button type="button" class="debug-copy" id="debug-copy">copy JSON</button>
        </summary>
        <pre class="debug-json" id="debug-json">${reportJsonHtml}</pre>
      </details>`
    : "";

  const debugScript = showDebug
    ? `
      var errorReport = ${reportJsonScript};

      document.getElementById("debug-copy").addEventListener("click", function (event) {
        event.preventDefault();
        var btn = event.currentTarget;
        var text = JSON.stringify(errorReport, null, 2);
        navigator.clipboard.writeText(text).then(function () {
          var original = btn.textContent;
          btn.textContent = "copied!";
          setTimeout(function () { btn.textContent = original; }, 1500);
        });
      });`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Site temporarily unavailable</title>
    <style>
      /* Matches personal-website: dark trans-pink palette + Comic Code.
         Tokens mirror src/styles/themes.css.ts. */
      @font-face {
        font-family: "Comic Code";
        src: url("https://m.doughmination.gay/f/Comic-Code/woff2/ComicCode-Regular.woff2") format("woff2"),
             url("https://m.doughmination.gay/f/Comic-Code/woff/ComicCode-Regular.woff") format("woff");
        font-weight: 400;
        font-style: normal;
        font-display: swap;
      }
      @font-face {
        font-family: "Comic Code";
        src: url("https://m.doughmination.gay/f/Comic-Code/woff2/ComicCode-Medium.woff2") format("woff2"),
             url("https://m.doughmination.gay/f/Comic-Code/woff/ComicCode-Medium.woff") format("woff");
        font-weight: 500;
        font-style: normal;
        font-display: swap;
      }
      @font-face {
        font-family: "Comic Code";
        src: url("https://m.doughmination.gay/f/Comic-Code/woff2/ComicCode-Bold.woff2") format("woff2"),
             url("https://m.doughmination.gay/f/Comic-Code/woff/ComicCode-Bold.woff") format("woff");
        font-weight: 700;
        font-style: normal;
        font-display: swap;
      }
      :root {
        --bg-deep: #05060a;
        --bg-raised: #0e1017;
        --bg: #0a0b10;
        --surface: #12141c;
        --surface-hi: #1b1e2a;
        --surface-higher: #232838;
        --text-faint: #5b6480;
        --text-dim: #6b7391;
        --text-muted: #9aa3c2;
        --text-soft: #c9cfe0;
        --text: #f4f6fb;
        --accent: #f5a9b8;
        --accent-alt: #d15f8c;
        color-scheme: dark;
      }
      * { box-sizing: border-box; }
      body {
        font-family: "Comic Code", ui-monospace, SFMono-Regular, Menlo, monospace;
        background: linear-gradient(135deg, var(--bg) 0%, var(--bg-raised) 60%, var(--bg-deep) 100%);
        color: var(--text);
        display: flex;
        min-height: 100vh;
        min-height: 100dvh;
        align-items: center;
        justify-content: center;
        margin: 0;
        text-align: center;
        padding: 1.5rem 1rem;
        position: relative;
      }
      /* Estrogen watermark, matching the site background. */
      body::before {
        content: "";
        position: fixed;
        inset: 0;
        background: url("https://m.doughmination.gay/img/bg/estrogen.svg") center / cover no-repeat;
        filter: invert(86%) sepia(8%) saturate(900%) hue-rotate(190deg) brightness(105%);
        opacity: 0.05;
        pointer-events: none;
        z-index: 0;
      }
      /* Miku chibi in the corner, matching the site background. */
      body::after {
        content: "";
        position: fixed;
        right: 0.5rem;
        bottom: 0.5rem;
        width: clamp(96px, 14vw, 168px);
        aspect-ratio: 564 / 547;
        background: url("https://m.doughmination.gay/img/bg/miku.png") center / contain no-repeat;
        opacity: 0.18;
        pointer-events: none;
        z-index: 0;
      }
      .card {
        position: relative;
        z-index: 1;
        max-width: 420px;
        background: var(--surface);
        border: 1px solid var(--surface-higher);
        border-radius: 12px;
        padding: 2.5rem 2rem;
      }
      h1 { font-size: 1.4rem; margin-bottom: 0.5rem; color: var(--accent); font-weight: 700; }
      p { line-height: 1.5; color: var(--text-soft); }
      .contact { margin-top: 1.5rem; font-size: 0.95rem; }
      .contact a, .contact button {
        color: var(--accent);
        text-decoration: none;
        font-weight: 500;
        border-bottom: 1px solid rgba(245, 169, 184, 0.4);
        transition: border-color 0.15s ease;
      }
      .contact button {
        font-family: inherit;
        font-size: inherit;
        background: none;
        border-top: none;
        border-left: none;
        border-right: none;
        cursor: pointer;
        padding: 0;
      }
      .contact a:hover, .contact button:hover { border-color: var(--accent); }
      .sep { color: var(--text-dim); margin: 0 0.35rem; }
      .copied { color: var(--accent); font-size: 0.8rem; margin-left: 0.5rem; opacity: 0; transition: opacity 0.15s ease; }
      .copied.show { opacity: 1; }
      .code { color: var(--text-faint); font-size: 0.8rem; margin-top: 2rem; }
      details.debug {
        margin-top: 1.75rem;
        text-align: left;
        border: 1px solid var(--surface-higher);
        border-radius: 8px;
        background: var(--bg-deep);
      }
      details.debug summary {
        cursor: pointer;
        padding: 0.6rem 0.9rem;
        color: var(--accent);
        font-size: 0.85rem;
        list-style: none;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
      }
      details.debug summary::-webkit-details-marker { display: none; }
      details.debug[open] summary { border-bottom: 1px solid var(--surface-higher); }
      .debug-copy {
        font-family: inherit;
        font-size: 0.75rem;
        color: var(--text);
        background: var(--surface-hi);
        border: none;
        border-radius: 6px;
        padding: 0.25rem 0.6rem;
        cursor: pointer;
      }
      .debug-copy:hover { background: var(--surface-higher); }
      pre.debug-json {
        margin: 0;
        padding: 0.9rem;
        overflow-x: auto;
        font-family: "Comic Code", ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 0.78rem;
        line-height: 1.5;
        color: var(--text-muted);
        white-space: pre;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>This page isn't loading right now</h1>
      <p>If this page isn't loading, try again in a few minutes.</p>
      <p>The dedicated server may be restarting.</p>
      <p class="contact">
        Still broken? Contact the owner:<br />
        Discord:
        <a href="https://discord.com/users/${CONTACT_DISCORD_ID}" target="_blank" rel="noopener noreferrer">open profile</a>
        <span class="sep">·</span>
        <button type="button" id="discord-copy">copy username</button>
        <span class="copied" id="discord-copied">copied!</span>
        <br />
        Email: <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>
      </p>
      <p class="code">Error ${status}</p>${debugBlock}
    </div>
    <script>
      document.getElementById("discord-copy").addEventListener("click", function () {
        navigator.clipboard.writeText("${CONTACT_DISCORD}").then(function () {
          var el = document.getElementById("discord-copied");
          el.classList.add("show");
          setTimeout(function () { el.classList.remove("show"); }, 1500);
        });
      });${debugScript}
    </script>
  </body>
</html>`;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    let response: Response;

    try {
      response = await fetch(request);
    } catch {
      // Origin totally unreachable (connection refused, DNS failure inside your infra, etc.)
      return new Response(
        errorPage({ status: 521, origin: "unreachable", request }),
        {
          status: 521,
          headers: { "content-type": "text/html;charset=UTF-8" },
        },
      );
    }

    if (response.status >= 500 && response.status < 600) {
      const { text, truncated } = await readBodyCapped(response);
      return new Response(
        errorPage({
          status: response.status,
          origin: "5xx",
          request,
          originBody: text,
          originBodyTruncated: truncated,
          originHeaders: pickOriginHeaders(response.headers),
        }),
        {
          status: response.status,
          headers: { "content-type": "text/html;charset=UTF-8" },
        },
      );
    }

    return response;
  },
};