"use client";

import { useState, useEffect } from "react";
import { Plus, Loader2, Sparkles } from "lucide-react";
import { useSubmitEntry } from "@/lib/hooks/useRoyArena";
import type { FeePresetLevel } from "@/lib/genlayer/fees";
import type { ArenaCategory } from "@/lib/contracts/types";
import { useWallet } from "@/lib/genlayer/wallet";
import { error } from "@/lib/utils/toast";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { Label } from "./ui/label";

const CATEGORIES: ArenaCategory[] = ["Startup", "Meme", "Poem"];

export function SubmitModal() {
  const { isConnected, address, isLoading } = useWallet();
  const { submitEntryAsync, isCreating, reset } = useSubmitEntry();

  const [isOpen, setIsOpen] = useState(false);
  const [category, setCategory] = useState<ArenaCategory | "">("");
  const [content, setContent] = useState("");
  const [claim, setClaim] = useState("");
  const [deadline, setDeadline] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [feePresetLevel, setFeePresetLevel] = useState<FeePresetLevel>("standard");
  const [errors, setErrors] = useState({
    category: "",
    content: "",
    claim: "",
    deadline: "",
    evidenceUrl: "",
  });
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    if (!isConnected && isOpen && !isCreating) {
      setIsOpen(false);
    }
  }, [isConnected, isOpen, isCreating]);

  const validateForm = (): boolean => {
    const newErrors = {
      category: "",
      content: "",
      claim: "",
      deadline: "",
      evidenceUrl: "",
    };

    if (!category) {
      newErrors.category = "Choose a category";
    }
    if (!content.trim()) {
      newErrors.content = "Content is required";
    } else if (content.trim().length < 20) {
      newErrors.content = "Give the judge a bit more to work with (20+ characters)";
    }
    if (!claim.trim()) {
      newErrors.claim = "Write a falsifiable claim";
    } else if (claim.trim().length < 20) {
      newErrors.claim = "The claim needs 20+ characters";
    }
    if (!deadline.trim()) {
      newErrors.deadline = "Pick a deadline";
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline.trim())) {
      newErrors.deadline = "Use YYYY-MM-DD";
    }
    const url = evidenceUrl.trim();
    if (!url) {
      newErrors.evidenceUrl = "Add a public evidence URL";
    } else if (!/^https?:\/\/[^/\s]+\.[^/\s]+/i.test(url)) {
      newErrors.evidenceUrl = "Use a public http(s) URL";
    }

    setErrors(newErrors);
    return !Object.values(newErrors).some((value) => value !== "");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isConnected || !address) {
      error("Please connect your wallet first");
      return;
    }

    if (!validateForm() || !category) {
      return;
    }

    setSubmitError("");
    try {
      await submitEntryAsync({
        category,
        content: content.trim(),
        claim: claim.trim(),
        deadline: deadline.trim(),
        evidenceUrl: evidenceUrl.trim(),
        feePresetLevel,
      });
      resetForm();
      setIsOpen(false);
      reset();
    } catch (err: any) {
      setSubmitError(
        err?.shortMessage ||
          err?.cause?.message ||
          err?.message ||
          "The submission did not save. Please try again."
      );
    }
  };

  const resetForm = () => {
    setCategory("");
    setContent("");
    setClaim("");
    setDeadline("");
    setEvidenceUrl("");
    setErrors({
      category: "",
      content: "",
      claim: "",
      deadline: "",
      evidenceUrl: "",
    });
    setSubmitError("");
  };

  const handleOpenChange = (open: boolean) => {
    if (!open && !isCreating) {
      resetForm();
      reset();
    }
    setIsOpen(open);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="gradient" disabled={!isConnected || !address || isLoading}>
          <Plus className="w-4 h-4 mr-2" />
          Submit Entry
        </Button>
      </DialogTrigger>
      <DialogContent className="brand-card border-2 sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Submit a projection</DialogTitle>
          <DialogDescription>
            Validators score the idea now, then later re-fetch your evidence URL to see if the world agreed.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          <div className="space-y-3">
            <Label>Category</Label>
            <div className="grid grid-cols-3 gap-3">
              {CATEGORIES.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    setCategory(option);
                    setErrors({ ...errors, category: "" });
                  }}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    category === option
                      ? "border-accent bg-accent/20 text-accent"
                      : "border-white/10 hover:border-white/20"
                  }`}
                >
                  <div className="font-semibold text-sm">{option}</div>
                </button>
              ))}
            </div>
            {errors.category && (
              <p className="text-xs text-destructive">{errors.category}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="content" className="flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Content
            </Label>
            <textarea
              id="content"
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                setErrors({ ...errors, content: "" });
              }}
              placeholder="Pitch, joke, or poem..."
              rows={5}
              className={`w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none ${
                errors.content ? "border-destructive" : "border-white/10"
              }`}
            />
            {errors.content && (
              <p className="text-xs text-destructive">{errors.content}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="claim">Projection claim</Label>
            <textarea
              id="claim"
              value={claim}
              onChange={(e) => {
                setClaim(e.target.value);
                setErrors({ ...errors, claim: "" });
              }}
              placeholder="By this date, a public page at this URL will show the idea as a live thing in the world."
              rows={3}
              className={`w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none ${
                errors.claim ? "border-destructive" : "border-white/10"
              }`}
            />
            {errors.claim && (
              <p className="text-xs text-destructive">{errors.claim}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="deadline">Deadline</Label>
              <input
                id="deadline"
                type="date"
                value={deadline}
                onChange={(e) => {
                  setDeadline(e.target.value);
                  setErrors({ ...errors, deadline: "" });
                }}
                className={`w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none ${
                  errors.deadline ? "border-destructive" : "border-white/10"
                }`}
              />
              {errors.deadline && (
                <p className="text-xs text-destructive">{errors.deadline}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="evidenceUrl">Evidence URL</Label>
              <input
                id="evidenceUrl"
                type="url"
                value={evidenceUrl}
                onChange={(e) => {
                  setEvidenceUrl(e.target.value);
                  setErrors({ ...errors, evidenceUrl: "" });
                }}
                placeholder="https://..."
                className={`w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none ${
                  errors.evidenceUrl ? "border-destructive" : "border-white/10"
                }`}
              />
              {errors.evidenceUrl && (
                <p className="text-xs text-destructive">{errors.evidenceUrl}</p>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <Label>Fee Preset</Label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { value: "low", label: "Low", detail: "No appeals" },
                  { value: "standard", label: "Standard", detail: "1 appeal" },
                  { value: "high", label: "High", detail: "2 appeals" },
                ] as const
              ).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFeePresetLevel(option.value)}
                  className={`rounded-md border px-3 py-2 text-left transition-all ${
                    feePresetLevel === option.value
                      ? "border-accent bg-accent/20 text-accent"
                      : "border-white/10 hover:border-white/20"
                  }`}
                >
                  <div className="text-sm font-semibold">{option.label}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{option.detail}</div>
                </button>
              ))}
            </div>
          </div>

          {submitError && (
            <p className="text-sm text-destructive">{submitError}</p>
          )}

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={() => setIsOpen(false)}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="gradient"
              className="flex-1"
              disabled={isCreating}
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Judging...
                </>
              ) : (
                "Submit & Judge"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
