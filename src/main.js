import { createGameApp } from './app.js?v=20260313-ui-refresh';
import { renderGame } from './ui/renderApp.js?v=20260313-ui-refresh';

const root = document.getElementById('app');
const uiState = {};
const app = createGameApp();

function showFatalError(error) {
  console.error(error);
  if (!root) return;
  const message = error instanceof Error ? (error.stack || error.message) : String(error);
  root.innerHTML = `
    <div class="panel">
      <div class="panel-title"><h3>\u9875\u9762\u6e32\u67d3\u51fa\u9519</h3><span class="tag">\u8bf7\u6253\u5f00\u63a7\u5236\u53f0\u67e5\u770b\u8be6\u60c5</span></div>
      <pre style="white-space:pre-wrap;word-break:break-word;margin:0;">${message}</pre>
    </div>
  `;
}

function safeRender() {
  try {
    renderGame(root, app, uiState);
  } catch (error) {
    showFatalError(error);
  }
}

app.store.subscribe(() => {
  safeRender();
});

window.addEventListener('error', (event) => {
  if (event?.error) showFatalError(event.error);
});
window.addEventListener('unhandledrejection', (event) => {
  showFatalError(event?.reason ?? event);
});

safeRender();
app.start();

window.addEventListener('beforeunload', () => {
  app.stopAutosave();
  app.saveManager.save();
});

window.__gameApp = app;
