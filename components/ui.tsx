"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { X, Inbox } from "lucide-react";
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog
      className={"modal " + (wide ? "wide" : "")}
      ref={ref}
      onCancel={onClose}
    >
      <div className="modal-heading">
        <h2>{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty">
      <Inbox size={30} />
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}
export function Badge({ status }: { status: string }) {
  return (
    <span
      className={"badge badge-" + status.toLowerCase().replaceAll(" ", "-")}
    >
      {status}
    </span>
  );
}
export function Field({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={"field " + (wide ? "field-wide" : "")}>
      <span>{label}</span>
      {children}
    </label>
  );
}
