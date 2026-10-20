import type { CourseMetadata } from "@/domains/blocks/schema";
import type { Asset } from "../lesson/registry";

class UploadError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}
function send<T>(
  url: string,
  body?: Blob,
  progress?: (loaded: number) => void,
) {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.timeout = 10 * 60 * 1000;
    if (body) xhr.setRequestHeader("Content-Type", "application/octet-stream");
    xhr.upload.onprogress = (event) => progress?.(event.loaded);
    xhr.onerror = () =>
      reject(
        new UploadError(
          "Connection interrupted. Please try uploading again.",
          true,
        ),
      );
    xhr.ontimeout = () =>
      reject(new UploadError("The upload timed out. Please try again.", true));
    xhr.onload = () => {
      let data;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        reject(
          new UploadError(
            "Upload service unavailable. Please try again.",
            xhr.status >= 500,
          ),
        );
        return;
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data as T);
      else
        reject(
          new UploadError(
            data.error || "Unable to upload this video.",
            xhr.status >= 500 || xhr.status === 429,
          ),
        );
    };
    xhr.send(body);
  });
}
async function retry<T>(operation: () => Promise<T>) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (!(error instanceof UploadError) || !error.retryable || attempt >= 2)
        throw error;
      await new Promise((resolve) => setTimeout(resolve, 750 * 2 ** attempt));
    }
  }
}
export async function uploadVideoFile(
  file: File,
  courseId: string,
  rights: CourseMetadata["rights"],
  progress: (percent: number) => void,
) {
  const query = new URLSearchParams({
    courseId,
    filename: file.name,
    size: String(file.size),
    rights: JSON.stringify(rights),
  });
  const session = await send<{ id: string; partSize: number }>(
    `/api/uploads/video/start?${query}`,
  );
  try {
    for (
      let offset = 0, partNumber = 1;
      offset < file.size;
      offset += session.partSize, partNumber++
    ) {
      const part = file.slice(
        offset,
        Math.min(file.size, offset + session.partSize),
      );
      await retry(() =>
        send(
          `/api/uploads/video/part?id=${session.id}&partNumber=${partNumber}`,
          part,
          (loaded) =>
            progress(
              Math.min(99, Math.floor(((offset + loaded) / file.size) * 100)),
            ),
        ),
      );
    }
    progress(100);
    return await retry(() =>
      send<{ asset: Asset }>(`/api/uploads/video/complete?id=${session.id}`),
    );
  } catch (error) {
    // Abort incomplete storage, but the server preserves any asset already saved by completion.
    await send(`/api/uploads/video/abort?id=${session.id}`).catch(() => {});
    throw error;
  }
}
