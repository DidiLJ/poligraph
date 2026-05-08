import { CONFIRM_DOI_HTML } from "./templates/confirm-doi-compiled";

export interface ConfirmDoiContext {
  confirmUrl: string;
}

export function renderConfirmDoiHtml(ctx: ConfirmDoiContext): string {
  return CONFIRM_DOI_HTML.replace(/\{\{confirmUrl\}\}/g, ctx.confirmUrl);
}

export function renderConfirmDoiText(ctx: ConfirmDoiContext): string {
  return [
    "Confirme ton inscription à Poligraph",
    "",
    "Tu viens de t'inscrire à La Semaine Poligraph.",
    "Pour activer ton inscription, ouvre ce lien :",
    "",
    ctx.confirmUrl,
    "",
    "Si tu n'es pas à l'origine de cette inscription, ignore cet email.",
    "",
    "Poligraph · Observatoire citoyen de la vie politique",
  ].join("\n");
}
