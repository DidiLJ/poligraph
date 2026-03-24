import { Municipales2014Nav } from "@/components/elections/municipales/Municipales2014Nav";

export default function Municipales2014Layout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <Municipales2014Nav />
      <div className="pt-8">{children}</div>
    </div>
  );
}
