import { z } from "zod/v4";

export const promoteMaireSchema = z.object({
  wikidataId: z
    .string()
    .regex(/^Q\d+$/, "Format Q-ID invalide")
    .optional(),
});
