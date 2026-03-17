import type { Meta, StoryObj } from "@storybook/react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./tabs";

const meta: Meta<typeof Tabs> = {
  title: "UI/Tabs",
  component: Tabs,
};

export default meta;
type Story = StoryObj<typeof Tabs>;

export const Default: Story = {
  render: () => (
    <Tabs defaultValue="profil" className="max-w-lg">
      <TabsList>
        <TabsTrigger value="profil">Profil</TabsTrigger>
        <TabsTrigger value="votes">Votes</TabsTrigger>
        <TabsTrigger value="affaires">Affaires</TabsTrigger>
      </TabsList>
      <TabsContent value="profil" className="p-4 text-sm">
        Député de la 2e circonscription des Bouches-du-Rhône depuis 2022. Membre de la commission
        des lois constitutionnelles.
      </TabsContent>
      <TabsContent value="votes" className="p-4 text-sm">
        A participé à 312 scrutins sur 450 lors de la session 2024-2025 (taux de participation :
        69%).
      </TabsContent>
      <TabsContent value="affaires" className="p-4 text-sm">
        Aucune affaire judiciaire enregistrée.
      </TabsContent>
    </Tabs>
  ),
};

export const LineVariant: Story = {
  render: () => (
    <Tabs defaultValue="carriere" className="max-w-lg">
      <TabsList variant="line">
        <TabsTrigger value="carriere">Carrière</TabsTrigger>
        <TabsTrigger value="declarations">Déclarations</TabsTrigger>
        <TabsTrigger value="presse">Presse</TabsTrigger>
        <TabsTrigger value="factchecks">Fact-checks</TabsTrigger>
      </TabsList>
      <TabsContent value="carriere" className="p-4 text-sm">
        <ul className="space-y-1">
          <li>2024 - aujourd{"'"}hui : Ministre de la Justice</li>
          <li>2022 - 2024 : Sénateur du Rhône</li>
          <li>2014 - 2022 : Maire de Lyon</li>
        </ul>
      </TabsContent>
      <TabsContent value="declarations" className="p-4 text-sm">
        2 déclarations de patrimoine et 3 déclarations d{"'"}intérêts publiées sur le site de la
        HATVP.
      </TabsContent>
      <TabsContent value="presse" className="p-4 text-sm">
        47 articles de presse référencés ces 30 derniers jours.
      </TabsContent>
      <TabsContent value="factchecks" className="p-4 text-sm">
        3 vérifications de faits disponibles (sources : Le Monde Décodeurs, AFP Factuel).
      </TabsContent>
    </Tabs>
  ),
};

export const ManyTabs: Story = {
  render: () => (
    <Tabs defaultValue="resume" className="max-w-2xl">
      <TabsList>
        <TabsTrigger value="resume">Résumé</TabsTrigger>
        <TabsTrigger value="mandats">Mandats</TabsTrigger>
        <TabsTrigger value="votes">Votes</TabsTrigger>
        <TabsTrigger value="affaires">Affaires</TabsTrigger>
        <TabsTrigger value="patrimoine">Patrimoine</TabsTrigger>
      </TabsList>
      <TabsContent value="resume" className="p-4 text-sm">
        Vue d{"'"}ensemble du parcours politique et des activités parlementaires.
      </TabsContent>
      <TabsContent value="mandats" className="p-4 text-sm">
        3 mandats enregistrés depuis 2012.
      </TabsContent>
      <TabsContent value="votes" className="p-4 text-sm">
        Participation aux scrutins publics de l{"'"}Assemblée nationale.
      </TabsContent>
      <TabsContent value="affaires" className="p-4 text-sm">
        Aucune affaire judiciaire.
      </TabsContent>
      <TabsContent value="patrimoine" className="p-4 text-sm">
        Déclarations HATVP disponibles.
      </TabsContent>
    </Tabs>
  ),
};
