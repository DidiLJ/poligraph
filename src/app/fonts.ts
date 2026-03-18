import { Atkinson_Hyperlegible, Outfit } from "next/font/google";

export const outfit = Outfit({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["700", "800"],
  display: "swap",
});

export const atkinson = Atkinson_Hyperlegible({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});
