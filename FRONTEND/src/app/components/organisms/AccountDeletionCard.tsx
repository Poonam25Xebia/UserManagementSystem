import { useState } from "react";
import { Trash2, XCircle, X } from "lucide-react";
import { WarningBanner } from "../molecules/WarningBanner";

const CONSEQUENCES = [
  "Permanently remove all your personal data from our systems.",
  "Cancel all active subscriptions and billing agreements.",
  "Revoke access to all associated services and integrations.",
  "This action CANNOT be reversed — there is no recovery option.",
];

interface AccountDeletionCardProps {
  onDeleteClick: () => void;
  onCancel: () => void;
}

export function AccountDeletionCard({ onDeleteClick, onCancel }: AccountDeletionCardProps) {
  const [agreed, setAgreed] = useState(false);

  return (
    <div
      className="w-full rounded-lg border-2 bg-white"
      style={{
        borderColor: "#D32F2F",
        padding: "32px",
        boxShadow: "0px 2px 8px rgba(211,47,47,0.08)",
      }}
    >
      {/* Card heading */}
      <div className="flex items-center gap-3 mb-6">
        <span
          className="inline-flex items-center justify-center w-10 h-10 rounded-lg flex-shrink-0"
          style={{ backgroundColor: "rgba(211,47,47,0.10)", color: "#D32F2F" }}
          aria-hidden="true"
        >
          <Trash2 size={20} strokeWidth={1.75} />
        </span>
        <div>
          <h2 style={{ color: "#D32F2F" }}>Permanently Delete Account</h2>
          <p style={{ color: "#9E9E9E", fontSize: "13px", lineHeight: "18px", marginTop: 2 }}>
            Read carefully before proceeding.
          </p>
        </div>
      </div>

      {/* Danger warning */}
      <div className="mb-6">
        <WarningBanner
          variant="danger"
          title="Danger"
          message="Deleting your account is permanent. Once deleted, your data cannot be recovered by you or our support team."
        />
      </div>

      {/* Consequences list */}
      <div className="mb-6">
        <p style={{ color: "#212121", fontSize: "14px", fontWeight: 600, lineHeight: "20px", marginBottom: 12 }}>
          Deleting your account will:
        </p>
        <ul role="list" className="flex flex-col gap-3" aria-label="Consequences of account deletion">
          {CONSEQUENCES.map((item, idx) => (
            <li key={idx} className="flex items-start gap-3">
              <X
                size={16}
                className="flex-shrink-0 mt-0.5"
                style={{ color: "#D32F2F" }}
                aria-hidden="true"
              />
              <p
                style={{
                  color: idx === CONSEQUENCES.length - 1 ? "#D32F2F" : "#212121",
                  fontSize: "14px",
                  lineHeight: "20px",
                  fontWeight: idx === CONSEQUENCES.length - 1 ? 600 : 400,
                }}
              >
                {item}
              </p>
            </li>
          ))}
        </ul>
      </div>

      {/* Divider */}
      <div className="h-px w-full mb-6" style={{ backgroundColor: "#F0F0F0" }} aria-hidden="true" />

      {/* Acknowledgement checkbox */}
      <label className="flex items-start gap-3 cursor-pointer group mb-6" htmlFor="del-agree">
        <div className="relative mt-0.5 flex-shrink-0">
          <input
            id="del-agree"
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="sr-only"
            aria-describedby="del-agree-desc"
          />
          {/* Custom checkbox */}
          <div
            className="w-5 h-5 rounded border-2 flex items-center justify-center transition-all duration-150"
            style={{
              borderColor: agreed ? "#D32F2F" : "#E0E0E0",
              backgroundColor: agreed ? "#D32F2F" : "#FFFFFF",
            }}
            aria-hidden="true"
          >
            {agreed && (
              <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
        </div>
        <p
          id="del-agree-desc"
          style={{
            color: "#212121",
            fontSize: "14px",
            lineHeight: "20px",
            userSelect: "none",
          }}
        >
          I understand that this action is{" "}
          <strong style={{ color: "#D32F2F" }}>permanent and cannot be undone</strong>
          , and I wish to proceed with deleting my account.
        </p>
      </label>

      {/* Action row */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        {/* Delete My Account — destructive */}
        <button
          type="button"
          onClick={onDeleteClick}
          disabled={!agreed}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 h-12 rounded-md font-semibold text-white transition-all duration-150 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[rgba(211,47,47,0.4)] disabled:cursor-not-allowed"
          style={{
            fontSize: "14px",
            letterSpacing: "0.5px",
            backgroundColor: agreed ? "#D32F2F" : "#E0E0E0",
            color: agreed ? "#FFFFFF" : "#9E9E9E",
            boxShadow: agreed ? "0px 2px 4px rgba(211,47,47,0.3)" : "none",
          }}
          onMouseEnter={(e) => { if (agreed) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#B71C1C"; }}
          onMouseLeave={(e) => { if (agreed) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#D32F2F"; }}
          aria-disabled={!agreed}
          aria-label="Delete my account permanently"
        >
          <Trash2 size={15} aria-hidden="true" />
          Delete My Account
        </button>

        {/* Cancel — subdued text link */}
        <button
          type="button"
          onClick={onCancel}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 h-12 px-4 text-sm font-medium text-[#9E9E9E] hover:text-[#212121] hover:underline underline-offset-2 transition-colors"
        >
          <XCircle size={14} aria-hidden="true" />
          Cancel — Return to Account Settings
        </button>
      </div>
    </div>
  );
}
