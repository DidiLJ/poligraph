import { z } from "zod/v4";

const sourceEnum = z.enum(["BOUSSOLE", "FOOTER", "RECAP_PAGE", "ARTICLE_CTA", "IMPORT"]);

const positionEnum = z.enum(["POUR", "CONTRE", "ABSTENTION"]);

const boussoleProfileSchema = z.object({
  answers: z
    .array(
      z.object({
        scrutinId: z.string().min(1),
        position: positionEnum,
      })
    )
    .max(50),
  topPartyMatches: z
    .array(
      z.object({
        partyId: z.string().min(1),
        score: z.number().min(0).max(100),
      })
    )
    .max(20),
  profileHash: z.string().min(1).max(128),
  computedAt: z.iso.datetime(),
  boussoleVersion: z.string().min(1).max(20),
});

export const subscribeSchema = z.object({
  email: z.email("Adresse email invalide"),
  source: sourceEnum,
  postalCode: z
    .string()
    .regex(/^\d{5}$/)
    .optional(),
  deputySlug: z.string().min(1).max(120).optional(),
  boussoleProfile: boussoleProfileSchema.optional(),
});

export const tokenQuerySchema = z.object({
  token: z.string().min(20).max(128),
});

export const forgetSchema = z.object({
  email: z.email(),
  unsubscribeToken: z.string().min(20).max(128),
});

export type BoussoleProfilePayload = z.infer<typeof boussoleProfileSchema>;
