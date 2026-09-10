"use client";

import { useState, useEffect } from "react";
import { Plus, Loader2, Link2, FileText } from "lucide-react";
import { useSubmitWork } from "@/lib/hooks/useProofOfWork";
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
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";

const MIN_DESCRIPTION_LENGTH = 20;

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value.trim());
    return (
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      parsed.hostname.length > 0
    );
  } catch {
    return false;
  }
}

interface SubmitModalProps {
  bountyId: string;
}

export function SubmitModal({ bountyId }: SubmitModalProps) {
  const { isConnected, address, isLoading } = useWallet();
  const { mutateAsync: submitWork, isPending, reset } = useSubmitWork();

  const [isOpen, setIsOpen] = useState(false);
  const [proofLink, setProofLink] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState({ proofLink: "", description: "" });
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    if (!isConnected && isOpen && !isPending) {
      setIsOpen(false);
    }
  }, [isConnected, isOpen, isPending]);

  const validateForm = (): boolean => {
    const newErrors = { proofLink: "", description: "" };
    const trimmedLink = proofLink.trim();
    const trimmedDescription = description.trim();

    if (!trimmedLink) {
      newErrors.proofLink = "Proof link is required";
    } else if (!isHttpUrl(trimmedLink)) {
      newErrors.proofLink = "Enter a valid http or https URL";
    }

    if (!trimmedDescription) {
      newErrors.description = "Description is required";
    } else if (trimmedDescription.length < MIN_DESCRIPTION_LENGTH) {
      newErrors.description = `Give validators a bit more to work with (${MIN_DESCRIPTION_LENGTH}+ characters)`;
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

    if (!bountyId) {
      error("A bounty is required to submit work");
      return;
    }

    if (!validateForm()) {
      return;
    }

    setSubmitError("");
    try {
      await submitWork({
        bountyId,
        proofLink: proofLink.trim(),
        description: description.trim(),
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
    setProofLink("");
    setDescription("");
    setErrors({ proofLink: "", description: "" });
    setSubmitError("");
  };

  const handleOpenChange = (open: boolean) => {
    if (!open && !isPending) {
      resetForm();
      reset();
    }
    setIsOpen(open);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="gradient"
          disabled={!isConnected || !address || isLoading || !bountyId}
        >
          <Plus className="w-4 h-4 mr-2" />
          Submit work
        </Button>
      </DialogTrigger>
      <DialogContent className="brand-card border-2 sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Submit work</DialogTitle>
          <DialogDescription>
            Share a public link (GitHub, gist, docs page) that proves the spec
            is met. Independent GenLayer validators will fetch it and compare it
            against the bounty.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          <div className="space-y-2">
            <Label htmlFor="proofLink" className="flex items-center gap-2">
              <Link2 className="w-4 h-4" />
              Proof link
            </Label>
            <Input
              id="proofLink"
              type="url"
              value={proofLink}
              onChange={(e) => {
                setProofLink(e.target.value);
                setErrors({ ...errors, proofLink: "" });
              }}
              placeholder="https://github.com/you/repo/blob/main/README.md"
              disabled={isPending}
              aria-invalid={!!errors.proofLink}
              className={errors.proofLink ? "border-destructive" : ""}
            />
            {errors.proofLink && (
              <p className="text-xs text-destructive">{errors.proofLink}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              What did you deliver?
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setErrors({ ...errors, description: "" });
              }}
              placeholder="A short note for validators: what to look at, and how it matches the spec."
              rows={5}
              disabled={isPending}
              aria-invalid={!!errors.description}
              className={errors.description ? "border-destructive" : ""}
            />
            <p className="text-xs text-muted-foreground">
              {description.trim().length}/{MIN_DESCRIPTION_LENGTH} characters
              minimum
            </p>
            {errors.description && (
              <p className="text-xs text-destructive">{errors.description}</p>
            )}
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
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="gradient"
              className="flex-1"
              disabled={isPending}
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting…
                </>
              ) : (
                "Submit for review"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
