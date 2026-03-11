function setTransientUiFeedback(uiState, key, message) {
  if (!uiState || !key) return;
  if (!uiState.transientFeedback) uiState.transientFeedback = {};
  uiState.transientFeedback[key] = { message, createdAt: Date.now() };
}

function getTransientUiFeedback(uiState, key, durationMs) {
  const entry = uiState?.transientFeedback?.[key];
  if (!entry) return null;

  const elapsedMs = Date.now() - (entry.createdAt ?? 0);
  if (durationMs != null && elapsedMs > durationMs) {
    delete uiState.transientFeedback[key];
    return null;
  }
  return entry;
}

export { setTransientUiFeedback, getTransientUiFeedback };

