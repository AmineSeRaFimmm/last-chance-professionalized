import { EXERCISE_GIF_ASSETS, getExerciseGifUrl, getExerciseThumbUrl } from "./exerciseGifMap";
import { warmPersistentImageCache } from "./imageCache";
import { loadCustomWorkoutPlan } from "../storage/customWorkoutPlan";

export function startStartupGifPreload(): void {
  if (typeof window === "undefined") return;

  window.setTimeout(() => {
    const builtInAssets = Object.values(EXERCISE_GIF_ASSETS);
    const builtInThumbs = builtInAssets.map(getExerciseThumbUrl);
    const builtInGifs = builtInAssets.map(getExerciseGifUrl);
    const savedCustomPlan = loadCustomWorkoutPlan();
    const savedCustomMedia = savedCustomPlan?.days.flatMap((day) => day.exercises.flatMap((exercise) => [exercise.thumbUrl, exercise.gifUrl])) ?? [];

    warmPersistentImageCache([
      ...savedCustomMedia,
      ...builtInThumbs,
      ...builtInGifs
    ], 96, 2);
  }, 1200);
}
