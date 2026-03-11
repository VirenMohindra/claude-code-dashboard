import { esc } from "./helpers.mjs";
import { extractSteps, extractSections } from "./markdown.mjs";
import { groupSkillsByCategory } from "./skills.mjs";

export function renderSections(sections) {
  return sections
    .map(
      (s) =>
        `<details class="agent-section"><summary>${esc(s.name)}</summary>` +
        (s.preview.length
          ? `<div class="agent-section-preview">${s.preview.map((l) => `<div class="line">${esc(l)}</div>`).join("")}</div>`
          : "") +
        `</details>`,
    )
    .join("");
}

export function renderCmd(cmd, prefix = "/") {
  const steps = extractSteps(cmd.filepath);
  const d = esc(cmd.desc);
  if (steps.length) {
    const body = steps.map((s) => `<div class="detail-${s.type}">${esc(s.text)}</div>`).join("");
    return `<details class="cmd-detail"><summary><span class="cmd-name">${prefix}${esc(cmd.name)}</span><span class="cmd-desc">${d}</span></summary><div class="detail-body">${body}</div></details>`;
  }
  return `<div class="cmd-row"><span class="cmd-name">${prefix}${esc(cmd.name)}</span><span class="cmd-desc">${d}</span></div>`;
}

export function renderRule(rule) {
  const sections = extractSections(rule.filepath);
  const d = esc(rule.desc);
  if (sections.length) {
    return `<details class="cmd-detail"><summary><span class="cmd-name">${esc(rule.name)}</span><span class="cmd-desc">${d}</span></summary><div class="detail-body">${renderSections(sections)}</div></details>`;
  }
  return `<div class="cmd-row"><span class="cmd-name">${esc(rule.name)}</span><span class="cmd-desc">${d}</span></div>`;
}

export function sourceBadgeHtml(source) {
  if (!source) return "";
  switch (source.type) {
    case "superpowers":
      return `<span class="badge source superpowers">superpowers</span>`;
    case "skills.sh": {
      const label = source.repo ? `skills.sh &middot; ${esc(source.repo)}` : "skills.sh";
      return `<span class="badge source skillssh">${label}</span>`;
    }
    default:
      return `<span class="badge source custom">custom</span>`;
  }
}

export function renderSkill(skill) {
  const sections = extractSections(skill.filepath);
  const d = esc(skill.desc);
  const badge = sourceBadgeHtml(skill.source);
  if (sections.length) {
    return `<details class="cmd-detail"><summary><span class="cmd-name skill-name">${esc(skill.name)}</span>${badge}<span class="cmd-desc">${d}</span></summary><div class="detail-body">${renderSections(sections)}</div></details>`;
  }
  return `<div class="cmd-row"><span class="cmd-name skill-name">${esc(skill.name)}</span>${badge}<span class="cmd-desc">${d}</span></div>`;
}

// Re-export from skills.mjs (single source of truth)
export { groupSkillsByCategory };

export function renderBadges(repo) {
  const b = [];
  if (repo.commands.length) b.push(`<span class="badge cmds">${repo.commands.length} cmd</span>`);
  if (repo.rules.length) b.push(`<span class="badge rules">${repo.rules.length} rules</span>`);
  if (repo.sections.length)
    b.push(`<span class="badge agent">${repo.sections.length} sections</span>`);
  if (repo.techStack && repo.techStack.length)
    b.push(`<span class="badge stack">${esc(repo.techStack.join(", "))}</span>`);
  return b.join("");
}

export function healthScoreColor(score) {
  if (score >= 80) return "var(--green)";
  if (score >= 50) return "var(--yellow)";
  return "var(--red)";
}

export function renderHealthBar(repo) {
  if (repo.healthScore === undefined) return "";
  const s = Math.max(0, Math.min(100, repo.healthScore || 0));
  const color = healthScoreColor(s);
  return `<div class="health-bar"><div class="health-fill" style="width:${s}%;background:${color}"></div><span class="health-label">${s}</span></div>`;
}

export function renderDriftIndicator(repo) {
  if (!repo.drift || repo.drift.level === "unknown" || repo.drift.level === "synced") return "";
  const cls = `drift-${esc(repo.drift.level)}`;
  const n = Number(repo.drift.commitsSince) || 0;
  return `<span class="drift ${cls}" title="${n} commits since config update">${n}&#8203;&#916;</span>`;
}

export function renderRepoCard(repo) {
  const badges = renderBadges(repo);
  const preview = repo.desc[0] ? esc(repo.desc[0].slice(0, 120)) : "";
  const drift = renderDriftIndicator(repo);

  let body = "";

  body += `<div class="repo-meta"><span class="repo-path">${esc(repo.shortPath)}</span>`;
  body += `<span class="freshness ${repo.freshnessClass}">${esc(repo.freshnessText)}${drift}</span></div>`;

  body += renderHealthBar(repo);

  if (repo.desc.length) {
    body += `<div class="repo-desc">${repo.desc.map((l) => esc(l)).join("<br>")}</div>`;
  }

  if (repo.healthReasons && repo.healthReasons.length) {
    body += `<div class="label">Quick Wins</div>`;
    body += `<div class="quick-wins">${repo.healthReasons.map((r) => `<span class="quick-win">${esc(r)}</span>`).join("")}</div>`;
  }

  if (repo.commands.length) {
    body += `<div class="label">Commands</div>`;
    body += repo.commands.map((c) => renderCmd(c)).join("");
  }

  if (repo.rules.length) {
    body += `<div class="label">Rules</div>`;
    body += repo.rules.map((r) => renderRule(r)).join("");
  }

  if (repo.matchedSkills && repo.matchedSkills.length) {
    body += `<div class="label">Relevant Skills</div>`;
    body += `<div class="matched-skills">${repo.matchedSkills
      .map((m) => `<span class="matched-skill">${esc(m.name)}</span>`)
      .join("")}</div>`;
  }

  if (repo.similarRepos && repo.similarRepos.length) {
    body += `<div class="label">Similar Configs</div>`;
    body += `<div class="similar-repos">${repo.similarRepos
      .map(
        (r) => `<span class="similar-repo">${esc(r.name)} <small>${r.similarity}%</small></span>`,
      )
      .join("")}</div>`;
  }

  if (repo.sections.length) {
    body += `<div class="label">Agent Config</div>`;
    body += renderSections(repo.sections);
  }

  const parent = repo.shortPath.split("/").slice(0, -1).join("/");

  return `<details class="repo-card" data-name="${esc(repo.name)}" data-path="${esc(repo.shortPath)}" data-stack="${esc((repo.techStack || []).join(","))}" data-parent="${esc(parent)}">
  <summary>
    <div class="repo-header">
      <div class="repo-name">${esc(repo.name)}<span class="freshness-dot ${repo.freshnessClass}"></span></div>
    </div>
    ${preview ? `<div class="repo-preview">${preview}</div>` : ""}
    ${badges ? `<div class="badges">${badges}</div>` : ""}
  </summary>
  <div class="repo-body">${body}</div>
</details>`;
}

export function generateCatalogHtml(groups, totalCount, ts) {
  let cards = "";
  for (const [cat, skills] of Object.entries(groups)) {
    const heading = cat.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    let rows = "";
    for (const s of skills) {
      const badge = sourceBadgeHtml(s.source);
      let hint = "";
      if (s.source) {
        switch (s.source.type) {
          case "superpowers":
            hint = "Included with superpowers-skills";
            break;
          case "skills.sh":
            hint = s.source.repo
              ? `Installed via skills.sh (${esc(s.source.repo)})`
              : "Installed via skills.sh";
            break;
          default:
            hint = `Custom skill — copy from ~/.claude/skills/${esc(s.name)}/`;
        }
      }
      rows += `
      <div class="cat-skill">
        <div class="cat-skill-head">
          <span class="cat-skill-name">${esc(s.name)}</span>${badge}
        </div>
        <div class="cat-skill-desc">${esc(s.desc)}</div>
        ${hint ? `<div class="cat-skill-hint">${hint}</div>` : ""}
      </div>`;
    }
    cards += `
    <section class="cat-group">
      <h2>${esc(heading)} <span class="cat-n">${skills.length}</span></h2>
      ${rows}
    </section>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Claude Code Skill Catalog</title>
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
    padding: 2.5rem 2rem; line-height: 1.5; max-width: 900px; margin: 0 auto;
  }
  code { font-family: 'SF Mono', 'Fira Code', 'JetBrains Mono', monospace; }
  h1 { font-size: 1.4rem; font-weight: 600; color: var(--accent); margin-bottom: .2rem; }
  .sub { color: var(--text-dim); font-size: .78rem; margin-bottom: 2rem; }
  .cat-group { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 1.25rem; margin-bottom: 1.25rem; }
  .cat-group h2 { font-size: .7rem; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: var(--text-dim); margin-bottom: .75rem; display: flex; align-items: center; gap: .5rem; }
  .cat-n { background: var(--surface2); border: 1px solid var(--border); border-radius: 4px; padding: .05rem .35rem; font-size: .65rem; color: var(--accent); }
  .cat-skill { padding: .5rem .25rem; border-bottom: 1px solid var(--border); }
  .cat-skill:last-child { border-bottom: none; }
  .cat-skill-head { display: flex; align-items: center; gap: .5rem; flex-wrap: wrap; }
  .cat-skill-name { font-family: 'SF Mono', 'Fira Code', 'JetBrains Mono', monospace; font-weight: 600; color: var(--yellow); font-size: .82rem; }
  .cat-skill-desc { color: var(--text-dim); font-size: .75rem; margin-top: .15rem; }
  .cat-skill-hint { font-size: .65rem; color: var(--blue); margin-top: .2rem; opacity: .8; }
  .badge { font-size: .55rem; padding: .1rem .35rem; border-radius: 3px; font-weight: 600; }
  .badge.source.superpowers { background: rgba(167,139,250,.1); border: 1px solid rgba(167,139,250,.2); color: var(--purple); }
  .badge.source.skillssh { background: rgba(96,165,250,.1); border: 1px solid rgba(96,165,250,.2); color: var(--blue); }
  .badge.source.custom { background: rgba(251,191,36,.1); border: 1px solid rgba(251,191,36,.2); color: var(--yellow); }
  @media (max-width: 600px) { body { padding: 1.5rem 1rem; } }
  .theme-toggle {
    position: fixed; top: 1rem; right: 1rem; z-index: 100;
    background: var(--surface); border: 1px solid var(--border); border-radius: 8px;
    padding: .4rem .6rem; cursor: pointer; color: var(--text-dim); font-size: .75rem;
    transition: background .15s, border-color .15s;
  }
  .theme-toggle:hover { border-color: var(--accent-dim); }
  .theme-icon::before { content: "\\263E"; }
  [data-theme="light"] .theme-icon::before { content: "\\2600"; }
</style>
</head>
<body>
<h1>Claude Code Skill Catalog</h1>
<button id="theme-toggle" class="theme-toggle" title="Toggle light/dark mode" aria-label="Toggle theme"><span class="theme-icon"></span></button>
<div class="sub">${totalCount} skills &middot; generated ${esc(ts)}</div>
${cards}
<script>
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
</script>
</body>
</html>`;
}
