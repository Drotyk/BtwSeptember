export interface Training {
  id: string;
  title: string;
  date: string;
  time: string;
  speaker: string;
  active: boolean;
}

export const INSTITUTIONS = ["ВНТУ", "ВТФК", "ВНАУ", "ВДПУ", "ДонНУ", "ХНУВС"] as const;
export const COURSES = ["1", "2", "3", "4", "магістр"] as const;
export const DISCOVERY_SOURCES = [
  "Живі оголошення",
  "Від знайомих",
  "Із соціальних мереж",
] as const;

export const TRAININGS: readonly Training[] = [
  {
    id: "leadership",
    title: "«Лідерство та командна робота: як об'єднувати людей і вести за собою»",
    date: "14.09",
    time: "15:00",
    speaker: "Сергій Притула",
    active: true,
  },
  {
    id: "self-realization",
    title: "«Як реалізувати себе після навчання: знайти хорошу роботу чи створити власну справу?»",
    date: "15.09",
    time: "17:00",
    speaker: "Грабовський Олександр",
    active: true,
  },
  {
    id: "acting",
    title: "«Акторська майстерність на сцені та в житті»",
    date: "16.09",
    time: "17:00",
    speaker: "Костянтин Боровик",
    active: true,
  },
  {
    id: "first-job",
    title: "«Як знайти першу роботу: з чого почати, коли ще немає великого досвіду»",
    date: "17.09",
    time: "17:00",
    speaker: "Сергій Андрощук",
    active: true,
  },
];

export function getTraining(id: string): Training | undefined {
  return TRAININGS.find((training) => training.id === id);
}

export function getTrainingLabel(training: Training): string {
  return training.time
    ? `${training.date} | ${training.time} | ${training.speaker} | ${training.title}`
    : `${training.date} | ${training.speaker} | ${training.title}`;
}

export function getTrainingDate(training: Training): string {
  return training.time ? `${training.date} | ${training.time}` : training.date;
}
