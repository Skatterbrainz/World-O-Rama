"use strict";

/**
 * Desktop wrapper for World-O-Rama. The game is a static web app (dist/); this just opens it in a window.
 *
 * - The build is served from a private app:// origin, so localStorage (stats, settings) persists reliably.
 * - The renderer is sandboxed with context isolation and a strict Content-Security-Policy. The only network
 *   access it needs is Wikipedia (summaries and thumbnails on the reveal card).
 * - Links that point to the web open in the system browser.
 */

const { app, BrowserWindow, Menu, net, protocol, session, shell } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const DIST = path.join(__dirname, "..", "dist");
const ORIGIN = "app://world-o-rama";
const ICON = path.join(__dirname, "..", "build", "icon.png");

// Set only by the packaging smoke test: load the app, write a screenshot to this path, print a report, exit.
const SMOKE_OUT = process.env.WORLD_O_RAMA_SMOKE || "";

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://upload.wikimedia.org",
  "connect-src 'self' https://en.wikipedia.org",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

protocol.registerSchemesAsPrivileged([
  { scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
]);

const isWebUrl = (url) => /^https?:\/\//i.test(url);

async function serveDist(request) {
  const { pathname } = new URL(request.url);
  let rel = decodeURIComponent(pathname);
  if (rel === "/" || rel === "") rel = "/index.html";
  const file = path.normalize(path.join(DIST, rel));
  if (file !== DIST && !file.startsWith(DIST + path.sep)) return new Response("Forbidden", { status: 403 });
  if (!fs.existsSync(file)) return new Response("Not found", { status: 404 });
  const res = await net.fetch(pathToFileURL(file).toString());
  const headers = new Headers(res.headers);
  headers.set("Content-Security-Policy", CSP);
  return new Response(res.body, { status: res.status, headers });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 880,
    minWidth: 900,
    minHeight: 600,
    title: "World-O-Rama",
    backgroundColor: "#0e1420",
    icon: fs.existsSync(ICON) ? ICON : undefined,
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false },
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isWebUrl(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, url) => {
    if (url.startsWith(ORIGIN)) return;
    event.preventDefault();
    if (isWebUrl(url)) void shell.openExternal(url);
  });

  if (SMOKE_OUT) runSmokeTest(win);
  void win.loadURL(`${ORIGIN}/`);
  return win;
}

function runSmokeTest(win) {
  const errors = [];
  win.webContents.on("console-message", (...args) => {
    const first = args[0];
    const level = first && typeof first === "object" && "level" in first ? first.level : args[1];
    const message = first && typeof first === "object" && "message" in first ? first.message : args[2];
    if (level === "error" || level === 3) errors.push(String(message));
  });
  win.webContents.on("did-fail-load", (_e, code, desc, url) => errors.push(`load failed ${code} ${desc} ${url}`));
  win.webContents.on("did-finish-load", () => {
    setTimeout(async () => {
      try {
        const info = await win.webContents.executeJavaScript(`({
          clue: document.querySelector(".clue-text")?.textContent ?? null,
          countryShapes: document.querySelectorAll("svg path.country").length,
          theme: document.documentElement.dataset.theme ?? null,
          storage: (() => { try { localStorage.setItem("probe", "1"); localStorage.removeItem("probe"); return true; } catch { return false; } })(),
        })`);
        const image = await win.webContents.capturePage();
        fs.writeFileSync(SMOKE_OUT, image.toPNG());
        const ok = errors.length === 0 && info.countryShapes > 200 && !!info.clue && !/^(Unrolling|Dusting|Consulting|Sharpening)/.test(info.clue) && info.storage;
        console.log("SMOKE_RESULT " + JSON.stringify({ ok, errors, ...info, screenshot: SMOKE_OUT }));
        app.exit(ok ? 0 : 1);
      } catch (e) {
        console.log("SMOKE_RESULT " + JSON.stringify({ ok: false, error: String(e) }));
        app.exit(1);
      }
    }, 5000);
  });
}

if (!app.requestSingleInstanceLock() && !SMOKE_OUT) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const [win] = BrowserWindow.getAllWindows();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    protocol.handle("app", serveDist);
    session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
    Menu.setApplicationMenu(null);
    createWindow();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => app.quit());
}
