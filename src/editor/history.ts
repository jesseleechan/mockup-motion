export interface History<T> {
  past: T[];
  present: T;
  future: T[];
}
export function commit<T>(history: History<T>, next: T): History<T> {
  if (history.present === next) return history;
  return {
    past: [...history.past, history.present].slice(-60),
    present: next,
    future: [],
  };
}
export function undo<T>(h: History<T>): History<T> {
  return h.past.length
    ? {
        past: h.past.slice(0, -1),
        present: h.past[h.past.length - 1],
        future: [h.present, ...h.future],
      }
    : h;
}
export function redo<T>(h: History<T>): History<T> {
  return h.future.length
    ? {
        past: [...h.past, h.present],
        present: h.future[0],
        future: h.future.slice(1),
      }
    : h;
}
