"use client";

import { useI18n } from "@/lib/i18n/LanguageProvider";
import { Button } from "./ui/button";

export function LanguageToggle() {
  const { lang, setLang } = useI18n();
  return (
    <div className="flex items-center rounded-md border border-white/10 overflow-hidden text-xs font-semibold">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={`rounded-none h-8 px-2 ${lang === "en" ? "bg-accent/20 text-accent" : "text-muted-foreground"}`}
        onClick={() => setLang("en")}
      >
        EN
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={`rounded-none h-8 px-2 ${lang === "bn" ? "bg-accent/20 text-accent" : "text-muted-foreground"}`}
        onClick={() => setLang("bn")}
      >
        বাং
      </Button>
    </div>
  );
}
