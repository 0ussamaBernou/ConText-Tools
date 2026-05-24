import { createTooltip } from '@/utils/tooltip';
import { getSelectionInfo, getSelectionRect, replaceSelectedText, type SelectionInfo } from '@/utils/selection';
import type { ProofreadRequest, ProofreadSuccess, ProofreadError } from '@/utils/messages';

export default defineContentScript({
  matches: ['<all_urls>'],

  main(ctx) {
    const tooltip = createTooltip();
    let currentSelection: SelectionInfo | null = null;
    let isProcessing = false;

    // --- Proofread handler ---
    tooltip.onProofread(async () => {
      if (!currentSelection || isProcessing) return;
      isProcessing = true;
      tooltip.setLoading(true);

      try {
        const response = await browser.runtime.sendMessage({
          type: 'PROOFREAD',
          text: currentSelection.text,
        } satisfies ProofreadRequest);

        if (response?.type === 'PROOFREAD_RESULT') {
          const result = response as ProofreadSuccess;
          replaceSelectedText(currentSelection, result.text);
          tooltip.hide();
        } else if (response?.type === 'PROOFREAD_ERROR') {
          const error = response as ProofreadError;
          console.error('[Writing Tools] Proofread error:', error.error);
        }
      } catch (err) {
        console.error('[Writing Tools] Message error:', err);
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
