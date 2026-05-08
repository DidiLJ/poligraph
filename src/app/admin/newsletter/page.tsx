import { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Newsletter — Admin" };
export const dynamic = "force-dynamic";

const SUBSCRIBER_STATUS_LABELS: Record<string, string> = {
  PENDING_CONFIRMATION: "En attente",
  CONFIRMED: "Confirmé",
  UNSUBSCRIBED: "Désabonné",
  BOUNCED: "Bounce",
};

const SUBSCRIBER_SOURCE_LABELS: Record<string, string> = {
  BOUSSOLE: "Boussole",
  FOOTER: "Footer",
  RECAP_PAGE: "Page Recap",
  ARTICLE_CTA: "CTA article",
  IMPORT: "Import",
};

export default async function AdminNewsletterPage() {
  const [byStatusRaw, bySourceRaw, editionsRaw, stuckSubscribers] = await Promise.all([
    db.subscriber.groupBy({ by: ["status"], _count: { _all: true } }),
    db.subscriber.groupBy({ by: ["source"], _count: { _all: true } }),
    db.newsletterEdition.findMany({
      orderBy: { weekStart: "desc" },
      take: 12,
      include: {
        stats: true,
        politician: { select: { fullName: true, slug: true } },
      },
    }),
    db.subscriber.findMany({
      where: { status: "CONFIRMED", consecutiveMisses: { gte: 8 } },
      select: { id: true, email: true, consecutiveMisses: true, lastOpenedAt: true },
      take: 50,
    }),
  ]);

  const byStatus = byStatusRaw.map((s) => ({ key: s.status, count: s._count._all }));
  const bySource = bySourceRaw.map((s) => ({ key: s.source, count: s._count._all }));
  const totalSubscribers = byStatus.reduce((sum, s) => sum + s.count, 0);

  return (
    <main className="container py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Newsletter</h1>
        <p className="text-sm text-muted-foreground">
          {totalSubscribers} abonnés au total. Les statistiques d&apos;envoi sont synchronisées
          chaque lundi à 12h UTC.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Par statut</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {byStatus.map((s) => (
                <li key={s.key} className="flex justify-between">
                  <span>{SUBSCRIBER_STATUS_LABELS[s.key] ?? s.key}</span>
                  <span className="font-mono">{s.count}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Par source</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {bySource.map((s) => (
                <li key={s.key} className="flex justify-between">
                  <span>{SUBSCRIBER_SOURCE_LABELS[s.key] ?? s.key}</span>
                  <span className="font-mono">{s.count}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>12 dernières éditions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2 pr-4">Semaine</th>
                  <th className="py-2 pr-4">Politicien</th>
                  <th className="py-2 pr-4 text-right">Envoyés</th>
                  <th className="py-2 pr-4 text-right">Ouvertures</th>
                  <th className="py-2 pr-4 text-right">Clics</th>
                  <th className="py-2 text-right">Désabonnements</th>
                </tr>
              </thead>
              <tbody>
                {editionsRaw.map((e) => (
                  <tr key={e.id} className="border-b">
                    <td className="py-2 pr-4">{e.weekStart.toISOString().slice(0, 10)}</td>
                    <td className="py-2 pr-4">
                      {e.politician ? (
                        <Link
                          href={`/politiques/${e.politician.slug}`}
                          prefetch={false}
                          className="hover:text-primary"
                        >
                          {e.politician.fullName}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-right font-mono">{e.recipientCount}</td>
                    <td className="py-2 pr-4 text-right font-mono">{e.stats?.opened ?? "—"}</td>
                    <td className="py-2 pr-4 text-right font-mono">{e.stats?.clicked ?? "—"}</td>
                    <td className="py-2 text-right font-mono">{e.stats?.unsubscribed ?? "—"}</td>
                  </tr>
                ))}
                {editionsRaw.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-4 text-center text-muted-foreground">
                      Aucune édition envoyée pour l&apos;instant.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {stuckSubscribers.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Abonnés à risque (8+ ouvertures manquées)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-muted-foreground">
              Suppression automatique à 12 ouvertures manquées consécutives.
            </p>
            <ul className="space-y-1 font-mono text-xs">
              {stuckSubscribers.map((s) => (
                <li key={s.id} className="flex justify-between">
                  <span>{s.email}</span>
                  <span>{s.consecutiveMisses} miss</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}
