import { describe, expect, it } from "vitest";

import { TRAININGS, getTraining, getTrainingDate, getTrainingLabel } from "../src/form.js";

describe("BTW training configuration", () => {
  it("contains structured active training data", () => {
    const training = TRAININGS[0];
    expect(training).toBeDefined();
    expect(training.id).toBeTruthy();
    expect(getTraining(training.id)).toEqual(training);
    expect(getTrainingDate(training)).toBe(training.date);
    expect(getTrainingLabel(training)).toContain(training.speaker);
    expect(getTraining("missing")).toBeUndefined();
  });
});
