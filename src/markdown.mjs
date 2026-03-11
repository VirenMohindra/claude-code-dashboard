import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";
import { BOILERPLATE_RE } from "./constants.mjs";

export function getDescFromContent(content) {
  const lines = content.split("\n");

  // YAML frontmatter
  if (lines[0] === "---") {
    for (let i = 1; i < lines.length; i++) {
      if (lines[i] === "---") break;
      const m = lines[i].match(/^description:\s*(.+)/);
      if (m) return m[1].trim();
    }
  }

  if (lines[0]?.startsWith("# ")) return lines[0].slice(2);

  // First non-empty, non-frontmatter line
  for (const l of lines.slice(0, 5)) {
    const t = l.trim();
    if (t && t !== "---" && !t.startsWith("```")) {
      return t.length > 60 ? t.slice(0, 57) + "..." : t;
    }
  }
  return "";
}

export function getDesc(filepath) {
  try {
    return getDescFromContent(readFileSync(filepath, "utf8"));
  } catch {
    return "";
  }
}

export function extractProjectDesc(filepath) {
  try {
    const content = readFileSync(filepath, "utf8");
    const lines = content.split("\n");
    const desc = [];

    // YAML frontmatter description
    if (lines[0] === "---") {
      for (let i = 1; i < lines.length; i++) {
        if (lines[i] === "---") break;
        const m = lines[i].match(/^description:\s*(.+)/);
        if (m) {
          desc.push(m[1].trim());
          return desc;
        }
      }
    }

    // First meaningful lines (skip headings, boilerplate)
    for (const l of lines.slice(0, 10)) {
      const t = l.trim();
      if (!t || t.startsWith("#") || t.startsWith("```") || t === "---") continue;
      if (BOILERPLATE_RE.test(t)) continue;
      desc.push(t.length > 120 ? t.slice(0, 117) + "..." : t);
      if (desc.length >= 2) break;
    }
    return desc;
  } catch {
    return [];
  }
}

export function extractSections(filepath) {
  try {
    const content = readFileSync(filepath, "utf8");
    const lines = content.split("\n");
    const sections = [];
    let current = null;

    for (const l of lines) {
      const m = l.match(/^##\s+(.+)/);
      if (m) {
        if (current) sections.push(current);
        current = { name: m[1].trim(), preview: [] };
      } else if (current && current.preview.length < 3) {
        const t = l.trim();
        if (t && !t.startsWith("```")) current.preview.push(t);
      }
    }
    if (current) sections.push(current);
    return sections;
  } catch {
    return [];
  }
}

export function extractSteps(filepath) {
  try {
    const content = readFileSync(filepath, "utf8");
    const steps = [];
    for (const l of content.split("\n")) {
      const t = l.trim();
      if (!t) continue;
      if (/^\d+\.\s/.test(t)) steps.push({ type: "step", text: t });
      else if (t.startsWith("- ") || t.startsWith("* ")) steps.push({ type: "bullet", text: t });
      else if (t.startsWith("> ")) steps.push({ type: "note", text: t.slice(2) });
    }
    return steps;
  } catch {
    return [];
  }
}

export function scanMdDir(dir) {
  if (!existsSync(dir)) return [];
  const results = [];
  try {
    for (const f of readdirSync(dir)) {
      if (!f.endsWith(".md")) continue;
      const full = join(dir, f);
      const name = f.slice(0, -3);
      const desc = getDesc(full);
      results.push({ name, desc: desc || "No description", filepath: full });
    }
  } catch {
    /* directory unreadable */
  }
  return results.sort((a, b) => a.name.localeCompare(b.name));
}
