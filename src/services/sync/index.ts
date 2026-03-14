export { syncDeputes, getSyncStats, fetchDeputesCSV } from "./deputes";
export { syncSenateurs, getSenatStats } from "./senateurs";
export { syncGouvernement, getGouvernementStats } from "./gouvernement";
export { syncHATVP, getHATVPStats } from "./hatvp";
export { syncPhotos, getPhotoStats } from "./photos";
export { syncEuroparl, getEuroparlStats } from "./europarl";
export { syncRNEMaires, getRNEStats } from "./rne";
export { syncCandidaturesMunicipales, getCandidaturesStats } from "./candidatures";
export type {
  DeputeCSV,
  SyncResult,
  SenateurAPI,
  SenatSyncResult,
  GouvernementCSV,
  GouvernementSyncResult,
  HATVPCSV,
  HATVPSyncResult,
  EuroparlDepute,
  EuroparlSyncResult,
  MaireRNECSV,
  RNESyncResult,
  CandidatureMunicipaleCSV,
  CandidaturesSyncResult,
} from "./types";
export { syncScrutinsAN, getScrutinsANStats } from "./scrutins-an";
export type { ScrutinsANSyncStats } from "./scrutins-an";
export { syncScrutinsSenat, getScrutinsSenatStats, AVAILABLE_SESSIONS } from "./scrutins-senat";
export type { ScrutinsSenatSyncStats } from "./scrutins-senat";
export { syncFactchecks } from "./factchecks";
export type { FactcheckSyncOptions, FactcheckSyncStats } from "./factchecks";
export { syncPress } from "./press";
export type { PressSyncOptions, PressSyncStats } from "./press";
export { recalculateProminence } from "./prominence";
export type { ProminenceOptions, ProminenceStats } from "./prominence";
export { assignPublicationStatus } from "./publication-status";
export type { PublicationStatusOptions, PublicationStatusStats } from "./publication-status";
export { reconcileAffairs } from "./reconcile-affairs";
export type { ReconcileAffairsOptions, ReconcileAffairsStats } from "./reconcile-affairs";
export { classifyThemes } from "./classify-themes";
export type { ClassifyThemesOptions, ClassifyThemesStats } from "./classify-themes";
