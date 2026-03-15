import { ImageResponse } from "next/og";
import { db } from "@/lib/db";
import { OgLayout, OgCategoryLabel, OG_SIZE } from "@/lib/og-utils";
import { getDepartmentShapeWithDot } from "@/lib/og-department-shape";

export const alt = "Municipales 2026 sur Poligraph";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ inseeCode: string }> }) {
  const { inseeCode } = await params;

  const commune = await db.commune.findUnique({
    where: { id: inseeCode },
    select: {
      name: true,
      departmentCode: true,
      departmentName: true,
      population: true,
      latitude: true,
      longitude: true,
    },
  });

  if (!commune) {
    return new ImageResponse(
      <OgLayout>
        <div
          style={{
            display: "flex",
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontSize: 32,
          }}
        >
          Commune non trouvée
        </div>
      </OgLayout>,
      { ...OG_SIZE }
    );
  }

  const election = await db.election.findUnique({
    where: { slug: "municipales-2026" },
    select: { id: true },
  });

  let listCount = 0;
  let candidateCount = 0;
  if (election) {
    const stats = await db.candidacy.aggregate({
      where: { electionId: election.id, communeId: inseeCode },
      _count: true,
    });
    candidateCount = stats._count;

    const lists = await db.candidacy.groupBy({
      by: ["listName"],
      where: { electionId: election.id, communeId: inseeCode },
    });
    listCount = lists.length;
  }

  const populationFormatted = commune.population
    ? commune.population.toLocaleString("fr-FR")
    : null;

  const shapeUri = getDepartmentShapeWithDot(
    commune.departmentCode,
    commune.latitude,
    commune.longitude,
    { width: 280, height: 280 }
  );

  const nameFontSize = commune.name.length > 25 ? 34 : commune.name.length > 18 ? 38 : 42;

  return new ImageResponse(
    <OgLayout>
      <div style={{ display: "flex", flex: 1 }}>
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <OgCategoryLabel emoji="🏛️" label="Municipales 2026" />

          <div
            style={{
              fontSize: nameFontSize,
              fontWeight: 700,
              color: "white",
              marginBottom: 12,
              lineHeight: 1.2,
            }}
          >
            {commune.name}
          </div>

          <div style={{ fontSize: 22, color: "#94a3b8", marginBottom: 28 }}>
            {`${commune.departmentName} (${commune.departmentCode})`}
          </div>

          {(listCount > 0 || candidateCount > 0) && (
            <div
              style={{
                display: "flex",
                gap: 8,
                fontSize: 22,
                color: "#94a3b8",
                marginBottom: 12,
              }}
            >
              <span>📋</span>
              <span>
                {`${listCount} liste${listCount > 1 ? "s" : ""} · ${candidateCount} candidat${candidateCount > 1 ? "s" : ""}`}
              </span>
            </div>
          )}

          {populationFormatted && (
            <div
              style={{
                display: "flex",
                gap: 8,
                fontSize: 22,
                color: "#94a3b8",
              }}
            >
              <span>👥</span>
              <span>{populationFormatted} habitants</span>
            </div>
          )}
        </div>

        {shapeUri && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 280,
              flexShrink: 0,
            }}
          >
            <img src={shapeUri} width={280} height={280} />
          </div>
        )}
      </div>
    </OgLayout>,
    { ...OG_SIZE }
  );
}
