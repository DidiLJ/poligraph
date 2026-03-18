import type { Meta, StoryObj } from "@storybook/react";
import { CopyLinkButton } from "./CopyLinkButton";

const meta: Meta<typeof CopyLinkButton> = {
  title: "UI/CopyLinkButton",
  component: CopyLinkButton,
  argTypes: {
    url: { control: "text" },
    // initialCopied is one-time initialization only — not reactive, excluded from controls
    initialCopied: { table: { disable: true } },
  },
};

export default meta;
type Story = StoryObj<typeof CopyLinkButton>;

// Default story: no url prop — demonstrates window.location.href fallback
export const Default: Story = {
  args: {},
};

export const Copied: Story = {
  args: {
    url: "https://poligraph.fr/politiques/marine-le-pen",
    initialCopied: true,
  },
};

export const WithUrl: Story = {
  args: {
    url: "https://poligraph.fr/politiques/marine-le-pen",
  },
};
