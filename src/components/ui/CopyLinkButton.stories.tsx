import type { Meta, StoryObj } from "@storybook/react";
import { CopyLinkButton } from "./CopyLinkButton";

const meta: Meta<typeof CopyLinkButton> = {
  title: "UI/CopyLinkButton",
  component: CopyLinkButton,
  argTypes: {
    url: { control: "text" },
    initialCopied: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof CopyLinkButton>;

export const Default: Story = {
  args: {
    url: "https://poligraph.fr/politiques/marine-le-pen",
  },
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
