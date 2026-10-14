import { createEffect, createRoot } from "solid-js";
import { createStore, SetStoreFunction, Store } from "solid-js/store";

const STORAGE_KEY = "APP_STORE";

function loadStoredState<T extends object>(init: T, validate?: (value: unknown) => value is T): T {
  try {
    const localState = localStorage.getItem(STORAGE_KEY);
    if (!localState) return init;
    const parsed: unknown = JSON.parse(localState);
    if (!validate || validate(parsed)) {
      return parsed as T;
    }
  } catch {
    // Fallback to initial state when localStorage is unavailable or corrupted
  }
  return init;
}

export default function createLocalStore<T extends object>(
  init: T,
  validate?: (value: unknown) => value is T
): [Store<T>, SetStoreFunction<T>] {
  const [state, setState] = createStore<T>(loadStoredState(init, validate));

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
