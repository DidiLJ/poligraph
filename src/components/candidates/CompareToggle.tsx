import Link from "next/link";

interface Props {
  currentSlug: string;
  currentName: string;
  electionSlug: string;
}

export function CompareToggle({ currentSlug, currentName, electionSlug }: Props) {
  return (
    <div className="sticky bottom-4 z-10 flex justify-center">
      <Link
        href={`/admin/candidats/compare?from=${currentSlug}&election=${electionSlug}`}
        className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white shadow-lg hover:bg-primary/90"
      >
        Comparer {currentName} à un autre candidat
      </Link>
    </div>
  );
}
