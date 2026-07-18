/**
 * Default SEO copy for the bare /affaires listing (no filter/mode). Centralised and
 * pure so the wording is testable and the legally-cautious vocabulary can't silently
 * drift: "mises en cause" and "condamnations" stay distinct, and the presumption of
 * innocence is always stated.
 *
 * The keyword head "Affaires judiciaires des responsables politiques français" is kept
 * verbatim (it already earns the page's impressions); the appended clause and the
 * benefit-led description are what target click-through. Filtered/mode variants build
 * their own title/description in the page and are noindex,follow anyway.
 */

export const AFFAIRES_DEFAULT_TITLE =
  "Affaires judiciaires des responsables politiques français : mises en cause et condamnations";

export const AFFAIRES_DEFAULT_DESCRIPTION =
  "Affaires judiciaires des responsables politiques français, des mises en cause aux condamnations. Filtrez par parti et statut. Sources vérifiées, présomption d'innocence respectée.";
