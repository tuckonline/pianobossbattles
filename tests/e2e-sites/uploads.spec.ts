import { test, expect } from "@playwright/test";
import MidiPackage from "@tonejs/midi";
const { Midi } = MidiPackage;

test.use({
  extraHTTPHeaders: {
    "oai-authenticated-user-id": "local-teacher",
    "oai-authenticated-user-email": "local@pianopath.test",
    "oai-authenticated-user-full-name": "Developer teacher",
  },
});

test("teacher uploads video, audio and MIDI, saves and previews them after reload", async ({
  page,
}) => {
  let videoPartRequests = 0;
  await page.route("**/api/uploads/video/part?**", async (route) => {
    videoPartRequests++;
    if (videoPartRequests === 1)
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Temporary test interruption" }),
      });
    else await route.continue();
  });
  await page.goto("/teacher/courses");
  await page.getByLabel("New course title").fill(`Upload test ${Date.now()}`);
  await page
    .getByRole("button", { name: "Create course", exact: true })
    .click();
  await page.waitForURL("**/teacher/courses/*");
  await page.getByRole("button", { name: "Add module", exact: true }).click();
  await page.getByRole("button", { name: "Add lesson", exact: true }).click();
  const video = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "blue";
    context.fillRect(0, 0, 64, 64);
    const stream = canvas.captureStream(10);
    const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
    const blobs: Blob[] = [];
    recorder.ondataavailable = (e) => blobs.push(e.data);
    const finished = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
    });
    recorder.start();
    await new Promise((resolve) => setTimeout(resolve, 300));
    recorder.stop();
    await finished;
    stream.getTracks().forEach((track) => track.stop());
    return Array.from(new Uint8Array(await new Blob(blobs).arrayBuffer()));
  });
  const wav = Buffer.alloc(44 + 8000 * 2);
  wav.write("RIFF", 0);
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(8000, 24);
  wav.writeUInt32LE(16000, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(wav.length - 44, 40);
  const midi = new Midi();
  midi.header.setTempo(90);
  midi
    .addTrack()
    .addNote({ midi: 60, time: 0, duration: 0.5, velocity: 0.8 })
    .addCC({ number: 64, time: 0.1, value: 1 });
  for (const file of [
    {
      block: "VIDEO",
      label: "video",
      name: "example.webm",
      mimeType: "video/webm",
      buffer: Buffer.from(video),
    },
    {
      block: "AUDIO",
      label: "audio",
      name: "example.wav",
      mimeType: "audio/wav",
      buffer: wav,
    },
    {
      block: "MIDI_EXERCISE",
      label: "MIDI",
      name: "example.mid",
      mimeType: "audio/midi",
      buffer: Buffer.from(midi.toArray()),
    },
  ]) {
    await page
      .getByRole("combobox", { name: "Block type", exact: true })
      .selectOption(file.block);
    await page.getByRole("button", { name: "Add block", exact: true }).click();
    await page
      .getByLabel(`Choose ${file.label} file`, { exact: true })
      .setInputFiles(file);
    await page
      .getByRole("button", { name: `Upload ${file.label}`, exact: true })
      .click();
    await expect(
      page.getByRole("status").filter({
        hasText: `${file.name} ${file.label === "MIDI" ? "imported" : "uploaded"} and selected`,
      }),
    ).toBeVisible();
  }
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  expect(videoPartRequests).toBeGreaterThan(1);
  await expect(page.getByText("Draft saved.", { exact: true })).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("combobox", { name: "Recording", exact: true }),
  ).not.toHaveValue("");
  await page
    .getByRole("button", { name: "Preview as student", exact: true })
    .click();
  await expect(page.locator("video")).toBeVisible();
  await expect(page.locator("audio")).toBeVisible();
  await expect
    .poll(() =>
      page.locator("video").evaluate((v: HTMLVideoElement) => v.readyState),
    )
    .toBeGreaterThanOrEqual(2);
  await expect
    .poll(() =>
      page.locator("audio").evaluate((a: HTMLAudioElement) => a.readyState),
    )
    .toBeGreaterThanOrEqual(2);
  await expect(
    page.getByRole("button", { name: "Start attempt", exact: true }),
  ).toBeVisible();
});
