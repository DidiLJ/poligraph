import type { Meta, StoryObj } from "@storybook/react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "./card";
import { Badge } from "./badge";

const meta: Meta<typeof Card> = {
  title: "UI/Card",
  component: Card,
};

export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {
  render: () => (
    <Card className="max-w-sm">
      <CardHeader>
        <CardTitle>Marine Le Pen</CardTitle>
        <CardDescription>
          Députée du Pas-de-Calais, présidente du Rassemblement National
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2">
          <Badge>Députée</Badge>
          <Badge variant="secondary">11e circonscription</Badge>
        </div>
      </CardContent>
    </Card>
  ),
};

export const PoliticalProfile: Story = {
  render: () => (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle>Gabriel Attal</CardTitle>
        <CardDescription>Député des Hauts-de-Seine, ancien Premier ministre</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            <Badge>Député</Badge>
            <Badge variant="accent">Renaissance</Badge>
          </div>
          <div className="text-sm text-muted-foreground">
            <p>Taux de participation aux scrutins : 72%</p>
            <p>Mandats : 2 (en cours et passés)</p>
          </div>
        </div>
      </CardContent>
      <CardFooter className="text-xs text-muted-foreground">
        Dernière mise à jour : 15 mars 2026
      </CardFooter>
    </Card>
  ),
};

export const Simple: Story = {
  render: () => (
    <Card className="max-w-sm">
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">
          Aucune affaire judiciaire enregistrée pour ce politicien.
        </p>
      </CardContent>
    </Card>
  ),
};
