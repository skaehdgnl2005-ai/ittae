"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { EverytimeImportSheet } from "@/components/calendar/EverytimeImportSheet";

type Props = {
  hasExistingEverytime: boolean;
  existingCount: number;
};

export function EverytimeImportButton({ hasExistingEverytime, existingCount }: Props) {
  const [open, setOpen] = useState(false);
  const label = hasExistingEverytime
    ? "에브리타임 갱신"
    : "에브리타임 가져오기";

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        {label}
      </Button>
      {open && (
        <EverytimeImportSheet
          open
          onClose={() => setOpen(false)}
          hasExistingEverytime={hasExistingEverytime}
          existingCount={existingCount}
        />
      )}
    </>
  );
}
