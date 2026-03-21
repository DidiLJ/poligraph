import "dotenv/config";
import { syncResultatsCsv } from "../src/services/sync/resultats-csv";

const dryRun = process.argv.includes("--dry-run");
const deptArg = process.argv.find((a) => a.startsWith("--dept="));
const dept = deptArg ? deptArg.split("=")[1] : undefined;

syncResultatsCsv({ dryRun, dept });
