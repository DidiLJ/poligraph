import type { Meta, StoryObj } from "@storybook/react";
import { StatCard } from "./StatCard";

const meta: Meta<typeof StatCard> = {
  title: "UI/StatCard",
  component: StatCard,
  argTypes: {
    isActive: { control: "boolean" },
  },
  decorators: [
    (Story) => (
      <div className="max-w-xs">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof StatCard>;

export const Deputes: Story = {
  args: {
    count: 577,
    label: "Députés",
    accent: { border: "#1D4ED8", bg: "#EFF6FF" },
  },
};

export const Senateurs: Story = {
  args: {
    count: 348,
    label: "Sénateurs",
    accent: { border: "#7C3AED", bg: "#F5F3FF" },
  },
};

export const WithDescription: Story = {
  args: {
    count: 42,
    label: "Affaires en cours",
    description: "Politiciens avec au moins une affaire judiciaire non clôturée",
    accent: { border: "#D97706", bg: "#FFFBEB" },
  },
};

export const Active: Story = {
  args: {
    count: 577,
    label: "Députés",
    accent: { border: "#1D4ED8", bg: "#EFF6FF" },
    isActive: true,
  },
};

export const WithHref: Story = {
  args: {
    count: 577,
    label: "Députés",
    description: "Assemblée nationale, XVIIe législature",
    accent: { border: "#1D4ED8", bg: "#EFF6FF" },
    href: "#",
  },
};

export const AllStats: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-4 max-w-lg">
      <StatCard count={577} label="Députés" accent={{ border: "#1D4ED8", bg: "#EFF6FF" }} />
      <StatCard count={348} label="Sénateurs" accent={{ border: "#7C3AED", bg: "#F5F3FF" }} />
      <StatCard
        count={35}
        label="Membres du gouvernement"
        accent={{ border: "#059669", bg: "#ECFDF5" }}
      />
      <StatCard count={81} label="Eurodéputés" accent={{ border: "#0891B2", bg: "#ECFEFF" }} />
    </div>
  ),
};
