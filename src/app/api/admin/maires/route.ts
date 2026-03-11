import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { withAdminAuth } from "@/lib/api/with-admin-auth";
import { getMaires } from "@/lib/data/municipales";

export const GET = withAdminAuth(async (request: NextRequest) => {
  const url = new URL(request.url);
  const search = url.searchParams.get("search") || undefined;
  const dept = url.searchParams.get("dept") || undefined;
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const fiche = url.searchParams.get("fiche");
  const fichePoligraph = fiche === "true" ? true : fiche === "false" ? false : undefined;

  const result = await getMaires(search, dept, undefined, undefined, page, fichePoligraph);
  return NextResponse.json(result);
});
