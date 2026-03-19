import type { Meta, StoryObj } from "@storybook/react";
import { ShareButtons } from "./ShareButtons";

const meta: Meta<typeof ShareButtons> = {
  title: "UI/ShareButtons",
  component: ShareButtons,
  argTypes: {
    url: { control: "text" },
    title: { control: "text" },
    description: { control: "text" },
  },
};

export default meta;
type Story = StoryObj<typeof ShareButtons>;

export const Politicien: Story = {
  args: {
    url: "https://poligraph.fr/politiques/marine-le-pen",
    title: "Marine Le Pen",
    description: "Députée (RN)",
  },
};

export const Affaire: Story = {
  args: {
    url: "https://poligraph.fr/affaires/francois-fillon-condamnation-definitive-de-francois-fillon-dans-l-affaire-des-emplois-fictifs",
    title: "Condamnation définitive dans l'affaire des emplois fictifs — François Fillon",
    description: "Affaire en cours documentée à partir de sources publiques",
  },
};

export const Vote: Story = {
  args: {
    url: "https://poligraph.fr/votes/2026-02-27-l-amendement-n-217-de-mme-lebon-a-l-article-2-du-projet-de-loi-relatif-a-la-lutte-contre-les-fraudes",
    title:
      "L'amendement n°217 de Mme Lebon à l'article 2 du projet de loi relatif à la lutte contre les fraudes",
    description: "Scrutin adopté : 312 pour, 245 contre et 10 abstentions.",
  },
};

export const FactCheck: Story = {
  args: {
    url: "https://poligraph.fr/factchecks/2025-03-18-retraites-le-regime-de-la-fonction-publique-est-il-en-deficit",
    title: "Retraites : le régime de la fonction publique est-il en déficit ?",
    description: "Faux — « Le régime des fonctionnaires est en excédent »",
  },
};

export const SansDescription: Story = {
  args: {
    url: "https://poligraph.fr/politiques/marine-le-pen",
    title: "Marine Le Pen",
  },
};
