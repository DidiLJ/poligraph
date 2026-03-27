import { ImageResponse } from "next/og";
import { OgLayout, OgCategoryLabel, OG_SIZE } from "@/lib/og-utils";

export const alt = "Programmes des partis sur Poligraph";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    <OgLayout>
      <OgCategoryLabel emoji="📋" label="Programmes" />

      <div
        style={{
          display: "flex",
          flex: 1,
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <div style={{ fontSize: 48, fontWeight: 700, color: "white", marginBottom: 16 }}>
          Programmes des partis
        </div>
        <div style={{ fontSize: 28, color: "#94a3b8", lineHeight: 1.4 }}>
          Comparez les positions des partis politiques sur les grands enjeux
        </div>
      </div>
    </OgLayout>,
    { ...OG_SIZE }
  );
}
