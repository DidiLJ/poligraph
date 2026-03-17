import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./button";

const meta: Meta<typeof Button> = {
  title: "UI/Button",
  component: Button,
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "destructive", "outline", "secondary", "ghost", "link"],
    },
    size: {
      control: "select",
      options: ["default", "sm", "lg", "icon", "icon-sm", "icon-lg"],
    },
    disabled: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Default: Story = {
  args: { children: "Voir le profil" },
};

export const Destructive: Story = {
  args: { children: "Supprimer", variant: "destructive" },
};

export const Outline: Story = {
  args: { children: "Filtrer", variant: "outline" },
};

export const Secondary: Story = {
  args: { children: "Exporter", variant: "secondary" },
};

export const Ghost: Story = {
  args: { children: "Annuler", variant: "ghost" },
};

export const Link: Story = {
  args: { children: "En savoir plus", variant: "link" },
};

export const Small: Story = {
  args: { children: "Petit", size: "sm" },
};

export const Large: Story = {
  args: { children: "Grand", size: "lg" },
};

export const Disabled: Story = {
  args: { children: "Indisponible", disabled: true },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <Button>Par défaut</Button>
      <Button variant="destructive">Destructif</Button>
      <Button variant="outline">Contour</Button>
      <Button variant="secondary">Secondaire</Button>
      <Button variant="ghost">Fantôme</Button>
      <Button variant="link">Lien</Button>
    </div>
  ),
};
