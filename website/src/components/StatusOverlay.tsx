import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';

interface StatusOverlayProps {
  open: boolean;
  class: string;
  popupClass: string;
  ariaLabel: string;
  onClose: () => void;
  children: ComponentChildren;
}

/**
 * Render the shared modal shell for screenshot-focused status panels.
 *
 * Inert keeps aria-modal honest by removing the page and dock from the
 * tab order. The keyed dock windows remain attached so focus can return
 * to the originating control after the overlay closes.
 */
export function StatusOverlay({
  open,
  class: className,
  popupClass,
  ariaLabel,
  onClose,
  children,
}: StatusOverlayProps) {
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const regions = [
      document.querySelector('main'),
      document.querySelector('.status-dock'),
    ].filter((region): region is HTMLElement => region instanceof HTMLElement);
    const returnFocus = document.activeElement;
    regions.forEach((region) => {
      region.inert = true;
    });
    popupRef.current?.focus();
    return () => {
      regions.forEach((region) => {
        region.inert = false;
      });
      if (returnFocus instanceof HTMLElement && returnFocus.isConnected) {
        returnFocus.focus();
      }
    };
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div
      class={'status-overlay ' + className}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div class={'status-popup ' + popupClass} tabindex={-1} ref={popupRef}>
        {children}
      </div>
    </div>
  );
}
