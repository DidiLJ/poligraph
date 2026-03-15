"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2 } from "lucide-react";

interface PressPurgeButtonProps {
  count: number;
}

export function PressPurgeButton({ count }: PressPurgeButtonProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [purging, setPurging] = useState(false);

  async function handlePurge() {
    setPurging(true);
    try {
      const res = await fetch("/api/admin/presse/purge", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        router.refresh();
      } else {
        toast.error(data.error || "Erreur lors de la purge");
      }
    } finally {
      setPurging(false);
      setConfirming(false);
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-amber-700">
          Supprimer {count} article{count > 1 ? "s" : ""} sans mention ?
        </span>
        <Button size="sm" variant="destructive" onClick={handlePurge} disabled={purging}>
          {purging ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
          ) : (
            <Trash2 className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
          )}
          Confirmer
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setConfirming(false)} disabled={purging}>
          Annuler
        </Button>
      </div>
    );
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={() => setConfirming(true)}
      className="text-amber-700 border-amber-300 hover:bg-amber-50"
    >
      <Trash2 className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
      Purger sans mention ({count})
    </Button>
  );
}
