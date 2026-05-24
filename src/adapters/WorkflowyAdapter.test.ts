import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkflowyConfig } from "../types";
import { WorkflowyAdapter, stripHtml, escapeRegex } from "./WorkflowyAdapter";

interface MockNode {
  id: string;
  name: string;
  note?: string;
  completedAt?: string | null;
  priority?: number;
}

interface FetchRecord {
  url: string;
}

function makeConfig(overrides: Partial<WorkflowyConfig> = {}): WorkflowyConfig {
  return {
    apiKey: "test-api-key",
    projectTag: "#nudge",
    enabled: true,
    lastSync: null,
    searchPaths: "",
    ...overrides,
  };
}

function installWorkflowyFetchMock(
  routes: Record<string, MockNode[]>,
  options: { failOnceFor?: string } = {}
) {
  const calls: FetchRecord[] = [];
  const seenFailures = new Set<string>();

  const workflowyFetch = vi.fn(async (url: string) => {
    calls.push({ url });

    if (options.failOnceFor && url.includes(options.failOnceFor) && !seenFailures.has(options.failOnceFor)) {
      seenFailures.add(options.failOnceFor);
      return {
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        text: JSON.stringify({ error: "boom" }),
      };
    }

    const parentId = new URL(url).searchParams.get("parent_id");
    const nodes = routes[parentId ?? ""] ?? [];

    return {
      ok: true,
      status: 200,
      statusText: "OK",
      text: JSON.stringify(nodes),
    };
  });

  vi.stubGlobal("window", {
    electronAPI: {
      workflowyFetch,
    },
  });

  return { calls, workflowyFetch };
}

describe("stripHtml", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("passes plain text through unchanged", () => {
    expect(stripHtml("Hello world")).toBe("Hello world");
  });

  it("strips simple tags", () => {
    expect(stripHtml("<b>Hello</b>")).toBe("Hello");
    expect(stripHtml("<em>italic</em>")).toBe("italic");
  });

  it("strips Workflowy colored-span markup", () => {
    expect(
      stripHtml('<SPAN CLASS="COLORED BC-ORANGE">CHECK OLD WORK LAPTOP </SPAN>')
    ).toBe("CHECK OLD WORK LAPTOP");
  });

  it("strips nested tags", () => {
    expect(stripHtml("<b><em>bold italic</em></b>")).toBe("bold italic");
  });

  it("decodes &amp;", () => {
    expect(stripHtml("Fish &amp; Chips")).toBe("Fish & Chips");
  });

  it("decodes &lt; and &gt;", () => {
    expect(stripHtml("&lt;not a tag&gt;")).toBe("<not a tag>");
  });

  it("decodes &quot; and &#39;", () => {
    expect(stripHtml("say &quot;hello&quot; and &#39;hi&#39;")).toBe(
      `say "hello" and 'hi'`
    );
  });

  it("decodes &nbsp; to a space", () => {
    expect(stripHtml("a&nbsp;b")).toBe("a b");
  });

  it("trims surrounding whitespace", () => {
    expect(stripHtml("  hello  ")).toBe("hello");
    expect(stripHtml("<b>  spaced  </b>")).toBe("spaced");
  });

  it("handles empty string", () => {
    expect(stripHtml("")).toBe("");
  });
});

describe("escapeRegex", () => {
  it("passes strings with no special characters through", () => {
    expect(escapeRegex("hello world")).toBe("hello world");
    expect(escapeRegex("#nudge")).toBe("#nudge");
  });

  it("escapes dots", () => {
    expect(escapeRegex("a.b")).toBe("a\\.b");
  });

  it("escapes asterisks and plus signs", () => {
    expect(escapeRegex("a*b+c")).toBe("a\\*b\\+c");
  });

  it("escapes parentheses and brackets", () => {
    expect(escapeRegex("(foo)[bar]")).toBe("\\(foo\\)\\[bar\\]");
  });

  it("escapes backslash", () => {
    expect(escapeRegex("a\\b")).toBe("a\\\\b");
  });

  it("makes escaped string safe to use in RegExp constructor", () => {
    const tag = "#track (project)";
    const re = new RegExp(escapeRegex(tag), "i");
    expect(re.test("My project #track (project)")).toBe(true);
    expect(re.test("My project #track")).toBe(false);
  });
});

describe("WorkflowyAdapter", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("deduplicates duplicate configured search paths", async () => {
    const { calls } = installWorkflowyFetchMock({
      None: [{ id: "life", name: "Life" }],
      life: [{ id: "work", name: "Work" }],
      work: [{ id: "project-1", name: "#nudge Alpha" }],
      "project-1": [{ id: "task-1", name: "Ship it" }],
    });

    const adapter = new WorkflowyAdapter(
      makeConfig({ searchPaths: "Life > Work, Life > Work" })
    );

    const projects = await adapter.fetchProjects();

    expect(projects).toHaveLength(1);
    expect(projects[0].name).toBe("Alpha");
    expect(calls.filter((call) => call.url.includes("parent_id=life"))).toHaveLength(1);
    expect(calls.filter((call) => call.url.includes("parent_id=work"))).toHaveLength(1);
  });

  it("sorts project tasks by Workflowy priority before exposing them", async () => {
    installWorkflowyFetchMock({
      None: [{ id: "project-1", name: "#nudge Alpha" }],
      "project-1": [
        { id: "task-last", name: "Last", priority: 3000 },
        { id: "task-first", name: "First", priority: 1000 },
        { id: "task-second", name: "Second", priority: 2000 },
      ],
    });

    const adapter = new WorkflowyAdapter(makeConfig());

    const projects = await adapter.fetchProjects();

    expect(projects[0].tasks.map((task) => task.id)).toEqual([
      "task-first",
      "task-second",
      "task-last",
    ]);
    expect(projects[0].tasks.find((task) => !task.done)?.id).toBe("task-first");
  });

  it("does not duplicate projects during overlapping sync calls", async () => {
    const { calls } = installWorkflowyFetchMock({
      None: [{ id: "project-1", name: "#nudge Alpha" }],
      "project-1": [{ id: "task-1", name: "Ship it" }],
    });

    const adapter = new WorkflowyAdapter(makeConfig());
    await adapter.connect();
    const noneCallsBeforeSync = calls.filter((call) =>
      call.url.includes("parent_id=None")
    ).length;

    await Promise.all([adapter.sync(), adapter.sync()]);

    const projects = await adapter.fetchProjects();
    const noneCallsAfterSync = calls.filter((call) =>
      call.url.includes("parent_id=None")
    ).length;

    expect(projects).toHaveLength(1);
    expect(projects[0].tasks).toHaveLength(1);
    expect(noneCallsAfterSync - noneCallsBeforeSync).toBe(2);
  });

  it("resets the in-flight guard after a failed fetch", async () => {
    installWorkflowyFetchMock(
      {
        None: [{ id: "project-1", name: "#nudge Alpha" }],
        "project-1": [{ id: "task-1", name: "Ship it" }],
      },
      { failOnceFor: "parent_id=None" }
    );

    const adapter = new WorkflowyAdapter(makeConfig());

    await expect(adapter.sync()).rejects.toThrow("Workflowy API error: 500 Internal Server Error");

    const projects = await adapter.fetchProjects();

    expect(projects).toHaveLength(1);
    expect(projects[0].name).toBe("Alpha");
  });
});
