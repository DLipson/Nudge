import {
  app,
  BrowserWindow,
  ipcMain,
  Tray,
  Menu,
  nativeImage,
  Notification,
  net,
} from "electron";
import path from "path";

const isDev = !app.isPackaged;

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    backgroundColor: "#1a1a1a",
    show: false,
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:3000");
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  mainWindow.once("ready-to-show", () => {
    mainWindow!.show();
  });

  // Minimize to tray on close instead of quitting
  mainWindow.on("close", (event) => {
    event.preventDefault();
    mainWindow!.hide();
  });
}

function createTray(): void {
  // 16x16 transparent placeholder icon (replace with real icon in assets/)
  const icon = nativeImage.createFromDataURL(
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAABiSURBVDhPY/hPIqCuAQwMDAxMeORpYgADg7sBAxgYGBjYGDgYGBjYGDgYGBjYGDgYGBjYGDgYGBjYGDgYGBjYGDgYGBjYGDgYGBjYGDgYGBjYGDgYGBjYGDgYiAIAHCIE7b6YJYUAAAAASUVORK5CYII="
  );

  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Show Nudge",
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
      },
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        app.exit(0);
      },
    },
  ]);

  tray.setToolTip("Nudge");
  tray.setContextMenu(contextMenu);

  tray.on("double-click", () => {
    mainWindow?.show();
    mainWindow?.focus();
  });
}

// ── IPC Handlers ─────────────────────────────────────────────────────────────

interface FetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

// Workflowy API requests — no CORS restrictions in the main process
ipcMain.handle(
  "workflowy:fetch",
  async (
    _event,
    url: string,
    options: FetchOptions = {}
  ): Promise<{ ok: boolean; status: number; statusText: string; text: string }> => {
    const response = await net.fetch(url, {
      method: options.method || "GET",
      headers: options.headers,
      body: options.body,
    });

    const text = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      text,
    };
  }
);

// OS-level native notifications
ipcMain.handle(
  "notification:show",
  (_event, title: string, body: string) => {
    if (!Notification.isSupported()) return;

    const notification = new Notification({ title, body });

    notification.on("click", () => {
      mainWindow?.show();
      mainWindow?.focus();
    });

    notification.show();
  }
);

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  createWindow();
  createTray();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      mainWindow?.show();
    }
  });
});

// Keep running in tray — don't quit when all windows are closed
app.on("window-all-closed", () => {
  // intentionally empty: app lives in system tray
});
