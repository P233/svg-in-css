import { createEffect, createRoot } from "solid-js";
import { createStore, SetStoreFunction, Store } from "solid-js/store";

const STORAGE_KEY = "APP_STORE";

function loadStoredState<T extends object>(init: T, restore: (value: unknown) => T | undefined): T {
  try {
    const localState = localStorage.getItem(STORAGE_KEY);
    if (!localState) return init;
    return restore(JSON.parse(localState)) ?? init;
  } catch {
    // Fallback to initial state when localStorage is unavailable or corrupted
  }
  return init;
}

export default function createLocalStore<T extends object>(
  init: T,
  restore: (value: unknown) => T | undefined
): [Store<T>, SetStoreFunction<T>] {
  const [state, setState] = createStore<T>(loadStoredState(init, restore));

  createRoot(() => {
    createEffect(() => {
      const serialized = JSON.stringify(state);
      try {
        localStorage.setItem(STORAGE_KEY, serialized);
      } catch {
        // Ignore storage quota or private browsing errors
      }
    });
  });

  return [state, setState];
}
