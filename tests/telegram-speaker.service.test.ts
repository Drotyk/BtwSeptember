import { describe, expect, it, vi } from "vitest";
import { InputFile } from "grammy";

import {
  editSpeakerCarousel,
  showFirstSpeaker,
  showSpeakerDetails,
  speakersKeyboard,
} from "../src/services/telegram-speaker.service.js";
import type { SpeakerRecord, SpeakerRepository } from "../src/repositories/speakers.repository.js";

const speaker = (
  id: string,
  name: string,
  sortOrder: number,
  photoFileId = `photo-${id}`,
): SpeakerRecord => ({
  id,
  trainingId: "cybersecurity",
  name,
  description: "Опис <важливий> & безпечний",
  detailedDescription: "Детальний опис <важливий> & безпечний",
  photoFileId,
  sortOrder,
  isActive: true,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
});

function repository(records: SpeakerRecord[]): SpeakerRepository {
  return {
    list: vi.fn(async () => records),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
}

describe("Telegram speaker carousel", () => {
  it("uses short structured callbacks and dynamic total", () => {
    const keyboard = speakersKeyboard("cybersecurity", 1, 3);
    const callbacks = keyboard.inline_keyboard
      .flat()
      .map((button) => ("callback_data" in button ? button.callback_data : ""));
    expect(callbacks).toContain("speakers:cybersecurity:next:1");
    expect(callbacks).toContain("speakers:cybersecurity:details:1");
  });

  it("sends the first speaker with escaped HTML and 1 / N", async () => {
    const replyWithPhoto = vi.fn<(photo: string, options: { caption: string }) => void>();
    const ctx = { replyWithPhoto, reply: vi.fn() } as never;
    await showFirstSpeaker(
      ctx,
      repository([speaker("1", "<Євген>", 1), speaker("2", "Анна", 2)]),
      "cybersecurity",
    );
    expect(replyWithPhoto).toHaveBeenCalled();
    const options = replyWithPhoto.mock.calls[0]?.[1];
    expect(options?.caption).toContain("&lt;Євген&gt;");
    expect(options?.caption).toContain("1 / 2");
  });

  it("shows the first speaker from the global carousel by default", async () => {
    const replyWithPhoto = vi.fn();
    const ctx = { replyWithPhoto, reply: vi.fn() } as never;
    const repo = repository([speaker("1", "Євген", 1), speaker("2", "Анна", 2)]);
    await showFirstSpeaker(ctx, repo);
    expect(repo.list).toHaveBeenCalledWith(undefined, true);
    expect(replyWithPhoto).toHaveBeenCalled();
  });

  it("uploads a bundled asset as a local file", async () => {
    const replyWithPhoto = vi.fn();
    const ctx = { replyWithPhoto, reply: vi.fn() } as never;
    await showFirstSpeaker(
      ctx,
      repository([speaker("1", "Сергій Притула", 1, "asset:serhiy-prytula")]),
      "cybersecurity",
    );
    expect(replyWithPhoto.mock.calls[0]?.[0]).toBeInstanceOf(InputFile);
  });

  it("edits media for next and caption for details, never sends a new message", async () => {
    const editMessageCaption = vi.fn();
    const ctx = { editMessageMedia: vi.fn(), editMessageCaption } as never;
    const repo = repository([speaker("1", "Євген", 1), speaker("2", "Анна", 2)]);
    await editSpeakerCarousel(ctx, repo, "cybersecurity", 0, "next");
    expect(ctx.editMessageMedia).toHaveBeenCalled();
    await showSpeakerDetails(ctx, repo, "cybersecurity", 1);
    expect(ctx.editMessageCaption).toHaveBeenCalled();
    const detailsOptions = editMessageCaption.mock.calls[0]?.[0] as
      { caption?: string } | undefined;
    expect(detailsOptions?.caption).toContain("Детальний опис &lt;важливий&gt; &amp; безпечний");
  });

  it("handles an empty list without a media message", async () => {
    const ctx = { reply: vi.fn() } as never;
    await showFirstSpeaker(ctx, repository([]), "cybersecurity");
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining("ще не опублікована"));
  });
});
