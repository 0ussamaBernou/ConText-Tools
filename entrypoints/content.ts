import { createTooltip } from '@/utils/tooltip';
import { getSelectionInfo, getSelectionRect, replaceSelectedText, type SelectionInfo } from '@/utils/selection';
import type { ProcessTextRequest, ProcessTextSuccess, ProcessTextError } from '@/utils/messages';

export default defineContentScript({
  matches: ['<all_urls>'],

  main(ctx) {
    const tooltip = createTooltip();
    let currentSelection: SelectionInfo | null = null;
    let isProcessing = false;

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
    let mouseUpCoords: { x: number; y: number } | null = null;

    document.addEventListener('mouseup', (e) => {
      // Ignore clicks on our tooltip shadow host
      if (tooltip.shadowHost.contains(e.target as Node)) return;

      mouseUpCoords = { x: e.clientX, y: e.clientY };

      // Small delay to let the browser finalize the selection
      setTimeout(() => {
        if (isProcessing) return;

        const info = getSelectionInfo();
        if (info) {
          currentSelection = info;
          const rect = getSelectionRect(info, e);
          if (rect) {
            tooltip.show(rect);
          }
        } else {
          tooltip.hide();
          currentSelection = null;
        }
      }, 10);
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
      tooltip.destroy();
    });
  },
});
