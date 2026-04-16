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

contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true as const,

  workflowyFetch: (url: string, options?: FetchOptions): Promise<FetchResult> =>
    ipcRenderer.invoke("workflowy:fetch", url, options),

  showNotification: (title: string, body: string): void => {
    ipcRenderer.invoke("notification:show", title, body);
  },
});
