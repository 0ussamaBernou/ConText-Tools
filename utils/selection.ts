/**
 * Selection detection & text replacement utilities.
 * Handles <input>, <textarea>, and [contenteditable] elements.
 */

export interface SelectionInfo {
  text: string;
  element: HTMLElement;
  type: 'input' | 'contenteditable';
  /** For input/textarea: character offsets */
  start?: number;
  end?: number;
  /** For contenteditable: saved range */
  range?: Range;
}

/**
 * Check if an element is an editable field.
 */
export function isEditableElement(el: Element | null): el is HTMLElement {
  if (!el) return false;

  // Standard input types that support text selection
  if (el instanceof HTMLInputElement) {
    const textTypes = ['text', 'search', 'url', 'tel', 'password', ''];
    return textTypes.includes(el.type);
  }

  if (el instanceof HTMLTextAreaElement) return true;

  // contenteditable
  if (el instanceof HTMLElement && el.isContentEditable) return true;

  return false;
}

/**
 * Get selected text info from the currently focused editable element.
 * Returns null if no text is selected.
 */
export function getSelectionInfo(): SelectionInfo | null {
  const active = document.activeElement;
  if (!active || !isEditableElement(active)) return null;

  // Handle <input> and <textarea>
  if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
    const start = active.selectionStart ?? 0;
    const end = active.selectionEnd ?? 0;
    if (start === end) return null;

    const text = active.value.slice(start, end);
    if (!text.trim()) return null;

    return {
      text,
      element: active,
      type: 'input',
      start,
      end,
    };
  }

  // Handle contenteditable
  if (active.isContentEditable) {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;

    const text = selection.toString();
    if (!text.trim()) return null;

    const range = selection.getRangeAt(0);

    // Verify selection is inside the editable element
    if (!active.contains(range.commonAncestorContainer)) return null;

    return {
      text,
      element: active,
      type: 'contenteditable',
      range: range.cloneRange(),
    };
  }

  return null;
}

/**
 * Replace the selected text in an editable element.
 * Dispatches proper events for framework compatibility (React, Vue, etc.).
 */
export function replaceSelectedText(info: SelectionInfo, newText: string): boolean {
  try {
    if (info.type === 'input') {
      return replaceInInputElement(info, newText);
    } else {
      return replaceInContentEditable(info, newText);
    }
  } catch (e) {
    console.error('[Writing Tools] Failed to replace text:', e);
    return false;
  }
}

function replaceInInputElement(info: SelectionInfo, newText: string): boolean {
  const el = info.element as HTMLInputElement | HTMLTextAreaElement;
  const { start, end } = info;
  if (start === undefined || end === undefined) return false;

  const before = el.value.slice(0, start);
  const after = el.value.slice(end);
  const newValue = before + newText + after;

  // Use native setter for React/Vue compatibility
  const proto = el instanceof HTMLInputElement
    ? HTMLInputElement.prototype
    : HTMLTextAreaElement.prototype;
  const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;

  if (nativeSetter) {
    nativeSetter.call(el, newValue);
  } else {
    el.value = newValue;
  }

  // Set cursor position after the replaced text
  const newCursorPos = start + newText.length;
  el.setSelectionRange(newCursorPos, newCursorPos);

  // Dispatch events for framework reactivity
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));

  return true;
}

function replaceInContentEditable(info: SelectionInfo, newText: string): boolean {
  const { range, element } = info;
  if (!range) return false;

  // Restore the selection range
  const selection = window.getSelection();
  if (!selection) return false;

  selection.removeAllRanges();
  selection.addRange(range);

  // Focus the element
  element.focus();

  // Use execCommand for undo support
  const success = document.execCommand('insertText', false, newText);

  if (!success) {
    // Fallback: manual range replacement
    range.deleteContents();
    range.insertNode(document.createTextNode(newText));

    // Collapse cursor to end of inserted text
    selection.collapseToEnd();
  }

  // Dispatch input event
  element.dispatchEvent(new Event('input', { bubbles: true }));

  return true;
}

/**
 * Get a bounding rect for the current selection.
 * For input/textarea, falls back to mouse coordinates or element rect.
 */
export function getSelectionRect(
  info: SelectionInfo,
  mouseEvent?: MouseEvent,
): DOMRect | null {
  // For contenteditable, use the range bounding rect (most accurate)
  if (info.type === 'contenteditable' && info.range) {
    const rect = info.range.getBoundingClientRect();
    if (rect.width > 0 || rect.height > 0) return rect;
  }

  // For input/textarea or fallback, use mouse position to create a synthetic rect
  if (mouseEvent) {
    return new DOMRect(
      mouseEvent.clientX,
      mouseEvent.clientY,
      0,
      0,
    );
  }

  // Last resort: use the element's bounding rect
  return info.element.getBoundingClientRect();
}
