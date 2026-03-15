import "dotenv/config";
import { syncResultatsT1 } from "../src/services/sync/resultats-t1";

const dryRun = process.argv.includes("--dry-run");
const deptArg = process.argv.find((a) => a.startsWith("--dept="));
const dept = deptArg ? deptArg.split("=")[1] : undefined;

syncResultatsT1({ dryRun, dept });
