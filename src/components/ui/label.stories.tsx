import type { Meta, StoryObj } from "@storybook/react";
import { Label } from "./label";
import { Input } from "./input";

const meta: Meta<typeof Label> = {
  title: "UI/Label",
  component: Label,
};

export default meta;
type Story = StoryObj<typeof Label>;

export const Default: Story = {
  args: { children: "Nom du politicien" },
};

export const WithInput: Story = {
  render: () => (
    <div className="grid w-full max-w-sm gap-1.5">
      <Label htmlFor="search">Rechercher un élu</Label>
      <Input id="search" placeholder="Nom, prénom ou département..." />
    </div>
  ),
};

export const Required: Story = {
  render: () => (
    <div className="grid w-full max-w-sm gap-1.5">
      <Label htmlFor="source">
        Source journalistique <span className="text-destructive">*</span>
      </Label>
      <Input id="source" placeholder="URL de l'article (Le Monde, Mediapart, AFP...)" />
    </div>
  ),
};
