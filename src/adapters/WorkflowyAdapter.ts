import type { TaskSourceAdapter } from "./types";
import type { Project, Task, WorkflowyConfig } from "../types";
import { COLORS } from "../types";

const API_BASE = "https://workflowy.com/api/v1";

// Shape returned by GET /api/v1/nodes
interface WorkflowyNode {
  id: string;
  name: string;
  note?: string;
  completedAt?: string | null;
  priority?: number;
  createdAt?: string;
  modifiedAt?: string;
}

// Strip HTML tags and decode common entities from Workflowy rich-text names
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .trim();
}

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export class WorkflowyAdapter implements TaskSourceAdapter {
  readonly id = "workflowy";
  readonly name = "Workflowy";

  private config: WorkflowyConfig;
  private connected = false;
  private lastSync: number | null = null;
  private nodesCache: Map<string, WorkflowyNode> = new Map();
  private projectNodes: WorkflowyNode[] = [];
  private childrenMap: Map<string, WorkflowyNode[]> = new Map();

  constructor(config: WorkflowyConfig) {
    this.config = config;
  }

  private get authHeader(): Record<string, string> {
    return { Authorization: `Bearer ${this.config.apiKey}` };
  }

  private async doFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const url = `${API_BASE}${endpoint}`;
    const result = await window.electronAPI!.workflowyFetch(url, {
      method: options.method as string | undefined,
      headers: options.headers as Record<string, string> | undefined,
      body: typeof options.body === "string" ? options.body : undefined,
    });
    return new Response(result.text, { status: result.status, statusText: result.statusText });
  }

  // ── Connection ────────────────────────────────────────────────────────────

  async connect(): Promise<void> {
    if (!this.config.apiKey) {
      throw new Error("Workflowy API key required. Get one at workflowy.com/api-key");
    }
    await this.fetchAllNodes();
    this.connected = true;
    this.lastSync = Date.now();
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.nodesCache.clear();
    this.projectNodes = [];
    this.childrenMap.clear();
  }

  isConnected(): boolean {
    return this.connected;
  }

  // ── Read Operations ───────────────────────────────────────────────────────

  async fetchProjects(): Promise<Project[]> {
    if (!this.connected) await this.connect();
    return this.projectNodes.map((node, i) => this.mapNodeToProject(node, i));
  }

  async fetchTasks(projectId: string): Promise<Task[]> {
    if (!this.connected) await this.connect();
    return (this.childrenMap.get(projectId) ?? []).map((n) => this.mapNodeToTask(n));
  }

  // ── Write Operations ──────────────────────────────────────────────────────

  async completeTask(taskId: string): Promise<void> {
    if (!this.connected) throw new Error("Adapter not connected");
    const response = await this.doFetch(`/nodes/${taskId}/complete`, {
      method: "POST",
      headers: { ...this.authHeader, "Content-Type": "application/json" },
    });
    if (!response.ok) throw new Error(`Failed to complete task: ${response.statusText}`);
    const node = this.nodesCache.get(taskId);
    if (node) node.completedAt = new Date().toISOString();
  }

  async uncompleteTask(taskId: string): Promise<void> {
    if (!this.connected) throw new Error("Adapter not connected");
    const response = await this.doFetch(`/nodes/${taskId}/uncomplete`, {
      method: "POST",
      headers: { ...this.authHeader, "Content-Type": "application/json" },
    });
    if (!response.ok) throw new Error(`Failed to uncomplete task: ${response.statusText}`);
    const node = this.nodesCache.get(taskId);
    if (node) node.completedAt = null;
  }

  // ── Sync ──────────────────────────────────────────────────────────────────

  getLastSyncTime(): number | null {
    return this.lastSync;
  }

  async sync(): Promise<void> {
    await this.fetchAllNodes();
    this.lastSync = Date.now();
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async fetchNodeChildren(parentId: string): Promise<WorkflowyNode[]> {
    const response = await this.doFetch(
      `/nodes?parent_id=${encodeURIComponent(parentId)}`,
      { headers: this.authHeader }
    );
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("Invalid Workflowy API key. Check your key at workflowy.com/api-key");
      }
      throw new Error(`Workflowy API error: ${response.status} ${response.statusText}`);
    }
    const data: unknown = await response.json();
    return Array.isArray(data) ? data : ((data as { nodes?: WorkflowyNode[] }).nodes ?? []);
  }

  // Navigate a path like ["Life", "Work"] from root.
  // Each segment matched case-insensitively (substring) against stripped node names.
  // Returns the final WorkflowyNode, or null if any segment is not found.
  private async navigatePath(segments: string[]): Promise<WorkflowyNode | null> {
    let parentId = "None";
    let current: WorkflowyNode | null = null;
    for (const segment of segments) {
      const children = await this.fetchNodeChildren(parentId);
      for (const child of children) this.nodesCache.set(child.id, child);
      const lc = segment.toLowerCase();
      const match = children.find((n) => stripHtml(n.name).toLowerCase().includes(lc));
      if (!match) {
        console.warn(`[Workflowy] Path navigation failed: no node matching "${segment}" under parent_id="${parentId}"`);
        return null;
      }
      current = match;
      parentId = match.id;
    }
    return current;
  }

  // Resolve tagged children of a given parent node into projects.
  // - tagged child with subtasks  → project, subtasks become its tasks
  // - tagged child with no subtasks → single-task project (the node is its own task)
  private async resolveTaggedChildren(parentId: string): Promise<void> {
    const tag = this.config.projectTag.toLowerCase();
    const children = await this.fetchNodeChildren(parentId);
    for (const child of children) this.nodesCache.set(child.id, child);

    const tagged = children.filter((c) => stripHtml(c.name).toLowerCase().includes(tag));

    await Promise.all(
      tagged.map(async (child) => {
        const subtasks = await this.fetchNodeChildren(child.id);
        for (const t of subtasks) this.nodesCache.set(t.id, t);

        this.projectNodes.push(child);

        if (subtasks.length > 0) {
          this.childrenMap.set(child.id, subtasks);
          console.log(`[Workflowy] Project "${stripHtml(child.name)}" → ${subtasks.length} task(s)`);
        } else {
          // No subtasks — the node is a single-task project containing itself
          this.childrenMap.set(child.id, [child]);
          console.log(`[Workflowy] Single-task project: "${stripHtml(child.name)}"`);
        }
      })
    );
  }

  private async fetchAllNodes(): Promise<void> {
    this.nodesCache.clear();
    this.projectNodes = [];
    this.childrenMap.clear();

    console.log(`[Workflowy] Fetching nodes with tag="${this.config.projectTag}"`);

    if (this.config.searchPaths?.trim()) {
      // ── Configured path search ────────────────────────────────────────────
      const paths = this.config.searchPaths
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => p.split(">").map((s) => s.trim()).filter(Boolean));

      console.log(`[Workflowy] Using ${paths.length} configured search path(s)`);

      await Promise.all(
        paths.map(async (segments) => {
          const label = segments.join(" > ");
          console.log(`[Workflowy] Navigating: ${label}`);
          const destNode = await this.navigatePath(segments);
          if (!destNode) return;
          await this.resolveTaggedChildren(destNode.id);
        })
      );
    } else {
      // ── Default: root + one level deep ───────────────────────────────────
      const tag = this.config.projectTag.toLowerCase();
      const rootNodes = await this.fetchNodeChildren("None");
      console.log(`[Workflowy] ${rootNodes.length} root node(s):`, rootNodes.map((n) => stripHtml(n.name)));

      for (const node of rootNodes) this.nodesCache.set(node.id, node);

      const untaggedRoots = rootNodes.filter((n) => !stripHtml(n.name).toLowerCase().includes(tag));

      // Tagged root nodes — use the same resolution logic
      await this.resolveTaggedChildren("None");

      // One level deeper inside untagged roots
      await Promise.all(
        untaggedRoots.map((parent) => this.resolveTaggedChildren(parent.id))
      );
    }

    console.log(`[Workflowy] Total projects: ${this.projectNodes.length}`);
  }

  private mapNodeToProject(node: WorkflowyNode, index: number): Project {
    const tag = this.config.projectTag;
    const clean = stripHtml(node.name);
    let name = clean.replace(new RegExp(escapeRegex(tag), "gi"), "").trim();
    if (!name) name = "Untitled Project";
    const tasks = (this.childrenMap.get(node.id) ?? []).map((c) => this.mapNodeToTask(c));
    return {
      id: node.id,
      name,
      color: COLORS[index % COLORS.length],
      nudgeMinutes: 25,
      active: true,
      tasks,
      sourceId: this.id,
    };
  }

  private mapNodeToTask(node: WorkflowyNode): Task {
    const tag = this.config.projectTag;
    const clean = stripHtml(node.name);
    const name = clean.replace(new RegExp(escapeRegex(tag), "gi"), "").trim() || "(unnamed)";
    return {
      id: node.id,
      name,
      description: node.note ? stripHtml(node.note) : "",
      done: !!node.completedAt,
      completedAt: node.completedAt ? new Date(node.completedAt).getTime() : null,
      snoozedUntil: null,
      sourceId: this.id,
    };
  }

  // ── Static helper to test API key ─────────────────────────────────────────

  static async testApiKey(apiKey: string): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await window.electronAPI!.workflowyFetch(`${API_BASE}/targets`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (result.ok) return { success: true };
      if (result.status === 401) return { success: false, error: "Invalid API key" };
      if (result.status === 403) return { success: false, error: "Access forbidden — check your API key permissions" };
      return { success: false, error: `API error: ${result.status} ${result.statusText}` };
    } catch (error) {
      return { success: false, error: `Connection failed: ${error instanceof Error ? error.message : String(error)}` };
    }
  }
}
