import { useCallback, useState } from "react";

let nextId = 1;
const listeners = new Set();
let currentToasts = [];

function emit() { listeners.forEach((listener) => listener(currentToasts)); }
export function toast(input) { const item = { id: String(nextId++), ...(typeof input === "string" ? { description: input } : input) }; currentToasts = [...currentToasts, item]; emit(); return { id: item.id, dismiss: () => dismiss(item.id) }; }
export function dismiss(id) { currentToasts = id ? currentToasts.filter((item) => item.id !== id) : []; emit(); }
export function useToast() { const [toasts, setToasts] = useState(currentToasts); const subscribe = useCallback((listener) => { listeners.add(listener); return () => listeners.delete(listener); }, []); useState(() => subscribe(setToasts)); return { toasts, toast, dismiss }; }
