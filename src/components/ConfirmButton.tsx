"use client";

export default function ConfirmButton({
  message,
  children,
  className = "btn-secondary btn-sm",
  disabled = false,
  title,
}: {
  message: string;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      className={className}
      disabled={disabled}
      title={title}
      onClick={(event) => {
        if (disabled) return;
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
