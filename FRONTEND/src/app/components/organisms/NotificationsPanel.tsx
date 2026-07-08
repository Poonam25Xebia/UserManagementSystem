import { useState } from "react";
import { X, Bell, CheckCheck } from "lucide-react";

interface Notification {
  id: number;
  title: string;
  body: string;
  time: string;
  read: boolean;
}

const INITIAL: Notification[] = [
  { id: 1, title: "New user registered",          body: "Alex Johnson completed registration.",      time: "10:30 AM",    read: false },
  { id: 2, title: "OTP verification completed",   body: "User #4821 verified their email address.", time: "Yesterday",   read: false },
  { id: 3, title: "Revenue milestone reached",    body: "Monthly revenue crossed $98K.",            time: "2 days ago",  read: true  },
  { id: 4, title: "Scheduled maintenance",        body: "System maintenance on Sunday 2–4 AM.",    time: "3 days ago",  read: true  },
];

export function NotificationsPanel() {
  const [items, setItems] = useState<Notification[]>(INITIAL);

  const dismiss = (id: number) =>
    setItems((prev) => prev.filter((n) => n.id !== id));

  const markAllRead = () =>
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));

  const unreadCount = items.filter((n) => !n.read).length;

  return (
    <section
      aria-labelledby="notif-heading"
      className="rounded-lg border border-[#E0E0E0] bg-white overflow-hidden"
      style={{ boxShadow: "0px 2px 8px rgba(0,0,0,0.06)" }}
    >
      {/* Panel header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#E0E0E0]">
        <div className="flex items-center gap-2">
          <Bell size={16} style={{ color: "#1A73E8" }} aria-hidden="true" />
          <h2 id="notif-heading" style={{ color: "#212121", fontSize: "16px", fontWeight: 600, lineHeight: "24px" }}>
            Notifications
          </h2>
          {unreadCount > 0 && (
            <span
              className="inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-semibold text-white"
              style={{ backgroundColor: "#1A73E8" }}
              aria-label={`${unreadCount} unread`}
            >
              {unreadCount}
            </span>
          )}
        </div>

        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-1 text-xs font-medium text-[#1A73E8] hover:text-[#1557B0] hover:underline underline-offset-2 transition-colors"
            aria-label="Mark all notifications as read"
          >
            <CheckCheck size={13} aria-hidden="true" />
            Mark all read
          </button>
        )}
      </div>

      {/* Notification list */}
      {items.length === 0 ? (
        <div className="py-10 text-center">
          <Bell size={28} style={{ color: "#E0E0E0", margin: "0 auto 8px" }} aria-hidden="true" />
          <p style={{ color: "#9E9E9E", fontSize: "14px" }}>No notifications</p>
        </div>
      ) : (
        <ul role="list" className="divide-y divide-[#E0E0E0]">
          {items.map((n) => (
            <li
              key={n.id}
              className="flex items-start gap-3 px-5 py-4 transition-colors duration-150"
              style={{ backgroundColor: n.read ? "#FFFFFF" : "rgba(26,115,232,0.03)" }}
            >
              {/* Unread dot */}
              <span
                className="mt-1.5 flex-shrink-0 w-2 h-2 rounded-full transition-opacity"
                style={{
                  backgroundColor: "#1A73E8",
                  opacity: n.read ? 0 : 1,
                }}
                aria-hidden="true"
              />

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p
                  className="truncate"
                  style={{
                    color: "#212121",
                    fontSize: "13px",
                    fontWeight: n.read ? 400 : 600,
                    lineHeight: "18px",
                  }}
                >
                  {n.title}
                </p>
                <p
                  className="mt-0.5 text-[12px] leading-4 line-clamp-1"
                  style={{ color: "#9E9E9E" }}
                >
                  {n.body}
                </p>
                <p className="mt-1" style={{ color: "#9E9E9E", fontSize: "11px", lineHeight: "16px", letterSpacing: "0.25px" }}>
                  {n.time}
                </p>
              </div>

              {/* Dismiss [X] */}
              <button
                onClick={() => dismiss(n.id)}
                aria-label={`Dismiss notification: ${n.title}`}
                className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-md text-[#9E9E9E] hover:text-[#D32F2F] hover:bg-[#FFEBEE] transition-colors"
              >
                <X size={13} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Footer link */}
      <div className="px-5 py-3 border-t border-[#E0E0E0] text-center">
        <a
          href="#"
          className="text-sm font-medium text-[#1A73E8] hover:text-[#1557B0] hover:underline underline-offset-2 transition-colors"
        >
          View All Notifications
        </a>
      </div>
    </section>
  );
}
