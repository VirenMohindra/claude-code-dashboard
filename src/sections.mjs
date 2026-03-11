import { esc, formatTokens } from "./helpers.mjs";
import { renderSkill, healthScoreColor } from "./render.mjs";
import { groupSkillsByCategory } from "./skills.mjs";
import { QUICK_REFERENCE } from "./constants.mjs";

export function renderSkillsCard(globalSkills) {
  if (!globalSkills.length) return "";
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
}

export function renderMcpCard(mcpSummary, mcpPromotions, formerMcpServers) {
  if (!mcpSummary.length) return "";
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
}

export function renderToolsCard(topTools) {
  if (!topTools.length) return "";
  const maxCount = topTools[0].count;
  const rows = topTools
    .map((t) => {
      const pct = maxCount > 0 ? Math.round((t.count / maxCount) * 100) : 0;
      return `<div class="usage-bar-row"><span class="usage-bar-label">${esc(t.name)}</span><div class="usage-bar-track"><div class="usage-bar-fill usage-bar-tool" style="width:${pct}%"></div></div><span class="usage-bar-count">${t.count.toLocaleString()}</span></div>`;
    })
    .join("\n    ");
  return `<div class="card">
  <h2>Top Tools Used <span class="n">${topTools.length}</span></h2>
  ${rows}
</div>`;
}

export function renderLangsCard(topLanguages) {
  if (!topLanguages.length) return "";
  const maxCount = topLanguages[0].count;
  const rows = topLanguages
    .map((l) => {
      const pct = maxCount > 0 ? Math.round((l.count / maxCount) * 100) : 0;
      return `<div class="usage-bar-row"><span class="usage-bar-label">${esc(l.name)}</span><div class="usage-bar-track"><div class="usage-bar-fill usage-bar-lang" style="width:${pct}%"></div></div><span class="usage-bar-count">${l.count.toLocaleString()}</span></div>`;
    })
    .join("\n    ");
  return `<div class="card">
  <h2>Languages <span class="n">${topLanguages.length}</span></h2>
  ${rows}
</div>`;
}

export function renderErrorsCard(errorCategories) {
  if (!errorCategories.length) return "";
  const maxCount = errorCategories[0].count;
  const rows = errorCategories
    .map((e) => {
      const pct = maxCount > 0 ? Math.round((e.count / maxCount) * 100) : 0;
      return `<div class="usage-bar-row"><span class="usage-bar-label">${esc(e.name)}</span><div class="usage-bar-track"><div class="usage-bar-fill usage-bar-error" style="width:${pct}%"></div></div><span class="usage-bar-count">${e.count.toLocaleString()}</span></div>`;
    })
    .join("\n    ");
  return `<div class="card">
  <h2>Top Errors <span class="n">${errorCategories.length}</span></h2>
  ${rows}
</div>`;
}

export function renderActivityCard(statsCache, ccusageData) {
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
}

export function renderChainsCard(chains) {
  if (!chains.length) return "";
  return `<div class="card">
  <h2>Dependency Chains</h2>
  ${chains.map((c) => `<div class="chain">${c.nodes.map((n, i) => `<span class="chain-node">${esc(n.trim())}</span>${i < c.nodes.length - 1 ? `<span class="chain-arrow">${c.arrow}</span>` : ""}`).join("")}</div>`).join("\n  ")}
</div>`;
}

export function renderConsolidationCard(consolidationGroups) {
  if (!consolidationGroups.length) return "";
  return `<div class="card">
  <h2>Consolidation Opportunities <span class="n">${consolidationGroups.length}</span></h2>
  ${consolidationGroups.map((g) => `<div class="consolidation-hint"><span class="consolidation-stack">${esc(g.stack)}</span> <span class="consolidation-text">${esc(g.suggestion)}</span></div>`).join("\n  ")}
</div>`;
}

export function renderUnconfiguredCard(unconfigured) {
  if (!unconfigured.length) return "";
  return `<details class="card">
  <summary style="cursor:pointer;list-style:none"><h2 style="margin:0">Unconfigured Repos <span class="n">${unconfigured.length}</span></h2></summary>
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
</details>`;
}

export function renderReferenceCard() {
  return `<div class="card">
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
}

export function renderInsightsCard(insights, markdown) {
  if (!insights || !insights.length) return "";
  const mdAttr = markdown ? ` data-markdown="${esc(markdown)}"` : "";
  return `<div class="card insight-card"${mdAttr}>
    <div class="card-header">
      <h2>Insights <span class="n">${insights.length}</span></h2>
      ${markdown ? `<button class="copy-md-btn" title="Copy as Markdown">&#128203; copy markdown</button>` : ""}
    </div>
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
  </div>`;
}

export function renderInsightsReportCard(insightsReport) {
  if (!insightsReport) {
    return `<div class="card report-card">
    <h2>Claude Code Insights</h2>
    <div class="report-glance"><div class="report-glance-item">No insights report found. Run <code>/insights</code> in Claude Code to generate a personalized report with usage patterns, friction points, and feature suggestions.</div></div>
  </div>`;
  }
  return `<div class="card report-card" id="section-insights-report">
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
  </div>`;
}

export function renderStatsBar(data) {
  const {
    coveragePct,
    configuredCount,
    totalRepos,
    avgHealth,
    globalCmds,
    globalSkills,
    totalRepoCmds,
    mcpCount,
    driftCount,
    ccusageData,
    usageAnalytics,
  } = data;
  return `<div class="stats">
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
</div>`;
}
