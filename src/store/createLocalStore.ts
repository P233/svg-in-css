import { createEffect, createRoot, createSignal, type Accessor } from "solid-js";
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
): [Store<T>, SetStoreFunction<T>, Accessor<Error | undefined>] {
  const [state, setState] = createStore<T>(loadStoredState(init, restore));
  const [persistenceError, setPersistenceError] = createSignal<Error>();

  createRoot(() => {
    createEffect(() => {
      try {
        const serialized = JSON.stringify(state);
        localStorage.setItem(STORAGE_KEY, serialized);
        setPersistenceError(undefined);
      } catch (error) {
        setPersistenceError(
          error instanceof Error ? error : new Error("Could not save configuration", { cause: error })
        );
      }
    });
  });

  return [state, setState, persistenceError];
}
