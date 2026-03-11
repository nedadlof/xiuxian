import { bindTooltips } from './tooltipBinder.js';
import { bindAppEvents } from './eventBinder.js';
import { scheduleWarAutoBattle, scheduleWarReplay, syncReplayAfterWarAction } from './warSchedulers.js';

function hydrateRenderedUi({ root, app, uiState, helpers = {} }) {
  const {
    renderGame,
    setTransientUiFeedback,
  } = helpers;

  bindAppEvents({
    root,
    app,
    uiState,
    helpers: {
      renderGame,
      setTransientUiFeedback,
      syncReplayAfterWarAction,
    },
  });

  bindTooltips(root);
  scheduleWarReplay(root, app, uiState, { renderGame });
  scheduleWarAutoBattle(root, app, uiState, {
    renderGame,
    syncReplayAfterWarAction: (nextUiState, nextApp) => syncReplayAfterWarAction(nextUiState, nextApp, { setTransientUiFeedback }),
  });
}

export { hydrateRenderedUi };
