import type { Meta, StoryObj } from "@storybook/react";
import { SectionErrorPage } from "./SectionErrorPage";

const meta: Meta<typeof SectionErrorPage> = {
  title: "UI/SectionErrorPage",
  component: SectionErrorPage,
  parameters: {
    layout: "fullscreen",
  },
  args: {
    onReset: () => {},
  },
};

export default meta;

type Story = StoryObj<typeof SectionErrorPage>;

export const Politiciens: Story = {
  args: {
    title: "Oups, la section Politiciens est indisponible",
    backHref: "/politiques",
    backLabel: "Retour aux politiciens",
    description: "Réessayez dans un instant ou revenez à la liste des politiciens.",
  },
};

export const Affaires: Story = {
  args: {
    title: "Oups, la section Affaires est indisponible",
    backHref: "/affaires",
    backLabel: "Retour aux affaires",
    description: "Réessayez dans un instant ou revenez à la liste des affaires.",
  },
};

export const Assemblee: Story = {
  args: {
    title: "Oups, la section Assemblée nationale est indisponible",
    backHref: "/assemblee",
    backLabel: "Retour à l'Assemblée",
    description: "Réessayez dans un instant ou revenez à la page de l'Assemblée nationale.",
  },
};

export const Votes: Story = {
  args: {
    title: "Oups, la section Votes est indisponible",
    backHref: "/votes",
    backLabel: "Retour aux votes",
    description: "Réessayez dans un instant ou revenez à la liste des votes.",
  },
};

export const Partis: Story = {
  args: {
    title: "Oups, la section Partis est indisponible",
    backHref: "/partis",
    backLabel: "Retour aux partis",
    description: "Réessayez dans un instant ou revenez à la liste des partis.",
  },
};

export const Globale: Story = {
  args: {
    title: "Le site est momentanément indisponible",
    backHref: "/",
    backLabel: "Retour à l'accueil",
    description: "Réessayez dans un instant ou revenez à l'accueil.",
  },
};

export const AdminAvecDigest: Story = {
  args: {
    title: "Cette page d'administration est momentanément indisponible",
    backHref: "/admin",
    backLabel: "Retour au tableau de bord",
    variant: "admin",
    errorDigest: "1a2b3c4d5e6f",
    description:
      "Réessayez ou revenez au tableau de bord. Si le problème persiste, utilisez le code ci-dessous pour le diagnostic.",
  },
};

export const AdminSansDigest: Story = {
  args: {
    title: "Cette page d'administration est momentanément indisponible",
    backHref: "/admin",
    backLabel: "Retour au tableau de bord",
    variant: "admin",
    description: "Réessayez ou revenez au tableau de bord.",
  },
};
