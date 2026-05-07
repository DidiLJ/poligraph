import { ImageResponse } from "next/og";
import { OgLayout, OG_SIZE, OWL_DATA_URI } from "@/lib/og-utils";
import { getWeeklyRecap, parseISOWeekString, getISOWeekNumber } from "@/lib/data/recap";

export const alt = "Le Recap parlementaire de la semaine";
export const size = OG_SIZE;
export const contentType = "image/png";

interface Props {
  params: Promise<{ week: string }>;
}

export default async function Image({ params }: Props) {
  const { week } = await params;
  const weekStart = parseISOWeekString(week);
  if (!weekStart) {
    return new ImageResponse(
      <OgLayout>
        <div
          style={{
            display: "flex",
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            fontSize: 48,
            color: "white",
          }}
        >
          Le Recap Poligraph
        </div>
      </OgLayout>,
      { ...size }
    );
  }

  const weekNum = getISOWeekNumber(weekStart);
  const data = await getWeeklyRecap(weekStart);

  return new ImageResponse(
    <OgLayout>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          flex: 1,
          padding: 60,
        }}
      >
        <img src={OWL_DATA_URI} width={80} height={80} style={{ marginBottom: 24 }} />
        <div
          style={{
            display: "flex",
            fontSize: 56,
            fontWeight: 700,
            color: "white",
            textAlign: "center",
            marginBottom: 16,
          }}
        >
          Le Recap parlementaire
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 36,
            color: "#93c5fd",
            marginBottom: 32,
          }}
        >
          Semaine {weekNum}
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            gap: 48,
            fontSize: 28,
            color: "white",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", fontSize: 56, fontWeight: 700 }}>{data.votes.total}</div>
            <div style={{ display: "flex", fontSize: 20, color: "#93c5fd" }}>scrutins</div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", fontSize: 56, fontWeight: 700 }}>
              {data.affairs.total}
            </div>
            <div style={{ display: "flex", fontSize: 20, color: "#93c5fd" }}>affaires</div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", fontSize: 56, fontWeight: 700 }}>
              {data.press.articleCount}
            </div>
            <div style={{ display: "flex", fontSize: 20, color: "#93c5fd" }}>articles</div>
          </div>
        </div>
      </div>
    </OgLayout>,
    { ...size }
  );
}
