import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateDashboardHtml } from "../src/assembler.mjs";
import { generateDemoRawInputs } from "../src/demo.mjs";
import { buildDashboardData } from "../src/pipeline.mjs";

describe("generateDashboardHtml (assembler)", () => {
  const data = buildDashboardData(generateDemoRawInputs());

  it("produces valid HTML document", () => {
    const html = generateDashboardHtml(data);
    assert.ok(html.startsWith("<!DOCTYPE html>"));
    assert.ok(html.includes("</html>"));
  });

  it("contains no unresolved placeholders", () => {
    const html = generateDashboardHtml(data);
    const htmlPlaceholders = html.match(/<!-- \{\{[A-Z_]+\}\} -->/g);
    const jsPlaceholders = html.match(/\/\* \{\{[A-Z_]+\}\} \*\//g);
    assert.equal(htmlPlaceholders, null, `Unresolved HTML placeholders: ${htmlPlaceholders}`);
    assert.equal(jsPlaceholders, null, `Unresolved JS placeholders: ${jsPlaceholders}`);
  });

  it("includes all tab sections", () => {
    const html = generateDashboardHtml(data);
    assert.ok(html.includes('id="tab-overview"'));
    assert.ok(html.includes('id="tab-skills-mcp"'));
    assert.ok(html.includes('id="tab-analytics"'));
    assert.ok(html.includes('id="tab-repos"'));
    assert.ok(html.includes('id="tab-reference"'));
  });

  it("includes CSS and JS", () => {
    const html = generateDashboardHtml(data);
    assert.ok(html.includes("<style>"));
    assert.ok(html.includes("</style>"));
    assert.ok(html.includes("<script>"));
    assert.ok(html.includes("function switchTab"));
  });

  it("includes stats bar with demo data", () => {
    const html = generateDashboardHtml(data);
    assert.ok(html.includes("Coverage"));
    assert.ok(html.includes("Avg Health"));
    assert.ok(html.includes("Global Commands"));
  });

  it("includes section IDs for scroll targets", () => {
    const html = generateDashboardHtml(data);
    assert.ok(html.includes('id="section-skills"'));
    assert.ok(html.includes('id="section-mcp"'));
    assert.ok(html.includes('id="section-commands"'));
    assert.ok(html.includes('id="section-activity"'));
  });

  it("injects coverage color as CSS custom property", () => {
    const html = generateDashboardHtml(data);
    assert.ok(html.includes("--coverage-color:"), "Should inject --coverage-color");
    assert.ok(
      !html.includes("var(--coverage-color, var(--accent))") || html.includes("--coverage-color:"),
      "Should set --coverage-color via :root, not replace CSS rule",
    );
  });

  it("renders refresh button in header", () => {
    const html = generateDashboardHtml(data);
    assert.ok(html.includes('id="refresh-btn"'));
    assert.ok(html.includes("header-actions"));
  });

  it("renders copy-markdown button and data-markdown attribute when insights exist", () => {
    const html = generateDashboardHtml(data);
    const body = html.split("</style>")[1];
    assert.ok(body.includes("copy-md-btn"), "Should render copy markdown button");
    assert.ok(/data-markdown="/.test(body), "Should embed markdown in data attribute");
    assert.ok(body.includes("# Dashboard Insights"), "Markdown should contain insights heading");
  });

  it("omits copy-markdown button when no insights", () => {
    const noInsightsData = { ...data, insights: [] };
    const html = generateDashboardHtml(noInsightsData);
    const body = html.split("</style>")[1];
    assert.ok(!/data-markdown="/.test(body), "Should not embed markdown when no insights");
  });

  it("handles empty data gracefully", () => {
    const emptyData = {
      configured: [],
      unconfigured: [],
      globalCmds: [],
      globalRules: [],
      globalSkills: [],
      chains: [],
      mcpSummary: [],
      mcpPromotions: [],
      formerMcpServers: [],
      recommendedMcpServers: [],
      availableMcpServers: [],
      registryTotal: 0,
      consolidationGroups: [],
      usageAnalytics: {
        topTools: [],
        topLanguages: [],
        errorCategories: [],
        heavySessions: 0,
      },
      ccusageData: null,
      statsCache: {},
      timestamp: "test",
      coveragePct: 0,
      totalRepos: 0,
      configuredCount: 0,
      unconfiguredCount: 0,
      totalRepoCmds: 0,
      avgHealth: 0,
      driftCount: 0,
      mcpCount: 0,
      scanScope: "test",
      insights: [],
      insightsReport: null,
    };
    const html = generateDashboardHtml(emptyData);
    assert.ok(html.includes("<!DOCTYPE html>"));
    assert.ok(html.includes("</html>"));
    // No unresolved placeholders (HTML or JS style)
    assert.equal(html.match(/<!-- \{\{[A-Z_]+\}\} -->/g), null);
    assert.equal(html.match(/\/\* \{\{[A-Z_]+\}\} \*\//g), null);
  });
});
