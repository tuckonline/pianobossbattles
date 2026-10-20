"use client";
import { useRef, useState } from "react";
import type { CourseMetadata } from "@/domains/blocks/schema";
import type { Asset } from "../lesson/registry";
import type { Recording } from "../midi/recorder";
import { uploadVideoFile } from "./video-upload";
import { VIDEO_UPLOAD_LIMIT } from "@/domains/media/upload-limits";

const formats = {
  VIDEO: {
    accept: ".mp4,.webm",
    label: "video",
    help: "MP4 or WebM · up to 1 GB. Keep this page open until the upload finishes.",
  },
  AUDIO: {
    accept: ".mp3,.wav,.m4a,.ogg",
    label: "audio",
    help: "MP3, WAV, M4A or OGG · up to 100 MB",
  },
  MIDI: {
    accept: ".mid,.midi",
    label: "MIDI",
    help: "MID or MIDI · up to 2 MB. Imports notes, timing, velocity and pedal into a recording.",
  },
};
export function FileUpload({
  courseId,
  kind,
  rights,
  onUploaded,
  onBusy,
}: {
  courseId: string;
  kind: keyof typeof formats;
  rights: CourseMetadata["rights"];
  onUploaded: (result: { asset: Asset; recording?: Recording }) => void;
  onBusy: (busy: boolean) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const format = formats[kind];
  const busy = progress !== null;
  async function upload() {
    if (!file || busy) return;
    setError("");
    setMessage("");
    const extension = `.${file.name.split(".").at(-1)?.toLowerCase()}`;
    if (!format.accept.split(",").includes(extension)) {
      setError(`Choose a supported ${format.label} file.`);
      return;
    }
    const limit =
      kind === "VIDEO"
        ? VIDEO_UPLOAD_LIMIT
        : (kind === "MIDI" ? 2 : 100) * 1024 * 1024;
    if (!file.size || file.size > limit) {
      setError(
        `Choose a non-empty file up to ${kind === "VIDEO" ? "1 GB" : kind === "MIDI" ? "2 MB" : "100 MB"}.`,
      );
      return;
    }
    setProgress(0);
    onBusy(true);
    try {
      const result: { asset: Asset; recording?: Recording } =
        kind === "VIDEO"
          ? await uploadVideoFile(file, courseId, rights, setProgress)
          : await new Promise<{ asset: Asset; recording?: Recording }>(
              (resolve, reject) => {
                const xhr = new XMLHttpRequest();
                const query = new URLSearchParams({
                  courseId,
                  kind,
                  filename: file.name,
                  rights: JSON.stringify(rights),
                });
                xhr.open("POST", `/api/uploads?${query}`);
                xhr.timeout = 10 * 60 * 1000;
                xhr.setRequestHeader(
                  "Content-Type",
                  "application/octet-stream",
                );
                xhr.upload.onprogress = (event) => {
                  if (event.lengthComputable)
                    setProgress(Math.round((event.loaded / event.total) * 100));
                };
                xhr.onerror = () =>
                  reject(
                    new Error(
                      "Upload failed. Check your connection and try again.",
                    ),
                  );
                xhr.ontimeout = () =>
                  reject(
                    new Error(
                      "Upload timed out. Try again with a smaller file.",
                    ),
                  );
                xhr.onload = () => {
                  try {
                    const body = JSON.parse(xhr.responseText);
                    if (xhr.status < 200 || xhr.status >= 300)
                      reject(
                        new Error(
                          body.error || "Upload failed. Please try again.",
                        ),
                      );
                    else resolve(body);
                  } catch {
                    reject(new Error("Upload failed. Please try again."));
                  }
                };
                xhr.send(file);
              },
            );
      onUploaded(result);
      setMessage(
        `${file.name} ${kind === "MIDI" ? "imported" : "uploaded"} and selected. Save your draft to keep this block.`,
      );
      setFile(null);
      if (input.current) input.current.value = "";
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setProgress(null);
      onBusy(false);
    }
  }
  return (
    <div className="panel stack">
      <label>
        Choose {format.label} file
        <input
          ref={input}
          type="file"
          accept={format.accept}
          disabled={busy}
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setError("");
            setMessage("");
          }}
        />
      </label>
      <small>{format.help} Files use the course’s rights declaration.</small>
      <button
        type="button"
        className="secondary"
        disabled={!file || busy}
        onClick={() => void upload()}
      >
        {busy
          ? progress === 100
            ? "Saving file…"
            : `Uploading ${progress}%…`
          : `Upload ${format.label}`}
      </button>
      {busy && (
        <progress aria-label="Upload progress" value={progress} max={100} />
      )}
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
