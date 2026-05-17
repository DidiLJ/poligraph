import { describe, it, expect } from "vitest";
import { parseCriXml } from "@/services/promises/cri-source";

describe("parseCriXml", () => {
  it("returns an empty array on empty input", () => {
    expect(parseCriXml("")).toEqual([]);
  });

  it("returns an empty array on arbitrary XML with no paragraphes", () => {
    expect(parseCriXml("<root><a/></root>")).toEqual([]);
  });

  it("ignores paragraphes without a named speaker", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<compteRendu>
  <contenu>
    <paragraphe>
      <orateurs/>
      <texte>La séance est ouverte.</texte>
    </paragraphe>
  </contenu>
</compteRendu>`;
    expect(parseCriXml(xml)).toEqual([]);
  });

  it("extracts a single intervention with speaker, text, and timestamp", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<compteRendu xmlns="http://schemas.assemblee-nationale.fr/referentiel">
  <contenu>
    <paragraphe id_acteur="PA721908">
      <orateurs>
        <orateur>
          <nom>Mme la présidente</nom>
          <id>721908</id>
          <qualite/>
        </orateur>
      </orateurs>
      <texte stime="926.62">La séance est ouverte.</texte>
    </paragraphe>
  </contenu>
</compteRendu>`;

    const result = parseCriXml(xml);
    expect(result).toHaveLength(1);
    const first = result[0];
    expect(first).toEqual({
      speakerName: "Mme la présidente",
      speakerId: "721908",
      text: "La séance est ouverte.",
      timestamp: "926.62",
    });
  });

  it("extracts multiple interventions across nested points", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<compteRendu>
  <contenu>
    <ouvertureSeance>
      <paragraphe>
        <orateurs>
          <orateur><nom>Mme la présidente</nom><id>721908</id></orateur>
        </orateurs>
        <texte stime="100.0">La séance est ouverte.</texte>
      </paragraphe>
    </ouvertureSeance>
    <point>
      <paragraphe>
        <orateurs>
          <orateur><nom>M. Pascal Lecamp</nom><id>123456</id></orateur>
        </orateurs>
        <texte stime="200.5">Ma question s'adresse au ministre.</texte>
      </paragraphe>
      <paragraphe>
        <orateurs>
          <orateur><nom>M. Laurent Nuñez, ministre de l'intérieur</nom><id>789012</id></orateur>
        </orateurs>
        <texte stime="250.0">Je vous réponds.</texte>
      </paragraphe>
    </point>
  </contenu>
</compteRendu>`;

    const result = parseCriXml(xml);
    expect(result).toHaveLength(3);
    expect(result.map((i) => i.speakerName)).toEqual([
      "Mme la présidente",
      "M. Pascal Lecamp",
      "M. Laurent Nuñez, ministre de l'intérieur",
    ]);
    expect(result[1]?.speakerId).toBe("123456");
  });

  it("flattens mixed-content texte with inline italique tags", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<compteRendu>
  <contenu>
    <paragraphe>
      <orateurs>
        <orateur><nom>Mme la présidente</nom><id>721908</id></orateur>
      </orateurs>
      <texte stime="939.34">À la mémoire de Lucas Voignier, je vous invite à observer une minute de silence.<italique>(Mmes et MM. les députés se lèvent.)</italique></texte>
    </paragraphe>
  </contenu>
</compteRendu>`;

    const result = parseCriXml(xml);
    expect(result).toHaveLength(1);
    expect(result[0]?.text).toContain("Lucas Voignier");
    expect(result[0]?.text).toContain("Mmes et MM. les députés se lèvent.");
  });

  it("returns empty array on malformed XML without throwing", () => {
    expect(parseCriXml("<unclosed>")).toEqual([]);
  });
});
