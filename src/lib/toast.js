const listeners = new Set();
let idCounter = 0;

export function subscribeToast(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function showToast(message, type = 'info') {
  const toast = { id: ++idCounter, message, type };
  listeners.forEach((fn) => fn(toast));
}
