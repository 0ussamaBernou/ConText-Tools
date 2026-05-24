/**
 * Tooltip DOM creation, positioning, and state management.
 * Renders inside a Shadow DOM for style isolation.
 */

export interface TooltipController {
  /** The shadow host element (for event target checking) */
  shadowHost: HTMLElement;
  /** Show the tooltip at the given viewport rect */
  show(rect: DOMRect): void;
  /** Hide the tooltip with animation */
  hide(): void;
  /** Toggle loading state */
  setLoading(loading: boolean): void;
  /** Set the click handler for the proofread button */
  onProofread(handler: () => void): void;
  /** Remove from DOM */
  destroy(): void;
}

const TOOLTIP_CSS = `
:host {
  all: initial;
  position: fixed;
  top: 0;
  left: 0;
  width: 0;
  height: 0;
  overflow: visible;
  z-index: 2147483647;
  pointer-events: none;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

.ctx-tooltip {
  position: fixed;
  display: inline-flex;
  align-items: center;
  padding: 4px 4px;
  background: #202127;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.45),
    0 2px 8px rgba(0, 0, 0, 0.25),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
  opacity: 0;
  transform: translateY(6px) scale(0.92);
  transition: opacity 0.18s cubic-bezier(0.16, 1, 0.3, 1),
              transform 0.18s cubic-bezier(0.16, 1, 0.3, 1);
  pointer-events: auto;
  user-select: none;
  visibility: hidden;
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}

.ctx-tooltip.visible {
  opacity: 1;
  transform: translateY(0) scale(1);
  visibility: visible;
}

.ctx-tooltip.hiding {
  opacity: 0;
  transform: translateY(4px) scale(0.95);
  visibility: visible;
}

.ctx-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  background: transparent;
  border: none;
  color: #d1d1d6;
  font-family: inherit;
  font-size: 13.5px;
  font-weight: 500;
  letter-spacing: 0.01em;
  cursor: pointer;
  padding: 6px 14px;
  border-radius: 7px;
  transition: background-color 0.14s ease,
              color 0.14s ease;
  white-space: nowrap;
  line-height: 1;
}

.ctx-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #ffffff;
}

.ctx-btn:active {
  background: rgba(255, 255, 255, 0.12);
  transform: scale(0.97);
}

.ctx-btn:disabled {
  opacity: 0.55;
  cursor: default;
  transform: none;
}

.ctx-btn:disabled:hover {
  background: transparent;
  color: #d1d1d6;
}

.ctx-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.ctx-sparkle {
  font-size: 14px;
  background: linear-gradient(135deg, #a78bfa, #818cf8, #6d9fff);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.ctx-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(167, 139, 250, 0.2);
  border-top-color: #a78bfa;
  border-radius: 50%;
  animation: ctx-spin 0.55s linear infinite;
}

@keyframes ctx-spin {
  to { transform: rotate(360deg); }
}

.ctx-error {
  color: #f87171;
  font-size: 12px;
  padding: 4px 10px;
  max-width: 220px;
  line-height: 1.3;
}
`;

const TOOLTIP_OFFSET_Y = 10; // pixels above the selection

export function createTooltip(): TooltipController {
  // Create shadow host
  const shadowHost = document.createElement('context-tools-tooltip');
  const shadow = shadowHost.attachShadow({ mode: 'closed' });

  // Inject styles
  const style = document.createElement('style');
  style.textContent = TOOLTIP_CSS;
  shadow.appendChild(style);

  // Create tooltip container
  const tooltip = document.createElement('div');
  tooltip.className = 'ctx-tooltip';

  // Create proofread button
  const btn = document.createElement('button');
  btn.className = 'ctx-btn';
  btn.type = 'button';

  const iconSpan = document.createElement('span');
  iconSpan.className = 'ctx-icon';

  const sparkle = document.createElement('span');
  sparkle.className = 'ctx-sparkle';
  sparkle.textContent = '✦';
  iconSpan.appendChild(sparkle);

  const label = document.createElement('span');
  label.textContent = 'Proofread';

  btn.appendChild(iconSpan);
  btn.appendChild(label);
  tooltip.appendChild(btn);

  shadow.appendChild(tooltip);
  document.documentElement.appendChild(shadowHost);

  // State
  let isVisible = false;
  let hideTimeout: ReturnType<typeof setTimeout> | null = null;
  let proofreadHandler: (() => void) | null = null;

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    proofreadHandler?.();
  });

  // Prevent mousedown from stealing focus from the editable field
  tooltip.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });

  function show(rect: DOMRect) {
    if (hideTimeout) {
      clearTimeout(hideTimeout);
      hideTimeout = null;
    }

    // Calculate position: centered above the selection
    const tooltipWidth = 140; // approximate
    let x = rect.left + rect.width / 2 - tooltipWidth / 2;
    let y = rect.top - TOOLTIP_OFFSET_Y;

    // Ensure tooltip stays within viewport
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    if (x < 8) x = 8;
    if (x + tooltipWidth > vw - 8) x = vw - tooltipWidth - 8;

    // If not enough room above, show below
    if (y < 40) {
      y = rect.bottom + TOOLTIP_OFFSET_Y;
    }

    tooltip.style.left = `${x}px`;
    tooltip.style.bottom = `${vh - y}px`;
    tooltip.style.top = 'auto';

    tooltip.classList.remove('hiding');

    // Force reflow for animation
    void tooltip.offsetHeight;

    tooltip.classList.add('visible');
    isVisible = true;
  }

  function hide() {
    if (!isVisible) return;

    tooltip.classList.remove('visible');
    tooltip.classList.add('hiding');

    hideTimeout = setTimeout(() => {
      tooltip.classList.remove('hiding');
      isVisible = false;
      hideTimeout = null;
    }, 180);
  }

  function setLoading(loading: boolean) {
    btn.disabled = loading;
    const icon = iconSpan;

    // Clear the icon container
    while (icon.firstChild) icon.removeChild(icon.firstChild);

    if (loading) {
      const spinner = document.createElement('span');
      spinner.className = 'ctx-spinner';
      icon.appendChild(spinner);
      label.textContent = 'Proofreading…';
    } else {
      const sparkleEl = document.createElement('span');
      sparkleEl.className = 'ctx-sparkle';
      sparkleEl.textContent = '✦';
      icon.appendChild(sparkleEl);
      label.textContent = 'Proofread';
    }
  }

  function showError(message: string) {
    // Remove any existing error
    const existing = tooltip.querySelector('.ctx-error');
    if (existing) existing.remove();

    const errorEl = document.createElement('div');
    errorEl.className = 'ctx-error';
    errorEl.textContent = message;
    tooltip.appendChild(errorEl);

    // Auto-remove after 3 seconds
    setTimeout(() => {
      errorEl.remove();
    }, 3000);
  }

  function destroy() {
    if (hideTimeout) clearTimeout(hideTimeout);
    shadowHost.remove();
  }

  return {
    shadowHost,
    show,
    hide,
    setLoading,
    onProofread(handler) {
      proofreadHandler = handler;
    },
    destroy,
  };
}
