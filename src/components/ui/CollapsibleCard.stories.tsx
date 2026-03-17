import type { Meta, StoryObj } from "@storybook/react";
import { CollapsibleCard } from "./CollapsibleCard";
import { Badge } from "./badge";

const meta: Meta<typeof CollapsibleCard> = {
  title: "UI/CollapsibleCard",
  component: CollapsibleCard,
  argTypes: {
    defaultOpen: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof CollapsibleCard>;

export const Closed: Story = {
  args: {
    title: "Affaires judiciaires",
    count: 3,
    children: (
      <ul className="space-y-3 text-sm">
        <li className="flex items-center gap-2">
          <Badge variant="destructive">Condamné</Badge>
          Emplois fictifs au Parlement européen
        </li>
        <li className="flex items-center gap-2">
          <Badge variant="outline">En cours</Badge>
          Soupçons de financement libyen
        </li>
        <li className="flex items-center gap-2">
          <Badge variant="secondary">Relaxé</Badge>
          Abus de confiance présumé
        </li>
      </ul>
    ),
  },
};

export const Open: Story = {
  args: {
    title: "Déclarations de patrimoine",
    count: 2,
    defaultOpen: true,
    children: (
      <div className="space-y-2 text-sm">
        <p>Déclaration HATVP du 15 juin 2024 : patrimoine estimé à 1,2 M EUR</p>
        <p>Déclaration HATVP du 3 janvier 2022 : patrimoine estimé à 980 000 EUR</p>
      </div>
    ),
  },
};

export const WithoutCount: Story = {
  args: {
    title: "Parcours politique",
    defaultOpen: true,
    children: (
      <div className="space-y-1 text-sm text-muted-foreground">
        <p>2022 - aujourd{"'"}hui : Député de la 10e circonscription du Nord</p>
        <p>2020 - 2022 : Conseiller municipal de Lille</p>
        <p>2017 - 2022 : Attaché parlementaire</p>
      </div>
    ),
  },
};
