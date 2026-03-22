"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Search, ChevronLeft, ChevronRight, Loader2, MapPin } from "lucide-react";

interface MaireItem {
  id: string;
  fullName: string;
  slug: string;
  gender: string | null;
  commune: { name: string; departmentCode: string; population: number | null } | null;
  party: { shortName: string; color: string | null } | null;
  functionStart: string | null;
}

interface ApiResponse {
  maires: MaireItem[];
  total: number;
  page: number;
  totalPages: number;
}

export default function AdminMairesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const searchQuery = searchParams.get("search") || "";
  const deptFilter = searchParams.get("dept") || "";
  const currentPage = parseInt(searchParams.get("page") || "1", 10);

  const updateParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value) params.set(key, value);
        else params.delete(key);
      }
      if (!("page" in updates)) params.set("page", "1");
      router.push(`/admin/maires?${params.toString()}`);
    },
    [router, searchParams]
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (searchQuery) params.set("search", searchQuery);
    if (deptFilter) params.set("dept", deptFilter);
    params.set("page", String(currentPage));

    try {
      const res = await fetch(`/api/admin/maires?${params.toString()}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [searchQuery, deptFilter, currentPage]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const maires = data?.maires ?? [];
  const pagination = data
    ? { total: data.total, page: data.page, totalPages: data.totalPages }
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display font-bold tracking-tight">Maires</h1>
        <Badge variant="outline" className="text-sm">
          {pagination?.total ?? 0} maires
        </Badge>
      </div>

      {/* Search + filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] max-w-sm flex-1">
          <Search
            className="absolute left-3 top-1/2 w-4 h-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="search"
            placeholder="Rechercher un maire..."
            defaultValue={searchQuery}
            aria-label="Rechercher un maire"
            onChange={(e) => {
              const val = e.target.value;
              if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
              searchTimerRef.current = setTimeout(() => {
                updateParams({ search: val });
              }, 300);
            }}
            className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
          />
        </div>

        <input
          type="text"
          placeholder="Dept. (ex: 31)"
          defaultValue={deptFilter}
          aria-label="Filtrer par departement"
          onChange={(e) => {
            const val = e.target.value;
            if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
            searchTimerRef.current = setTimeout(() => {
              updateParams({ dept: val });
            }, 300);
          }}
          className="w-20 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
        />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 text-center">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : maires.length === 0 ? (
            <div className="p-12 text-center">
              <MapPin
                className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40"
                aria-hidden="true"
              />
              <p className="text-sm text-muted-foreground">Aucun maire trouve</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="px-4 py-3 font-medium text-muted-foreground">Maire</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">Commune</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">Population</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">Parti</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {maires.map((maire) => (
                    <tr key={maire.id} className="transition-colors hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">
                        <Link
                          href={`/admin/politiques/${maire.slug}`}
                          className="hover:underline text-primary"
                        >
                          {maire.fullName}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {maire.commune?.name}
                        <span className="ml-1 text-xs opacity-60">
                          ({maire.commune?.departmentCode})
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {maire.commune?.population?.toLocaleString("fr-FR") ?? "-"}
                      </td>
                      <td className="px-4 py-3">
                        {maire.party ? (
                          <Badge
                            variant="outline"
                            style={{
                              borderColor: maire.party.color ? `${maire.party.color}40` : undefined,
                            }}
                          >
                            {maire.party.shortName}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {pagination.total} resultat{pagination.total > 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => updateParams({ page: String(currentPage - 1) })}
              disabled={currentPage <= 1}
              className="rounded-md p-2 hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
              aria-label="Page precedente"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-muted-foreground">
              {currentPage} / {pagination.totalPages}
            </span>
            <button
              onClick={() => updateParams({ page: String(currentPage + 1) })}
              disabled={currentPage >= pagination.totalPages}
              className="rounded-md p-2 hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
              aria-label="Page suivante"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
