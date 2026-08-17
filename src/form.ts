export interface Training {
  id: string;
  title: string;
  date: string;
  time: string;
  speaker: string;
  active: boolean;
}

export const INSTITUTIONS = ["ВНТУ", "ВНМУ", "ВНАУ", "ВДПУ", "ДонНУ"] as const;
export const COURSES = ["1", "2", "3", "4", "магістр"] as const;
export const DISCOVERY_SOURCES = [
  "Живі оголошення",
  "Від знайомих",
  "Із соціальних мереж",
] as const;

export const TRAININGS: readonly Training[] = [
  {
    id: "cybersecurity",
    title: "Кібербезпека та безпечна цифрова поведінка",
    date: "10 листопада",
    time: "17:00",
    speaker: "Ольга Гунько",
    active: true,
  },
  {
    id: "communication",
    title: "Як говорити, щоб тебе уважно слухали, довіряли і запам’ятовували",
    date: "11 листопада",
    time: "17:00",
    speaker: "Ольга Сольвар",
    active: true,
  },
  {
    id: "business",
    title: "Як почати бізнес з нуля без стартового капіталу",
    date: "12 листопада",
    time: "17:00",
    speaker: "Оксана Ломич",
    active: true,
  },
  {
    id: "change",
    title: "Як подолати страх змін і почати діяти",
    date: "13 листопада",
    time: "17:00",
    speaker: "Світлана Пенькова",
    active: true,
  },
  {
    id: "interior",
    title: "Як створити інтер’єр, який працює. Дизайн і психологія",
    date: "14 листопада",
    time: "17:00",
    speaker: "Олег Горюн",
    active: true,
  },
  {
    id: "tourism",
    title: "Туризм. Як подорожі змінюють людей і розширюють світогляд",
    date: "15 листопада",
    time: "11:00",
    speaker: "Оксана Кнапдійс",
    active: true,
  },
  {
    id: "marketing",
    title: "Довіра — нова валюта маркетингу. Як надихати, а не продавати",
    date: "16 листопада",
    time: "11:00",
    speaker: "Антон Горін",
    active: true,
  },
];

export function getTraining(id: string): Training | undefined {
  return TRAININGS.find((training) => training.id === id);
}

export function getTrainingLabel(training: Training): string {
  return `${training.date} | ${training.time} | ${training.speaker} | ${training.title}`;
}

export function getTrainingDate(training: Training): string {
  return training.date;
}
