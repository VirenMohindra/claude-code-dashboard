import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDashboardData } from "../src/pipeline.mjs";

describe("buildDashboardData()", () => {
  it("returns valid dashboard data from minimal raw inputs", () => {
    const raw = {
      repos: [],
      globalCmds: [],
      globalRules: [],
      globalSkills: [],
      userMcpServers: [],
      projectMcpByRepo: {},
      disabledMcpByRepo: {},
      historicalMcpMap: new Map(),
      sessionMetaFiles: [],
      ccusageData: null,
      statsCache: {},
      insightsReportHtml: null,
      chains: [],
      scanScope: "test",
    };
    const data = buildDashboardData(raw);
    assert.ok(data.configured);
    assert.ok(data.unconfigured);
    assert.ok(data.insights);
    assert.equal(data.totalRepos, 0);
    assert.equal(data.coveragePct, 0);
  });
});
