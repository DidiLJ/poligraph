import { z } from "zod/v4";

export const promoteMayorSchema = z.object({
  wikidataId: z
    .string()
    .regex(/^Q\d+$/, "Format Q-ID invalide")
    .optional(),
});
