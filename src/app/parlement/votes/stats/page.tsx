import { permanentRedirect } from "next/navigation";
import { statsHref } from "@/config/routes";

interface PageProps {
  searchParams: Promise<{
    chamber?: string;
  }>;
}

export default async function VoteStatsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  // Only the participation tab reads `chamber`, so that is where the old vote
  // stats land. Anything other than a real chamber is dropped rather than
  // reflected into the redirect target.
  const chamber =
    params.chamber === "AN" || params.chamber === "SENAT" ? params.chamber : undefined;
  const url = statsHref("participation", { chamber });
  // 308, not 307: the vote stats moved to /statistiques for good. A temporary
  // redirect tells Google to keep the old URL in the index, which is how these
  // land in the "Page avec redirection" bucket instead of consolidating.
  permanentRedirect(url);
}
