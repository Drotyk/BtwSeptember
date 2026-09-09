import type { Context } from "grammy";

import type { RulesService } from "../services/rules.service.js";
import { rulesConsentKeyboard, rulesViewKeyboard } from "./keyboards.js";

export async function sendRules(
  ctx: Context,
  rulesService: RulesService,
  includeAcceptance = false,
  includeRegistrationReturn = false,
): Promise<void> {
  const rules = await rulesService.getCurrentRules();
  const chunks = [...rules.chunks];
  const lastChunk = chunks.length - 1;
  const replyMarkup = includeAcceptance
    ? rulesConsentKeyboard()
    : includeRegistrationReturn
      ? rulesViewKeyboard()
      : undefined;

  if (chunks.length === 0) {
    await ctx.reply("Правила BTW", replyMarkup ? { reply_markup: replyMarkup } : undefined);
    return;
  }

  for (const [index, chunk] of chunks.entries()) {
    if (index !== lastChunk) {
      await ctx.reply(chunk);
      continue;
    }

    if (replyMarkup) await ctx.reply(chunk, { reply_markup: replyMarkup });
    else await ctx.reply(chunk);
  }
}
