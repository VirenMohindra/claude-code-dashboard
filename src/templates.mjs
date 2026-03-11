import { existsSync, writeFileSync } from "fs";
import { join, basename } from "path";
import { CONF, MAX_DEPTH } from "./constants.mjs";
import {
  detectTechStack,
  findExemplar,
  detectConfigPattern,
  computeHealthScore,
} from "./analysis.mjs";
import { getFreshness, freshnessClass } from "./freshness.mjs";
import { scanMdDir, extractSections, extractProjectDesc } from "./markdown.mjs";
import { findGitRepos, getScanRoots } from "./discovery.mjs";

export const TEMPLATE_SECTIONS = {
  next: {
    purpose: "Next.js web application",
    commands: "npm run dev, npm run build, npm run lint, npm test",
    rules: [
      "Use App Router conventions",
      "Server components by default, 'use client' only when needed",
      "Use TypeScript strict mode",
    ],
  },
  react: {
    purpose: "React application",
    commands: "npm start, npm run build, npm run lint, npm test",
    rules: [
      "Functional components with hooks",
      "Co-locate component, test, and styles",
      "Use TypeScript strict mode",
    ],
  },
  python: {
    purpose: "Python application",
    commands: "pytest, ruff check ., ruff format .",
    rules: [
      "Type hints on all public functions",
      "Use dataclasses/pydantic for data models",
      "Keep modules focused and small",
    ],
  },
  node: {
    purpose: "Node.js application",
    commands: "npm start, npm test, npm run lint",
    rules: [
      "Use ES modules (import/export)",
      "Handle errors explicitly, never swallow",
      "Use async/await over callbacks",
    ],
  },
  go: {
    purpose: "Go application",
    commands: "go build ./..., go test ./..., golangci-lint run",
    rules: [
      "Handle all errors explicitly",
      "Use interfaces for testability",
      "Keep packages focused",
    ],
  },
  expo: {
    purpose: "Expo/React Native mobile application",
    commands: "npx expo start, npm test, npm run lint",
    rules: [
      "Use Expo SDK APIs over bare React Native",
      "Test on both iOS and Android",
      "Use TypeScript strict mode",
    ],
  },
  rust: {
    purpose: "Rust application",
    commands: "cargo build, cargo test, cargo clippy",
    rules: [
      "Prefer owned types in public APIs",
      "Use Result for fallible operations",
      "Document public items",
    ],
  },
  swift: {
    purpose: "Swift application",
    commands: "swift build, swift test",
    rules: [
      "Use Swift concurrency (async/await)",
      "Protocol-oriented design",
      "Prefer value types",
    ],
  },
  generic: {
    purpose: "Software project",
    commands: "",
    rules: [
      "Follow existing patterns in the codebase",
      "Test before committing",
      "Keep functions focused and small",
    ],
  },
};

function generateTemplate(stack, exemplar, pattern) {
  const t = TEMPLATE_SECTIONS[stack] || TEMPLATE_SECTIONS.generic;
  const lines = [];

  lines.push(`# ${basename(process.cwd())}`);
  lines.push("");
  lines.push(`> ${t.purpose}`);
  lines.push("");

  if (t.commands) {
    lines.push("## Commands");
    lines.push("");
    for (const cmd of t.commands.split(", ")) {
      lines.push(`- \`${cmd}\``);
    }
    lines.push("");
  }

  lines.push("## Architecture");
  lines.push("");
  lines.push("<!-- Describe key directories, data flow, and patterns -->");
  lines.push("");

  lines.push("## Rules");
  lines.push("");
  for (const rule of t.rules) {
    lines.push(`- ${rule}`);
  }
  lines.push("");

  lines.push("## Quality Gates");
  lines.push("");
  lines.push("- [ ] All tests passing");
  lines.push("- [ ] Linter clean");
  const tsStacks = new Set(["next", "react", "expo", "node"]);
  if (tsStacks.has(stack)) {
    lines.push("- [ ] No TypeScript errors");
  }
  lines.push("");

  if (exemplar) {
    lines.push(
      `<!-- Based on ${exemplar.name} (health: ${exemplar.healthScore}, pattern: ${pattern}) -->`,
    );
  }

  return lines.join("\n");
}

export function handleInit(cliArgs) {
  const cwd = process.cwd();
  const stackInfo = detectTechStack(cwd);
  const stack = cliArgs.template || stackInfo.stacks[0] || "generic";

  if (cliArgs.template && !TEMPLATE_SECTIONS[cliArgs.template]) {
    console.error(
      `Warning: unknown stack '${cliArgs.template}', using generic template. Available: ${Object.keys(TEMPLATE_SECTIONS).join(", ")}`,
    );
  }

  // Scan repos to find exemplar
  let exemplar = null;
  let pattern = "minimal";
  if (existsSync(CONF)) {
    const initRoots = getScanRoots();
    const initRepoPaths = findGitRepos(initRoots, MAX_DEPTH);
    const configuredForInit = [];
    for (const repoDir of initRepoPaths) {
      const commands = scanMdDir(join(repoDir, ".claude", "commands"));
      const rules = scanMdDir(join(repoDir, ".claude", "rules"));
      let agentsFile = null;
      if (existsSync(join(repoDir, "AGENTS.md"))) agentsFile = join(repoDir, "AGENTS.md");
      else if (existsSync(join(repoDir, "CLAUDE.md"))) agentsFile = join(repoDir, "CLAUDE.md");
      if (!agentsFile && commands.length === 0 && rules.length === 0) continue;
      const sections = agentsFile ? extractSections(agentsFile) : [];
      const ts = detectTechStack(repoDir);
      const fc = freshnessClass(getFreshness(repoDir));
      const health = computeHealthScore({
        hasAgentsFile: !!agentsFile,
        desc: agentsFile ? extractProjectDesc(agentsFile) : [],
        commandCount: commands.length,
        ruleCount: rules.length,
        sectionCount: sections.length,
        freshnessClass: fc,
      });
      configuredForInit.push({
        name: basename(repoDir),
        commands,
        rules,
        sections,
        techStack: ts.stacks,
        healthScore: health.score,
        hasAgentsFile: !!agentsFile,
      });
    }
    exemplar = findExemplar([stack], configuredForInit);
    if (exemplar) pattern = detectConfigPattern(exemplar);
  }

  const content = generateTemplate(stack, exemplar, pattern);
  const claudeMdPath = join(cwd, "CLAUDE.md");

  if (cliArgs.dryRun) {
    console.log(`Would create: ${claudeMdPath}`);
    console.log(`Stack: ${stack}`);
    if (exemplar) console.log(`Exemplar: ${exemplar.name} (${pattern})`);
    console.log("---");
    console.log(content);
    process.exit(0);
  }

  if (existsSync(claudeMdPath)) {
    console.error(
      `Error: ${claudeMdPath} already exists. Remove it first or use --dry-run to preview.`,
    );
    process.exit(1);
  }

  writeFileSync(claudeMdPath, content);
  console.log(
    `Created ${claudeMdPath} (stack: ${stack}${exemplar ? `, based on ${exemplar.name}` : ""})`,
  );
  process.exit(0);
}
