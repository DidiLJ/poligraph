import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { withAdminAuth } from "@/lib/api/with-admin-auth";
import { parsePagination } from "@/lib/api/pagination";
import { getMaires } from "@/lib/data/municipales";

export const GET = withAdminAuth(async (request: NextRequest) => {
  const url = new URL(request.url);
  const search = url.searchParams.get("search") || undefined;
  const dept = url.searchParams.get("dept") || undefined;
  const { page } = parsePagination(url.searchParams);

  const result = await getMaires(search, dept, undefined, undefined, page);
  return NextResponse.json(result);
});
