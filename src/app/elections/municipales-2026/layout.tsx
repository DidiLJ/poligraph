import { MunicipalesNav } from "@/components/elections/municipales/MunicipalesNav";

export default function MunicipalesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <MunicipalesNav />
      <div className="pt-8">{children}</div>
    </div>
  );
}
