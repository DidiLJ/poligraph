import "dotenv/config";
import { syncMunicipales2014 } from "../src/services/sync/municipales-2014";

const statsOnly = process.argv.includes("--stats");
syncMunicipales2014(statsOnly);
