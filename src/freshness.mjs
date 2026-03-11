import { ONE_DAY, TWO_DAYS, THIRTY_DAYS, NINETY_DAYS, ONE_YEAR } from "./constants.mjs";
import { gitCmd } from "./helpers.mjs";

export function getFreshness(repoDir) {
  const ts = gitCmd(
    repoDir,
    "log",
    "-1",
    "--format=%ct",
    "--",
    "CLAUDE.md",
    "AGENTS.md",
    ".claude/",
  );
  const parsed = Number(ts);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function relativeTime(ts) {
  if (!ts) return "unknown";
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < ONE_DAY) return "today";
  if (diff < TWO_DAYS) return "yesterday";
  if (diff < THIRTY_DAYS) return `${Math.floor(diff / ONE_DAY)}d ago`;
  if (diff < ONE_YEAR) return `${Math.floor(diff / THIRTY_DAYS)}mo ago`;
  return `${Math.floor(diff / ONE_YEAR)}y ago`;
}

export function freshnessClass(ts) {
  if (!ts) return "stale";
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < THIRTY_DAYS) return "fresh";
  if (diff < NINETY_DAYS) return "aging";
  return "stale";
}
