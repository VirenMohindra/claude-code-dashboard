import { esc, formatTokens } from "./helpers.mjs";
import { QUICK_REFERENCE, VERSION, REPO_URL } from "./constants.mjs";
import {
  renderCmd,
  renderRule,
  renderSkill,
  renderRepoCard,
  groupSkillsByCategory,
  healthScoreColor,
} from "./render.mjs";

export function generateDashboardHtml({
  configured,
  unconfigured,
  globalCmds,
  globalRules,
  globalSkills,
  chains,
  mcpSummary,
  mcpPromotions,
  formerMcpServers,
  consolidationGroups,
  usageAnalytics,
  ccusageData,
  statsCache,
  timestamp,
  coveragePct,
  totalRepos,
  configuredCount,
  unconfiguredCount,
  totalRepoCmds,
  avgHealth,
  driftCount,
  mcpCount,
  scanScope,
  insights,
  insightsReport,
}) {
  // ── Build tab content sections ──────────────────────────────────────────

  // Skills card
  const skillsHtml = globalSkills.length
    ? (() => {
        const groups = groupSkillsByCategory(globalSkills);
        const categoryHtml = Object.entries(groups)
          .map(
            ([cat, skills], idx) =>
              `<details class="skill-category"${idx === 0 ? " open" : ""}>` +
              `<summary class="skill-category-label">${esc(cat)} <span class="cat-n">${skills.length}</span></summary>` +
              skills.map((s) => renderSkill(s)).join("\n    ") +
              `</details>`,
          )
          .join("\n  ");
        return `<div class="card" id="section-skills">
  <h2>Skills <span class="n">${globalSkills.length}</span></h2>
  ${categoryHtml}
</div>`;
      })()
    : "";

  // MCP card
  const mcpHtml = mcpSummary.length
    ? (() => {
        const rows = mcpSummary
          .map((s) => {
            const disabledClass = s.disabledIn > 0 ? " mcp-disabled" : "";
            const disabledHint =
              s.disabledIn > 0
                ? `<span class="mcp-disabled-hint">disabled in ${s.disabledIn} project${s.disabledIn > 1 ? "s" : ""}</span>`
                : "";
            const scopeBadge = s.userLevel
              ? `<span class="badge mcp-global">global</span>`
              : s.recentlyActive
                ? `<span class="badge mcp-recent">recent</span>`
                : `<span class="badge mcp-project">project</span>`;
            const typeBadge = `<span class="badge mcp-type">${esc(s.type)}</span>`;
            const projects =
              !s.userLevel && s.projects.length
                ? `<span class="mcp-projects">${s.projects.map((p) => esc(p)).join(", ")}</span>`
                : "";
            return `<div class="mcp-row${disabledClass}"><span class="mcp-name">${esc(s.name)}</span>${scopeBadge}${typeBadge}${disabledHint}${projects}</div>`;
          })
          .join("\n    ");
        const promoteHtml = mcpPromotions.length
          ? mcpPromotions
              .map(
                (p) =>
                  `<div class="mcp-promote"><span class="mcp-name">${esc(p.name)}</span> installed in ${p.projects.length} projects &rarr; add to <code>~/.claude/mcp_config.json</code></div>`,
              )
              .join("\n    ")
          : "";
        const formerHtml = formerMcpServers.length
          ? `<div class="label" style="margin-top:.75rem">Formerly Installed</div>
  ${formerMcpServers
    .map((s) => {
      const hint = s.projects.length
        ? `<span class="mcp-projects">${s.projects.map((p) => esc(p)).join(", ")}</span>`
        : "";
      return `<div class="mcp-row mcp-former"><span class="mcp-name">${esc(s.name)}</span><span class="badge mcp-former-badge">removed</span>${hint}</div>`;
    })
    .join("\n    ")}`
          : "";
        return `<div class="card" id="section-mcp">
  <h2>MCP Servers <span class="n">${mcpSummary.length}</span></h2>
  ${rows}
  ${promoteHtml}
  ${formerHtml}
</div>`;
      })()
    : "";

  // Usage bar cards (tools, languages, errors)
  const toolsHtml = usageAnalytics.topTools.length
    ? (() => {
        const maxCount = usageAnalytics.topTools[0].count;
        const rows = usageAnalytics.topTools
          .map((t) => {
            const pct = maxCount > 0 ? Math.round((t.count / maxCount) * 100) : 0;
            return `<div class="usage-bar-row"><span class="usage-bar-label">${esc(t.name)}</span><div class="usage-bar-track"><div class="usage-bar-fill usage-bar-tool" style="width:${pct}%"></div></div><span class="usage-bar-count">${t.count.toLocaleString()}</span></div>`;
          })
          .join("\n    ");
        return `<div class="card">
  <h2>Top Tools Used <span class="n">${usageAnalytics.topTools.length}</span></h2>
  ${rows}
</div>`;
      })()
    : "";

  const langsHtml = usageAnalytics.topLanguages.length
    ? (() => {
        const maxCount = usageAnalytics.topLanguages[0].count;
        const rows = usageAnalytics.topLanguages
          .map((l) => {
            const pct = maxCount > 0 ? Math.round((l.count / maxCount) * 100) : 0;
            return `<div class="usage-bar-row"><span class="usage-bar-label">${esc(l.name)}</span><div class="usage-bar-track"><div class="usage-bar-fill usage-bar-lang" style="width:${pct}%"></div></div><span class="usage-bar-count">${l.count.toLocaleString()}</span></div>`;
          })
          .join("\n    ");
        return `<div class="card">
  <h2>Languages <span class="n">${usageAnalytics.topLanguages.length}</span></h2>
  ${rows}
</div>`;
      })()
    : "";

  const errorsHtml = usageAnalytics.errorCategories.length
    ? (() => {
        const maxCount = usageAnalytics.errorCategories[0].count;
        const rows = usageAnalytics.errorCategories
          .map((e) => {
            const pct = maxCount > 0 ? Math.round((e.count / maxCount) * 100) : 0;
            return `<div class="usage-bar-row"><span class="usage-bar-label">${esc(e.name)}</span><div class="usage-bar-track"><div class="usage-bar-fill usage-bar-error" style="width:${pct}%"></div></div><span class="usage-bar-count">${e.count.toLocaleString()}</span></div>`;
          })
          .join("\n    ");
        return `<div class="card">
  <h2>Top Errors <span class="n">${usageAnalytics.errorCategories.length}</span></h2>
  ${rows}
</div>`;
      })()
    : "";

  // Activity/heatmap/peak hours/model usage card
  const activityHtml = (() => {
    const dailyActivity = statsCache.dailyActivity || [];
    const hourCounts = statsCache.hourCounts || {};
    const modelUsage = statsCache.modelUsage || {};
    const hasActivity = dailyActivity.length > 0;
    const hasHours = Object.keys(hourCounts).length > 0;
    const hasModels = Object.keys(modelUsage).length > 0;

    if (!hasActivity && !hasHours && !hasModels && !ccusageData) return "";

    let content = "";

    if (hasActivity) {
      const dateMap = new Map(dailyActivity.map((d) => [d.date, d.messageCount || 0]));
      const dates = dailyActivity.map((d) => d.date).sort();
      const lastDate = new Date(dates[dates.length - 1]);
      const firstDate = new Date(lastDate);
      firstDate.setDate(firstDate.getDate() - 364);

      const nonZero = dailyActivity
        .map((d) => d.messageCount || 0)
        .filter((n) => n > 0)
        .sort((a, b) => a - b);
      const q1 = nonZero[Math.floor(nonZero.length * 0.25)] || 1;
      const q2 = nonZero[Math.floor(nonZero.length * 0.5)] || 2;
      const q3 = nonZero[Math.floor(nonZero.length * 0.75)] || 3;

      function level(count) {
        if (count === 0) return "";
        if (count <= q1) return " l1";
        if (count <= q2) return " l2";
        if (count <= q3) return " l3";
        return " l4";
      }

      const start = new Date(firstDate);
      start.setUTCDate(start.getUTCDate() - start.getUTCDay());

      const months = [];
      let lastMonth = -1;
      const cursor1 = new Date(start);
      let weekIdx = 0;
      while (cursor1 <= lastDate) {
        if (cursor1.getUTCDay() === 0) {
          const m = cursor1.getUTCMonth();
          if (m !== lastMonth) {
            months.push({
              name: cursor1.toLocaleString("en", { month: "short", timeZone: "UTC" }),
              week: weekIdx,
            });
            lastMonth = m;
          }
          weekIdx++;
        }
        cursor1.setUTCDate(cursor1.getUTCDate() + 1);
      }
      const totalWeeks = weekIdx;
      const monthLabels = months
        .map((m) => {
          const left = totalWeeks > 0 ? Math.round((m.week / totalWeeks) * 100) : 0;
          return `<span class="heatmap-month" style="position:absolute;left:${left}%">${m.name}</span>`;
        })
        .join("");

      let cells = "";
      const cursor2 = new Date(start);
      while (cursor2 <= lastDate) {
        const key = cursor2.toISOString().slice(0, 10);
        const count = dateMap.get(key) || 0;
        const fmtDate = cursor2.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
        cells += `<div class="heatmap-cell${level(count)}" title="${esc(fmtDate)}: ${count} messages"></div>`;
        cursor2.setUTCDate(cursor2.getUTCDate() + 1);
      }

      content += `<div class="label">Activity</div>
      <div style="overflow-x:auto;margin-bottom:.5rem">
        <div style="width:fit-content;position:relative">
          <div class="heatmap-months" style="position:relative;height:.8rem">${monthLabels}</div>
          <div class="heatmap">${cells}</div>
        </div>
      </div>`;
    }

    if (hasHours) {
      const maxHour = Math.max(...Object.values(hourCounts), 1);
      let bars = "";
      let labels = "";
      for (let h = 0; h < 24; h++) {
        const count = hourCounts[String(h)] || 0;
        const pct = Math.round((count / maxHour) * 100);
        bars += `<div class="peak-bar" style="height:${Math.max(pct, 2)}%" title="${esc(String(h))}:00 — ${count} messages"></div>`;
        labels += `<div class="peak-label">${h % 6 === 0 ? h : ""}</div>`;
      }
      content += `<div class="label" style="margin-top:.75rem">Peak Hours</div>
      <div class="peak-hours">${bars}</div>
      <div class="peak-labels">${labels}</div>`;
    }

    if (ccusageData) {
      const modelCosts = {};
      for (const day of ccusageData.daily) {
        for (const mb of day.modelBreakdowns || []) {
          if (!modelCosts[mb.modelName]) modelCosts[mb.modelName] = { cost: 0, tokens: 0 };
          modelCosts[mb.modelName].cost += mb.cost || 0;
          modelCosts[mb.modelName].tokens +=
            (mb.inputTokens || 0) +
            (mb.outputTokens || 0) +
            (mb.cacheCreationTokens || 0) +
            (mb.cacheReadTokens || 0);
        }
      }
      const modelRows = Object.entries(modelCosts)
        .sort((a, b) => b[1].cost - a[1].cost)
        .map(
          ([name, data]) =>
            `<div class="model-row"><span class="model-name">${esc(name)}</span><span class="model-tokens">$${Math.round(data.cost).toLocaleString()} · ${formatTokens(data.tokens)}</span></div>`,
        )
        .join("\n      ");

      const t = ccusageData.totals;
      const breakdownHtml = `<div class="token-breakdown">
      <div class="tb-row"><span class="tb-label">Cache Read</span><span class="tb-val">${formatTokens(t.cacheReadTokens)}</span></div>
      <div class="tb-row"><span class="tb-label">Cache Creation</span><span class="tb-val">${formatTokens(t.cacheCreationTokens)}</span></div>
      <div class="tb-row"><span class="tb-label">Output</span><span class="tb-val">${formatTokens(t.outputTokens)}</span></div>
      <div class="tb-row"><span class="tb-label">Input</span><span class="tb-val">${formatTokens(t.inputTokens)}</span></div>
    </div>`;

      content += `<div class="label" style="margin-top:.75rem">Model Usage (via ccusage)</div>
      ${modelRows}
      <div class="label" style="margin-top:.75rem">Token Breakdown</div>
      ${breakdownHtml}`;
    } else if (hasModels) {
      const modelRows = Object.entries(modelUsage)
        .map(([name, usage]) => {
          const total = (usage.inputTokens || 0) + (usage.outputTokens || 0);
          return { name, total };
        })
        .sort((a, b) => b.total - a.total)
        .map(
          (m) =>
            `<div class="model-row"><span class="model-name">${esc(m.name)}</span><span class="model-tokens">${formatTokens(m.total)}</span></div>`,
        )
        .join("\n      ");
      content += `<div class="label" style="margin-top:.75rem">Model Usage (partial — install ccusage for full data)</div>
      ${modelRows}`;
    }

    return `<div class="card" id="section-activity">
  <h2>Activity</h2>
  ${content}
</div>`;
  })();

  // Chains
  const chainsHtml = chains.length
    ? `<div class="card">
  <h2>Dependency Chains</h2>
  ${chains.map((c) => `<div class="chain">${c.nodes.map((n, i) => `<span class="chain-node">${esc(n.trim())}</span>${i < c.nodes.length - 1 ? `<span class="chain-arrow">${c.arrow}</span>` : ""}`).join("")}</div>`).join("\n  ")}
</div>`
    : "";

  // Consolidation
  const consolidationHtml = consolidationGroups.length
    ? `<div class="card">
  <h2>Consolidation Opportunities <span class="n">${consolidationGroups.length}</span></h2>
  ${consolidationGroups.map((g) => `<div class="consolidation-hint"><span class="consolidation-stack">${esc(g.stack)}</span> <span class="consolidation-text">${esc(g.suggestion)}</span></div>`).join("\n  ")}
</div>`
    : "";

  // Unconfigured repos
  const unconfiguredHtml = unconfigured.length
    ? `<details class="card">
  <summary style="cursor:pointer;list-style:none"><h2 style="margin:0">Unconfigured Repos <span class="n">${unconfiguredCount}</span></h2></summary>
  <div style="margin-top:.75rem">
    <div class="unconfigured-grid">
      ${unconfigured
        .map((r) => {
          const stackTag =
            r.techStack && r.techStack.length
              ? `<span class="stack-tag">${esc(r.techStack.join(", "))}</span>`
              : "";
          const suggestionsHtml =
            r.suggestions && r.suggestions.length
              ? `<div class="suggestion-hints">${r.suggestions.map((s) => `<span class="suggestion-hint">${esc(s)}</span>`).join("")}</div>`
              : "";
          return `<div class="unconfigured-item">${esc(r.name)}${stackTag}<span class="upath">${esc(r.shortPath)}</span>${suggestionsHtml}</div>`;
        })
        .join("\n      ")}
    </div>
  </div>
</details>`
    : "";

  // Quick reference
  const referenceHtml = `<div class="card">
  <h2>Quick Reference</h2>
  <div class="ref-grid">
    <div class="ref-col">
      <div class="label">Essential Commands</div>
      ${QUICK_REFERENCE.essentialCommands.map((c) => `<div class="ref-row"><code class="ref-cmd">${esc(c.cmd)}</code><span class="ref-desc">${esc(c.desc)}</span></div>`).join("\n      ")}
    </div>
    <div class="ref-col">
      <div class="label">Built-in Tools</div>
      ${QUICK_REFERENCE.tools.map((t) => `<div class="ref-row"><code class="ref-cmd">${esc(t.name)}</code><span class="ref-desc">${esc(t.desc)}</span></div>`).join("\n      ")}
      <div class="label" style="margin-top:.75rem">Keyboard Shortcuts</div>
      ${QUICK_REFERENCE.shortcuts.map((s) => `<div class="ref-row"><kbd class="ref-key">${esc(s.keys)}</kbd><span class="ref-desc">${esc(s.desc)}</span></div>`).join("\n      ")}
    </div>
  </div>
</div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Claude Code Dashboard</title>
<style>
  :root {
    --bg: #0a0a0a; --surface: #111; --surface2: #1a1a1a; --border: #262626;
    --text: #e5e5e5; --text-dim: #777; --accent: #c4956a; --accent-dim: #8b6a4a;
    --green: #4ade80; --blue: #60a5fa; --purple: #a78bfa; --yellow: #fbbf24;
    --red: #f87171;
  }
  [data-theme="light"] {
    --bg: #f5f5f5; --surface: #fff; --surface2: #f0f0f0; --border: #e0e0e0;
    --text: #1a1a1a; --text-dim: #666; --accent: #9b6b47; --accent-dim: #b8956e;
    --green: #16a34a; --blue: #2563eb; --purple: #7c3aed; --yellow: #ca8a04;
    --red: #dc2626;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
    background: var(--bg); color: var(--text);
    padding: 2.5rem 2rem; line-height: 1.5; max-width: 1200px; margin: 0 auto;
  }
  code, .cmd-name { font-family: 'SF Mono', 'Fira Code', 'JetBrains Mono', monospace; }
  h1 { font-size: 1.4rem; font-weight: 600; color: var(--accent); margin-bottom: .2rem; }
  .sub { color: var(--text-dim); font-size: .78rem; margin-bottom: 1rem; }
  kbd { background: var(--surface2); border: 1px solid var(--border); border-radius: 3px; padding: .05rem .3rem; font-size: .7rem; font-family: inherit; }

  /* ── Tabs ─────────────────────────────────────────────────── */
  .tab-nav { display: flex; gap: 0; border-bottom: 1px solid var(--border); margin-bottom: 1.5rem; overflow-x: auto; }
  .tab-btn {
    padding: .6rem 1.2rem; font-size: .78rem; font-weight: 500; color: var(--text-dim);
    background: none; border: none; border-bottom: 2px solid transparent;
    cursor: pointer; white-space: nowrap; font-family: inherit; transition: color .15s, border-color .15s;
  }
  .tab-btn:hover { color: var(--text); }
  .tab-btn.active { color: var(--accent); border-bottom-color: var(--accent); }
  .tab-content { display: none; }
  .tab-content.active { display: block; }

  /* ── Cards ────────────────────────────────────────────────── */
  .top-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; margin-bottom: 1.25rem; }
  .top-grid > .card { margin-bottom: 0; }
  @media (max-width: 900px) { .top-grid { grid-template-columns: 1fr; } }

  .card { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 1.25rem; overflow: hidden; margin-bottom: 1.25rem; }
  .card:last-child { margin-bottom: 0; }
  .card h2 { font-size: .7rem; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: var(--text-dim); margin-bottom: .75rem; display: flex; align-items: center; gap: .5rem; }
  .card h2 .n { background: var(--surface2); border: 1px solid var(--border); border-radius: 4px; padding: .05rem .35rem; font-size: .65rem; color: var(--accent); }

  .cmd-row, details.cmd-detail > summary { display: flex; align-items: baseline; padding: .35rem .25rem; gap: .75rem; border-bottom: 1px solid var(--border); font-size: .82rem; }
  .cmd-row:last-child, details.cmd-detail:last-child:not([open]) > summary { border-bottom: none; }
  .cmd-name { font-weight: 600; color: var(--green); white-space: nowrap; font-size: .8rem; flex-shrink: 0; }
  .cmd-desc { color: var(--text-dim); font-size: .75rem; text-align: right; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  details.cmd-detail { border-bottom: 1px solid var(--border); }
  details.cmd-detail:last-child { border-bottom: none; }
  details.cmd-detail > summary { cursor: pointer; list-style: none; border-radius: 4px; transition: background .1s; }
  details.cmd-detail[open] > summary, details.cmd-detail > summary:hover { background: var(--surface2); }
  details.cmd-detail > summary::-webkit-details-marker { display: none; }
  .detail-body { padding: .6rem .5rem .6rem 1rem; background: var(--surface2); border-radius: 0 0 6px 6px; margin-bottom: .15rem; }
  .detail-section { color: var(--blue); font-size: .72rem; font-weight: 600; margin-top: .35rem; }
  .detail-section:first-child { margin-top: 0; }
  .detail-step, .detail-key { font-size: .7rem; padding: .1rem 0 .1rem .9rem; position: relative; }
  .detail-step { color: var(--text); }
  .detail-step::before { content: "\\2192"; position: absolute; left: 0; color: var(--accent-dim); font-size: .65rem; }
  .detail-key { color: var(--yellow); }
  .detail-key::before { content: "\\2022"; position: absolute; left: .15rem; color: var(--accent-dim); }

  .label { color: var(--text-dim); font-size: .65rem; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; margin: .85rem 0 .35rem; }
  .label:first-child { margin-top: 0; }

  .agent-section { border-bottom: 1px solid var(--border); }
  .agent-section:last-child { border-bottom: none; }
  .agent-section > summary { cursor: pointer; list-style: none; display: flex; align-items: baseline; padding: .3rem .25rem; font-size: .78rem; font-weight: 500; color: var(--text); border-radius: 4px; transition: background .1s; }
  .agent-section > summary::-webkit-details-marker { display: none; }
  .agent-section > summary:hover, .agent-section[open] > summary { background: var(--surface2); }
  .agent-section[open] > summary { color: var(--blue); }
  .agent-section-preview { padding: .3rem .4rem .5rem 1rem; background: var(--surface2); border-radius: 0 0 4px 4px; margin-bottom: .1rem; }
  .agent-section-preview .line { color: var(--text-dim); font-size: .68rem; line-height: 1.5; padding: .05rem 0; }

  .chain { display: flex; align-items: center; gap: .5rem; flex-wrap: wrap; padding: .65rem .75rem; background: var(--surface2); border-radius: 6px; margin-top: .4rem; }
  .chain:first-child { margin-top: 0; }
  .chain-node { background: var(--surface); border: 1px solid var(--accent-dim); border-radius: 5px; padding: .25rem .55rem; font-size: .75rem; font-weight: 500; color: var(--accent); }
  .chain-arrow { color: var(--text-dim); font-size: .85rem; }

  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: .65rem; margin-bottom: 1.5rem; }
  .stat { text-align: center; padding: .65rem .5rem; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; cursor: pointer; transition: border-color .15s, transform .1s; }
  .stat:hover { border-color: var(--accent-dim); transform: translateY(-1px); }
  .stat b { display: block; font-size: 1.4rem; color: var(--accent); }
  .stat span { font-size: .6rem; color: var(--text-dim); text-transform: uppercase; letter-spacing: .06em; }
  .stat.coverage b { color: ${coveragePct >= 70 ? "var(--green)" : coveragePct >= 40 ? "var(--yellow)" : "var(--red)"}; }

  .search-bar { margin-bottom: 1rem; position: relative; }
  .search-bar input {
    width: 100%; padding: .6rem .9rem; padding-right: 4rem; font-size: .82rem;
    background: var(--surface); border: 1px solid var(--border); border-radius: 8px;
    color: var(--text); outline: none; transition: border-color .15s; font-family: inherit;
  }
  .search-bar input::placeholder { color: var(--text-dim); }
  .search-bar input:focus { border-color: var(--accent-dim); }
  .search-hint { position: absolute; right: .75rem; top: 50%; transform: translateY(-50%); pointer-events: none; }

  .repo-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: .75rem; margin-bottom: 1.25rem; }
  @media (max-width: 1000px) { .repo-grid { grid-template-columns: 1fr 1fr; } }
  @media (max-width: 600px) { .repo-grid { grid-template-columns: 1fr; } }

  .repo-card {
    background: var(--surface); border: 1px solid var(--border); border-radius: 10px;
    overflow: hidden; transition: border-color .15s;
  }
  .repo-card[open] { grid-column: 1 / -1; border-color: var(--accent-dim); }
  .repo-card > summary {
    cursor: pointer; list-style: none; padding: .85rem 1rem;
    display: flex; flex-direction: column; gap: .3rem;
    min-height: 7.5rem; justify-content: center;
  }
  .repo-card > summary::-webkit-details-marker { display: none; }
  .repo-card > summary:hover { background: var(--surface2); }
  .repo-header { display: flex; align-items: center; justify-content: space-between; }
  .repo-card .repo-name {
    font-size: .88rem; font-weight: 600; color: var(--text);
    display: flex; align-items: center; gap: .4rem;
  }
  .repo-card .repo-preview {
    font-size: .7rem; color: var(--text-dim); line-height: 1.4;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  }
  .repo-card .badges { display: flex; gap: .3rem; margin-top: .2rem; flex-wrap: wrap; }
  .badge {
    font-size: .58rem; font-weight: 600; text-transform: uppercase; letter-spacing: .04em;
    padding: .12rem .4rem; border-radius: 3px; border: 1px solid;
  }
  .badge.cmds { color: var(--green); border-color: #4ade8033; background: #4ade8010; }
  .badge.rules { color: var(--purple); border-color: #a78bfa33; background: #a78bfa10; }
  .badge.agent { color: var(--blue); border-color: #60a5fa33; background: #60a5fa10; }
  .badge.skills { color: var(--yellow); border-color: #fbbf2433; background: #fbbf2410; }
  .badge.source { font-size: .5rem; padding: .08rem .3rem; margin-left: .4rem; text-transform: none; letter-spacing: .02em; flex-shrink: 0; }
  .badge.source.superpowers { color: var(--purple); border-color: #a78bfa33; background: #a78bfa10; }
  .badge.source.skillssh { color: var(--blue); border-color: #60a5fa33; background: #60a5fa10; }
  .badge.source.custom { color: var(--text-dim); border-color: var(--border); background: var(--surface2); }
  .skill-name { color: var(--yellow) !important; }
  .skill-category { margin-top: .75rem; }
  .skill-category:first-child { margin-top: 0; }
  .skill-category-label { font-size: .6rem; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--text-dim); padding: .3rem 0; margin-bottom: .25rem; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: .4rem; }
  .skill-category-label .cat-n { font-size: .55rem; color: var(--accent-dim); }

  .mcp-row { display: flex; align-items: center; gap: .5rem; padding: .3rem .25rem; border-bottom: 1px solid var(--border); font-size: .8rem; flex-wrap: wrap; }
  .mcp-row:last-child { border-bottom: none; }
  .mcp-row.mcp-disabled { opacity: .5; }
  .mcp-disabled-hint { font-size: .6rem; color: var(--red); opacity: .8; }
  .mcp-name { font-family: 'SF Mono', 'Fira Code', 'JetBrains Mono', monospace; font-weight: 600; color: var(--text); font-size: .78rem; }
  .mcp-projects { font-size: .65rem; color: var(--text-dim); margin-left: auto; }
  .badge.mcp-global { color: var(--green); border-color: #4ade8033; background: #4ade8010; }
  .badge.mcp-project { color: var(--blue); border-color: #60a5fa33; background: #60a5fa10; }
  .badge.mcp-recent { color: var(--yellow); border-color: #fbbf2433; background: #fbbf2410; }
  .badge.mcp-type { color: var(--text-dim); border-color: var(--border); background: var(--surface2); text-transform: none; font-size: .5rem; }
  .mcp-promote { font-size: .72rem; color: var(--text-dim); padding: .4rem .5rem; background: rgba(251,191,36,.05); border: 1px solid rgba(251,191,36,.15); border-radius: 6px; margin-top: .3rem; }
  .mcp-promote .mcp-name { color: var(--yellow); }
  .mcp-promote code { font-size: .65rem; color: var(--accent); }

  .insight-card { margin-bottom: 1.25rem; }
  .insight-row { display: flex; align-items: flex-start; gap: .6rem; padding: .5rem .6rem; border-radius: 6px; margin-bottom: .35rem; font-size: .78rem; line-height: 1.4; }
  .insight-row:last-child { margin-bottom: 0; }
  .insight-icon { flex-shrink: 0; font-size: .85rem; line-height: 1; margin-top: .1rem; }
  .insight-body { flex: 1; min-width: 0; }
  .insight-title { font-weight: 600; color: var(--text); }
  .insight-detail { color: var(--text-dim); font-size: .72rem; margin-top: .15rem; }
  .insight-action { color: var(--accent-dim); font-size: .68rem; font-style: italic; margin-top: .15rem; }
  .insight-row.warning { background: rgba(251,191,36,.06); border: 1px solid rgba(251,191,36,.15); }
  .insight-row.info { background: rgba(96,165,250,.06); border: 1px solid rgba(96,165,250,.15); }
  .insight-row.tip { background: rgba(74,222,128,.06); border: 1px solid rgba(74,222,128,.15); }
  .insight-row.promote { background: rgba(192,132,252,.06); border: 1px solid rgba(192,132,252,.15); }

  .report-card { margin-bottom: 1.25rem; }
  .report-subtitle { font-size: .72rem; color: var(--text-dim); margin-bottom: .75rem; }
  .report-stats { display: flex; flex-wrap: wrap; gap: .5rem; margin-bottom: .75rem; }
  .report-stat { background: var(--bg); border: 1px solid var(--border); border-radius: 6px; padding: .4rem .6rem; text-align: center; min-width: 70px; }
  .report-stat b { display: block; font-size: 1rem; color: var(--accent); }
  .report-stat span { font-size: .55rem; color: var(--text-dim); text-transform: uppercase; letter-spacing: .04em; }
  .report-glance { display: flex; flex-direction: column; gap: .5rem; margin-bottom: .75rem; }
  .report-glance-item { font-size: .75rem; line-height: 1.5; color: var(--text-dim); padding: .5rem .6rem; background: var(--bg); border-radius: 6px; border: 1px solid var(--border); }
  .report-glance-item strong { color: var(--text); font-weight: 600; }
  .report-link { display: inline-block; margin-top: .5rem; font-size: .72rem; color: var(--accent); text-decoration: none; }
  .report-link:hover { text-decoration: underline; }
  .mcp-former { opacity: .4; }
  .badge.mcp-former-badge { color: var(--text-dim); border-color: var(--border); background: var(--surface2); font-style: italic; }

  .usage-bar-row { display: flex; align-items: center; gap: .5rem; padding: .25rem 0; font-size: .75rem; }
  .usage-bar-label { width: 100px; flex-shrink: 0; color: var(--text); font-weight: 500; font-size: .72rem; }
  .usage-bar-track { flex: 1; height: 8px; background: var(--surface2); border-radius: 4px; overflow: hidden; }
  .usage-bar-fill { height: 100%; border-radius: 4px; transition: width .3s; }
  .usage-bar-tool { background: linear-gradient(90deg, var(--blue), var(--green)); }
  .usage-bar-lang { background: linear-gradient(90deg, var(--green), var(--accent)); }
  .usage-bar-error { background: linear-gradient(90deg, var(--red), var(--yellow)); }
  .usage-bar-count { font-size: .65rem; color: var(--text-dim); min-width: 40px; text-align: right; font-variant-numeric: tabular-nums; }

  .heatmap { display: grid; grid-template-rows: repeat(7, 10px); grid-auto-flow: column; grid-auto-columns: 10px; gap: 3px; overflow-x: auto; width: fit-content; max-width: 100%; }
  .heatmap-cell { border-radius: 2px; background: var(--surface2); width: 10px; height: 10px; }
  .heatmap-cell.l1 { background: #0e4429; }
  .heatmap-cell.l2 { background: #006d32; }
  .heatmap-cell.l3 { background: #26a641; }
  .heatmap-cell.l4 { background: #39d353; }
  [data-theme="light"] .heatmap-cell.l1 { background: #9be9a8; }
  [data-theme="light"] .heatmap-cell.l2 { background: #40c463; }
  [data-theme="light"] .heatmap-cell.l3 { background: #30a14e; }
  [data-theme="light"] .heatmap-cell.l4 { background: #216e39; }

  .heatmap-months { display: flex; font-size: .5rem; color: var(--text-dim); margin-bottom: .2rem; }
  .heatmap-month { flex: 1; }

  .chart-tooltip { position: fixed; pointer-events: none; background: var(--surface); color: var(--text); border: 1px solid var(--border); border-radius: 6px; padding: .3rem .5rem; font-size: .7rem; white-space: nowrap; z-index: 999; box-shadow: 0 2px 8px rgba(0,0,0,.25); opacity: 0; transition: opacity .1s; }
  .chart-tooltip.visible { opacity: 1; }

  .peak-hours { display: flex; align-items: flex-end; gap: 2px; height: 40px; }
  .peak-bar { flex: 1; background: var(--purple); border-radius: 2px 2px 0 0; min-width: 4px; opacity: .7; }
  .peak-labels { display: flex; gap: 2px; font-size: .45rem; color: var(--text-dim); }
  .peak-label { flex: 1; text-align: center; min-width: 4px; }

  .model-row { display: flex; justify-content: space-between; padding: .2rem 0; font-size: .72rem; border-bottom: 1px solid var(--border); }
  .model-row:last-child { border-bottom: none; }
  .model-name { color: var(--text); font-weight: 500; }
  .model-tokens { color: var(--text-dim); font-variant-numeric: tabular-nums; }
  .token-breakdown { margin-top: .25rem; }
  .tb-row { display: flex; justify-content: space-between; padding: .15rem 0; font-size: .68rem; }
  .tb-label { color: var(--text-dim); }
  .tb-val { color: var(--text); font-variant-numeric: tabular-nums; font-weight: 500; }

  .health-bar { height: 4px; background: var(--surface2); border-radius: 2px; margin: .4rem 0 .5rem; position: relative; overflow: hidden; }
  .health-fill { height: 100%; border-radius: 2px; transition: width .3s; }
  .health-label { position: absolute; right: 0; top: -14px; font-size: .55rem; color: var(--text-dim); }
  .badge.stack { color: var(--accent); border-color: var(--accent-dim); background: rgba(196,149,106,.08); text-transform: none; }
  .drift { font-size: .58rem; margin-left: .4rem; font-weight: 600; }
  .drift-low { color: var(--text-dim); }
  .drift-medium { color: var(--yellow); }
  .drift-high { color: var(--red); }
  .quick-wins { display: flex; flex-wrap: wrap; gap: .3rem; margin-bottom: .5rem; }
  .quick-win { font-size: .6rem; padding: .15rem .4rem; border-radius: 3px; background: rgba(251,191,36,.08); border: 1px solid rgba(251,191,36,.2); color: var(--yellow); }
  .matched-skills { display: flex; flex-wrap: wrap; gap: .3rem; margin-bottom: .5rem; }
  .matched-skill { font-size: .6rem; padding: .12rem .4rem; border-radius: 3px; background: rgba(251,191,36,.08); border: 1px solid rgba(251,191,36,.2); color: var(--yellow); font-family: 'SF Mono', monospace; }
  .similar-repos { display: flex; flex-wrap: wrap; gap: .3rem; margin-bottom: .5rem; }
  .similar-repo { font-size: .6rem; padding: .12rem .4rem; border-radius: 3px; background: rgba(99,179,237,.08); border: 1px solid rgba(99,179,237,.2); color: var(--blue); font-family: 'SF Mono', monospace; }
  .similar-repo small { opacity: .6; }
  .consolidation-hint { padding: .45rem .6rem; background: var(--surface2); border-radius: 6px; margin-top: .4rem; display: flex; align-items: baseline; gap: .5rem; }
  .consolidation-hint:first-child { margin-top: 0; }
  .consolidation-stack { font-size: .7rem; font-weight: 600; color: var(--accent); white-space: nowrap; }
  .consolidation-text { font-size: .7rem; color: var(--text-dim); }

  .unconfigured-item .stack-tag { font-size: .5rem; color: var(--accent-dim); margin-left: .3rem; }

  .freshness-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; }
  .freshness-dot.fresh { background: var(--green); }
  .freshness-dot.aging { background: var(--yellow); }
  .freshness-dot.stale { background: var(--red); }

  .repo-body { padding: 0 1rem 1rem; }
  .repo-meta { display: flex; justify-content: space-between; align-items: center; margin-bottom: .5rem; padding-bottom: .4rem; border-bottom: 1px solid var(--border); }
  .repo-path { font-size: .68rem; color: var(--text-dim); font-family: 'SF Mono', monospace; }
  .freshness { font-size: .65rem; font-weight: 500; }
  .freshness.fresh { color: var(--green); }
  .freshness.aging { color: var(--yellow); }
  .freshness.stale { color: var(--red); }
  .repo-desc { color: var(--text-dim); font-size: .75rem; line-height: 1.45; margin-bottom: .75rem; padding-bottom: .6rem; border-bottom: 1px solid var(--border); }

  .unconfigured-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: .4rem; }
  @media (max-width: 900px) { .unconfigured-grid { grid-template-columns: repeat(2, 1fr); } }
  .unconfigured-item { font-size: .72rem; padding: .3rem .5rem; border-radius: 4px; background: var(--surface2); color: var(--text-dim); }
  .unconfigured-item .upath { font-size: .6rem; color: #555; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .suggestion-hints { display: flex; flex-wrap: wrap; gap: .2rem; margin-top: .25rem; }
  .suggestion-hint { font-size: .5rem; padding: .08rem .3rem; border-radius: 2px; background: rgba(96,165,250,.08); border: 1px solid rgba(96,165,250,.15); color: var(--blue); }

  .ts { text-align: center; color: var(--text-dim); font-size: .65rem; margin-top: 2rem; padding-top: 1rem; border-top: 1px solid var(--border); }

  .theme-toggle {
    position: fixed; top: 1rem; right: 1rem; z-index: 100;
    background: var(--surface); border: 1px solid var(--border); border-radius: 8px;
    padding: .4rem .6rem; cursor: pointer; color: var(--text-dim); font-size: .75rem;
    transition: background .15s, border-color .15s;
  }
  .theme-toggle:hover { border-color: var(--accent-dim); }
  .theme-icon::before { content: "\\263E"; }
  [data-theme="light"] .theme-icon::before { content: "\\2600"; }

  .ref-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; }
  @media (max-width: 700px) { .ref-grid { grid-template-columns: 1fr; } }
  .ref-row { display: flex; align-items: baseline; gap: .5rem; padding: .2rem 0; font-size: .72rem; }
  .ref-cmd { font-size: .7rem; color: var(--green); white-space: nowrap; min-width: 100px; }
  .ref-key { min-width: 90px; font-size: .65rem; }
  .ref-desc { color: var(--text-dim); font-size: .68rem; }

  details.skill-category > summary { cursor: pointer; list-style: none; }
  details.skill-category > summary::-webkit-details-marker { display: none; }
  details.skill-category > summary:hover { color: var(--accent); }
  details.skill-category[open] > summary { color: var(--blue); }

  .group-controls { display: flex; align-items: center; gap: .5rem; margin-bottom: 1rem; }
  .group-label { font-size: .7rem; color: var(--text-dim); text-transform: uppercase; letter-spacing: .06em; }
  .group-select { font-size: .75rem; padding: .3rem .5rem; background: var(--surface); color: var(--text); border: 1px solid var(--border); border-radius: 6px; outline: none; font-family: inherit; }
  .group-select:focus { border-color: var(--accent-dim); }
  .group-heading { font-size: .75rem; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--accent); padding: .5rem 0 .25rem; margin-top: .75rem; border-bottom: 1px solid var(--border); grid-column: 1 / -1; }

  .repo-card[open] .repo-preview { display: none; }
  details.cmd-detail[open] .cmd-desc { white-space: normal; text-overflow: unset; overflow: visible; }
</style>
</head>
<body>
<h1>claude code dashboard</h1>
<button id="theme-toggle" class="theme-toggle" title="Toggle light/dark mode" aria-label="Toggle theme"><span class="theme-icon"></span></button>
<p class="sub">generated ${timestamp} · run <code>claude-code-dashboard</code> to refresh · <a href="${esc(REPO_URL)}" target="_blank" rel="noopener" style="color:var(--accent);text-decoration:none">v${esc(VERSION)}</a></p>

<div class="stats">
  <div class="stat coverage" data-nav="repos" data-section="repo-grid" title="View repos"><b>${coveragePct}%</b><span>Coverage (${configuredCount}/${totalRepos})</span></div>
  <div class="stat" data-nav="repos" data-section="repo-grid" title="View repos" style="${avgHealth >= 70 ? "border-color:#4ade8033" : avgHealth >= 40 ? "border-color:#fbbf2433" : "border-color:#f8717133"}"><b style="color:${healthScoreColor(avgHealth)}">${avgHealth}</b><span>Avg Health</span></div>
  <div class="stat" data-nav="overview" data-section="section-commands" title="View commands"><b>${globalCmds.length}</b><span>Global Commands</span></div>
  <div class="stat" data-nav="skills-mcp" data-section="section-skills" title="View skills"><b>${globalSkills.length}</b><span>Skills</span></div>
  <div class="stat" data-nav="repos" data-section="repo-grid" title="View repos"><b>${totalRepoCmds}</b><span>Repo Commands</span></div>
  ${mcpCount > 0 ? `<div class="stat" data-nav="skills-mcp" data-section="section-mcp" title="View MCP servers"><b>${mcpCount}</b><span>MCP Servers</span></div>` : ""}
  ${driftCount > 0 ? `<div class="stat" data-nav="repos" data-section="repo-grid" title="View drifting repos" style="border-color:#f8717133"><b style="color:var(--red)">${driftCount}</b><span>Drifting Repos</span></div>` : ""}
  ${ccusageData ? `<div class="stat" data-nav="analytics" data-section="section-activity" title="View analytics" style="border-color:#4ade8033"><b style="color:var(--green)">$${Math.round(Number(ccusageData.totals.totalCost) || 0).toLocaleString()}</b><span>Total Spent</span></div>` : ""}
  ${ccusageData ? `<div class="stat" data-nav="analytics" data-section="section-activity" title="View analytics"><b>${formatTokens(ccusageData.totals.totalTokens).replace(" tokens", "")}</b><span>Total Tokens</span></div>` : ""}
  ${usageAnalytics.heavySessions > 0 ? `<div class="stat" data-nav="analytics" data-section="section-activity" title="View analytics"><b>${usageAnalytics.heavySessions}</b><span>Heavy Sessions</span></div>` : ""}
</div>

<nav class="tab-nav">
  <button class="tab-btn active" data-tab="overview">Overview</button>
  <button class="tab-btn" data-tab="skills-mcp">Skills & MCP</button>
  <button class="tab-btn" data-tab="analytics">Analytics</button>
  <button class="tab-btn" data-tab="repos">Repos</button>
  <button class="tab-btn" data-tab="reference">Reference</button>
</nav>

<div class="tab-content active" id="tab-overview">
  <div class="top-grid">
    <div class="card" id="section-commands" style="margin-bottom:0">
      <h2>Global Commands <span class="n">${globalCmds.length}</span></h2>
      ${globalCmds.map((c) => renderCmd(c)).join("\n  ")}
    </div>
    <div class="card" style="margin-bottom:0">
      <h2>Global Rules <span class="n">${globalRules.length}</span></h2>
      ${globalRules.map((r) => renderRule(r)).join("\n  ")}
    </div>
  </div>
  ${
    insights && insights.length > 0
      ? `<div class="card insight-card">
    <h2>Insights <span class="n">${insights.length}</span></h2>
    ${insights
      .map(
        (i) =>
          `<div class="insight-row ${esc(i.type)}">
      <span class="insight-icon">${i.type === "warning" ? "&#9888;" : i.type === "tip" ? "&#10024;" : i.type === "promote" ? "&#8593;" : "&#9432;"}</span>
      <div class="insight-body">
        <div class="insight-title">${esc(i.title)}</div>
        ${i.detail ? `<div class="insight-detail">${esc(i.detail)}</div>` : ""}
        ${i.action ? `<div class="insight-action">${esc(i.action)}</div>` : ""}
      </div>
    </div>`,
      )
      .join("\n    ")}
  </div>`
      : ""
  }
  ${chainsHtml}
  ${consolidationHtml}
</div>

<div class="tab-content" id="tab-skills-mcp">
  ${skillsHtml}
  ${mcpHtml}
</div>

<div class="tab-content" id="tab-analytics">
  ${
    insightsReport
      ? `<div class="card report-card" id="section-insights-report">
    <h2>Claude Code Insights</h2>
    ${insightsReport.subtitle ? `<div class="report-subtitle">${esc(insightsReport.subtitle)}</div>` : ""}
    ${
      insightsReport.stats.length > 0
        ? `<div class="report-stats">${insightsReport.stats
            .map((s) => {
              if (s.isDiff) {
                const parts = s.value.match(/^([+-][^/]+)\/([-+].+)$/);
                if (parts) {
                  return `<div class="report-stat"><b><span style="color:var(--green)">${esc(parts[1])}</span><span style="color:var(--text-dim)">/</span><span style="color:var(--red)">${esc(parts[2])}</span></b><span>${esc(s.label)}</span></div>`;
                }
              }
              return `<div class="report-stat"><b>${esc(s.value)}</b><span>${esc(s.label)}</span></div>`;
            })
            .join("")}</div>`
        : ""
    }
    ${
      insightsReport.glance.length > 0
        ? `<div class="report-glance">${insightsReport.glance.map((g) => `<div class="report-glance-item"><strong>${esc(g.label)}:</strong> ${esc(g.text)}</div>`).join("")}</div>`
        : ""
    }
    <a class="report-link" href="file://${encodeURI(insightsReport.filePath)}" target="_blank">View full insights report &rarr;</a>
  </div>`
      : `<div class="card report-card">
    <h2>Claude Code Insights</h2>
    <div class="report-glance"><div class="report-glance-item">No insights report found. Run <code>/insights</code> in Claude Code to generate a personalized report with usage patterns, friction points, and feature suggestions.</div></div>
  </div>`
  }
  <div class="top-grid">
    ${toolsHtml || ""}
    ${langsHtml || ""}
  </div>
  ${errorsHtml}
  ${activityHtml}
</div>

<div class="tab-content" id="tab-repos">
  <div class="search-bar">
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
  ${configured.map((r) => renderRepoCard(r)).join("\n")}
  </div>
  ${unconfiguredHtml}
</div>

<div class="tab-content" id="tab-reference">
  ${referenceHtml}
</div>

<div class="ts">found ${totalRepos} repos · ${configuredCount} configured · ${unconfiguredCount} unconfigured · scanned ${scanScope} · ${timestamp}</div>

<div class="chart-tooltip" id="chart-tooltip"></div>
<script>
function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.remove('active'); });
  document.querySelectorAll('.tab-content').forEach(function(c) { c.classList.remove('active'); });
  var btn = document.querySelector('.tab-btn[data-tab="' + tabName + '"]');
  if (btn) btn.classList.add('active');
  var content = document.getElementById('tab-' + tabName);
  if (content) content.classList.add('active');
}
document.querySelectorAll('.tab-btn').forEach(function(btn) {
  btn.addEventListener('click', function() { switchTab(btn.dataset.tab); });
});
document.querySelectorAll('.stat[data-nav]').forEach(function(stat) {
  stat.addEventListener('click', function() {
    switchTab(stat.dataset.nav);
    if (stat.dataset.section) {
      var el = document.getElementById(stat.dataset.section);
      if (el) setTimeout(function() { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 50);
    }
  });
});

var input = document.getElementById('search');
var hint = document.querySelector('.search-hint');

input.addEventListener('input', function(e) {
  var q = e.target.value.toLowerCase();
  hint.style.display = q ? 'none' : '';
  document.querySelectorAll('.repo-card').forEach(function(card) {
    var name = card.dataset.name.toLowerCase();
    var path = (card.dataset.path || '').toLowerCase();
    var text = card.textContent.toLowerCase();
    card.style.display = (q === '' || name.includes(q) || path.includes(q) || text.includes(q)) ? '' : 'none';
  });
});

document.addEventListener('keydown', function(e) {
  if (e.key === '/' && document.activeElement !== input) {
    e.preventDefault();
    // Switch to repos tab first
    document.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.remove('active'); });
    document.querySelectorAll('.tab-content').forEach(function(c) { c.classList.remove('active'); });
    document.querySelector('[data-tab="repos"]').classList.add('active');
    document.getElementById('tab-repos').classList.add('active');
    input.focus();
  }
  if (e.key === 'Escape' && document.activeElement === input) {
    input.value = '';
    input.dispatchEvent(new Event('input'));
    input.blur();
  }
});

var toggle = document.getElementById('theme-toggle');
var saved = localStorage.getItem('ccd-theme');
if (saved) document.documentElement.setAttribute('data-theme', saved);
else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
  document.documentElement.setAttribute('data-theme', 'light');
}
toggle.addEventListener('click', function() {
  var current = document.documentElement.getAttribute('data-theme');
  var next = current === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('ccd-theme', next);
});

var groupSelect = document.getElementById('group-by');
groupSelect.addEventListener('change', function() {
  var mode = this.value;
  var grid = document.getElementById('repo-grid');
  grid.querySelectorAll('.group-heading').forEach(function(h) { h.remove(); });
  var cards = Array.from(grid.querySelectorAll('.repo-card'));
  if (mode === 'none') {
    cards.forEach(function(c) { grid.appendChild(c); });
    return;
  }
  var groups = {};
  cards.forEach(function(card) {
    if (mode === 'stack') {
      var stacks = (card.dataset.stack || 'undetected').split(',');
      stacks.forEach(function(s) {
        var key = s.trim() || 'undetected';
        if (!groups[key]) groups[key] = [];
        groups[key].push(card);
      });
    } else {
      var key = card.dataset.parent || '~/';
      if (!groups[key]) groups[key] = [];
      groups[key].push(card);
    }
  });
  Object.keys(groups).sort().forEach(function(key) {
    var h = document.createElement('div');
    h.className = 'group-heading';
    h.textContent = key || '(none)';
    grid.appendChild(h);
    groups[key].forEach(function(card) { grid.appendChild(card); });
  });
});

// Custom tooltip for heatmap cells and peak bars
var tip = document.getElementById('chart-tooltip');
document.addEventListener('mouseover', function(e) {
  var t = e.target.closest('.heatmap-cell, .peak-bar');
  if (t && t.title) {
    tip.textContent = t.title;
    tip.classList.add('visible');
    t.dataset.tip = t.title;
    t.removeAttribute('title');
  }
});
document.addEventListener('mousemove', function(e) {
  if (tip.classList.contains('visible')) {
    tip.style.left = (e.clientX + 12) + 'px';
    tip.style.top = (e.clientY - 28) + 'px';
  }
});
document.addEventListener('mouseout', function(e) {
  var t = e.target.closest('.heatmap-cell, .peak-bar');
  if (t && t.dataset.tip) {
    t.title = t.dataset.tip;
    delete t.dataset.tip;
  }
  if (!e.relatedTarget || !e.relatedTarget.closest || !e.relatedTarget.closest('.heatmap-cell, .peak-bar')) {
    tip.classList.remove('visible');
  }
});
</script>
</body>
</html>`;
}
