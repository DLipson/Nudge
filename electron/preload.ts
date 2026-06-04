import { contextBridge, ipcRenderer } from "electron";

interface FetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

interface FetchResult {
  ok: boolean;
  status: number;
  statusText: string;
  text: string;
}

interface AppInfo {
  appName: string;
  userDataPath: string;
  localStorageKey: string;
}

interface NotificationOptions {
  autoDismiss: boolean;
  durationMs: number;
}

contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true as const,

  workflowyFetch: (url: string, options?: FetchOptions): Promise<FetchResult> =>
    ipcRenderer.invoke("workflowy:fetch", url, options),

  getAppInfo: (): Promise<AppInfo> => ipcRenderer.invoke("app:getInfo"),

  getLaunchOnStartup: (): Promise<boolean> =>
    ipcRenderer.invoke("app:getLaunchOnStartup"),

  setLaunchOnStartup: (enabled: boolean): Promise<boolean> =>
    ipcRenderer.invoke("app:setLaunchOnStartup", enabled),

  showNotification: (
    title: string,
    body: string,
    options?: NotificationOptions
  ): void => {
    ipcRenderer.invoke("notification:show", title, body, options);
  },
});
