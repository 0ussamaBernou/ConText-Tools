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

/* Dropdown style */
.ctx-dropdown-container {
  position: relative;
  width: 100%;
}

.ctx-dropdown-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  height: 36px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.45);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 10px;
  color: #1e293b;
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  outline: none;
  transition: background-color 0.16s ease, border-color 0.16s ease;
}

.ctx-dropdown-trigger:hover {
  background: rgba(255, 255, 255, 0.7);
}

.ctx-dropdown-trigger:active {
  transform: scale(0.99);
}

.ctx-dropdown-arrow {
  display: flex;
  align-items: center;
  color: #475569;
  transition: transform 0.2s ease;
}

.ctx-dropdown-container.open .ctx-dropdown-arrow {
  transform: rotate(180deg);
}

.ctx-dropdown-menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  width: 100%;
  max-height: 300px;
  overflow-y: auto;
  background: rgba(240, 245, 255, 0.96);
  border: 1px solid rgba(255, 255, 255, 0.6);
  border-radius: 12px;
  box-shadow: 0 10px 25px rgba(28, 43, 70, 0.15);
  padding: 6px;
  z-index: 100;
  opacity: 0;
  transform: translateY(-4px) scale(0.97);
  pointer-events: none;
  visibility: hidden;
  transition: opacity 0.15s cubic-bezier(0.16, 1, 0.3, 1),
              transform 0.15s cubic-bezier(0.16, 1, 0.3, 1);
  backdrop-filter: blur(15px);
  -webkit-backdrop-filter: blur(15px);
}

.ctx-dropdown-container.open .ctx-dropdown-menu {
  opacity: 1;
  transform: translateY(0) scale(1);
  pointer-events: auto;
  visibility: visible;
}

.ctx-dropdown-group-title {
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #64748b;
  padding: 6px 8px 4px;
}

.ctx-dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  color: #334155;
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.1s ease, color 0.1s ease, transform 0.1s ease;
}

.ctx-dropdown-item:hover {
  background: rgba(255, 255, 255, 0.7);
  color: #0f172a;
}

.ctx-dropdown-item:active {
  transform: scale(0.98);
}

.ctx-dropdown-divider {
  height: 1px;
  background: rgba(0, 0, 0, 0.05);
  margin: 4px;
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

    <div class="ctx-dropdown-container">
      <button class="ctx-dropdown-trigger" type="button">
        <span>Choose preset…</span>
        <span class="ctx-dropdown-arrow">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </span>
      </button>
      
      <div class="ctx-dropdown-menu">
        <div class="ctx-dropdown-group-title">Tones</div>
        <div class="ctx-dropdown-item" data-action="friendly">
          <span>😊</span> Friendly
        </div>
        <div class="ctx-dropdown-item" data-action="professional">
          <span>💼</span> Professional
        </div>
        <div class="ctx-dropdown-item" data-action="concise">
          <span>↕</span> Concise
        </div>
        
        <div class="ctx-dropdown-divider"></div>
        
        <div class="ctx-dropdown-group-title">Formats</div>
        <div class="ctx-dropdown-item" data-action="summary">
          <span>📝</span> Summary
        </div>
        <div class="ctx-dropdown-item" data-action="key_points">
          <span>✨</span> Key Points
        </div>
        <div class="ctx-dropdown-item" data-action="table">
          <span>📊</span> Table
        </div>
        <div class="ctx-dropdown-item" data-action="list">
          <span>🔢</span> List
        </div>
      </div>
    </div>
  `;

  shadow.appendChild(tooltip);
  document.documentElement.appendChild(shadowHost);

  // DOM Elements
  const input = tooltip.querySelector('.ctx-input') as HTMLInputElement;
  const dropdownContainer = tooltip.querySelector('.ctx-dropdown-container') as HTMLElement;
  const dropdownTrigger = tooltip.querySelector('.ctx-dropdown-trigger') as HTMLButtonElement;

  // State
  let isVisible = false;
  let hideTimeout: ReturnType<typeof setTimeout> | null = null;
  let actionHandler: ((action: ProcessActionType, customPrompt?: string) => void) | null = null;

  // Dropdown toggle
  dropdownTrigger.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropdownContainer.classList.toggle('open');
  });

  // Close dropdown on click outside
  tooltip.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (!dropdownContainer.contains(target)) {
      dropdownContainer.classList.remove('open');
    }
  });

  // Event Delegation for action items
  tooltip.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest('[data-action]');
    if (!target) return;

    const action = target.getAttribute('data-action') as ProcessActionType;
    if (!action) return;

    e.preventDefault();
    e.stopPropagation();

    dropdownContainer.classList.remove('open');
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

    // Close dropdown
    dropdownContainer.classList.remove('open');

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

    tooltip.classList.add('visible');
    isVisible = true;
  }

  function hide() {
    if (!isVisible) return;

    // De-focus input
    input.blur();

    // Close dropdown
    dropdownContainer.classList.remove('open');

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
