import type { DateFormatId } from './frames/dateStamp';
import type { Facing } from './guidance/types';
import { load, save } from './lib/storage';
import { createStore, useStore } from './lib/store';

export interface Settings {
  onboarded: boolean;
  grid: boolean;
  guidance: boolean;
  level: boolean;
  dateFormat: DateFormatId;
  /** Android: use ImageCapture.takePhoto() for full-sensor stills when it works. */
  fullSensor: boolean;
  lastFacing: Facing;
  /** Use the generated demo scene instead of a real camera. */
  demoCamera: boolean;
  /** When the "save favourites to Photos" reminder was last dismissed. */
  backupReminderDismissedAt: number;
}

export const DEFAULT_SETTINGS: Settings = {
  onboarded: false,
  grid: true,
  guidance: true,
  level: true,
  dateFormat: 'yy-mm-dd',
  fullSensor: true,
  lastFacing: 'environment',
  demoCamera: false,
  backupReminderDismissedAt: 0,
};

export const settingsStore = createStore<Settings>(load('settings', DEFAULT_SETTINGS), (s) => save('settings', s));

export const useSettings = () => useStore(settingsStore);
export const setSettings = settingsStore.set;
