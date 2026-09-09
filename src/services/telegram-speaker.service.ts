import { InputFile, InlineKeyboard } from "grammy";

import { TRAININGS, getTraining } from "../form.js";
import { getSpeakerAsset, speakerAssetId, speakerAssetPath } from "../speaker-assets.js";
import type { SpeakerRecord, SpeakerRepository } from "../repositories/speakers.repository.js";
import type { BotContext } from "../bot/types.js";

export const SPEAKERS_MENU_LABEL = "🎤 Спікери";
export const ALL_SPEAKERS_ID = "all";
const EMPTY_SPEAKERS_MESSAGE =
  "🎤 Спікери\n\nНаразі інформація про спікерів\nще не опублікована.\n\nСпробуйте перевірити пізніше.";

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function captionDescription(value: string): string {
  const escaped = escapeHtml(value);
  if (escaped.length <= 800) return escaped;
  const candidate = escaped.slice(0, 800);
  const lastAmpersand = candidate.lastIndexOf("&");
  const lastSemicolon = candidate.lastIndexOf(";");
  const safe = lastAmpersand > lastSemicolon ? candidate.slice(0, lastAmpersand) : candidate;
  return `${safe}…`;
}

function caption(speaker: SpeakerRecord, index: number, total: number): string {
  const training = getTraining(speaker.trainingId);
  const timeLabel = training?.time ? ` | ${training.time}` : "";
  const dateLabel = training ? ` | ${training.date}${timeLabel}` : "";
  return `🎤 <b>${escapeHtml(speaker.name)}</b>${dateLabel}\n\n${captionDescription(speaker.description)}\n\n${index + 1} / ${total}`;
}

function detailsCaption(speaker: SpeakerRecord): string {
  return `🎤 <b>${escapeHtml(speaker.name)}</b>\n\n${captionDescription(speaker.detailedDescription)}`;
}

export function speakersKeyboard(
  trainingId: string,
  index: number,
  total: number,
  details = false,
): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  if (details) {
    return keyboard.text("⬅️ До спікерів", `speakers:${trainingId}:back:${index}`);
  }
  keyboard
    .text("◀️", `speakers:${trainingId}:prev:${index}`)
    .text(`${index + 1} / ${total}`, `speakers:${trainingId}:noop:${index}`)
    .text("▶️", `speakers:${trainingId}:next:${index}`)
    .row()
    .text("📖 Детальніше", `speakers:${trainingId}:details:${index}`);
  return keyboard;
}

function activeWithPhotos(speakers: SpeakerRecord[]): SpeakerRecord[] {
  return speakers.filter((speaker) => speaker.isActive && Boolean(speaker.photoFileId));
}

function photoSource(photoFileId: string): string | InputFile {
  const assetId = speakerAssetId(photoFileId);
  const asset = assetId ? getSpeakerAsset(assetId) : undefined;
  return asset ? new InputFile(speakerAssetPath(asset)) : photoFileId;
}

function speakersForScope(repository: SpeakerRepository, scope: string): Promise<SpeakerRecord[]> {
  return repository.list(scope === ALL_SPEAKERS_ID ? undefined : scope, true);
}

export async function showSpeakerTrainingSelection(
  ctx: BotContext,
  repository: SpeakerRepository,
): Promise<void> {
  const trainingIds = new Set(
    (await repository.list(undefined, true)).map((speaker) => speaker.trainingId),
  );
  const trainings = TRAININGS.filter((training) => training.active && trainingIds.has(training.id));
  if (trainings.length === 0) {
    await ctx.reply(EMPTY_SPEAKERS_MESSAGE);
    return;
  }

  const keyboard = new InlineKeyboard();
  for (const training of trainings) {
    const timeLabel = training.time ? ` | ${training.time}` : "";
    keyboard.text(`${training.date}${timeLabel} - ${training.title}`, `speakers:select:${training.id}`).row();
  }
  await ctx.reply("🎤 Спікери\n\nВиберіть тренінг:", { reply_markup: keyboard });
}

export async function showFirstSpeaker(
  ctx: BotContext,
  repository: SpeakerRepository,
  scope = ALL_SPEAKERS_ID,
): Promise<void> {
  const speakers = activeWithPhotos(await speakersForScope(repository, scope));
  if (speakers.length === 0) {
    await ctx.reply(EMPTY_SPEAKERS_MESSAGE);
    return;
  }
  const speaker = speakers[0];
  if (!speaker?.photoFileId) return;
  await ctx.replyWithPhoto(photoSource(speaker.photoFileId), {
    caption: caption(speaker, 0, speakers.length),
    parse_mode: "HTML",
    reply_markup: speakersKeyboard(scope, 0, speakers.length),
  });
}

export async function editSpeakerCarousel(
  ctx: BotContext,
  repository: SpeakerRepository,
  trainingId: string,
  requestedIndex: number,
  action: "prev" | "next" | "back" = "next",
): Promise<void> {
  const speakers = activeWithPhotos(await speakersForScope(repository, trainingId));
  if (speakers.length === 0) {
    await ctx.editMessageCaption({ caption: EMPTY_SPEAKERS_MESSAGE, reply_markup: undefined });
    return;
  }

  const boundedIndex = Math.min(Math.max(requestedIndex, 0), speakers.length - 1);
  const index =
    action === "prev"
      ? (boundedIndex - 1 + speakers.length) % speakers.length
      : action === "next"
        ? (boundedIndex + 1) % speakers.length
        : boundedIndex;
  const speaker = speakers[index];
  if (!speaker?.photoFileId) return;

  await ctx.editMessageMedia(
    {
      type: "photo",
      media: photoSource(speaker.photoFileId),
      caption: caption(speaker, index, speakers.length),
      parse_mode: "HTML",
    },
    { reply_markup: speakersKeyboard(trainingId, index, speakers.length) },
  );
}

export async function showSpeakerDetails(
  ctx: BotContext,
  repository: SpeakerRepository,
  trainingId: string,
  requestedIndex: number,
): Promise<void> {
  const speakers = activeWithPhotos(await speakersForScope(repository, trainingId));
  if (speakers.length === 0) {
    await ctx.editMessageCaption({ caption: EMPTY_SPEAKERS_MESSAGE, reply_markup: undefined });
    return;
  }
  const index = Math.min(Math.max(requestedIndex, 0), speakers.length - 1);
  const speaker = speakers[index];
  if (!speaker) return;
  await ctx.editMessageCaption({
    caption: detailsCaption(speaker),
    parse_mode: "HTML",
    reply_markup: speakersKeyboard(trainingId, index, speakers.length, true),
  });
}
