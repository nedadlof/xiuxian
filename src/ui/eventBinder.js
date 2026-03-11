import { handleWarUiAction } from './warEvents.js';
import { handleCoreUiAction } from './coreEvents.js';
import { handleEconomyUiAction } from './economyEvents.js';
import { handleScriptureUiAction } from './scriptureEvents.js';
import { handleTradeUiAction } from './tradeEvents.js';
import { handleDisciplesUiAction } from './disciplesEvents.js';
import { handleBeastsUiAction } from './beastsEvents.js';
import { handleMissionsUiAction } from './missionsEvents.js';

function bindAppEvents({ root, app, uiState, helpers = {} }) {
  const {
    renderGame,
    setTransientUiFeedback,
    syncReplayAfterWarAction,
  } = helpers;

  root.querySelectorAll('[data-action]').forEach((element) => {
    element.addEventListener('click', () => {
      const { action } = element.dataset;
      const state = app.store.getState();

      if (handleWarUiAction({
        action,
        element,
        root,
        app,
        uiState,
        state,
        helpers: {
          renderGame,
          syncReplayAfterWarAction: (nextUiState, nextApp) => syncReplayAfterWarAction(nextUiState, nextApp, { setTransientUiFeedback }),
          setTransientUiFeedback,
        },
      })) {
        return;
      }
      if (handleCoreUiAction({ action, element, app })) return;
      if (handleEconomyUiAction({ action, element, app })) return;
      if (handleScriptureUiAction({ action, element, app })) return;
      if (handleTradeUiAction({ action, element, app })) return;
      if (handleDisciplesUiAction({ action, element, root, app, uiState, state, helpers: { renderGame } })) return;
      if (handleBeastsUiAction({ action, element, app })) return;
      if (handleMissionsUiAction({ action, element, app })) return;
    });
  });
}

export { bindAppEvents };
