import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { CustomerSessionController } from "../session/controller";
import { loadSupportWhatsApp } from "./config";

const SupportContext = createContext("");
export const useSupportWhatsApp = () => useContext(SupportContext);
export function SupportProvider({
  origin,
  session,
  children,
}: {
  origin: string;
  session: CustomerSessionController;
  children: ReactNode;
}) {
  const [digits, setDigits] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    void session
      .withCredentials(() =>
        loadSupportWhatsApp(origin, undefined, 5000, controller.signal),
      )
      .then((value) => {
        if (!controller.signal.aborted) setDigits(value);
      })
      .catch(() => {
        if (!controller.signal.aborted) setDigits("");
      });
    return () => controller.abort();
  }, [origin, session]);
  return (
    <SupportContext.Provider value={digits}>{children}</SupportContext.Provider>
  );
}
