import { Municipales2020Nav } from "@/components/elections/municipales/Municipales2020Nav";

export default function Municipales2020Layout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <Municipales2020Nav />
      <div className="pt-8">{children}</div>
    </div>
  );
}
