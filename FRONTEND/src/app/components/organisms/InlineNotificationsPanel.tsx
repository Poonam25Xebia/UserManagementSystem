import { useState } from "react";
import { KeyRound, Smartphone, ShieldCheck, Bell } from "lucide-react";

interface InlineNotif {
  id: number;
  icon: React.ElementType;
  iconColor: string;
  accentColor: string;   /* left border colour */
  message: string;
  time: string;
}

const INITIAL: InlineNotif[] = [
  {
    id: 1,
    icon: KeyRound,
    iconColor: "#FF6D00",
    accentColor: "#FF6D00",
    message: "Password changed successfully.",
    time: "2 mins ago",
  },
  {
    id: 2,
    icon: Smartphone,
    iconColor: "#FBC02D",
    accentColor: "#FBC02D",
    message: "New device detected on your account.",
    time: "15 mins ago",
  },
  {
    id: 3,
    icon: ShieldCheck,
    iconColor: "#388E3C",
    accentColor: "#388E3C",
    message: "Account identity verified.",
    time: "1 hr ago",
  },
];

export function InlineNotificationsPanel() {
  const [items, setItems] = useState<InlineNotif[]>(INITIAL);

  const dismiss = (id: number) => setItems((prev) => prev.filter((n) => n.id !== id));

  return (
    <section
      aria-labelledby="inline-notif-heading"
      className="flex flex-col rounded-lg border border-[#E0E0E0] bg-white overflow-hidden h-full"
      style={{ boxShadow: "0px 2px 8px rgba(0,0,0,0.06)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#E0E0E0]">
        <div className="flex items-center gap-2">
          <Bell size={16} style={{ color: "#1A73E8" }} aria-hidden="true" />
          <h2
            id="inline-notif-heading"
            style={{ color: "#212121", fontSize: "18px", fontWeight: 600, lineHeight: "28px" }}
          >
            Notifications
          </h2>
          {items.length > 0 && (
            <span
              className="inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-semibold text-white"
              style={{ backgroundColor: "#1A73E8" }}
              aria-label={`${items.length} notifications`}
            >
              {items.length}
            </span>
          )}
        </div>
      </div>

      {/* Notification cards */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 py-10">
          <Bell size={28} style={{ color: "#E0E0E0", marginBottom: 8 }} aria-hidden="true" />
          <p style={{ color: "#9E9E9E", fontSize: "14px" }}>All caught up!</p>
        </div>
      ) : (
        <ul role="list" className="flex flex-col gap-3 p-4 flex-1">
          {items.map((n) => {
            const Icon = n.icon;
            return (
              <li
                key={n.id}
                className="flex gap-3 rounded-md border border-[#E0E0E0] p-4 relative overflow-hidden"
                style={{ backgroundColor: "#FFFFFF" }}
              >
                {/* Left accent border */}
                <span
                  className="absolute left-0 top-0 bottom-0 w-1 rounded-l-md"
                  style={{ backgroundColor: n.accentColor }}
                  aria-hidden="true"
                />

                {/* Icon */}
                <span
                  className="inline-flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0 ml-1"
                  style={{ backgroundColor: `${n.iconColor}18`, color: n.iconColor }}
                  aria-hidden="true"
                >
                  <Icon size={16} strokeWidth={1.75} />
                </span>

                {/* Content */}
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                  <p style={{ color: "#212121", fontSize: "14px", lineHeight: "20px", fontWeight: 400 }}>
                    {n.message}
                  </p>

                  {/* Time + Dismiss — same row */}
                  <div className="flex items-center justify-between gap-2">
                    <time
                      dateTime={n.time}
                      style={{ color: "#9E9E9E", fontSize: "12px", lineHeight: "16px", letterSpacing: "0.25px" }}
                    >
                      {n.time}
                    </time>
                    <button
                      onClick={() => dismiss(n.id)}
                      className="text-xs font-medium text-[#9E9E9E] hover:text-[#D32F2F] transition-colors underline-offset-2 hover:underline"
                      aria-label={`Dismiss: ${n.message}`}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
