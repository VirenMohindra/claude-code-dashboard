import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

import { esc, insightsToPrompt } from "./helpers.mjs";
import { VERSION, REPO_URL } from "./constants.mjs";
import { renderCmd, renderRule, renderRepoCard } from "./render.mjs";
import {
  renderSkillsCard,
  renderMcpCard,
  renderMcpRecommendedCard,
  renderToolsCard,
  renderLangsCard,
  renderErrorsCard,
  renderActivityCard,
  renderChainsCard,
  renderConsolidationCard,
  renderUnconfiguredCard,
  renderReferenceCard,
  renderInsightsCard,
  renderInsightsReportCard,
  renderStatsBar,
} from "./sections.mjs";

// Resolve template directory relative to this module (works when installed via npm too)
const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_DIR = join(__dirname, "..", "template");

// Cache template files (read once per process).
// Assumes one-shot CLI usage; watch mode spawns fresh processes.
let _css, _js, _html;
function loadTemplates() {
  if (!_css) _css = readFileSync(join(TEMPLATE_DIR, "dashboard.css"), "utf8");
  if (!_js) _js = readFileSync(join(TEMPLATE_DIR, "dashboard.js"), "utf8");
  if (!_html) _html = readFileSync(join(TEMPLATE_DIR, "dashboard.html"), "utf8");
}

export function generateDashboardHtml(data) {
  loadTemplates();

  const {
    configured,
    unconfigured,
    globalCmds,
    globalRules,
    globalSkills,
    chains,
    mcpSummary,
    mcpPromotions,
    formerMcpServers,
    recommendedMcpServers,
    availableMcpServers,
    registryTotal,
    consolidationGroups,
    usageAnalytics,
    ccusageData,
    statsCache,
    timestamp,
    coveragePct,
    totalRepos,
    configuredCount,
    unconfiguredCount,
    scanScope,
    insights,
    insightsReport,
  } = data;

  // ── Build section HTML fragments ──────────────────────────────────────────

  const header = `<h1>claude code dashboard</h1>
<div class="header-actions">
  <button id="refresh-btn" class="header-btn" title="Copy refresh command to clipboard" aria-label="Copy refresh command">&#8635; refresh</button>
  <button id="theme-toggle" class="theme-toggle" title="Toggle light/dark mode" aria-label="Toggle theme"><span class="theme-icon"></span></button>
</div>
<p class="sub">generated ${timestamp} · <a href="${esc(REPO_URL)}" target="_blank" rel="noopener" style="color:var(--accent);text-decoration:underline;text-underline-offset:2px">v${esc(VERSION)}</a></p>`;

  const statsBar = renderStatsBar(data);

  // Home tab — actionable content first
  const insightsPrompt = insightsToPrompt(insights);
  const insightsHtml = renderInsightsCard(insights, insightsPrompt);
  const mcpRecsHtml = renderMcpRecommendedCard(recommendedMcpServers);
  const chainsHtml = renderChainsCard(chains);
  const consolidationHtml = renderConsolidationCard(consolidationGroups);
  const tabHome = `${insightsHtml}\n  ${mcpRecsHtml}\n  ${chainsHtml}\n  ${consolidationHtml}`;

  // Config tab — stable reference: commands, rules, skills, MCP servers
  const commandsRulesHtml = `<div class="top-grid">
    <div class="card" id="section-commands" style="margin-bottom:0">
      <h2>Global Commands <span class="n">${globalCmds.length}</span></h2>
      ${globalCmds.map((c) => renderCmd(c)).join("\n  ")}
    </div>
    <div class="card" style="margin-bottom:0">
      <h2>Global Rules <span class="n">${globalRules.length}</span></h2>
      ${globalRules.map((r) => renderRule(r)).join("\n  ")}
    </div>
  </div>`;
  const tabConfig = `${commandsRulesHtml}\n  ${renderSkillsCard(globalSkills)}\n  ${renderMcpCard(mcpSummary, mcpPromotions, formerMcpServers, availableMcpServers, registryTotal)}`;

  // Analytics tab
  const insightsReportHtml = renderInsightsReportCard(insightsReport);
  const toolsHtml = renderToolsCard(usageAnalytics.topTools);
  const langsHtml = renderLangsCard(usageAnalytics.topLanguages);
  const errorsHtml = renderErrorsCard(usageAnalytics.errorCategories);
  const activityHtml = renderActivityCard(statsCache, ccusageData);
  const tabAnalytics = `${insightsReportHtml}
  <div class="top-grid">
    ${toolsHtml || ""}
    ${langsHtml || ""}
  </div>
  ${errorsHtml}
  ${activityHtml}`;

  // Repos tab
  const repoCards = configured.map((r) => renderRepoCard(r)).join("\n");
  const unconfiguredHtml = renderUnconfiguredCard(unconfigured);
  const tabRepos = `<div class="search-bar">
    <input type="text" id="search" placeholder="search repos..." autocomplete="off">
    <span class="search-hint"><kbd>/</kbd></span>
  </div>
  <div class="group-controls">
    <label class="group-label">Group by:</label>
    <select id="group-by" class="group-select">
      <option value="none">None</option>
      <option value="stack">Tech Stack</option>
      <option value="parent">Parent Directory</option>
    </select>
  </div>
  <div class="repo-grid" id="repo-grid">
  ${repoCards}
  </div>
  ${unconfiguredHtml}`;

  // Reference tab
  const tabReference = renderReferenceCard();

  // Footer
  const footer = `<div class="ts">found ${totalRepos} repos · ${configuredCount} configured · ${unconfiguredCount} unconfigured · scanned ${scanScope} · ${timestamp}</div>`;

  // ── Inject dynamic coverage color via CSS custom property ─────────────────
  const coverageColor =
    coveragePct >= 70 ? "var(--green)" : coveragePct >= 40 ? "var(--yellow)" : "var(--red)";
  const css = `:root { --coverage-color: ${coverageColor}; }\n${_css}`;

  // ── Assemble final HTML via placeholder replacement ───────────────────────
  let html = _html;
  html = html.replace("<!-- {{CSS}} -->", css);
  html = html.replace("/* {{JS}} */", _js);
  html = html.replace("<!-- {{HEADER}} -->", header);
  html = html.replace("<!-- {{STATS_BAR}} -->", statsBar);
  html = html.replace("<!-- {{TAB_HOME}} -->", tabHome);
  html = html.replace("<!-- {{TAB_CONFIG}} -->", tabConfig);
  html = html.replace("<!-- {{TAB_ANALYTICS}} -->", tabAnalytics);
  html = html.replace("<!-- {{TAB_REPOS}} -->", tabRepos);
  html = html.replace("<!-- {{TAB_REFERENCE}} -->", tabReference);
  html = html.replace("<!-- {{FOOTER}} -->", footer);

  return html;
}
