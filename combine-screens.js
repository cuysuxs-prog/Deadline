import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENS_DIR = path.join(__dirname, "screens");
const OUT_FILE = path.join(__dirname, "deadline-hunter-dashboard.html");

const SCREENS = [
  { key: "dashboard-overview",   file: "dashboard-overview.html",   label: "Dashboard" },
  { key: "all-tasks",            file: "all-tasks.html",            label: "All Tasks" },
  { key: "all-tasks-refined-ui", file: "all-tasks-refined-ui.html", label: "All Tasks – Refined" },
  { key: "near-deadline",        file: "near-deadline.html",        label: "Near Deadline" },
  { key: "task-calendar",        file: "task-calendar.html",        label: "Calendar" },
  { key: "reports-analytics",    file: "reports-analytics.html",    label: "Reports" },
  { key: "team-management",      file: "team-management.html",      label: "Team" },
  { key: "system-settings",      file: "system-settings.html",      label: "Settings" },
];

// Maps sidebar link text (lowercase) to screen key
const NAV_MAP = {
  "dashboard":    "dashboard-overview",
  "all tasks":    "all-tasks",
  "near deadline":"near-deadline",
  "calendar":     "task-calendar",
  "team":         "team-management",
  "reports":      "reports-analytics",
  "settings":     "system-settings",
};

// Script injected into every iframe — intercepts sidebar clicks and notifies parent
const buildInjectScript = (screenKey) => `
<script>
(function() {
  var NAV_MAP = ${JSON.stringify(NAV_MAP)};
  var CURRENT = ${JSON.stringify(screenKey)};

  // Each <a> contains an icon <span> AND a label <span>.
  // textContent would merge both (e.g. "dashboardDashboard"), so we
  // check every <span> individually to find a NAV_MAP key.
  function navKeyFromAnchor(a) {
    var spans = a.querySelectorAll('span');
    for (var i = 0; i < spans.length; i++) {
      var t = spans[i].textContent.trim().toLowerCase();
      if (NAV_MAP[t]) return NAV_MAP[t];
    }
    return null;
  }

  // Mark which sidebar item is active based on current screen key
  function highlightActive() {
    document.querySelectorAll('aside nav a, aside a').forEach(function(a) {
      var target = navKeyFromAnchor(a);
      var isActive = target === CURRENT;
      if (isActive) {
        a.classList.add('border-l-4','border-primary','bg-primary\\/5','text-primary','font-bold');
        a.classList.remove('text-on-surface-variant','hover:bg-surface-container-high');
      } else {
        a.classList.remove('border-l-4','border-primary','bg-primary\\/5','text-primary','font-bold');
      }
    });
  }

  document.addEventListener('click', function(e) {
    var a = e.target.closest('a');
    if (!a) return;
    var target = navKeyFromAnchor(a);
    if (target) {
      e.preventDefault();
      window.parent.postMessage({ stitchNav: target }, '*');
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', highlightActive);
  } else {
    highlightActive();
  }
})();
</script>`;

function escapeForSrcdoc(html) {
  return html.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

// Inject the nav script just before </body>, handling both </body> and </body></html>
function injectScript(html, script) {
  if (html.includes("</body>")) {
    return html.replace(/<\/body>/, script + "\n</body>");
  }
  return html + script;
}

const screenData = await Promise.all(
  SCREENS.map(async ({ key, file, label }) => {
    const html = await fs.readFile(path.join(SCREENS_DIR, file), "utf8");
    const injected = injectScript(html, buildInjectScript(key));
    return { key, label, html: injected };
  })
);

// Build tab bar (slim, matches app color palette)
const tabs = screenData
  .map(({ key, label }, i) =>
    `<button class="tab${i === 0 ? " active" : ""}" data-key="${key}" onclick="switchTo('${key}')">${label}</button>`
  )
  .join("\n    ");

// Build iframes with srcdoc
const iframes = screenData
  .map(({ key, label, html }, i) =>
    `  <iframe id="frame-${key}" class="screen-frame${i === 0 ? "" : " hidden"}" title="${label}" srcdoc="${escapeForSrcdoc(html)}"></iframe>`
  )
  .join("\n");

const combined = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Deadline Hunter Dashboard</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: system-ui, sans-serif;
      background: #f9f9ff;
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
    }

    /* ── Top tab bar ───────────────────────────────── */
    nav#topbar {
      display: flex;
      align-items: center;
      gap: 2px;
      padding: 6px 10px;
      background: #1e293b;
      border-bottom: 1px solid #334155;
      overflow-x: auto;
      flex-shrink: 0;
      scrollbar-width: thin;
      scrollbar-color: #475569 transparent;
      z-index: 9999;
    }

    nav#topbar .brand {
      color: #93c5fd;
      font-size: 12px;
      font-weight: 700;
      white-space: nowrap;
      padding-right: 10px;
      border-right: 1px solid #334155;
      margin-right: 6px;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }

    .tab {
      padding: 5px 12px;
      border: none;
      border-radius: 5px;
      background: transparent;
      color: #94a3b8;
      font-size: 12px;
      cursor: pointer;
      white-space: nowrap;
      transition: background 0.15s, color 0.15s;
    }
    .tab:hover  { background: #334155; color: #e2e8f0; }
    .tab.active { background: #2563eb; color: #fff; font-weight: 600; }

    /* ── Iframe area ───────────────────────────────── */
    .screen-frame {
      flex: 1;
      width: 100%;
      border: none;
    }
    .hidden { display: none !important; }
  </style>
</head>
<body>
  <nav id="topbar">
    <span class="brand">Deadline Hunter</span>
    ${tabs}
  </nav>

${iframes}

  <script>
    var SCREENS = ${JSON.stringify(SCREENS.map(s => s.key))};

    function switchTo(key) {
      // Update tab styles
      document.querySelectorAll('.tab').forEach(function(t) {
        t.classList.toggle('active', t.dataset.key === key);
      });
      // Show / hide iframes
      document.querySelectorAll('.screen-frame').forEach(function(f) {
        f.classList.toggle('hidden', f.id !== 'frame-' + key);
      });
    }

    // Listen for postMessage from any iframe's sidebar nav
    window.addEventListener('message', function(e) {
      if (e.data && e.data.stitchNav) {
        switchTo(e.data.stitchNav);
      }
    });
  </script>
</body>
</html>`;

await fs.writeFile(OUT_FILE, combined, "utf8");
const stats = await fs.stat(OUT_FILE);
console.log(`Done! ${OUT_FILE} (${(stats.size / 1024).toFixed(1)} KB)`);
