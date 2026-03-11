function positionTooltip(tooltip, event) {
  const offset = 14;
  const width = tooltip.offsetWidth;
  const height = tooltip.offsetHeight;
  let left = event.clientX + offset;
  let top = event.clientY + offset;
  if (left + width > window.innerWidth - 12) left = event.clientX - width - offset;
  if (top + height > window.innerHeight - 12) top = event.clientY - height - offset;
  tooltip.style.left = `${Math.max(8, left)}px`;
  tooltip.style.top = `${Math.max(8, top)}px`;
}

function bindTooltips(root, deps = {}) {
  const tooltip = root.querySelector('[data-role="tooltip"]');
  if (!tooltip) return;

  const resolve = deps.resolveElement ?? ((target) => target?.closest?.('[data-tooltip]') ?? null);

  let activeElement = null;
  const show = (element, event) => {
    if (!element) return;
    activeElement = element;
    tooltip.textContent = element.dataset.tooltip ?? '';
    tooltip.classList.remove('hidden');
    tooltip.classList.add('visible');
    if (event) positionTooltip(tooltip, event);
  };
  const hide = () => {
    activeElement = null;
    tooltip.classList.remove('visible');
    tooltip.classList.add('hidden');
  };

  root.addEventListener('mouseover', (event) => {
    const element = resolve(event.target);
    if (element && element !== activeElement) show(element, event);
  });
  root.addEventListener('mousemove', (event) => {
    if (activeElement) positionTooltip(tooltip, event);
  });
  root.addEventListener('mouseout', (event) => {
    const from = resolve(event.target);
    const to = resolve(event.relatedTarget);
    if (from && from === activeElement && from !== to) hide();
  });
  root.addEventListener('mouseleave', hide);
  root.addEventListener('pointerdown', hide);
}

export { bindTooltips, positionTooltip };

