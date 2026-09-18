import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { CustomerDataController } from "./state";
import type { DevelopmentDataAdapter } from "./development";
const Context = createContext<{
  controller: CustomerDataController;
  development?: DevelopmentDataAdapter;
  setDirty: (dirty: boolean) => void;
  guardNavigation: (action: () => void) => void;
} | null>(null);
export function CustomerDataProvider({
  controller,
  development,
  children,
}: {
  controller: CustomerDataController;
  development?: DevelopmentDataAdapter;
  children: ReactNode;
}) {
  const dirty = useRef(false);
  const [pending, setPending] = useState<(() => void) | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    void controller.load();
  }, [controller]);
  useEffect(() => {
    if (pending) dialog.current?.showModal();
  }, [pending]);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (dirty.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, []);
  return (
    <Context.Provider
      value={{
        controller,
        development,
        setDirty: (value) => {
          dirty.current = value;
        },
        guardNavigation: (action) => {
          if (dirty.current) setPending(() => action);
          else action();
        },
      }}
    >
      {children}
      {pending && (
        <dialog
          ref={dialog}
          aria-labelledby="discard-title"
          onCancel={() => setPending(null)}
          className="customer-dialog rounded-3xl p-6"
        >
          <h2 id="discard-title" className="text-xl font-black">
            Discard unsaved address changes?
          </h2>
          <p className="my-4">
            Your changes will be lost when you leave this form.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              autoFocus
              className="customer-button"
              onClick={() => {
                dialog.current?.close();
                setPending(null);
              }}
            >
              Keep editing
            </button>
            <button
              className="customer-button"
              onClick={() => {
                dirty.current = false;
                dialog.current?.close();
                setPending(null);
                pending();
              }}
            >
              Discard changes
            </button>
          </div>
        </dialog>
      )}
    </Context.Provider>
  );
}
export function useCustomer() {
  const context = useContext(Context);
  if (!context) throw new Error("Customer provider required.");
  const state = useSyncExternalStore(
    context.controller.subscribe,
    context.controller.getSnapshot,
    context.controller.getSnapshot,
  );
  return { ...context, state };
}
