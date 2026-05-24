import { createTooltip } from '@/utils/tooltip';
import { getSelectionInfo, getSelectionRect, replaceSelectedText, type SelectionInfo } from '@/utils/selection';
import type { ProcessTextRequest, ProcessTextSuccess, ProcessTextError, ExtensionSettings } from '@/utils/messages';

export default defineContentScript({
  matches: ['<all_urls>'],

  main(ctx) {
    const tooltip = createTooltip();
    let currentSelection: SelectionInfo | null = null;
    let isProcessing = false;
    let isEnabled = true;

    // Load initial enabled status
    browser.storage.local.get('settings').then((data) => {
      const settings = data.settings as ExtensionSettings | undefined;
      if (settings && typeof settings.enabled === 'boolean') {
        isEnabled = settings.enabled;
      }
    });

    // Listen for setting changes
    const storageListener = (changes: Record<string, any>, areaName: string) => {
      if (areaName === 'local' && changes.settings) {
        const settings = changes.settings.newValue as ExtensionSettings | undefined;
        if (settings && typeof settings.enabled === 'boolean') {
          isEnabled = settings.enabled;
          if (!isEnabled) {
            tooltip.hide();
            currentSelection = null;
          }
        }
      }
    };
    browser.storage.onChanged.addListener(storageListener);

    // --- Action handler ---
    tooltip.onAction(async (action, customPrompt) => {
      if (!currentSelection || isProcessing) return;
      isProcessing = true;
      tooltip.setLoading(true);

      try {
        const response = await browser.runtime.sendMessage({
          type: 'PROCESS_TEXT',
          text: currentSelection.text,
          action,
          customPrompt,
        } satisfies ProcessTextRequest);

        if (response?.type === 'PROCESS_TEXT_RESULT') {
          const result = response as ProcessTextSuccess;
          replaceSelectedText(currentSelection, result.text);
          tooltip.hide();
        } else if (response?.type === 'PROCESS_TEXT_ERROR') {
          const error = response as ProcessTextError;
          console.error('[Writing Tools] Processing error:', error.error);
          tooltip.showError(error.error);
        }
      } catch (err: any) {
        console.error('[Writing Tools] Message error:', err);
        tooltip.showError(err?.message || 'Failed to send message to background.');
      } finally {
        tooltip.setLoading(false);
        isProcessing = false;
      }
    });

    // --- Selection detection ---
    let selectionTimeout: ReturnType<typeof setTimeout> | null = null;

    function handleSelection(mouseEvent?: MouseEvent) {
      if (!isEnabled || isProcessing) return;

      // Ignore selection changes if focus is inside the tooltip
      const isFocusInTooltip = document.activeElement === tooltip.shadowHost ||
                               tooltip.shadowHost.contains(document.activeElement);
      if (isFocusInTooltip) return;

      const info = getSelectionInfo();
      if (info) {
        currentSelection = info;
        const rect = getSelectionRect(info, mouseEvent);
        if (rect) {
          tooltip.show(rect);
        }
      } else {
        tooltip.hide();
        currentSelection = null;
      }
    }

    document.addEventListener('mouseup', (e) => {
      if (tooltip.shadowHost.contains(e.target as Node)) return;

      // Small delay to let browser finalize selection, then show immediately
      setTimeout(() => {
        if (selectionTimeout) clearTimeout(selectionTimeout);
        handleSelection(e);
      }, 10);
    });

    document.addEventListener('selectionchange', () => {
      if (selectionTimeout) clearTimeout(selectionTimeout);

      selectionTimeout = setTimeout(() => {
        handleSelection();
      }, 150);
    });

    // --- Dismiss on mousedown outside ---
    document.addEventListener('mousedown', (e) => {
      if (tooltip.shadowHost.contains(e.target as Node)) return;
      if (isProcessing) return;
      tooltip.hide();
      currentSelection = null;
    });

    // --- Dismiss on Escape ---
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (isProcessing) return;
        tooltip.hide();
        currentSelection = null;
      }
    });

    // --- Dismiss on scroll ---
    let scrollTimeout: ReturnType<typeof setTimeout> | null = null;
    window.addEventListener('scroll', () => {
      if (isProcessing) return;
      if (scrollTimeout) clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        tooltip.hide();
        currentSelection = null;
      }, 100);
    }, { passive: true });

    // --- Cleanup on HMR / extension invalidation ---
    ctx.onInvalidated(() => {
      if (selectionTimeout) clearTimeout(selectionTimeout);
      if (scrollTimeout) clearTimeout(scrollTimeout);
      browser.storage.onChanged.removeListener(storageListener);
      tooltip.destroy();
    });
  },
});
