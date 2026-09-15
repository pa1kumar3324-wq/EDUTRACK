"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, Loader2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { initials } from "@/lib/utils";

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024; // 2 MB — matches the bucket's file_size_limit
const MAX_DIMENSION = 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const AVATARS_BUCKET_PUBLIC_PREFIX = "/storage/v1/object/public/avatars/";

/**
 * Extracts the storage object path (e.g. "<volunteerId>/169...webp") from a
 * Supabase Storage public URL, so it can be passed to `.remove()`. Returns
 * null for anything that isn't actually one of our own avatars bucket URLs
 * (e.g. a dicebear fallback URL, or already null) — nothing to delete in
 * that case.
 */
function avatarStoragePathFromUrl(url: string | null): string | null {
  if (!url) return null;
  const idx = url.indexOf(AVATARS_BUCKET_PUBLIC_PREFIX);
  if (idx === -1) return null;
  return url.slice(idx + AVATARS_BUCKET_PUBLIC_PREFIX.length);
}

/** Resizes/re-encodes an image client-side so uploads land near the ~300–500KB target without a server-side image pipeline. */
async function compressImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, width, height);

  // Step quality down until we're under target size or hit a sane floor.
  let quality = 0.85;
  let blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", quality));
  while (blob && blob.size > 500 * 1024 && quality > 0.4) {
    quality -= 0.15;
    blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", quality));
  }
  return blob ?? file;
}

export function AvatarUploader({
  volunteerId,
  currentAvatarUrl,
  altName,
  onUploaded,
}: {
  volunteerId: string;
  currentAvatarUrl: string | null;
  altName: string;
  onUploaded: (url: string | null) => void | Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(currentAvatarUrl);
  const [isBusy, setIsBusy] = useState(false);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error("Please choose a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error("That image is larger than 2MB. Please choose a smaller one.");
      return;
    }

    setIsBusy(true);
    try {
      const compressed = await compressImage(file);
      const supabase = createClient();
      const path = `${volunteerId}/${Date.now()}.webp`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, compressed, { contentType: "image/webp", upsert: true });
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from("avatars").getPublicUrl(path);
      const url = publicUrlData.publicUrl;

      // L8: delete the previous object now that the new one has uploaded
      // successfully, so old avatar blobs don't accumulate indefinitely.
      // Best-effort — a failed cleanup shouldn't fail the upload the user
      // is actively waiting on.
      const previousPath = avatarStoragePathFromUrl(preview);
      if (previousPath) {
        void supabase.storage.from("avatars").remove([previousPath]);
      }

      setPreview(url);
      await onUploaded(url);
      toast.success("Photo updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload photo");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleRemove() {
    setIsBusy(true);
    try {
      // L8: also delete the object from Storage, not just clear the DB
      // column — best-effort, same reasoning as above.
      const previousPath = avatarStoragePathFromUrl(preview);
      const supabase = createClient();
      setPreview(null);
      await onUploaded(null);
      if (previousPath) {
        void supabase.storage.from("avatars").remove([previousPath]);
      }
      toast.success("Photo removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove photo");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar className="h-20 w-20 border border-border">
        <AvatarImage src={preview ?? undefined} alt={altName} />
        <AvatarFallback className="text-lg">{initials(altName)}</AvatarFallback>
      </Avatar>
      <div className="flex flex-col gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleFileChange}
          aria-label="Upload profile photo"
        />
        <Button type="button" variant="outline" size="sm" disabled={isBusy} onClick={() => inputRef.current?.click()}>
          {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
          {preview ? "Change photo" : "Upload photo"}
        </Button>
        {preview && (
          <Button type="button" variant="ghost" size="sm" disabled={isBusy} onClick={handleRemove} className="text-destructive hover:text-destructive">
            <X className="h-3.5 w-3.5" /> Remove
          </Button>
        )}
        <p className="text-xs text-muted-foreground">JPEG, PNG, or WebP. Up to 2MB.</p>
      </div>
    </div>
  );
}
