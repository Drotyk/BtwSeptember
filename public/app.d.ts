export function formatDate(value: string | Date | null | undefined): string;
export function pluralizeTrainings(count: number): string;
export function formatTrainingCount(trainingIds: string[] | null | undefined): string;
export function parseTrainingLabel(label: string): {
  date: string;
  time: string;
  speaker: string;
  title: string;
};
export function formatStatisticNumber(value: number | string | null | undefined): string;
export function createStatisticsRow(item: unknown, maxCount: number): HTMLElement;
export function createUserRow(user: unknown, onOpen: () => void): HTMLTableRowElement;
export function createUserCard(user: unknown, onOpen: () => void): HTMLElement;
export function createIncompleteRegistrationRow(registration: unknown): HTMLTableRowElement;
export function createDetailSection(title: string, fields: unknown): HTMLElement;
export function createConsentBadge(accepted: boolean, at: string | null | undefined): HTMLElement;
export function createDrawerContent(user: unknown): HTMLElement;
export function init(): void;
