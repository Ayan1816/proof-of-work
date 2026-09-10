"use client";

import Link from "next/link";
import { FileCheck, Gavel, HelpCircle, ShieldCheck, Wallet } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";

const STEPS = [
  {
    title: "1. Post a bounty",
    body: "Describe the work you need in plain language and set a reward. That reward is held safely until the work is checked. Nobody can spend it in the meantime.",
  },
  {
    title: "2. Submit proof",
    body: "A contributor does the work and shares a public link — usually a GitHub page, gist, or document — plus a short note about what to look at.",
  },
  {
    title: "3. Independent AI reviewers check it",
    body: "Several independent reviewers open the link and compare it to your spec. They must agree on the result. A vague “looks good” is not enough.",
  },
  {
    title: "4. Get paid — or ask for a second look",
    body: "If the work is approved, the held reward can be released to the contributor. If you disagree, the poster or the contributor can request one extra review.",
  },
];

const QUESTIONS = [
  {
    title: "Do I need real money?",
    body: "No. This app runs on a free test network. The GEN you see here has no cash value. You still connect a wallet so the app can tell who posted or submitted work.",
  },
  {
    title: "What is a wallet?",
    body: "A wallet such as MetaMask is a login for this kind of app. It gives you an address (like an account number) and asks you to confirm actions. We never see your password or secret phrase.",
  },
  {
    title: "What is a bounty?",
    body: "A bounty is a public job listing with a locked reward. You write what “done” looks like. When someone delivers proof that matches, reviewers can approve it and the reward can be paid out.",
  },
  {
    title: "How do AI validators work?",
    body: "They are independent reviewers. Each one fetches the public proof link and judges it against the spec on its own. The result only stands when they agree. Rubber-stamping the first answer is not allowed.",
  },
  {
    title: "How do payouts work?",
    body: "When you post a bounty, the reward is locked with the listing. After an Approved result, anyone can release that held amount to the contributor. Until then, it cannot be spent.",
  },
  {
    title: "What if the review is wrong?",
    body: "The bounty poster or the contributor can appeal once. Reviewers then re-read the proof independently. After that, the recorded result for this bounty stands.",
  },
];

export default function FaqPage() {
  return (
    <PageShell>
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12 animate-fade-in">
          <p className="text-xs uppercase tracking-wider text-accent mb-3">
            For first-time users
          </p>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            How Proof of Work works
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            You do not need to be a crypto expert. This page explains the
            product in everyday language.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
          <div className="brand-card p-5 space-y-2">
            <FileCheck className="w-5 h-5 text-accent" />
            <h2 className="font-semibold">Bounties</h2>
            <p className="text-sm text-muted-foreground">
              Public tasks with a locked reward and a clear definition of done.
            </p>
          </div>
          <div className="brand-card p-5 space-y-2">
            <ShieldCheck className="w-5 h-5 text-accent" />
            <h2 className="font-semibold">AI reviewers</h2>
            <p className="text-sm text-muted-foreground">
              Independent checks against your spec — not a single rubber stamp.
            </p>
          </div>
          <div className="brand-card p-5 space-y-2">
            <Wallet className="w-5 h-5 text-accent" />
            <h2 className="font-semibold">Payouts</h2>
            <p className="text-sm text-muted-foreground">
              Approved work can release the held reward to the contributor.
            </p>
          </div>
        </div>

        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6">The flow</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {STEPS.map((step) => (
              <div key={step.title} className="brand-card p-6 space-y-2">
                <h3 className="text-accent font-bold">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <HelpCircle className="w-6 h-6 text-accent" />
            Common questions
          </h2>
          <div className="space-y-4">
            {QUESTIONS.map((item) => (
              <div key={item.title} className="brand-card p-6 space-y-2">
                <h3 className="font-semibold">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        <div className="brand-card p-8 text-center space-y-4">
          <Gavel className="w-8 h-8 mx-auto text-accent" />
          <h2 className="text-xl font-bold">Ready to try it?</h2>
          <p className="text-sm text-muted-foreground max-w-lg mx-auto">
            Browse open bounties or post one of your own. Everything here uses
            free test GEN — no real funds.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild variant="gradient">
              <Link href="/">View bounties</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/create">Post a bounty</Link>
            </Button>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
