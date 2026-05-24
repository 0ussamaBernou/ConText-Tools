/**
 * Tooltip DOM creation, positioning, and state management.
 * Renders inside a Shadow DOM for style isolation.
 */

import type { ProcessActionType } from './messages';

export interface TooltipController {
  /** The shadow host element (for event target checking) */
  shadowHost: HTMLElement;
  /** Show the tooltip at the given viewport rect */
  show(rect: DOMRect): void;
  /** Hide the tooltip with animation */
  hide(): void;
  /** Toggle loading state */
  setLoading(loading: boolean): void;
  /** Show an error message inside the tooltip */
  showError(message: string): void;
  /** Set the action trigger handler */
  onAction(handler: (action: ProcessActionType, customPrompt?: string) => void): void;
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
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
}

.ctx-tooltip {
  position: fixed;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  width: 270px;
  padding: 12px;
  background: rgba(240, 245, 255, 0.75);
  border: 1px solid rgba(255, 255, 255, 0.4);
  border-radius: 16px;
  box-shadow:
    0 16px 40px rgba(28, 43, 70, 0.16),
    0 4px 12px rgba(28, 43, 70, 0.06),
    inset 0 1px 0 rgba(255, 255, 255, 0.5);
  opacity: 0;
  transform: translateY(8px) scale(0.95);
  transition: opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1),
              transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  pointer-events: auto;
  user-select: none;
  visibility: hidden;
  backdrop-filter: blur(20px) saturate(145%);
  -webkit-backdrop-filter: blur(20px) saturate(145%);
}

.ctx-tooltip * {
  box-sizing: border-box;
}

.ctx-tooltip.visible {
  opacity: 1;
  transform: translateY(0) scale(1);
  visibility: visible;
}

.ctx-tooltip.hiding {
  opacity: 0;
  transform: translateY(6px) scale(0.97);
  visibility: visible;
}

/* Loading state styles */
.ctx-tooltip.ctx-loading {
  pointer-events: none;
}

.ctx-tooltip.ctx-loading .ctx-input,
.ctx-tooltip.ctx-loading .ctx-grid-btn,
.ctx-tooltip.ctx-loading .ctx-menu-item {
  opacity: 0.6;
}

/* Sliding Progress Bar at top */
.ctx-progress-bar {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 3px;
  background: linear-gradient(90deg, #3b82f6, #a855f7, #ec4899, #3b82f6);
  background-size: 200% 100%;
  animation: ctx-progress-slide 1.5s infinite linear;
  border-top-left-radius: 16px;
  border-top-right-radius: 16px;
  opacity: 0;
  transition: opacity 0.22s ease;
}

.ctx-tooltip.ctx-loading .ctx-progress-bar {
  opacity: 1;
}

@keyframes ctx-progress-slide {
  0% { background-position: 0% 0%; }
  100% { background-position: -200% 0%; }
}

/* Section 1: Describe your change input */
.ctx-input-container {
  position: relative;
  width: 100%;
  margin-bottom: 10px;
}

.ctx-input-icon {
  position: absolute;
  top: 50%;
  left: 10px;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  pointer-events: none;
}

.ctx-input {
  width: 100%;
  height: 36px;
  padding: 8px 10px 8px 34px;
  background: rgba(255, 255, 255, 0.45);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 10px;
  color: #1e293b;
  font-family: inherit;
  font-size: 13.5px;
  font-weight: 450;
  outline: none;
  transition: background-color 0.16s ease,
              border-color 0.16s ease,
              box-shadow 0.16s ease;
}

.ctx-input::placeholder {
  color: #64748b;
  opacity: 0.85;
}

.ctx-input:focus {
  background: rgba(255, 255, 255, 0.7);
  border-color: rgba(59, 130, 246, 0.4);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
}

/* Section 2: Action buttons grid */
.ctx-grid {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}

.ctx-grid-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 58px;
  background: rgba(255, 255, 255, 0.45);
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 10px;
  color: #1e293b;
  font-family: inherit;
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
  outline: none;
  transition: background-color 0.14s ease,
              transform 0.1s ease,
              box-shadow 0.14s ease;
}

.ctx-grid-btn:hover {
  background: rgba(255, 255, 255, 0.7);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
}

.ctx-grid-btn:active {
  background: rgba(255, 255, 255, 0.8);
  transform: scale(0.97);
}

.ctx-grid-btn:disabled {
  opacity: 0.6;
  cursor: default;
  transform: none;
}

.ctx-btn-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #1e293b;
  width: 18px;
  height: 18px;
}

/* Section 3 & 4: Menu lists */
.ctx-menu-list {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.ctx-menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  color: #334155;
  font-family: inherit;
  font-size: 13.5px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.12s ease,
              color 0.12s ease,
              transform 0.1s ease;
}

.ctx-menu-item:hover {
  background: rgba(255, 255, 255, 0.5);
  color: #0f172a;
}

.ctx-menu-item:active {
  background: rgba(255, 255, 255, 0.75);
  transform: scale(0.98);
}

.ctx-item-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #475569;
  width: 16px;
  height: 16px;
}

.ctx-menu-item:hover .ctx-item-icon {
  color: #0f172a;
}

/* Divider */
.ctx-divider {
  height: 1px;
  background: rgba(0, 0, 0, 0.06);
  margin: 8px 4px;
}

/* Bounding arrow pointing to selection */
.ctx-arrow {
  position: absolute;
  width: 12px;
  height: 12px;
  background: rgba(240, 245, 255, 0.75);
  transform: translateY(-50%) rotate(45deg);
  z-index: -1;
}

/* Tooltip is to the left of selection (arrow is on the right pointing right) */
.ctx-tooltip.arrow-right .ctx-arrow {
  right: -6px;
  left: auto;
  border-top: 1px solid rgba(255, 255, 255, 0.4);
  border-right: 1px solid rgba(255, 255, 255, 0.4);
  border-bottom: none;
  border-left: none;
}

/* Tooltip is to the right of selection (arrow is on the left pointing left) */
.ctx-tooltip.arrow-left .ctx-arrow {
  left: -6px;
  right: auto;
  border-bottom: 1px solid rgba(255, 255, 255, 0.4);
  border-left: 1px solid rgba(255, 255, 255, 0.4);
  border-top: none;
  border-right: none;
}

/* Error message styling */
.ctx-error {
  background: rgba(254, 226, 226, 0.8);
  border: 1px solid rgba(248, 113, 113, 0.3);
  border-radius: 8px;
  color: #991b1b;
  font-size: 12.2px;
  padding: 8px 10px;
  margin-top: 8px;
  line-height: 1.4;
  word-break: break-word;
}
`;

const TOOLTIP_OFFSET_Y = 10; // pixels above the selection

export function createTooltip(): TooltipController {
  // Create shadow host
  const shadowHost = document.createElement('writing-tools-tooltip');
  const shadow = shadowHost.attachShadow({ mode: 'closed' });

  // Inject styles
  const style = document.createElement('style');
  style.textContent = TOOLTIP_CSS;
  shadow.appendChild(style);

  // Create tooltip container
  const tooltip = document.createElement('div');
  tooltip.className = 'ctx-tooltip';
  tooltip.innerHTML = `
    <div class="ctx-progress-bar"></div>
    
    <div class="ctx-input-container">
      <div class="ctx-input-icon">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="flower-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#ff7e5f" />
              <stop offset="40%" stop-color="#feb47b" />
              <stop offset="80%" stop-color="#a855f7" />
              <stop offset="100%" stop-color="#3b82f6" />
            </linearGradient>
          </defs>
          <circle cx="12" cy="12" r="9" fill="url(#flower-grad)" opacity="0.15"/>
          <circle cx="12" cy="12" r="6" fill="url(#flower-grad)" opacity="0.30"/>
          <path d="M12 7a.5.5 0 0 1 .5.5 4.5 4.5 0 0 0 4.5 4.5.5.5 0 0 1 0 1 4.5 4.5 0 0 0-4.5 4.5.5.5 0 0 1-1 0 4.5 4.5 0 0 0-4.5-4.5.5.5 0 0 1 0-1 4.5 4.5 0 0 0 4.5-4.5.5.5 0 0 1 .5-.5Z" fill="url(#flower-grad)"/>
        </svg>
      </div>
      <input type="text" class="ctx-input" placeholder="Describe your change" />
    </div>

    <div class="ctx-grid">
      <button class="ctx-grid-btn" data-action="proofread" type="button">
        <span class="ctx-btn-icon">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            <line x1="8" y1="11" x2="14" y2="11"></line>
          </svg>
        </span>
        <span class="ctx-btn-label">Proofread</span>
      </button>
      
      <button class="ctx-grid-btn" data-action="rewrite" type="button">
        <span class="ctx-btn-icon">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M23 4v6h-6"></path>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
          </svg>
        </span>
        <span class="ctx-btn-label">Rewrite</span>
      </button>
    </div>

    <div class="ctx-menu-list">
      <div class="ctx-menu-item" data-action="friendly">
        <span class="ctx-item-icon">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
            <line x1="9" y1="9" x2="9.01" y2="9"></line>
            <line x1="15" y1="9" x2="15.01" y2="9"></line>
          </svg>
        </span>
        Friendly
      </div>
      
      <div class="ctx-menu-item" data-action="professional">
        <span class="ctx-item-icon">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
          </svg>
        </span>
        Professional
      </div>
      
      <div class="ctx-menu-item" data-action="concise">
        <span class="ctx-item-icon">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="3" x2="12" y2="9"></line>
            <polyline points="9 6 12 9 15 6"></polyline>
            <line x1="12" y1="21" x2="12" y2="15"></line>
            <polyline points="9 18 12 15 15 18"></polyline>
            <line x1="4" y1="12" x2="20" y2="12"></line>
          </svg>
        </span>
        Concise
      </div>
    </div>

    <div class="ctx-divider"></div>

    <div class="ctx-menu-list">
      <div class="ctx-menu-item" data-action="summary">
        <span class="ctx-item-icon">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="4" y1="6" x2="20" y2="6"></line>
            <line x1="4" y1="12" x2="16" y2="12"></line>
            <line x1="4" y1="18" x2="12" y2="18"></line>
          </svg>
        </span>
        Summary
      </div>
      
      <div class="ctx-menu-item" data-action="key_points">
        <span class="ctx-item-icon">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="9" y1="6" x2="20" y2="6"></line>
            <line x1="9" y1="12" x2="20" y2="12"></line>
            <line x1="9" y1="18" x2="20" y2="18"></line>
            <circle cx="5" cy="6" r="1"></circle>
            <circle cx="5" cy="12" r="1"></circle>
            <circle cx="5" cy="18" r="1"></circle>
          </svg>
        </span>
        Key Points
      </div>
      
      <div class="ctx-menu-item" data-action="table">
        <span class="ctx-item-icon">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="3" y1="9" x2="21" y2="9"></line>
            <line x1="3" y1="15" x2="21" y2="15"></line>
            <line x1="10" y1="3" x2="10" y2="21"></line>
          </svg>
        </span>
        Table
      </div>
      
      <div class="ctx-menu-item" data-action="list">
        <span class="ctx-item-icon">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="10" y1="6" x2="21" y2="6"></line>
            <line x1="10" y1="12" x2="21" y2="12"></line>
            <line x1="10" y1="18" x2="21" y2="18"></line>
            <path d="M4 6h1v4"></path>
            <path d="M4 10h2"></path>
            <path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"></path>
          </svg>
        </span>
        List
      </div>
    </div>
    
    <div class="ctx-arrow"></div>
  `;

  shadow.appendChild(tooltip);
  document.documentElement.appendChild(shadowHost);

  // DOM Elements
  const input = tooltip.querySelector('.ctx-input') as HTMLInputElement;
  const arrow = tooltip.querySelector('.ctx-arrow') as HTMLElement;

  // State
  let isVisible = false;
  let hideTimeout: ReturnType<typeof setTimeout> | null = null;
  let actionHandler: ((action: ProcessActionType, customPrompt?: string) => void) | null = null;

  // Event Delegation for action items
  tooltip.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest('[data-action]');
    if (!target) return;

    const action = target.getAttribute('data-action') as ProcessActionType;
    if (!action) return;

    e.preventDefault();
    e.stopPropagation();

    actionHandler?.(action);
  });

  // Handle enter key on input field
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const val = input.value.trim();
      if (!val) return;

      e.preventDefault();
      e.stopPropagation();

      actionHandler?.('custom', val);
    }
  });

  // Prevent mousedown from stealing focus from the editable field, unless clicking on the input
  tooltip.addEventListener('mousedown', (e) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('ctx-input')) {
      return; // Allow focus on the input field
    }
    e.preventDefault();
    e.stopPropagation();
  });

  function show(rect: DOMRect) {
    if (hideTimeout) {
      clearTimeout(hideTimeout);
      hideTimeout = null;
    }

    // Clear previous error
    const existing = tooltip.querySelector('.ctx-error');
    if (existing) existing.remove();

    // Clear input
    input.value = '';

    // Calculate position: to the left of the selection
    const tooltipWidth = 270;
    let x = rect.left - tooltipWidth - TOOLTIP_OFFSET_Y;
    let arrowClass = 'arrow-right'; // Tooltip is to the left, arrow is on the right pointing right

    if (x < 8) {
      x = rect.right + TOOLTIP_OFFSET_Y;
      arrowClass = 'arrow-left'; // Tooltip is to the right, arrow is on the left pointing left
    }

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Clamp x to stay within viewport
    if (x < 8) x = 8;
    if (x + tooltipWidth > vw - 8) x = vw - tooltipWidth - 8;

    // Force reflow and layout so we can measure the actual offsetHeight
    tooltip.classList.remove('hiding');
    void tooltip.offsetHeight;
    const tooltipHeight = tooltip.offsetHeight || 370;

    // Center vertically relative to the selection rect
    const selectionCenterY = rect.top + rect.height / 2;
    let tooltipTop = selectionCenterY - tooltipHeight / 2;

    // Clamp vertically to stay within viewport
    if (tooltipTop < 8) tooltipTop = 8;
    if (tooltipTop + tooltipHeight > vh - 8) tooltipTop = vh - tooltipHeight - 8;

    // Position container
    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${tooltipTop}px`;
    tooltip.style.bottom = 'auto';

    tooltip.classList.remove('arrow-left', 'arrow-right');
    tooltip.classList.add(arrowClass);

    // Position arrow vertically relative to selection center
    let arrowTop = selectionCenterY - tooltipTop;
    // Clamp arrow position within the rounded corners of the card
    if (arrowTop < 16) arrowTop = 16;
    if (arrowTop > tooltipHeight - 16) arrowTop = tooltipHeight - 16;
    
    arrow.style.top = `${arrowTop}px`;
    arrow.style.left = 'auto';
    arrow.style.right = 'auto';

    tooltip.classList.add('visible');
    isVisible = true;
  }

  function hide() {
    if (!isVisible) return;

    // De-focus input
    input.blur();

    tooltip.classList.remove('visible');
    tooltip.classList.add('hiding');

    hideTimeout = setTimeout(() => {
      tooltip.classList.remove('hiding');
      isVisible = false;
      hideTimeout = null;
    }, 200);
  }

  function setLoading(loading: boolean) {
    if (loading) {
      tooltip.classList.add('ctx-loading');
      input.disabled = true;
      tooltip.querySelectorAll('button').forEach(btn => btn.disabled = true);
    } else {
      tooltip.classList.remove('ctx-loading');
      input.disabled = false;
      tooltip.querySelectorAll('button').forEach(btn => btn.disabled = false);
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

    // Auto-remove after 4 seconds
    setTimeout(() => {
      errorEl.remove();
    }, 4000);
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
    showError,
    onAction(handler) {
      actionHandler = handler;
    },
    destroy,
  };
}
