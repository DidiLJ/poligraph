import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { queryQueue, type QueueFilters as QueueFiltersType } from "./_data/queue-query";
import { QueueFilters } from "./_components/QueueFilters";
import { QueueTable } from "./_components/QueueTable";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function asArray(value: string | string[] | undefined): string[] | undefined {
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value : [value];
}

function asString(value: string | string[] | undefined): string | undefined {
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function asNumber(value: string | string[] | undefined): number | undefined {
  const s = asString(value);
  if (s === undefined || s === "") return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

const VALID_CONFIDENCE = ["HIGH", "MEDIUM", "LOW"] as const;
const VALID_SEVERITY = ["blocker", "warn", "clean"] as const;
const VALID_SORT = ["votingDate", "confidence", "generatedAt"] as const;

function parseFilters(params: Record<string, string | string[] | undefined>): QueueFiltersType {
  const confidence = asArray(params.confidence)?.filter(
    (c): c is (typeof VALID_CONFIDENCE)[number] =>
      (VALID_CONFIDENCE as readonly string[]).includes(c)
  );

  const severityRaw = asString(params.severity);
  const severity = (VALID_SEVERITY as readonly string[]).includes(severityRaw ?? "")
    ? (severityRaw as QueueFiltersType["severity"])
    : undefined;

  const sortRaw = asString(params.sort);
  const sort = (VALID_SORT as readonly string[]).includes(sortRaw ?? "")
    ? (sortRaw as QueueFiltersType["sort"])
    : undefined;

  return {
    status: asArray(params.status),
    confidence,
    generationSource: asArray(params.generationSource),
    warningCode: asString(params.warningCode),
    severity,
    substanceDepth: asArray(params.substanceDepth),
    titleLengthMin: asNumber(params.titleLengthMin),
    titleLengthMax: asNumber(params.titleLengthMax),
    nullTitle: asString(params.nullTitle) === "true",
    subAmendmentOnly: asString(params.subAmendmentOnly) === "true",
    q: asString(params.q),
    sort,
    sample: asNumber(params.sample),
    skip: asNumber(params.skip),
  };
}

export default async function AdminPolicyTitlesPage({ searchParams }: PageProps) {
  if (!(await isAuthenticated())) {
    redirect("/admin/login");
  }

  const params = await searchParams;
  const filters = parseFilters(params);
  const { rows, total } = await queryQueue(filters);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold tracking-tight">Titres de scrutins</h1>
        <p className="text-sm text-muted-foreground mt-1">
          File de modération des titres générés — {total} titre{total !== 1 ? "s" : ""}
        </p>
      </div>

      <QueueFilters />

      <QueueTable rows={rows} total={total} />
    </div>
  );
}
