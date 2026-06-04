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
import appConfig from "../app-config.json";
import {
  getStartupLaunchOptions,
  getStartupLoginItemOptions,
  type StartupLaunchConfig,
} from "./startup";

const isDev = !app.isPackaged;
const startHidden = process.argv.includes("--hidden");

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

function getStartupLaunchConfig(): StartupLaunchConfig {
  return {
    appPath: app.getAppPath(),
    executablePath: process.execPath,
    isPackaged: app.isPackaged,
  };
}

function getLaunchOnStartup(): boolean {
  const launchConfig = getStartupLaunchConfig();

  return (
    app.getLoginItemSettings(getStartupLaunchOptions(launchConfig))
      .openAtLogin || app.getLoginItemSettings().openAtLogin
  );
}

function setLaunchOnStartup(enabled: boolean): boolean {
  const launchConfig = getStartupLaunchConfig();

  if (!enabled) {
    app.setLoginItemSettings({
      openAtLogin: false,
      openAsHidden: false,
      args: [],
    });
  }

  app.setLoginItemSettings(getStartupLoginItemOptions(enabled, launchConfig));

  return getLaunchOnStartup();
}

function syncLaunchOnStartupRegistration(): void {
  if (getLaunchOnStartup()) {
    setLaunchOnStartup(true);
  }
}

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
    if (!startHidden) {
      mainWindow!.show();
    }
  });

  // Minimize to tray on close instead of quitting
  mainWindow.on("close", (event) => {
    if (isQuitting) {
      return;
    }

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
            label: `Show ${appConfig.appDisplayName}`,
            click: () => {
                mainWindow?.show();
                mainWindow?.focus();
            },
        },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setToolTip(appConfig.appDisplayName);
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

interface NotificationOptions {
  autoDismiss?: boolean;
  durationMs?: number;
}

const DEFAULT_NOTIFICATION_DURATION_MS = 8_000;
const MIN_NOTIFICATION_DURATION_MS = 1_000;
const MAX_NOTIFICATION_DURATION_MS = 300_000;

function getNotificationOptions(
  options?: NotificationOptions
): Required<NotificationOptions> {
  const durationMs =
    typeof options?.durationMs === "number" && Number.isFinite(options.durationMs)
      ? Math.min(
          MAX_NOTIFICATION_DURATION_MS,
          Math.max(MIN_NOTIFICATION_DURATION_MS, options.durationMs)
        )
      : DEFAULT_NOTIFICATION_DURATION_MS;

  return {
    autoDismiss: options?.autoDismiss !== false,
    durationMs,
  };
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
  (_event, title: string, body: string, options?: NotificationOptions) => {
    if (!Notification.isSupported()) return;

    const notificationOptions = getNotificationOptions(options);
    const notification = new Notification({
      title,
      body,
      timeoutType: notificationOptions.autoDismiss ? "default" : "never",
    });

    notification.on("click", () => {
      mainWindow?.show();
      mainWindow?.focus();
    });

    notification.show();

    if (notificationOptions.autoDismiss) {
      setTimeout(() => notification.close(), notificationOptions.durationMs);
    }
  }
);

ipcMain.handle("app:getInfo", () => {
  return {
    appName: appConfig.appDisplayName,
    userDataPath: app.getPath("userData"),
    localStorageKey: appConfig.storage.localStorageKey,
  };
});

ipcMain.handle("app:getLaunchOnStartup", () => {
  return getLaunchOnStartup();
});

ipcMain.handle("app:setLaunchOnStartup", (_event, enabled: boolean) => {
  return setLaunchOnStartup(enabled);
});

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  syncLaunchOnStartupRegistration();
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

app.on("before-quit", () => {
  isQuitting = true;
});
