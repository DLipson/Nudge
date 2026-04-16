import { describe, it, expect } from "vitest";
import { stripHtml, escapeRegex } from "./WorkflowyAdapter";

describe("stripHtml", () => {
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
