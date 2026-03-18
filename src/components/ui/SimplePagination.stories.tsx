import type { Meta, StoryObj } from "@storybook/react";
import { SimplePagination } from "./SimplePagination";

const meta: Meta<typeof SimplePagination> = {
  title: "UI/SimplePagination",
  component: SimplePagination,
};

export default meta;
type Story = StoryObj<typeof SimplePagination>;

export const MiddlePage: Story = {
  args: {
    page: 3,
    totalPages: 10,
    buildUrl: (p: number) => `#page-${p}`,
  },
};

export const FirstPage: Story = {
  args: {
    page: 1,
    totalPages: 10,
    buildUrl: (p: number) => `#page-${p}`,
  },
};

export const LastPage: Story = {
  args: {
    page: 10,
    totalPages: 10,
    buildUrl: (p: number) => `#page-${p}`,
  },
};

export const SinglePage: Story = {
  args: {
    page: 1,
    totalPages: 1,
    buildUrl: (p: number) => `#page-${p}`,
  },
};

export const TwoPages: Story = {
  args: {
    page: 1,
    totalPages: 2,
    buildUrl: (p: number) => `#page-${p}`,
  },
};
