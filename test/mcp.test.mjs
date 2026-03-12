import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeRegistryResponse } from "../src/mcp.mjs";

/* ── normalizeRegistryResponse ──────────────────────────────────────── */

describe("normalizeRegistryResponse()", () => {
  it("extracts fields from valid response with claude-code servers", () => {
    const raw = {
      servers: [
        {
          name: "Vercel",
          slug: "vercel",
          description: "Analyze, debug, and manage projects",
          url: "https://mcp.vercel.com/",
          transport: "streamable-http",
          installCommand: "claude mcp add vercel https://mcp.vercel.com",
          worksWith: ["claude", "claude-api", "claude-code"],
          tools: ["list_projects", "get_deployment"],
        },
      ],
    };
    const result = normalizeRegistryResponse(raw);
    assert.equal(result.length, 1);
    assert.equal(result[0].name, "Vercel");
    assert.equal(result[0].slug, "vercel");
    assert.equal(result[0].description, "Analyze, debug, and manage projects");
    assert.equal(result[0].url, "https://mcp.vercel.com/");
    assert.equal(result[0].installCommand, "claude mcp add vercel https://mcp.vercel.com");
    assert.deepEqual(result[0].worksWith, ["claude", "claude-api", "claude-code"]);
    assert.deepEqual(result[0].tools, ["list_projects", "get_deployment"]);
  });

  it("filters to claude-code compatible servers only", () => {
    const raw = {
      servers: [
        {
          name: "CodeOnly",
          slug: "code-only",
          description: "Works with claude-code",
          url: "https://example.com/code",
          installCommand: "claude mcp add code-only https://example.com/code",
          worksWith: ["claude-code"],
          tools: ["tool_a"],
        },
        {
          name: "ApiOnly",
          slug: "api-only",
          description: "Only works with API",
          url: "https://example.com/api",
          installCommand: "claude mcp add api-only https://example.com/api",
          worksWith: ["claude-api"],
          tools: ["tool_b"],
        },
        {
          name: "Both",
          slug: "both",
          description: "Works with both",
          url: "https://example.com/both",
          installCommand: "claude mcp add both https://example.com/both",
          worksWith: ["claude", "claude-code"],
          tools: [],
        },
      ],
    };
    const result = normalizeRegistryResponse(raw);
    assert.equal(result.length, 2);
    assert.equal(result[0].name, "CodeOnly");
    assert.equal(result[1].name, "Both");
  });

  it("returns [] for null input", () => {
    assert.deepEqual(normalizeRegistryResponse(null), []);
  });

  it("returns [] for empty object", () => {
    assert.deepEqual(normalizeRegistryResponse({}), []);
  });

  it("returns [] for { servers: 'bad' }", () => {
    assert.deepEqual(normalizeRegistryResponse({ servers: "bad" }), []);
  });

  it("returns [] for undefined input", () => {
    assert.deepEqual(normalizeRegistryResponse(undefined), []);
  });

  it("defaults tools to [] when missing", () => {
    const raw = {
      servers: [
        {
          name: "NoTools",
          slug: "no-tools",
          description: "Server without tools field",
          url: "https://example.com",
          installCommand: "claude mcp add no-tools https://example.com",
          worksWith: ["claude-code"],
        },
      ],
    };
    const result = normalizeRegistryResponse(raw);
    assert.equal(result.length, 1);
    assert.deepEqual(result[0].tools, []);
  });

  it("excludes servers without worksWith array", () => {
    const raw = {
      servers: [
        {
          name: "NoWorksWith",
          slug: "no-works-with",
          description: "Missing worksWith",
          url: "https://example.com",
          installCommand: "claude mcp add x https://example.com",
        },
      ],
    };
    const result = normalizeRegistryResponse(raw);
    assert.equal(result.length, 0);
  });

  it("strips extra fields from server objects", () => {
    const raw = {
      servers: [
        {
          name: "Extra",
          slug: "extra",
          description: "Has extra fields",
          url: "https://example.com",
          transport: "streamable-http",
          installCommand: "claude mcp add extra https://example.com",
          worksWith: ["claude-code"],
          tools: ["t1"],
          extraField: "should not appear",
          anotherExtra: 42,
        },
      ],
    };
    const result = normalizeRegistryResponse(raw);
    assert.equal(result.length, 1);
    assert.deepEqual(Object.keys(result[0]).sort(), [
      "description",
      "installCommand",
      "name",
      "slug",
      "tools",
      "url",
      "worksWith",
    ]);
  });
});
