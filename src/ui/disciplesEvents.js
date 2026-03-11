function handleDisciplesUiAction({ action, element, root, app, uiState, state, helpers }) {
  const { renderGame } = helpers ?? {};

  switch (action) {
    case 'recruit-normal':
      app.bus.emit('action:disciples/recruitPool', { mode: 'standard', count: Number(element.dataset.count) || 1 });
      return true;
    case 'recruit-advanced':
      app.bus.emit('action:disciples/recruitPool', { mode: 'advanced', count: Number(element.dataset.count) || 1 });
      return true;
    case 'recruit-faction':
      app.bus.emit('action:disciples/recruitPool', {
        mode: 'faction',
        count: Number(element.dataset.count) || 1,
        factionId: element.dataset.faction || null,
      });
      return true;
    case 'recruit-targeted':
      app.bus.emit('action:disciples/recruit', { discipleId: state.disciples.recruit?.focusId ?? null });
      return true;
    case 'set-recruit-faction':
      app.bus.emit('action:disciples/setRecruitFaction', { factionId: element.dataset.faction || null });
      return true;
    case 'set-recruit-focus':
      app.bus.emit('action:disciples/setRecruitFocus', { discipleId: element.dataset.id });
      return true;
    case 'clear-recruit-focus':
      app.bus.emit('action:disciples/setRecruitFocus', { discipleId: null });
      return true;
    case 'buy-recruit-token':
      app.bus.emit('action:disciples/buyRecruitToken', { resourceId: element.dataset.resource });
      return true;
    case 'recruit-disciple':
      app.bus.emit('action:disciples/recruit', { discipleId: element.dataset.id });
      return true;
    case 'station-disciple':
      app.bus.emit('action:disciples/station', { discipleId: element.dataset.id, buildingId: element.dataset.building });
      return true;
    case 'set-leader':
      uiState.pendingTeam = {
        ...(uiState.pendingTeam ?? {}),
        leaderId: element.dataset.id,
        supportIds: [...(uiState.pendingTeam?.supportIds ?? state.disciples.expeditionTeam?.supportIds ?? [])]
          .filter((id) => id !== element.dataset.id)
          .slice(0, 2),
      };
      renderGame?.(root, app, uiState);
      return true;
    case 'toggle-support': {
      const supportIds = [...(uiState.pendingTeam?.supportIds ?? state.disciples.expeditionTeam?.supportIds ?? [])];
      const discipleId = element.dataset.id;
      const exists = supportIds.includes(discipleId);
      const next = exists
        ? supportIds.filter((item) => item !== discipleId)
        : [...supportIds.filter((item) => item !== (uiState.pendingTeam?.leaderId ?? state.disciples.expeditionTeam?.leaderId ?? null)), discipleId].slice(0, 2);
      uiState.pendingTeam = {
        leaderId: uiState.pendingTeam?.leaderId ?? state.disciples.expeditionTeam?.leaderId ?? null,
        supportIds: next,
      };
      renderGame?.(root, app, uiState);
      return true;
    }
    case 'apply-team':
      app.bus.emit('action:disciples/assignExpedition', {
        leaderId: uiState.pendingTeam?.leaderId ?? state.disciples.expeditionTeam?.leaderId ?? null,
        supportIds: uiState.pendingTeam?.supportIds ?? state.disciples.expeditionTeam?.supportIds ?? [],
      });
      return true;
    case 'promote-elder':
      app.bus.emit('action:disciples/promoteElder', { discipleId: element.dataset.id });
      return true;
    case 'train-disciple':
      app.bus.emit('action:disciples/train', { discipleId: element.dataset.id, amount: Number(element.dataset.amount) || 1 });
      return true;
    case 'advance-disciple':
      app.bus.emit('action:disciples/advanceResonance', { discipleId: element.dataset.id });
      return true;
    default:
      return false;
  }
}

export { handleDisciplesUiAction };
