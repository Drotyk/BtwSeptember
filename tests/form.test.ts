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

  it("matches the supplied September schedule", () => {
    expect(TRAININGS.map(({ date, speaker, title }) => ({ date, speaker, title }))).toEqual([
      {
        date: "14.09",
        speaker: "Сергій Притула",
        title: "«Лідерство та командна робота: як об’єднувати людей і вести за собою»",
      },
      {
        date: "15.09",
        speaker: "Грабовський Олександр",
        title:
          "«Як реалізувати себе після навчання: знайти хорошу роботу чи створити власну справу?»",
      },
      {
        date: "16.09",
        speaker: "Костянтин Боровик",
        title: "«Акторська майстерність на сцені та в житті»",
      },
      {
        date: "17.09",
        speaker: "Сергій Андрощук",
        title: "«Як знайти першу роботу: з чого почати, коли ще немає великого досвіду»",
      },
    ]);
    expect(TRAININGS.every((training) => training.time === "")).toBe(true);
  });
});
