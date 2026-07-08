import { AlertTriangle, X } from "lucide-react";

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  loading: boolean;
  error?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteConfirmationModal({
  isOpen,
  loading,
  error,
  onConfirm,
  onCancel,
}: DeleteConfirmationModalProps) {
  if (!isOpen) return null;

  return (
    /* Backdrop */
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      aria-describedby="modal-body"
      className="fixed inset-0 z-[100] flex items-center justify-center px-4"
    >
      {/* Dimmed overlay */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Dialog card — 480px, elevated */}
      <div
        className="relative w-full rounded-xl border border-[#E0E0E0] bg-white"
        style={{
          maxWidth: "480px",
          padding: "32px",
          boxShadow: "0px 8px 32px rgba(0,0,0,0.24)",
          zIndex: 1,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close [X] */}
        <button
          onClick={onCancel}
          aria-label="Close dialog"
          className="absolute top-4 right-4 flex items-center justify-center w-8 h-8 rounded-lg text-[#9E9E9E] hover:text-[#212121] hover:bg-[#F5F5F5] transition-colors"
        >
          <X size={16} aria-hidden="true" />
        </button>

        {/* Warning icon */}
        <div className="flex flex-col items-center text-center gap-4 mb-6">
          <span
            className="inline-flex items-center justify-center w-16 h-16 rounded-full"
            style={{ backgroundColor: "rgba(211,47,47,0.10)" }}
            aria-hidden="true"
          >
            <AlertTriangle size={32} style={{ color: "#D32F2F" }} />
          </span>

          {/* Title */}
          <h2
            id="modal-title"
            style={{ color: "#212121" }}
          >
            Are you sure?
          </h2>

          {/* Body */}
          <p
            id="modal-body"
            style={{ color: "#9E9E9E", fontSize: "14px", lineHeight: "20px" }}
          >
            You are about to{" "}
            <strong style={{ color: "#D32F2F" }}>permanently delete</strong>{" "}
            your account. This action{" "}
            <strong style={{ color: "#212121" }}>cannot be undone</strong>{" "}
            and all your data will be irretrievably lost.
          </p>
        </div>

        {/* Error */}
        {error && (
          <p
            role="alert"
            className="text-center mb-4"
            style={{ color: "#D32F2F", fontSize: "13px", lineHeight: "18px" }}
          >
            {error}
          </p>
        )}

        {/* Divider */}
        <div className="h-px w-full mb-6" style={{ backgroundColor: "#F0F0F0" }} aria-hidden="true" />

        {/* Action buttons — side by side */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Yes, Delete — destructive, left */}
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 h-12 inline-flex items-center justify-center gap-2 rounded-md font-semibold text-white transition-colors duration-150 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[rgba(211,47,47,0.4)] disabled:cursor-not-allowed order-2 sm:order-1"
            style={{
              fontSize: "14px",
              letterSpacing: "0.5px",
              backgroundColor: loading ? "#9E9E9E" : "#D32F2F",
              boxShadow: loading ? "none" : "0px 2px 4px rgba(211,47,47,0.3)",
            }}
            onMouseEnter={(e) => { if (!loading) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#B71C1C"; }}
            onMouseLeave={(e) => { if (!loading) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#D32F2F"; }}
            aria-label={loading ? "Deleting account…" : "Yes, permanently delete my account"}
          >
            {loading ? (
              <>
                <svg className="animate-spin" width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                </svg>
                Deleting…
              </>
            ) : (
              "Yes, Delete My Account"
            )}
          </button>

          {/* Cancel — secondary outlined, right */}
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 h-12 inline-flex items-center justify-center rounded-md font-semibold border border-[#1A73E8] text-[#1A73E8] hover:bg-[rgba(26,115,232,0.08)] hover:border-[#1557B0] hover:text-[#1557B0] transition-all duration-150 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[rgba(26,115,232,0.4)] disabled:opacity-50 disabled:cursor-not-allowed order-1 sm:order-2"
            style={{ fontSize: "14px", letterSpacing: "0.5px" }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
