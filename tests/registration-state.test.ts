import { describe, expect, it } from "vitest";

import {
  hasStep,
  selectedTrainingIds,
  toggleTraining,
  updateState,
} from "../src/bot/registration-state.js";
import type { RegistrationState } from "../src/bot/types.js";

const state: RegistrationState = { step: "trainings", trainingIds: ["business"] };

describe("registration state", () => {
  it("uses explicit steps and preserves values", () => {
    expect(hasStep(state, "trainings")).toBe(true);
    expect(hasStep(state, "course")).toBe(false);
    expect(updateState(state, "source", { discoverySource: "мережі" })).toEqual({
      step: "source",
      trainingIds: ["business"],
      discoverySource: "мережі",
    });
  });

  it("toggles training selection without duplicates", () => {
    expect(toggleTraining(state, "business").trainingIds).toEqual([]);
    expect(toggleTraining(state, "marketing").trainingIds).toEqual(["business", "marketing"]);
    expect(
      selectedTrainingIds({ step: "trainings", trainingIds: ["business", "business"] }),
    ).toEqual(["business"]);
    expect(selectedTrainingIds({ step: "trainings" })).toEqual([]);
  });
});
