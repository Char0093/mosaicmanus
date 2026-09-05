import { Bell, Check, X } from "lucide-react";
import { useState } from "react";
import { trpc } from "@/lib/trpc";

type Audience = "educator" | "tutor" | "student";
export default function NotificationCenter({ audience, learnerId }: { audience: Audience; learnerId?: string }) {
  const [open, setOpen] = useState(false);
  const notifications = trpc.mosaic.notifications.useQuery({ audience, learnerId }, { refetchInterval: 15000 });
  const markRead = trpc.mosaic.markNotificationRead.useMutation({ onSuccess: () => notifications.refetch() });
  const unread = notifications.data?.filter((item) => !item.readAt).length ?? 0;
  return <div className="notification-center"><button className="bell" aria-label="Open notifications" onClick={() => setOpen((value) => !value)}><Bell size={18} />{unread > 0 && <i>{unread > 9 ? "9+" : unread}</i>}</button>{open && <div className="notification-popover"><header><div><div className="eyebrow">Inbox</div><b>Notifications</b></div><button className="notification-close" onClick={() => setOpen(false)}><X size={15} /></button></header>{notifications.isLoading ? <p className="notification-empty">Checking for updates…</p> : notifications.data?.length ? <div className="notification-list">{notifications.data.map((item) => <article className={item.readAt ? "notification-item notification-item--read" : "notification-item"} key={item.id}><div><b>{item.title}</b><p>{item.body}</p><small>{item.readAt ? "Read" : "New"}</small></div>{!item.readAt && <button aria-label="Mark notification read" onClick={() => markRead.mutate({ id: item.id })}><Check size={14} /></button>}</article>)}</div> : <p className="notification-empty">You’re all caught up.</p>}</div>}</div>;
}
