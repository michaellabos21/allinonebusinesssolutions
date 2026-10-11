"use client";

import { Camera, ImageUp, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { UserAvatar } from "@/components/common/user-avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PHOTO_SIZE } from "@/lib/photos";
import { cn } from "@/lib/utils";
import type { ActionResult } from "@/server/types";

/**
 * Crops a picture to a centred square and shrinks it to PHOTO_SIZE pixels,
 * as WebP where the browser can write it and JPEG otherwise. Doing this in
 * the browser keeps uploads small (usually under 30 KB) whatever the camera
 * produced, and accepts any format the browser can open, such as HEIC on an
 * iPhone.
 */
async function squarePhoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = PHOTO_SIZE;
  canvas.height = PHOTO_SIZE;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("no canvas");
  context.imageSmoothingQuality = "high";
  context.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    PHOTO_SIZE,
    PHOTO_SIZE,
  );
  bitmap.close();
  const encode = (type: string, quality: number) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
  const webp = await encode("image/webp", 0.86);
  if (webp?.type === "image/webp") return webp;
  const jpeg = await encode("image/jpeg", 0.88);
  if (!jpeg) throw new Error("could not encode");
  return jpeg;
}

type Props = {
  name: string;
  photoPath: string | null;
  /** Receives the prepared photo as form data with a `file` field. */
  onUpload: (form: FormData) => Promise<ActionResult<unknown>>;
  onRemove: () => Promise<ActionResult<unknown>>;
  /** "inline" shows buttons beside the photo; "overlay" puts a small camera menu on it. */
  layout?: "inline" | "overlay";
  className?: string;
  avatarClassName?: string;
};

/** Shows a person's photo with controls to upload, change or remove it. */
export function PhotoPicker({
  name,
  photoPath,
  onUpload,
  onRemove,
  layout = "inline",
  className,
  avatarClassName,
}: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function run(work: () => Promise<ActionResult<unknown>>, done: string) {
    setBusy(true);
    try {
      const result = await work();
      if (result.ok) toast.success(done);
      else toast.error(result.error);
    } catch {
      toast.error("We couldn’t reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function choose(file: File | undefined) {
    if (input.current) input.current.value = "";
    if (!file) return;
    let photo: Blob;
    try {
      photo = await squarePhoto(file);
    } catch {
      toast.error("We couldn’t read that image. Use a JPEG, PNG or WebP photo.");
      return;
    }
    const form = new FormData();
    form.set("file", photo, photo.type === "image/webp" ? "photo.webp" : "photo.jpg");
    await run(() => onUpload(form), photoPath ? "Photo changed" : "Photo added");
  }

  const fileInput = (
    <input
      ref={input}
      type="file"
      accept="image/*"
      className="sr-only"
      tabIndex={-1}
      aria-hidden
      onChange={(event) => choose(event.target.files?.[0])}
    />
  );
  const upload = () => input.current?.click();
  const remove = () => run(onRemove, "Photo removed");

  if (layout === "overlay") {
    return (
      <div className={cn("relative shrink-0", className)}>
        <UserAvatar name={name} photoPath={photoPath} className={avatarClassName} />
        {fileInput}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              size="icon"
              variant="outline"
              disabled={busy}
              aria-label={photoPath ? `Change ${name}’s photo` : `Add a photo of ${name}`}
              className="absolute -right-1 -bottom-1 size-7 rounded-full bg-background shadow-sm"
            >
              <Camera aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            <DropdownMenuItem onSelect={upload}>
              <ImageUp aria-hidden />
              {photoPath ? "Upload a new photo" : "Upload a photo"}
            </DropdownMenuItem>
            {photoPath ? (
              <DropdownMenuItem variant="destructive" onSelect={remove}>
                <Trash2 aria-hidden />
                Remove photo
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      <UserAvatar name={name} photoPath={photoPath} className={avatarClassName} />
      {fileInput}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={busy} onClick={upload}>
          <ImageUp data-icon="inline-start" aria-hidden />
          {busy ? "Saving…" : photoPath ? "Change photo" : "Upload photo"}
        </Button>
        {photoPath ? (
          <Button type="button" variant="ghost" disabled={busy} onClick={remove}>
            Remove
          </Button>
        ) : null}
      </div>
    </div>
  );
}
