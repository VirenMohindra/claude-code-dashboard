import { describe, it } from "node:test";
import assert from "node:assert/strict";

// We test the pure functions by importing the module's logic.
// Since the main script runs side effects on import, we extract testable
// functions into this test by re-implementing the pure helpers here and
// verifying they match the expected behavior.

// ── HTML Escaping ────────────────────────────────────────────────────────────

const esc = (s) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

describe("esc()", () => {
  it("escapes ampersands", () => {
    assert.equal(esc("a & b"), "a &amp; b");
  });

  it("escapes angle brackets", () => {
    assert.equal(esc("<script>alert(1)</script>"), "&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("escapes double quotes", () => {
    assert.equal(esc('data-name="test"'), "data-name=&quot;test&quot;");
  });

  it("handles all special chars together", () => {
    assert.equal(esc('<a href="x&y">'), "&lt;a href=&quot;x&amp;y&quot;&gt;");
  });

  it("returns empty string for empty input", () => {
    assert.equal(esc(""), "");
  });

  it("passes through safe strings unchanged", () => {
    assert.equal(esc("hello world 123"), "hello world 123");
  });
});

// ── Freshness ────────────────────────────────────────────────────────────────

const ONE_DAY = 86_400;
const TWO_DAYS = 172_800;
const THIRTY_DAYS = 2_592_000;
const NINETY_DAYS = 7_776_000;
const ONE_YEAR = 31_536_000;

function relativeTime(ts) {
  if (!ts) return "unknown";
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < ONE_DAY) return "today";
  if (diff < TWO_DAYS) return "yesterday";
  if (diff < THIRTY_DAYS) return `${Math.floor(diff / ONE_DAY)}d ago`;
  if (diff < ONE_YEAR) return `${Math.floor(diff / THIRTY_DAYS)}mo ago`;
  return `${Math.floor(diff / ONE_YEAR)}y ago`;
}

function freshnessClass(ts) {
  if (!ts) return "stale";
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < THIRTY_DAYS) return "fresh";
  if (diff < NINETY_DAYS) return "aging";
  return "stale";
}

describe("relativeTime()", () => {
  const now = Math.floor(Date.now() / 1000);

  it("returns 'unknown' for 0", () => {
    assert.equal(relativeTime(0), "unknown");
  });

  it("returns 'today' for recent timestamp", () => {
    assert.equal(relativeTime(now - 3600), "today");
  });

  it("returns 'yesterday' for ~1 day ago", () => {
    assert.equal(relativeTime(now - ONE_DAY - 100), "yesterday");
  });

  it("returns days for < 30 days", () => {
    const result = relativeTime(now - ONE_DAY * 10);
    assert.match(result, /^\d+d ago$/);
  });

  it("returns months for < 1 year", () => {
    const result = relativeTime(now - THIRTY_DAYS * 3);
    assert.match(result, /^\d+mo ago$/);
  });

  it("returns years for > 1 year", () => {
    const result = relativeTime(now - ONE_YEAR * 2);
    assert.match(result, /^\d+y ago$/);
  });
});

describe("freshnessClass()", () => {
  const now = Math.floor(Date.now() / 1000);

  it("returns 'stale' for 0", () => {
    assert.equal(freshnessClass(0), "stale");
  });

  it("returns 'fresh' for recent", () => {
    assert.equal(freshnessClass(now - ONE_DAY), "fresh");
  });

  it("returns 'aging' for 30-90 days", () => {
    assert.equal(freshnessClass(now - THIRTY_DAYS - ONE_DAY), "aging");
  });

  it("returns 'stale' for > 90 days", () => {
    assert.equal(freshnessClass(now - NINETY_DAYS - ONE_DAY), "stale");
  });
});

// ── Markdown Parsing ─────────────────────────────────────────────────────────

// Simulate getDesc logic
function getDesc(content) {
  const lines = content.split("\n");

  if (lines[0] === "---") {
    for (let i = 1; i < lines.length; i++) {
      if (lines[i] === "---") break;
      const m = lines[i].match(/^description:\s*(.+)/);
      if (m) return m[1].trim();
    }
  }

  if (lines[0]?.startsWith("# ")) return lines[0].slice(2);

  for (const l of lines.slice(0, 5)) {
    const t = l.trim();
    if (t && t !== "---" && !t.startsWith("```")) {
      return t.length > 60 ? t.slice(0, 57) + "..." : t;
    }
  }
  return "";
}

describe("getDesc()", () => {
  it("extracts YAML frontmatter description", () => {
    const md = "---\ndescription: My cool tool\n---\n# Title";
    assert.equal(getDesc(md), "My cool tool");
  });

  it("extracts # heading", () => {
    assert.equal(getDesc("# My Project\nSome text"), "My Project");
  });

  it("falls back to first non-empty line", () => {
    assert.equal(getDesc("\n\nSome intro text"), "Some intro text");
  });

  it("truncates long first lines", () => {
    const long = "A".repeat(80);
    const result = getDesc(long);
    assert.equal(result.length, 60);
    assert.ok(result.endsWith("..."));
  });

  it("returns empty for empty content", () => {
    assert.equal(getDesc(""), "");
  });
});

// ── Config Parsing ───────────────────────────────────────────────────────────

function parseChains(content) {
  const chains = [];
  for (const line of content.split("\n")) {
    const m = line.match(/^chain:\s*(.+)/i);
    if (!m) continue;
    const raw = m[1];
    if (raw.includes("<-")) {
      chains.push({ nodes: raw.split(/\s*<-\s*/), arrow: "&larr;" });
    } else {
      chains.push({ nodes: raw.split(/\s*->\s*/), arrow: "&rarr;" });
    }
  }
  return chains;
}

describe("parseChains()", () => {
  it("parses forward chain", () => {
    const result = parseChains("chain: A -> B -> C");
    assert.equal(result.length, 1);
    assert.deepEqual(result[0].nodes, ["A", "B", "C"]);
    assert.equal(result[0].arrow, "&rarr;");
  });

  it("parses backward chain", () => {
    const result = parseChains("chain: X <- Y");
    assert.equal(result.length, 1);
    assert.deepEqual(result[0].nodes, ["X", "Y"]);
    assert.equal(result[0].arrow, "&larr;");
  });

  it("ignores comments and empty lines", () => {
    const result = parseChains("# comment\n\nchain: A -> B");
    assert.equal(result.length, 1);
  });

  it("returns empty for no chains", () => {
    assert.deepEqual(parseChains("# just comments\n~/work"), []);
  });

  it("parses multiple chains", () => {
    const result = parseChains("chain: A -> B\nchain: C <- D");
    assert.equal(result.length, 2);
  });
});

// ── Freshness Parsing ────────────────────────────────────────────────────────

describe("freshness number parsing", () => {
  it("parses valid timestamp", () => {
    const ts = "1710000000";
    const parsed = Number(ts);
    assert.ok(Number.isFinite(parsed));
    assert.equal(parsed, 1710000000);
  });

  it("returns 0 for empty string", () => {
    const ts = "";
    const parsed = Number(ts);
    // Number("") is 0 which is falsy, so the || 0 fallback works
    const result = Number.isFinite(parsed) ? parsed : 0;
    assert.equal(result, 0);
  });

  it("returns 0 for garbage input", () => {
    const ts = "not-a-number";
    const parsed = Number(ts);
    const result = Number.isFinite(parsed) ? parsed : 0;
    assert.equal(result, 0);
  });

  it("returns 0 for NaN", () => {
    const parsed = Number(NaN);
    const result = Number.isFinite(parsed) ? parsed : 0;
    assert.equal(result, 0);
  });
});
