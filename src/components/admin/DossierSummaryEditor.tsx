"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

interface DossierSummaryEditorProps {
  dossierId: string;
  currentSummary: string | null;
  summaryDate: Date | null;
  title: string;
  sourceUrl: string | null;
}

export function DossierSummaryEditor({
  dossierId: _dossierId,
  currentSummary,
  summaryDate,
  title: _title,
  sourceUrl,
}: DossierSummaryEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [summary, setSummary] = useState(currentSummary || "");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/admin/dossiers/${_dossierId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erreur lors de la sauvegarde");
      }

      setSuccess("Résumé sauvegardé avec succès");
      setIsEditing(false);

      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setSummary(currentSummary || "");
    setIsEditing(false);
    setError(null);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            Résumé
            {currentSummary ? (
              <Badge className="bg-green-100 text-green-800">Renseigné</Badge>
            ) : (
              <Badge variant="outline" className="text-orange-600 border-orange-300">
                Non renseigné
              </Badge>
            )}
          </CardTitle>
          <div className="flex gap-2">
            {!isEditing && (
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                Modifier
              </Button>
            )}
          </div>
        </div>
        {summaryDate && (
          <p className="text-sm text-muted-foreground">
            Dernière mise à jour : {formatDate(summaryDate)}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <div className="bg-red-50 text-red-800 p-3 rounded-md text-sm">{error}</div>}
        {success && (
          <div className="bg-green-50 text-green-800 p-3 rounded-md text-sm">{success}</div>
        )}

        {isEditing ? (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Résumé (Markdown supporté)</label>
              <Textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                rows={10}
                placeholder="Entrez le résumé du dossier législatif..."
                className="font-mono text-sm"
              />
            </div>

            <div className="bg-amber-50 text-amber-800 p-3 rounded-md text-sm">
              <strong>Rappel :</strong> Le résumé doit être basé uniquement sur les sources
              officielles (texte du dossier, exposé des motifs).
              {sourceUrl && (
                <>
                  {" "}
                  <a
                    href={sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    Voir le dossier sur assemblee-nationale.fr
                  </a>
                </>
              )}
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? "Sauvegarde..." : "Sauvegarder"}
              </Button>
              <Button variant="outline" onClick={handleCancel}>
                Annuler
              </Button>
            </div>
          </div>
        ) : (
          <div>
            {currentSummary ? (
              <div className="prose prose-sm max-w-none whitespace-pre-wrap">{currentSummary}</div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>Aucun résumé disponible pour ce dossier.</p>
              </div>
            )}
          </div>
        )}

        {sourceUrl && !isEditing && (
          <div className="pt-4 border-t">
            <p className="text-xs text-muted-foreground">
              Source officielle :{" "}
              <a
                href={sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                {sourceUrl}
              </a>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
