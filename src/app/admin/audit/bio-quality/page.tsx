import { getBioQualityBreakdown } from "@/lib/data/bio-quality";

export const dynamic = "force-dynamic";

export default async function BioQualityAuditPage() {
  const data = await getBioQualityBreakdown();
  const ratio = (n: number) =>
    data.totalPoliticians === 0 ? "0.0" : ((n / data.totalPoliticians) * 100).toFixed(1);
  const getBucket = (label: string) =>
    data.buckets.find((b) => b.label === label) ?? {
      publishedCount: 0,
      draftCount: 0,
      currentMandateCount: 0,
    };
  const vide = getBucket("Vide");
  const stub = getBucket("Stub (<200 car.)");
  const redigee = getBucket("Rédigée (≥800 car.)");

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-bold">Audit qualité des biographies</h1>
        <p className="text-muted-foreground">
          {data.totalPoliticians.toLocaleString("fr-FR")} politiciens en base,{" "}
          {data.totalWithCurrentMandate.toLocaleString("fr-FR")} avec mandat actif.
        </p>
      </header>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2">Bucket</th>
            <th className="py-2 text-right">Publiées</th>
            <th className="py-2 text-right">Drafts</th>
            <th className="py-2 text-right">Avec mandat actif</th>
            <th className="py-2 text-right">% total</th>
          </tr>
        </thead>
        <tbody>
          {data.buckets.map((b) => {
            const total = b.publishedCount + b.draftCount;
            return (
              <tr key={b.label} className="border-b">
                <td className="py-2 font-medium">{b.label}</td>
                <td className="py-2 text-right">{b.publishedCount.toLocaleString("fr-FR")}</td>
                <td className="py-2 text-right">{b.draftCount.toLocaleString("fr-FR")}</td>
                <td className="py-2 text-right">{b.currentMandateCount.toLocaleString("fr-FR")}</td>
                <td className="py-2 text-right">{ratio(total)}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <section className="rounded-md border bg-amber-50 p-4 text-sm text-amber-900">
        <h2 className="font-semibold">Plan de remédiation suggéré</h2>
        <ul className="mt-2 list-disc pl-5 space-y-1">
          <li>
            Cible prioritaire : politiciens « Vide » ou « Stub » avec mandat actif, statut DRAFT (
            {vide.draftCount + stub.draftCount} fiches). Génération via
            <code className="mx-1 px-1 rounded bg-amber-100">npm run sync:enrich</code>
            puis revue éditoriale.
          </li>
          <li>
            Couverture rédigée actuelle : {ratio(redigee.publishedCount + redigee.draftCount)}% des
            fiches.
          </li>
        </ul>
      </section>
    </div>
  );
}
