"use client";

import Link from "next/link";
import type { Bounty } from "@/lib/contracts/types";
import { formatDeadline, formatGen, isExpired } from "@/lib/format";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { AddressDisplay } from "./AddressDisplay";
import { StatusBadge } from "./StatusBadge";

export function BountyCard({ bounty }: { bounty: Bounty }) {
  const { t, locale } = useI18n();
  const expired = bounty.status === "Open" && isExpired(bounty.deadline);

  return (
    <Link
      href={`/bounty/${bounty.id}`}
      className="brand-card p-5 block hover:border-accent/40 transition-colors h-full"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="text-lg font-bold leading-snug">{bounty.title}</h3>
        <StatusBadge status={bounty.status} />
      </div>
      <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
        {bounty.spec}
      </p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <span className="text-accent font-semibold">
          {formatGen(bounty.reward)} GEN
        </span>
        <span className="text-muted-foreground">
          {t.home.deadline}: {formatDeadline(bounty.deadline, locale)}
        </span>
        {expired && (
          <span className="text-destructive text-xs">{t.home.expired}</span>
        )}
      </div>
      <div className="mt-3 text-xs text-muted-foreground">
        <AddressDisplay address={bounty.creator} maxLength={12} />
      </div>
    </Link>
  );
}
