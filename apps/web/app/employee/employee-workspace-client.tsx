"use client";

import * as React from "react";
import { Archive, ArrowLeft, Download, Forward, Mail, MailPlus, Paperclip, RefreshCw, Reply, ReplyAll, Save, Search, Send, Star, Trash2, X } from "lucide-react";
import { AppShell, GlassBadge, GlassButton, GlassCard, GlassInput, StatusIndicator, type QuickAction, type ShellIconKey, type ShellNavItem } from "@jposta/ui";
import { jpostaApi, type WebmailFolder, type WebmailMe, type WebmailMessage, type WebmailMessageDetail } from "@/lib/api-client";
import { clearWebmailSession, getStoredWebmailSession } from "@/lib/webmail-session";

type ComposeMode = "compose" | "reply" | "reply-all" | "forward";
type Notice = { message: string; tone: "info" | "success" | "error" };
type ComposeState = { attachments: File[]; bcc: string; body: string; cc: string; draftUid?: number; inReplyTo?: string; mode: ComposeMode; open: boolean; references?: string; subject: string; to: string };

type MessagePage = { folder: string; hasMore: boolean; messages: WebmailMessage[]; page: number; pageSize: number; total: number };

const pageSize = 25;
const blankPage: MessagePage = { folder: "INBOX", hasMore: false, messages: [], page: 1, pageSize, total: 0 };
const blankCompose: ComposeState = { attachments: [], bcc: "", body: "", cc: "", mode: "compose", open: false, subject: "", to: "" };
const folderConfig: Array<{ aliases: string[]; iconKey: ShellIconKey; label: string }> = [
  { label: "Inbox", iconKey: "inbox", aliases: ["inbox"] },
  { label: "Starred", iconKey: "starred", aliases: ["starred", "flagged", "important"] },
  { label: "Sent", iconKey: "sent", aliases: ["sent"] },
  { label: "Drafts", iconKey: "drafts", aliases: ["draft"] },
  { label: "Spam", iconKey: "spam", aliases: ["spam", "junk"] },
  { label: "Archive", iconKey: "archive", aliases: ["archive", "all mail"] },
  { label: "Trash", iconKey: "trash", aliases: ["trash", "deleted"] },
];

export function EmployeeWorkspaceClient() {
  const [token, setToken] = React.useState<string | null>(null);
  const [identity, setIdentity] = React.useState<WebmailMe | null>(null);
  const [folders, setFolders] = React.useState<WebmailFolder[]>([]);
  const [activeFolder, setActiveFolder] = React.useState("INBOX");
  const [page, setPage] = React.useState<MessagePage>(blankPage);
  const [selected, setSelected] = React.useState<WebmailMessageDetail | null>(null);
  const [selectedUid, setSelectedUid] = React.useState<number | null>(null);
  const [search, setSearch] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [messagesLoading, setMessagesLoading] = React.useState(false);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [mobileDetail, setMobileDetail] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<Notice | null>(null);
  const [compose, setCompose] = React.useState<ComposeState>(blankCompose);
  const [sending, setSending] = React.useState(false);
  const [savingDraft, setSavingDraft] = React.useState(false);
  const bootstrapped = React.useRef(false);

  const mailbox = identity?.mailbox.address ?? "";
  const displayName = friendlyName(identity?.mailbox.displayName, mailbox);
  const workspace = identity?.portal.displayName || identity?.portal.organizationName || "JPosta Mail";
  const folder = folders.find((item) => item.path === activeFolder);
  const trash = /trash|deleted/i.test(activeFolder);

  const showNotice = React.useCallback((message: string, tone: Notice["tone"] = "info") => {
    setNotice({ message, tone });
    window.setTimeout(() => setNotice(null), 3500);
  }, []);
  const expire = React.useCallback(() => {
    clearWebmailSession();
    window.location.assign(window.location.origin);
  }, []);

  const loadMessages = React.useCallback(async (activeToken: string, nextFolder: string, nextPage = 1, nextSearch = search, keep = false) => {
    setMessagesLoading(true);
    setError(null);
    setActiveFolder(nextFolder);
    if (!keep) {
      setSelected(null);
      setSelectedUid(null);
      setMobileDetail(false);
      setPage({ ...blankPage, folder: nextFolder, page: nextPage });
    }
    try {
      const params = new URLSearchParams({ folder: nextFolder, page: String(nextPage), pageSize: String(pageSize) });
      if (nextSearch.trim()) params.set("search", nextSearch.trim());
      const result = await jpostaApi.webmailMessages(activeToken, `?${params.toString()}`);
      setPage({ ...result, folder: nextFolder });
    } catch (caught) {
      if (isExpired(caught)) expire();
      else setError(caught instanceof Error ? caught.message : "We couldn't connect to your mailbox. Please try again.");
    } finally {
      setMessagesLoading(false);
    }
  }, [expire, search]);

  const refresh = React.useCallback(async (activeToken = token, folderPath = activeFolder, keep = true) => {
    if (!activeToken) return;
    setError(null);
    try {
      const [me, folderResult] = await Promise.all([jpostaApi.webmailMe(activeToken), jpostaApi.webmailFolders(activeToken)]);
      setIdentity(me);
      setFolders(folderResult.folders);
      await loadMessages(activeToken, resolveFolder(folderResult.folders, folderPath), page.page, search, keep);
    } catch (caught) {
      if (isExpired(caught)) expire();
      else setError(caught instanceof Error ? caught.message : "We couldn't connect to your mailbox. Please try again.");
    }
  }, [activeFolder, expire, loadMessages, page.page, search, token]);

  React.useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    const stored = getStoredWebmailSession();
    if (!stored) { setLoading(false); setError("Loading your mailbox failed. Please sign in from your company portal."); return; }
    setToken(stored.token);
    void refresh(stored.token, "INBOX", false).finally(() => setLoading(false));
  }, [refresh]);

  React.useEffect(() => {
    if (!token) return;
    let running = false;
    const id = window.setInterval(() => {
      if (document.visibilityState === "hidden" || running) return;
      running = true;
      void refresh(token, activeFolder, true).finally(() => { running = false; });
    }, 45000);
    return () => window.clearInterval(id);
  }, [activeFolder, refresh, token]);

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && compose.open) void closeComposer();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  async function openFolder(path: string) {
    if (token) await loadMessages(token, path, 1, search, false);
  }

  async function openMessage(message: WebmailMessage) {
    if (!token) return;
    setSelectedUid(message.uid);
    setDetailLoading(true);
    setError(null);
    try {
      const detail = await jpostaApi.webmailMessage(token, message.uid, activeFolder);
      setSelected(detail);
      setMobileDetail(true);
      if (detail.unread) await setRead(detail, true, true);
    } catch (caught) {
      if (isExpired(caught)) expire();
      else setError("This email is no longer available.");
    } finally {
      setDetailLoading(false);
    }
  }

  async function setRead(message = selected, read?: boolean, silent = false) {
    if (!token || !message) return;
    const nextRead = read ?? message.unread;
    patchMessage(message.uid, { unread: !nextRead });
    setSelected((current) => current?.uid === message.uid ? { ...current, unread: !nextRead } : current);
    try {
      await jpostaApi.webmailSetRead(token, message.uid, { folder: activeFolder, read: nextRead });
      await refresh(token, activeFolder, true);
    } catch (caught) {
      if (!silent) showActionError(caught);
    }
  }

  async function toggleStar(message = selected) {
    if (!token || !message) return;
    const starred = !message.starred;
    patchMessage(message.uid, { starred });
    setSelected((current) => current?.uid === message.uid ? { ...current, starred } : current);
    try {
      await jpostaApi.webmailSetStar(token, message.uid, { folder: activeFolder, starred });
      await refresh(token, activeFolder, true);
    } catch (caught) { showActionError(caught); }
  }

  async function moveSelected(path: string) {
    if (!token || !selected) return;
    const uid = selected.uid;
    removeMessage(uid);
    setSelected(null);
    try {
      await jpostaApi.webmailMove(token, uid, { fromFolder: activeFolder, toFolder: path });
      await refresh(token, activeFolder, false);
      showNotice("Email moved.", "success");
    } catch (caught) { showActionError(caught); await refresh(token, activeFolder, true); }
  }

  async function deleteSelected() {
    if (!token || !selected) return;
    if (trash && !window.confirm("Permanently delete this email?")) return;
    const uid = selected.uid;
    removeMessage(uid);
    setSelected(null);
    try {
      await jpostaApi.webmailDelete(token, uid, activeFolder);
      await refresh(token, activeFolder, false);
      showNotice(trash ? "Email deleted." : "Email moved to Trash.", "success");
    } catch (caught) { showActionError(caught); await refresh(token, activeFolder, true); }
  }

  function beginCompose(mode: ComposeMode = "compose") {
    if (!selected || mode === "compose") { setCompose({ ...blankCompose, mode, open: true }); return; }
    const forward = mode === "forward";
    setCompose({
      ...blankCompose,
      body: forward ? forwardedText(selected) : quotedText(selected),
      cc: mode === "reply-all" ? withoutSelf(selected.cc || "", mailbox) : "",
      ...(forward ? {} : { inReplyTo: selected.messageId, references: selected.messageId }),
      mode,
      open: true,
      subject: withPrefix(selected.subject, forward ? "Fwd:" : "Re:"),
      to: forward ? "" : mode === "reply-all" ? replyAllTo(selected, mailbox) : extractEmail(selected.from),
    });
  }

  async function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || sending) return;
    setSending(true);
    try {
      const data = new FormData();
      data.set("to", compose.to);
      data.set("cc", compose.cc);
      data.set("bcc", compose.bcc);
      data.set("subject", compose.subject);
      data.set("text", compose.body);
      if (compose.inReplyTo) data.set("inReplyTo", compose.inReplyTo);
      if (compose.references) data.set("references", compose.references);
      compose.attachments.forEach((file) => data.append("attachments", file));
      await jpostaApi.webmailSendForm(token, data);
      setCompose(blankCompose);
      showNotice("Message sent", "success");
      const sent = findFolder(folders, "Sent")?.path;
      if (sent && activeFolder === sent) await loadMessages(token, sent, 1, search, false);
    } catch (caught) {
      if (isExpired(caught)) expire();
      else showNotice("Your message could not be sent. Please try again.", "error");
    } finally { setSending(false); }
  }

  async function saveDraft() {
    if (!token || savingDraft || !hasComposeContent(compose)) return;
    setSavingDraft(true);
    try {
      const result = await jpostaApi.webmailSaveDraft(token, { to: compose.to || mailbox, cc: compose.cc, bcc: compose.bcc, subject: compose.subject, text: compose.body }, compose.draftUid);
      setCompose((current) => ({ ...current, draftUid: result.uid }));
      await refresh(token, activeFolder, true);
      showNotice("Draft saved", "success");
    } catch (caught) { showActionError(caught); }
    finally { setSavingDraft(false); }
  }

  async function closeComposer() {
    if (hasComposeContent(compose) && !window.confirm("Discard this message?")) return;
    if (token && compose.draftUid) await jpostaApi.webmailDeleteDraft(token, compose.draftUid).catch(() => null);
    setCompose(blankCompose);
  }

  async function downloadAttachment(attachment: WebmailMessageDetail["attachments"][number]) {
    if (!token || !selected) return;
    try {
      const response = await jpostaApi.webmailAttachment(token, selected.uid, attachment.partId, activeFolder);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = attachment.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch { showNotice("Attachment could not be downloaded.", "error"); }
  }

  function patchMessage(uid: number, patch: Partial<WebmailMessage>) {
    setPage((current) => ({ ...current, messages: current.messages.map((message) => message.uid === uid ? { ...message, ...patch } : message) }));
  }
  function removeMessage(uid: number) {
    setPage((current) => ({ ...current, total: Math.max(0, current.total - 1), messages: current.messages.filter((message) => message.uid !== uid) }));
  }
  function showActionError(caught: unknown) {
    if (isExpired(caught)) expire();
    else showNotice("Action could not be completed. Please try again.", "error");
  }

  const navigation = makeNavigation(folders, activeFolder, (path) => void openFolder(path));
  const quickActions: QuickAction[] = [
    { label: "Compose", iconKey: "compose", onClick: () => beginCompose("compose") },
    { label: "Reply", iconKey: "reply", onClick: () => beginCompose("reply") },
    { label: "Forward", iconKey: "sent", onClick: () => beginCompose("forward") },
    { label: "Refresh", iconKey: "search", onClick: () => void refresh() },
  ];

  return (
    <AppShell
      currentSection={folder?.name || "Inbox"}
      navigation={navigation}
      quickActions={quickActions}
      quickActionsMode="floating"
      searchPlaceholder="Search emails, contacts, files..."
      shellDescription="Employee mail"
      shellTitle="JPosta Mail"
      userEmail={mailbox || undefined}
      userName={displayName}
      workspace={workspace}
      workspaceLabel="Mailbox"
    >
      <div className="grid min-h-[calc(100dvh-11rem)] gap-4 overflow-hidden lg:grid-cols-[minmax(18rem,0.42fr)_minmax(0,0.58fr)] xl:grid-cols-[minmax(21rem,0.36fr)_minmax(0,0.64fr)]">
        <section className={`${mobileDetail ? "hidden lg:grid" : "grid"} min-h-0 gap-3`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <GlassBadge tone="premium">JPosta Mail</GlassBadge>
              <h1 className="mt-2 truncate text-2xl font-semibold text-foreground">{folder?.name || activeFolder}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {loading ? "Loading your mailbox..." : `${page.total} total / ${folder?.unread ?? 0} unread`}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <GlassButton onClick={() => beginCompose("compose")} variant="primary"><MailPlus className="h-4 w-4" aria-hidden="true" />Compose</GlassButton>
              <GlassButton aria-label="Refresh mailbox" onClick={() => void refresh()} variant="glass"><RefreshCw className="h-4 w-4" aria-hidden="true" />Refresh</GlassButton>
            </div>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <GlassInput aria-label="Search emails" className="pl-9" onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && token) void loadMessages(token, activeFolder, 1, search, false); }} placeholder="Search this folder" value={search} />
          </div>

          {error ? <StateNotice message={error} tone="error" /> : null}
          {loading || messagesLoading ? <LoadingList /> : null}
          {!loading && !messagesLoading && !error && page.messages.length === 0 ? <StateNotice message={isInbox(activeFolder) ? "Your inbox is empty." : "No emails here."} /> : null}

          <div className="min-h-0 overflow-y-auto pr-1">
            <div className="grid gap-2 pb-24 lg:pb-2">
              {page.messages.map((message) => (
                <button aria-label={`Open email ${message.subject}`} className={`rounded-[1.25rem] border p-3 text-left shadow-inner-glass transition focus:outline-none focus:ring-2 focus:ring-sky-300 ${selectedUid === message.uid ? "border-sky-300/70 bg-sky-50/86" : "border-glass-edge/24 bg-white/62 hover:-translate-y-0.5 hover:bg-white/86"}`} key={`${activeFolder}-${message.uid}`} onClick={() => void openMessage(message)} type="button">
                  <div className="flex items-start gap-3">
                    <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${message.unread ? "bg-sky-500" : "bg-transparent"}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className={`truncate text-sm ${message.unread ? "font-semibold text-foreground" : "font-medium text-slate-700"}`}>{displayAddressName(message.from)}</p>
                        <time className="shrink-0 text-xs text-muted-foreground">{formatDate(message.date)}</time>
                      </div>
                      <p className="mt-1 truncate text-sm font-medium text-foreground">{message.subject}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{message.preview || message.subject}</p>
                      <div className="mt-2 flex items-center gap-2 text-sky-700">
                        {message.starred ? <Star className="h-3.5 w-3.5 fill-sky-300" aria-hidden="true" /> : null}
                        {message.hasAttachments ? <Paperclip className="h-3.5 w-3.5" aria-label="Has attachments" /> : null}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-glass-edge/20 pt-3 text-sm text-muted-foreground">
            <span>Page {page.page}</span>
            <div className="flex gap-2">
              <GlassButton disabled={!token || page.page <= 1} onClick={() => token && loadMessages(token, activeFolder, page.page - 1, search, false)} size="sm" variant="ghost">Previous</GlassButton>
              <GlassButton disabled={!token || !page.hasMore} onClick={() => token && loadMessages(token, activeFolder, page.page + 1, search, false)} size="sm" variant="ghost">Next</GlassButton>
            </div>
          </div>
        </section>

        <section className={`${mobileDetail ? "block" : "hidden lg:block"} min-h-0 overflow-hidden rounded-[1.75rem] border border-glass-edge/28 bg-white/62 shadow-inner-glass`}>
          {mobileDetail ? <div className="border-b border-glass-edge/20 p-3 lg:hidden"><GlassButton onClick={() => setMobileDetail(false)} variant="ghost"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Back to inbox</GlassButton></div> : null}
          {!selected && !detailLoading ? <div className="flex h-full min-h-[24rem] items-center justify-center p-6 text-center text-sm text-muted-foreground"><div><Mail className="mx-auto mb-3 h-8 w-8 text-sky-500" aria-hidden="true" />Select an email to read.</div></div> : null}
          {detailLoading ? <div className="grid gap-4 p-6"><div className="h-8 w-2/3 animate-pulse rounded-full bg-white/80" /><div className="h-4 w-1/2 animate-pulse rounded-full bg-white/70" /><div className="h-64 animate-pulse rounded-[1.5rem] bg-white/70" /></div> : null}
          {selected ? (
            <article className="flex max-h-[calc(100dvh-12rem)] flex-col overflow-hidden">
              <header className="border-b border-glass-edge/20 bg-white/54 p-4 sm:p-5">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0"><h2 className="text-2xl font-semibold leading-tight text-foreground">{selected.subject}</h2><p className="mt-2 text-sm text-muted-foreground">From {selected.from || "Unknown sender"} to {selected.to || mailbox}</p>{selected.cc ? <p className="mt-1 text-xs text-muted-foreground">Cc {selected.cc}</p> : null}<time className="mt-1 block text-xs text-muted-foreground">{formatLongDate(selected.date)}</time></div>
                  <StatusIndicator label={selected.unread ? "Unread" : "Read"} tone={selected.unread ? "neutral" : "success"} />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <GlassButton onClick={() => beginCompose("reply")} size="sm" variant="glass"><Reply className="h-4 w-4" aria-hidden="true" />Reply</GlassButton>
                  <GlassButton onClick={() => beginCompose("reply-all")} size="sm" variant="glass"><ReplyAll className="h-4 w-4" aria-hidden="true" />Reply all</GlassButton>
                  <GlassButton onClick={() => beginCompose("forward")} size="sm" variant="glass"><Forward className="h-4 w-4" aria-hidden="true" />Forward</GlassButton>
                  <GlassButton onClick={() => void setRead()} size="sm" variant="glass">{selected.unread ? "Mark read" : "Mark unread"}</GlassButton>
                  <GlassButton aria-label="Star email" onClick={() => void toggleStar()} size="icon" variant="glass"><Star className={`h-4 w-4 ${selected.starred ? "fill-sky-300 text-sky-700" : ""}`} aria-hidden="true" /></GlassButton>
                  {findFolder(folders, "Archive") ? <GlassButton onClick={() => void moveSelected(findFolder(folders, "Archive")!.path)} size="sm" variant="glass"><Archive className="h-4 w-4" aria-hidden="true" />Archive</GlassButton> : null}
                  <GlassButton onClick={() => void deleteSelected()} size="sm" variant="ghost"><Trash2 className="h-4 w-4" aria-hidden="true" />Delete</GlassButton>
                </div>
              </header>
              <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
                <div className="prose prose-sm max-w-[850px] text-foreground prose-a:text-sky-700 prose-img:rounded-2xl" dangerouslySetInnerHTML={{ __html: selected.sanitizedHtml || textToHtml(selected.text) }} />
                {selected.attachments.length ? <div className="mt-6 grid gap-2"><h3 className="text-sm font-semibold text-foreground">Attachments</h3>{selected.attachments.map((attachment) => <button className="flex items-center justify-between gap-3 rounded-2xl border border-glass-edge/24 bg-white/76 p-3 text-left text-sm transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-sky-300" key={attachment.partId} onClick={() => void downloadAttachment(attachment)} type="button"><span className="min-w-0"><span className="block truncate font-medium text-foreground">{attachment.filename}</span><span className="text-xs text-muted-foreground">{attachment.contentType} / {formatBytes(attachment.size)}</span></span><Download className="h-4 w-4 text-sky-700" aria-hidden="true" /></button>)}</div> : null}
              </div>
            </article>
          ) : null}
        </section>
      </div>

      {compose.open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-end bg-transparent p-0 sm:p-4 lg:pointer-events-none">
          <form className="pointer-events-auto flex h-dvh w-full flex-col overflow-hidden border border-glass-edge/32 bg-white/95 shadow-glass sm:h-[min(42rem,calc(100dvh-2rem))] sm:max-w-[44rem] sm:rounded-[1.5rem]" onSubmit={sendMessage}>
            <div className="flex items-center justify-between border-b border-glass-edge/24 px-4 py-3"><div><h2 className="text-sm font-semibold text-foreground">{composeTitle(compose.mode)}</h2><p className="text-xs text-muted-foreground">From {mailbox}</p></div><GlassButton aria-label="Close composer" onClick={() => void closeComposer()} size="icon" type="button" variant="glass"><X className="h-4 w-4" aria-hidden="true" /></GlassButton></div>
            <div className="grid gap-2 border-b border-glass-edge/20 p-4">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="compose-to">To</label><GlassInput id="compose-to" onChange={(event) => setCompose((current) => ({ ...current, to: event.target.value }))} required value={compose.to} />
              <label className="text-xs font-medium text-muted-foreground" htmlFor="compose-cc">Cc</label><GlassInput id="compose-cc" onChange={(event) => setCompose((current) => ({ ...current, cc: event.target.value }))} value={compose.cc} />
              <label className="text-xs font-medium text-muted-foreground" htmlFor="compose-bcc">Bcc</label><GlassInput id="compose-bcc" onChange={(event) => setCompose((current) => ({ ...current, bcc: event.target.value }))} value={compose.bcc} />
              <label className="text-xs font-medium text-muted-foreground" htmlFor="compose-subject">Subject</label><GlassInput id="compose-subject" onChange={(event) => setCompose((current) => ({ ...current, subject: event.target.value }))} value={compose.subject} />
            </div>
            <label className="sr-only" htmlFor="compose-body">Message body</label><textarea className="min-h-0 flex-1 resize-none bg-white/95 p-4 text-sm leading-6 text-foreground outline-none focus:ring-2 focus:ring-inset focus:ring-sky-200" id="compose-body" onChange={(event) => setCompose((current) => ({ ...current, body: event.target.value }))} placeholder="Write your message" value={compose.body} />
            {compose.attachments.length ? <div className="grid gap-2 border-t border-glass-edge/20 p-3">{compose.attachments.map((file) => <div className="flex items-center justify-between rounded-xl bg-sky-50 px-3 py-2 text-xs" key={`${file.name}-${file.size}`}><span className="truncate">{file.name} / {formatBytes(file.size)}</span><button aria-label={`Remove ${file.name}`} className="text-sky-700" onClick={() => setCompose((current) => ({ ...current, attachments: current.attachments.filter((item) => item !== file) }))} type="button">Remove</button></div>)}</div> : null}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-glass-edge/24 p-3"><div className="flex flex-wrap gap-2"><GlassButton disabled={sending} type="submit" variant="primary"><Send className="h-4 w-4" aria-hidden="true" />{sending ? "Sending..." : "Send"}</GlassButton><GlassButton disabled={savingDraft} onClick={() => void saveDraft()} type="button" variant="glass"><Save className="h-4 w-4" aria-hidden="true" />{savingDraft ? "Saving..." : "Save draft"}</GlassButton><label className="inline-flex cursor-pointer items-center gap-2 rounded-control border border-glass-edge/28 bg-white/66 px-3 py-2 text-sm font-medium text-slate-700 shadow-glass-soft transition hover:bg-white"><Paperclip className="h-4 w-4" aria-hidden="true" />Attach<input aria-label="Attach files" className="sr-only" multiple onChange={(event) => { const files = Array.from(event.target.files || []); setCompose((current) => ({ ...current, attachments: [...current.attachments, ...files].slice(0, 10) })); event.target.value = ""; }} type="file" /></label></div><GlassButton onClick={() => void closeComposer()} type="button" variant="ghost">Discard</GlassButton></div>
          </form>
        </div>
      ) : null}
      {notice ? <ToastNotice notice={notice} /> : null}
    </AppShell>
  );
}

function makeNavigation(folders: WebmailFolder[], activeFolder: string, onSelect: (path: string) => void): ShellNavItem[] {
  return folderConfig.map((config) => {
    const folder = findFolder(folders, config.label);
    if (!folder && !["Inbox", "Starred", "Sent", "Drafts", "Spam"].includes(config.label)) return null;
    const path = folder?.path || config.aliases[0]?.toUpperCase() || config.label;
    return { active: path === activeFolder, badge: folder?.unread ? String(folder.unread) : undefined, iconKey: config.iconKey, label: config.label, onClick: () => onSelect(path) };
  }).filter(Boolean) as ShellNavItem[];
}
function findFolder(folders: WebmailFolder[], label: string) { const config = folderConfig.find((item) => item.label === label); return folders.find((folder) => { const value = `${folder.specialUse || ""} ${folder.name} ${folder.path}`.toLowerCase(); return config?.aliases.some((alias) => value.includes(alias)) || value.includes(label.toLowerCase()); }); }
function resolveFolder(folders: WebmailFolder[], current: string) { return folders.some((folder) => folder.path === current) ? current : findFolder(folders, "Inbox")?.path || folders[0]?.path || "INBOX"; }
function friendlyName(name: string | undefined, address: string) { const clean = name?.trim(); if (clean) return clean; const local = address.split("@")[0] || "Mailbox"; return local.split(/[._-]+/).filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" "); }
function isInbox(folder: string) { return folder.toLowerCase() === "inbox"; }
function formatDate(value: string | null) { return value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value)) : ""; }
function formatLongDate(value: string | null) { return value ? new Intl.DateTimeFormat(undefined, { dateStyle: "full", timeStyle: "short" }).format(new Date(value)) : ""; }
function formatBytes(size: number) { if (!size) return "0 B"; const units = ["B", "KB", "MB", "GB"]; const index = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1); return `${(size / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`; }
function displayAddressName(value: string) { return value.replace(/<[^>]+>/g, "").trim() || value; }
function extractEmail(value: string) { const match = value.match(/<([^>]+)>/); return (match?.[1] || value).trim().toLowerCase(); }
function splitRecipients(value: string) { return value.split(/[;,]/).map(extractEmail).filter(Boolean); }
function withoutSelf(value: string, self: string) { return splitRecipients(value).filter((recipient) => recipient !== self.toLowerCase()).join(", "); }
function replyAllTo(message: WebmailMessageDetail, self: string) { return Array.from(new Set([extractEmail(message.from), ...splitRecipients(message.to), ...splitRecipients(message.cc || "")])).filter((recipient) => recipient && recipient !== self.toLowerCase()).join(", "); }
function withPrefix(subject: string, prefix: "Re:" | "Fwd:") { return subject.toLowerCase().startsWith(prefix.toLowerCase()) ? subject : `${prefix} ${subject}`; }
function quotedText(message: WebmailMessageDetail) { return `\n\nOn ${formatLongDate(message.date)}, ${message.from} wrote:\n> ${(message.text || message.subject).replace(/\n/g, "\n> ")}`; }
function forwardedText(message: WebmailMessageDetail) { return `\n\nForwarded message\nFrom: ${message.from}\nDate: ${formatLongDate(message.date)}\nSubject: ${message.subject}\nTo: ${message.to}\n\n${message.text || ""}`; }
function composeTitle(mode: ComposeMode) { if (mode === "reply") return "Reply"; if (mode === "reply-all") return "Reply all"; if (mode === "forward") return "Forward"; return "New message"; }
function hasComposeContent(compose: ComposeState) { return Boolean(compose.to.trim() || compose.cc.trim() || compose.bcc.trim() || compose.subject.trim() || compose.body.trim() || compose.attachments.length); }
function textToHtml(value: string) { return value.split(/\n{2,}/).map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`).join(""); }
function escapeHtml(value: string) { return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function isExpired(error: unknown) { return error instanceof Error && /401|session|unauthorized|expired/i.test(error.message); }
function LoadingList() { return <div className="grid gap-2" aria-label="Loading your mailbox">{Array.from({ length: 6 }).map((_, index) => <div className="h-24 animate-pulse rounded-[1.25rem] border border-glass-edge/20 bg-white/62" key={index} />)}</div>; }
function StateNotice({ message, tone = "info" }: { message: string; tone?: Notice["tone"] }) { return <GlassCard className={`p-4 text-sm ${tone === "error" ? "text-rose-700" : "text-muted-foreground"}`} intensity="soft">{message}</GlassCard>; }
function ToastNotice({ notice }: { notice: Notice }) { return <div className={`fixed right-4 top-4 z-[60] rounded-2xl border bg-white/95 px-4 py-3 text-sm shadow-glass ${notice.tone === "error" ? "border-rose-200 text-rose-800" : "border-sky-200 text-sky-800"}`}>{notice.message}</div>; }

