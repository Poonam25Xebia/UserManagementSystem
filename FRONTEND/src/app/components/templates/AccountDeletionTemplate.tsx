import { useState } from "react";
import { useNavigate } from "react-router";
import { Trash2, CheckCircle, MailCheck, AlertCircle } from "lucide-react";
import { AuthHeader }                from "../organisms/AuthHeader";
import { WarningBanner }             from "../molecules/WarningBanner";
import { IdentityVerificationCard }  from "../organisms/IdentityVerificationCard";
import { AccountDeletionCard }       from "../organisms/AccountDeletionCard";
import { DeleteConfirmationModal }   from "../organisms/DeleteConfirmationModal";
import { OtpInputGroup }             from "../molecules/OtpInputGroup";
import { Footer }                    from "../organisms/Footer";
import { requestAccountDeletion, confirmAccountDeletion, type ApiResult } from "../../lib/api-client";
import { getSessionToken, getSessionEmail, clearSession } from "../../lib/session";
import { useCurrentUser } from "../../lib/useCurrentUser";
import type { RequestDeletionErrorResponse, ConfirmDeletionErrorResponse } from "../../types/deletion.types";

function messageForRequestError(
  result: Extract<ApiResult<unknown, RequestDeletionErrorResponse>, { ok: false }>
): string {
  switch (result.status) {
    case 403:
      return "Your account is not active, so a deletion request can't be started.";
    case 409:
      return "You already have a pending deletion request. Check your email for the confirmation code.";
    default:
      return result.body.message ?? result.body.error ?? "Something went wrong. Please try again.";
  }
}

function messageForConfirmError(
  result: Extract<ApiResult<unknown, ConfirmDeletionErrorResponse>, { ok: false }>
): string {
  switch (result.body.error_code) {
    case "DELETION_OTP_EXPIRED":
      return "This code has expired. Please start the deletion request again.";
    case "DELETION_OTP_INVALID":
      return "That code isn't correct. Please try again.";
    case "DELETION_REQUEST_NOT_FOUND":
      return "This deletion request is no longer pending. Please start again.";
    default:
      return result.body.message ?? result.body.error ?? "Something went wrong. Please try again.";
  }
}

/* ── Final success state — account permanently deleted ──── */
function AccountDeletedScreen() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center text-center gap-5 py-12">
      <span
        className="inline-flex items-center justify-center w-20 h-20 rounded-full"
        style={{ backgroundColor: "rgba(56,142,60,0.10)" }}
        aria-hidden="true"
      >
        <CheckCircle size={40} style={{ color: "#388E3C" }} />
      </span>
      <div className="flex flex-col gap-2">
        <h2 style={{ color: "#212121" }}>Account Deleted</h2>
        <p style={{ color: "#9E9E9E", fontSize: "14px", lineHeight: "20px", maxWidth: 380 }}>
          Your account has been permanently deleted. All personal data has been
          removed from our systems. We're sorry to see you go.
        </p>
      </div>
      <button
        onClick={() => navigate("/")}
        className="mt-2 inline-flex items-center gap-2 px-6 h-12 rounded-md text-sm font-semibold text-white bg-[#1A73E8] hover:bg-[#1557B0] transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[rgba(26,115,232,0.4)]"
        style={{ boxShadow: "0px 2px 4px rgba(0,0,0,0.1)", letterSpacing: "0.5px" }}
      >
        Return to Home
      </button>
    </div>
  );
}

/* ── Page ────────────────────────────────────────────── */
export function AccountDeletionTemplate() {
  const navigate = useNavigate();
  const { profile } = useCurrentUser();

  const userName  = profile?.username ?? "";
  const userEmail = profile?.email ?? getSessionEmail() ?? "user@example.com";

  const [verified, setVerified]         = useState(false);
  const [modalOpen, setModalOpen]       = useState(false);
  const [requesting, setRequesting]     = useState(false);
  const [requestError, setRequestError] = useState("");
  const [awaitingCode, setAwaitingCode] = useState(false);
  const [code, setCode]                 = useState("");
  const [confirming, setConfirming]     = useState(false);
  const [confirmError, setConfirmError] = useState("");
  const [deleted, setDeleted]           = useState(false);

  const handleVerified    = () => setVerified(true);
  const handleDeleteClick = () => {
    setRequestError("");
    setModalOpen(true);
  };
  const handleModalCancel = () => {
    if (requesting) return;
    setModalOpen(false);
    setRequestError("");
  };
  const handleCancel = () => navigate(-1);

  const handleRequestConfirmed = async () => {
    const token = getSessionToken();
    if (!token) {
      navigate("/login");
      return;
    }

    setRequesting(true);
    setRequestError("");

    const result = await requestAccountDeletion(token);

    setRequesting(false);

    if (result.ok) {
      setModalOpen(false);
      setAwaitingCode(true);
    } else {
      setRequestError(messageForRequestError(result));
    }
  };

  const handleCodeComplete = async (submittedCode: string) => {
    const token = getSessionToken();
    if (!token) {
      navigate("/login");
      return;
    }

    setConfirming(true);
    setConfirmError("");

    const result = await confirmAccountDeletion(token, submittedCode);

    setConfirming(false);

    if (result.ok) {
      clearSession();
      setDeleted(true);
    } else {
      setCode("");
      setConfirmError(messageForConfirmError(result));
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ fontFamily: "'Inter','SF Pro Text','Roboto',sans-serif", backgroundColor: "#F5F5F5" }}
    >
      {/* Skip link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 z-[100] px-4 py-2 rounded-md bg-[#1A73E8] text-white text-sm font-medium"
      >
        Skip to main content
      </a>

      {/* Authenticated header — keeps the user signed in across this flow */}
      <AuthHeader userName={userName} userEmail={userEmail} />

      {/* Main content — max-width 720px, centred */}
      <main
        id="main-content"
        className="flex-1 flex flex-col"
        style={{ paddingTop: "calc(64px + 48px)", paddingBottom: "48px" }}
      >
        <div className="w-full mx-auto px-4 sm:px-6 flex flex-col gap-6" style={{ maxWidth: "720px" }}>

          {deleted ? (
            /* ── Final success ─────────────────────────────── */
            <AccountDeletedScreen />
          ) : awaitingCode ? (
            /* ── Step 3 — enter the emailed confirmation code ── */
            <div className="flex flex-col items-center text-center gap-6 py-8">
              <span
                className="inline-flex items-center justify-center w-16 h-16 rounded-full"
                style={{ backgroundColor: "rgba(26,115,232,0.10)" }}
                aria-hidden="true"
              >
                <MailCheck size={30} style={{ color: "#1A73E8" }} />
              </span>
              <div className="flex flex-col gap-2">
                <h2 style={{ color: "#212121" }}>Enter Confirmation Code</h2>
                <p style={{ color: "#9E9E9E", fontSize: "14px", lineHeight: "20px", maxWidth: 420 }}>
                  We've sent a 6-digit code to your email address. Enter it below to
                  permanently delete your account.
                </p>
              </div>

              <div className="w-full" style={{ maxWidth: 360 }}>
                <OtpInputGroup
                  value={code}
                  onChange={setCode}
                  onComplete={handleCodeComplete}
                  hasError={Boolean(confirmError)}
                  disabled={confirming}
                />
              </div>

              {confirmError && (
                <div
                  role="alert"
                  className="flex items-center gap-2.5 px-4 py-3 rounded-md border"
                  style={{ backgroundColor: "#FFEBEE", borderColor: "#D32F2F" }}
                >
                  <AlertCircle size={16} style={{ color: "#D32F2F" }} aria-hidden="true" />
                  <p style={{ color: "#B71C1C", fontSize: "14px", lineHeight: "20px" }}>{confirmError}</p>
                </div>
              )}

              {confirming && (
                <p style={{ color: "#9E9E9E", fontSize: "13px" }}>Confirming…</p>
              )}
            </div>
          ) : (
            <>
              {/* Page title — H1, centered */}
              <div className="flex flex-col items-center gap-2 text-center">
                <span
                  className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-1"
                  style={{ backgroundColor: "rgba(211,47,47,0.10)" }}
                  aria-hidden="true"
                >
                  <Trash2 size={26} style={{ color: "#D32F2F" }} />
                </span>
                <h1 style={{ color: "#212121" }}>Delete Your Account</h1>
                <p style={{ color: "#9E9E9E", fontSize: "14px", lineHeight: "20px", maxWidth: 480 }}>
                  Follow the steps below to permanently remove your account and all associated data.
                </p>
              </div>

              {/* Warning banner */}
              <WarningBanner
                title="Warning"
                message="This action is permanent and cannot be undone. All your personal data will be removed from the system."
              />

              {/* Step indicator */}
              <div className="flex items-center gap-3" aria-label="Progress steps">
                {/* Step 1 */}
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold"
                    style={{
                      backgroundColor: verified ? "rgba(56,142,60,0.10)" : "#1A73E8",
                      color:           verified ? "#388E3C"                : "#FFFFFF",
                      border:          verified ? "2px solid #388E3C"      : "none",
                    }}
                    aria-current={!verified ? "step" : undefined}
                  >
                    {verified ? "✓" : "1"}
                  </span>
                  <span style={{ color: "#212121", fontSize: "13px", fontWeight: 500 }}>
                    Verify Identity
                  </span>
                </div>
                {/* Connector */}
                <div
                  className="flex-1 h-0.5 rounded"
                  style={{ backgroundColor: verified ? "#388E3C" : "#E0E0E0" }}
                  aria-hidden="true"
                />
                {/* Step 2 */}
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold"
                    style={{
                      backgroundColor: verified ? "#D32F2F"               : "#F5F5F5",
                      color:           verified ? "#FFFFFF"                : "#9E9E9E",
                      border:          verified ? "none"                   : "2px solid #E0E0E0",
                    }}
                    aria-current={verified ? "step" : undefined}
                  >
                    2
                  </span>
                  <span style={{ color: verified ? "#212121" : "#9E9E9E", fontSize: "13px", fontWeight: 500 }}>
                    Delete Account
                  </span>
                </div>
              </div>

              {/* Card 1 — Identity Verification (always visible, collapses after verify) */}
              {!verified && (
                <IdentityVerificationCard
                  email={userEmail}
                  onVerified={handleVerified}
                />
              )}

              {/* Verified confirmation banner */}
              {verified && (
                <div
                  role="status"
                  aria-live="polite"
                  className="flex items-center gap-3 px-5 py-3.5 rounded-lg border"
                  style={{ backgroundColor: "rgba(56,142,60,0.06)", borderColor: "#388E3C" }}
                >
                  <CheckCircle size={18} style={{ color: "#388E3C" }} aria-hidden="true" />
                  <p style={{ color: "#1B5E20", fontSize: "14px", fontWeight: 500, lineHeight: "20px" }}>
                    Identity verified successfully. You may now proceed with account deletion.
                  </p>
                </div>
              )}

              {/* Card 2 — Account Deletion (revealed after verification) */}
              {verified && (
                <div
                  className="animate-in slide-in-from-bottom-4 duration-300"
                  aria-label="Account deletion options, now available"
                >
                  <AccountDeletionCard
                    onDeleteClick={handleDeleteClick}
                    onCancel={handleCancel}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </main>

      <Footer />

      {/* Confirmation modal */}
      <DeleteConfirmationModal
        isOpen={modalOpen}
        loading={requesting}
        error={requestError}
        onConfirm={handleRequestConfirmed}
        onCancel={handleModalCancel}
      />
    </div>
  );
}
