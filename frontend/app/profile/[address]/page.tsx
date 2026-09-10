"use client";

import { useParams } from "next/navigation";
import { PageShell } from "@/components/PageShell";
import { ProfileView } from "@/components/ProfileView";
import { useWallet } from "@/lib/genlayer/wallet";
import { sameWallet } from "@/lib/format";

export default function ContributorProfilePage() {
  const params = useParams<{ address: string }>();
  const profileAddress = decodeURIComponent(String(params?.address || ""));
  const { address } = useWallet();

  return (
    <PageShell>
      <ProfileView
        address={profileAddress}
        isOwn={sameWallet(address || undefined, profileAddress)}
      />
    </PageShell>
  );
}
