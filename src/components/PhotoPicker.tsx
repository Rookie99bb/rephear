"use client";

import { useRef, useState, type DragEvent } from "react";

// Friendlier replacement for a plain "Photo URL" text input (see
// AddNomineeForm). Users can either drag-and-drop / click to upload an
// image file — which is uploaded to Cloudflare R2 via
// /api/upload/photo and the returned public URL is used — or paste an
// existing image URL directly. Either path ends up in the same hidden
// `photoUrl` form field, so the surrounding <form> and its server action
// don't need to know or care which method was used.
export default function PhotoPicker({
  name = "photoUrl",
  defaultValue = "",
}: {
  name?: string;
  defaultValue?: string;
}) {
  const [photoUrl, setPhotoUrl] = useState(defaultValue);
  const [urlInput, setUrlInput] = useState(defaultValue);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [previewOk, setPreviewOk] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function uploadFile(file: File) {
    setError(null);
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/upload/photo", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Upload failed, please try again.");
      }
      setPhotoUrl(data.url);
      setUrlInput(data.url);
      setPreviewOk(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed, please try again.");
    } finally {
      setUploading(false);
    }
  }

  function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    uploadFile(file);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    handleFiles(e.dataTransfer.files);
  }

  function handleUrlChange(value: string) {
    setUrlInput(value);
    setError(null);
    const trimmed = value.trim();
    if (!trimmed) {
      setPhotoUrl("");
      return;
    }
    try {
      // eslint-disable-next-line no-new
      new URL(trimmed);
      setPhotoUrl(trimmed);
      setPreviewOk(true);
    } catch {
      // Not a valid absolute URL yet (still mid-typing/paste) — leave
      // photoUrl unset rather than showing an error on every keystroke.
      setPhotoUrl("");
    }
  }

  function handleRemove() {
    setPhotoUrl("");
    setUrlInput("");
    setError(null);
    setPreviewOk(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const showPreview = !!photoUrl && previewOk;

  return (
    <div className="flex flex-col gap-2">
      <input type="hidden" name={name} value={photoUrl} />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={(e) => handleFiles(e.target.files)}
        className="hidden"
      />

      {showPreview ? (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoUrl}
            alt="Selected photo preview"
            onError={() => setPreviewOk(false)}
            className="h-20 w-20 shrink-0 rounded-2xl border border-border object-cover"
          />
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-surface disabled:opacity-50"
            >
              {uploading ? "Uploading…" : "Replace"}
            </button>
            <button
              type="button"
              onClick={handleRemove}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          className={`flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-6 text-center transition ${
            dragActive ? "border-ink bg-surface" : "border-border"
          }`}
        >
          {uploading ? (
            <span className="text-sm text-subtle">Uploading…</span>
          ) : (
            <>
              <span className="text-sm text-subtle">
                Drag and drop a photo here
              </span>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-lg bg-ink px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90"
              >
                Click to upload
              </button>
            </>
          )}
        </div>
      )}

      <input
        type="url"
        value={urlInput}
        onChange={(e) => handleUrlChange(e.target.value)}
        placeholder="Or paste an image URL"
        className="w-full rounded-xl border border-border px-3 py-2.5 text-sm outline-none focus:border-ink"
      />

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
