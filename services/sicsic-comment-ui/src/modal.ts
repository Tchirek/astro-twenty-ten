const focusable = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

export function createModal(container: HTMLElement) {
  let overlay: HTMLElement | null = null;
  let returnFocus: HTMLElement | null = null;
  let inertSiblings: Array<[HTMLElement, boolean]> = [];

  function controls(): HTMLElement[] {
    return Array.from(overlay?.querySelectorAll<HTMLElement>(focusable) || [])
      .filter((element) => element.getClientRects().length > 0);
  }

  function close(restoreFocus = true): void {
    overlay?.remove();
    overlay = null;
    document.removeEventListener('keydown', onKeydown);
    document.removeEventListener('focusin', onFocus);
    for (const [element, wasInert] of inertSiblings) element.inert = wasInert;
    inertSiblings = [];
    if (restoreFocus && returnFocus?.isConnected) returnFocus.focus();
  }

  function onFocus(event: FocusEvent): void {
    if (overlay && event.target instanceof Node && !overlay.contains(event.target)) controls()[0]?.focus();
  }

  function onKeydown(event: KeyboardEvent): void {
    if (event.defaultPrevented || !overlay) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'Tab') {
      const items = controls();
      const next = event.shiftKey ? items.at(-1) : items[0];
      const edge = event.shiftKey ? items[0] : items.at(-1);
      if (!items.length || document.activeElement === edge || !overlay.contains(document.activeElement)) {
        event.preventDefault();
        next?.focus();
      }
    }
  }

  function open(card: HTMLElement): void {
    const opener = overlay ? returnFocus : document.activeElement;
    close(false);
    returnFocus = opener instanceof HTMLElement ? opener : null;
    overlay = document.createElement('div');
    overlay.className = 'auth-overlay';
    overlay.addEventListener('click', (event) => { if (event.target === overlay) close(); });
    overlay.append(card);
    container.append(overlay);
    for (let node: HTMLElement = overlay; node.parentElement; node = node.parentElement) {
      for (const sibling of node.parentElement.children) {
        if (sibling !== node && sibling instanceof HTMLElement) {
          inertSiblings.push([sibling, sibling.inert]);
          sibling.inert = true;
        }
      }
      if (node.parentElement === document.body) break;
    }
    document.addEventListener('keydown', onKeydown);
    document.addEventListener('focusin', onFocus);
    const initial = card.querySelector<HTMLElement>('.auth-body input, .auth-body textarea')
      ?? card.querySelector<HTMLElement>('.auth-body button, .auth-body a');
    (initial?.getClientRects().length ? initial : controls()[0])?.focus();
  }

  return { open, close };
}

export type Modal = ReturnType<typeof createModal>;
