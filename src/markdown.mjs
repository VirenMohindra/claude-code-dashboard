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
  let lines;
  try {
    lines = readFileSync(filepath, "utf8").split("\n");
  } catch {
    return [];
  }

  const result = [];
  let inCode = false;
  let foundContent = false;

  for (const line of lines) {
    if (line.startsWith("```")) {
      inCode = !inCode;
      continue;
    }
    if (inCode) continue;
    if (line.startsWith("# ") && result.length === 0) continue;
    if (!line.trim() && !foundContent) continue;
    if (line.startsWith("## ") && foundContent) break;
    if (line.startsWith("## ") && !foundContent) continue;
    if (BOILERPLATE_RE.test(line)) continue;
    if (/^[^#|`]/.test(line) && line.trim().length > 5) {
      foundContent = true;
      result.push(line.replace(/\*\*/g, "").replace(/`/g, ""));
      if (result.length >= 2) break;
    }
  }
  return result;
}

export function extractSections(filepath) {
  let lines;
  try {
    lines = readFileSync(filepath, "utf8").split("\n");
  } catch {
    return [];
  }

  const sections = [];
  let current = null;
  let inCode = false;

  for (const line of lines) {
    if (line.startsWith("```")) {
      inCode = !inCode;
      continue;
    }
    if (inCode) continue;

    if (line.startsWith("## ")) {
      current = { name: line.slice(3), preview: [] };
      sections.push(current);
      continue;
    }
    if (current && current.preview.length < 3 && !line.startsWith("#") && line.trim()) {
      let cleaned = line.replace(/\*\*/g, "").replace(/`/g, "").replace(/^- /, "");
      if (cleaned.trim().length > 2) {
        if (cleaned.length > 80) cleaned = cleaned.slice(0, 77) + "...";
        current.preview.push(cleaned.trim());
      }
    }
  }
  return sections;
}

export function extractSteps(filepath) {
  let lines;
  try {
    lines = readFileSync(filepath, "utf8").split("\n");
  } catch {
    return [];
  }

  const steps = [];
  for (const line of lines) {
    if (line.startsWith("## ")) {
      steps.push({ type: "section", text: line.slice(3) });
    } else if (/^\d+\. /.test(line)) {
      steps.push({ type: "step", text: line.replace(/^\d+\. /, "").replace(/\*\*/g, "") });
    } else if (line.startsWith("- **")) {
      const m = line.match(/^- \*\*([^*]+)\*\*/);
      if (m) steps.push({ type: "key", text: m[1] });
    }
    if (steps.length >= 12) break;
  }
  return steps;
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
