export function appendLog(draft, category, message) {
  draft.logs.unshift({
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    category,
    message,
    createdAt: Date.now(),
  });

  draft.logs = draft.logs.slice(0, 80);
}
