import type { RegistrationState, RegistrationStep } from "./types.js";

export function hasStep(state: RegistrationState | undefined, step: RegistrationStep): boolean {
  return state?.step === step;
}

export function updateState(
  state: RegistrationState | undefined,
  step: RegistrationStep,
  values: Partial<RegistrationState> = {},
): RegistrationState {
  return { ...state, ...values, step };
}

export function selectedTrainingIds(state: RegistrationState): string[] {
  return [...new Set(state.trainingIds ?? [])];
}

export function toggleTraining(state: RegistrationState, trainingId: string): RegistrationState {
  const selected = new Set(selectedTrainingIds(state));
  if (selected.has(trainingId)) selected.delete(trainingId);
  else selected.add(trainingId);
  return { ...state, trainingIds: [...selected].sort() };
}
