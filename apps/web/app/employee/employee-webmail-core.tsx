"use client";

import * as React from "react";
import { Mail, Paperclip, RefreshCw, Search, Send, Star, Trash2 } from "lucide-react";

import { GlassBadge, GlassButton, GlassCard, GlassInput } from "@jposta/ui";

import {
  jpostaApi,
  type WebmailFolder,
  type WebmailMessage,
  type WebmailMessageDetail,
  type WebmailMe,
} from "@/lib/api-client";
import { formString } from "@/lib/form";
import { clearWebmailSession, getStoredWebmailSession } from "@/lib/webmail-session";

export function EmployeeWebmailCore() {
  const [token, setToken] = React.useState<string | null>(null);
  const [me, setMe] = React.useState<WebmailMe | null>(null);
  const [folders, setFolders] = React.useState<WebmailFolder[]>([]);
  const [folder, setFolder] = React.useState("INBOX");
  const [messages, setMessages] = React.useState<WebmailMessage[]>([]);
  const [selected, setSelected] = React.useState<WebmailMessageDetail | null>(null);
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState("Loading webmail...");
  const [composeOpen, setComposeOpen] = React.useState(false);

  React.useEffect(() => {
    const stored = getStoredWebmailSession();
    if (!stored) {
      setStatus("Sign in from your organization mail portal to load live mail.");
      return;
    }
    setToken(stored.token);
    void bootstrap(stored.token);
  }, []);

  async function bootstrap(activeToken: string) {
    try {
      const [nextMe, nextFolders] = await Promise.all([
        jpostaApi.webmailMe(activeToken),
        jpostaApi.webmailFolders(activeToken),
      ]);
      setMe(nextMe);
      setFolders(nextFolders.folders);
      await loadMessages(activeToken, folder);
    } catch {
      clearWebmailSession();
      setStatus("Your webmail session expired. Sign in from your mail portal again.");
    }
  }

  async function loadMessages(activeToken = token, nextFolder = folder, nextSearch = search) {
    if (!activeToken) return;
    setStatus("Loading messages...");
    try {
      const query = new URLSearchParams({ folder: nextFolder, page: "1", pageSize: "25" });
      if (nextSearch.trim()) query.set("search", nextSearch.trim());
      const result = await jpostaApi.webmailMessages(activeToken, `?${query.toString()}`);
      setMessages(result.messages);
      setFolder(result.folder);
      setSelected(null);
      setStatus(result.messages.length ? "Messages loaded." : "This folder is empty.");
    } catch {
      setStatus("Mail storage is temporarily unavailable.");
    }
  }

  async function openMessage(message: WebmailMessage) {
    if (!token) return;
    try {
      const detail = await jpostaApi.webmailMessage(token, message.uid, folder);
      setSelected(detail);
    } catch {
      setStatus("Message could not be opened.");
    }
  }

  async function sendMessage(formData: FormData) {
    if (!token) return;
    try {
      await jpostaApi.webmailSend(token, {
        to: formString(formData, "to"),
        subject: formString(formData, "subject"),
        text: formString(formData, "text"),
      });
      setComposeOpen(false);
      setStatus("Message sent.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Message could not be sent.");
    }
  }

  async function deleteSelected() {
    if (!token || !selected) return;
    await jpostaApi.webmailDelete(token, selected.uid, folder).catch(() => null);
    await loadMessages();
  }

  return (
    <GlassCard className="mb-4 grid gap-4 p-4 sm:p-5" intensity="soft">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <GlassBadge tone="premium">Webmail Core</GlassBadge>
          <h2 className="mt-2 text-xl font-semibold text-foreground">
            {me?.mailbox.address ?? "Employee mailbox"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {me?.portal.organizationName ?? status}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <GlassButton onClick={() => setComposeOpen(true)}>
            <Send className="h-4 w-4" />
            Compose
          </GlassButton>
          <GlassButton onClick={() => loadMessages()}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </GlassButton>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[12rem_minmax(0,0.95fr)_minmax(0,1.15fr)]">
        <div className="grid content-start gap-2">
          {(folders.length ? folders : [{ path: "INBOX", name: "Inbox", total: 0, unread: 0 }]).map(
            (item) => (
              <button
                className={`rounded-2xl border px-3 py-2 text-left text-sm ${folder === item.path ? "border-sky-200 bg-sky-50 text-sky-800" : "border-glass-edge/24 bg-white/60 text-muted-foreground"}`}
                key={item.path}
                onClick={() => loadMessages(token, item.path)}
                type="button"
              >
                <span className="font-medium">{item.name}</span>
                <span className="ml-2 text-xs">
                  {item.unread ? `${item.unread} unread` : item.total}
                </span>
              </button>
            ),
          )}
        </div>
        <div className="grid content-start gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <GlassInput
              className="pl-9"
              placeholder="Search messages"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void loadMessages();
              }}
            />
          </div>
          {messages.map((message) => (
            <button
              className="rounded-2xl border border-glass-edge/24 bg-white/64 p-3 text-left shadow-inner-glass transition hover:bg-white"
              key={message.uid}
              onClick={() => openMessage(message)}
              type="button"
            >
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className={message.unread ? "font-bold" : "font-medium"}>{message.from}</span>
                <span className="text-xs text-muted-foreground">
                  {message.date ? new Date(message.date).toLocaleString() : ""}
                </span>
              </div>
              <p className="mt-1 truncate text-sm font-medium text-foreground">{message.subject}</p>
              <p className="truncate text-xs text-muted-foreground">{message.preview}</p>
              <div className="mt-2 flex gap-2 text-sky-700">
                {message.starred ? <Star className="h-3.5 w-3.5" /> : null}
                {message.hasAttachments ? <Paperclip className="h-3.5 w-3.5" /> : null}
              </div>
            </button>
          ))}
        </div>
        <div className="min-h-80 rounded-3xl border border-glass-edge/24 bg-white/64 p-4 shadow-inner-glass">
          {selected ? (
            <div className="grid gap-3">
              <div className="flex justify-between gap-3">
                <h3 className="text-xl font-semibold text-foreground">{selected.subject}</h3>
                <GlassButton size="sm" variant="ghost" onClick={deleteSelected}>
                  <Trash2 className="h-4 w-4" />
                  Delete
                </GlassButton>
              </div>
              <p className="text-sm text-muted-foreground">
                From {selected.from} to {selected.to}
              </p>
              <div
                className="prose prose-sm max-w-none text-foreground"
                dangerouslySetInnerHTML={{
                  __html: selected.sanitizedHtml || selected.text.replace(/\n/g, "<br />"),
                }}
              />
              {selected.attachments.length ? (
                <div className="grid gap-2">
                  {selected.attachments.map((attachment) => (
                    <div
                      className="rounded-2xl border border-glass-edge/24 bg-white/70 p-3 text-sm"
                      key={attachment.partId}
                    >
                      <Paperclip className="mr-2 inline h-4 w-4" />
                      {attachment.filename}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="flex h-full min-h-72 items-center justify-center text-sm text-muted-foreground">
              <Mail className="mr-2 h-4 w-4" />
              Select a message
            </div>
          )}
        </div>
      </div>

      {composeOpen ? (
        <div className="fixed bottom-6 right-6 z-50 w-[min(42rem,calc(100vw-2rem))] rounded-[1.5rem] border border-glass-edge/32 bg-white/95 p-4 shadow-glass">
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void sendMessage(new FormData(event.currentTarget));
            }}
          >
            <GlassInput name="to" placeholder="To" required />
            <GlassInput name="subject" placeholder="Subject" />
            <textarea
              className="min-h-40 rounded-control border border-input bg-white/95 p-3 text-sm outline-none"
              name="text"
              placeholder="Write your message"
            />
            <div className="flex justify-between gap-2">
              <GlassButton type="submit" variant="primary">
                Send
              </GlassButton>
              <GlassButton type="button" variant="ghost" onClick={() => setComposeOpen(false)}>
                Discard
              </GlassButton>
            </div>
          </form>
        </div>
      ) : null}
    </GlassCard>
  );
}