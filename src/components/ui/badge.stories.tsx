import type { Meta, StoryObj } from "@storybook/react";
import { Badge } from "./badge";

const meta: Meta<typeof Badge> = {
  title: "UI/Badge",
  component: Badge,
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "secondary", "destructive", "outline", "accent"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Badge>;

export const Default: Story = {
  args: { children: "Publié" },
};

export const Secondary: Story = {
  args: { children: "Brouillon", variant: "secondary" },
};

export const Destructive: Story = {
  args: { children: "Condamné", variant: "destructive" },
};

export const Outline: Story = {
  args: { children: "En attente", variant: "outline" },
};

export const Accent: Story = {
  args: { children: "Nouveau", variant: "accent" },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <Badge>Député</Badge>
      <Badge variant="secondary">Sénateur</Badge>
      <Badge variant="destructive">Mis en examen</Badge>
      <Badge variant="outline">Ancien ministre</Badge>
      <Badge variant="accent">Renaissance</Badge>
    </div>
  ),
};
