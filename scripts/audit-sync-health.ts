import "dotenv/config";
import { PIPELINE_REGISTRY, type PipelineHealth } from "../src/config/pipeline-registry";
import { getPipelineHealth } from "../src/lib/data/pipelines";
import { db } from "../src/lib/db";

async function main() {
  const all: PipelineHealth[] = [];
  for (const config of PIPELINE_REGISTRY) {
    const health = await getPipelineHealth(config.id);
    if (health) all.push(health);
  }

  const summary = {
    total: all.length,
    healthy: all.filter((p) => p.status === "healthy").length,
    warning: all.filter((p) => p.status === "warning").length,
    critical: all.filter((p) => p.status === "critical").length,
    unknown: all.filter((p) => p.status === "unknown").length,
    disabled: all.filter((p) => p.status === "disabled").length,
  };

  console.log(`# Audit pipelines : ${new Date().toISOString().slice(0, 10)}\n`);
  console.log(
    `Healthy: ${summary.healthy} / Warning: ${summary.warning} / Critical: ${summary.critical} / Unknown: ${summary.unknown} / Disabled: ${summary.disabled}\n`
  );

  const critical = all.filter((p) => p.status === "critical" || p.status === "unknown");
  if (critical.length > 0) {
    console.log("\n## Pipelines critiques ou inconnus\n");
    console.table(
      critical.map((p) => ({
        id: p.pipeline.id,
        name: p.pipeline.name,
        status: p.status,
        lastRunAt: p.lastRunAt?.toISOString().slice(0, 16) ?? "(jamais)",
        hoursSinceLastRun: p.hoursSinceLastRun?.toFixed(1) ?? "-",
      }))
    );
  }

  await db.$disconnect();
  if (critical.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
