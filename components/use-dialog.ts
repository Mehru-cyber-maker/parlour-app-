"use client";

import { useEffect, useRef } from "react";

export function useDialog(open: boolean, close: () => void, busy = false) {
  const closeRef = useRef(close);
  const busyRef = useRef(busy);
  closeRef.current = close;
  busyRef.current = busy;

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = document.querySelector<HTMLElement>(".account-modal[role='dialog']");
    if (!dialog) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const controls = () => Array.from(dialog.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])")).filter(element => element.getClientRects().length > 0);
    const initial = dialog.querySelector<HTMLElement>("input:not([disabled]), select:not([disabled]), textarea:not([disabled])") || controls()[0] || dialog;
    initial.focus();
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        if (!busyRef.current) closeRef.current();
      }
      if (event.key === "Tab") {
        const options = controls();
        if (!options.length) { event.preventDefault(); dialog?.focus(); return; }
        const first = options[0];
        const last = options[options.length - 1];
        if (event.shiftKey && (document.activeElement === first || !dialog?.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || !dialog?.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [open]);
}
