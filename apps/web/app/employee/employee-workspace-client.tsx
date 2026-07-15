
"use client";

import * as React from "react";
import { Archive, ArrowLeft, Bell, ChevronDown, ChevronRight, Cloud, Download, Forward, Folder, Inbox, Mail, MailPlus, Menu, Moon, MoreHorizontal, Paperclip, RefreshCw, Reply, ReplyAll, Save, Search, Send, Settings, ShieldAlert, Star, Trash2, X } from "lucide-react";
import { GlassButton, GlassInput } from "@jposta/ui";
import { jpostaApi, type WebmailFolder, type WebmailMe, type WebmailMessage, type WebmailMessageDetail } from "@/lib/api-client";
import { clearWebmailSession, getStoredWebmailSession } from "@/lib/webmail-session";

type ComposeMode = "compose" | "reply" | "reply-all" | "forward";
type Notice = { message: string; tone: "info" | "success" | "error" };
type ComposeState = { attachments: File[]; bcc: string; body: string; cc: string; draftUid?: number; inReplyTo?: string; mode: ComposeMode; open: boolean; references?: string; subject: string; to: string };
type MessagePage = { folder: string; hasMore: boolean; messages: WebmailMessage[]; page: number; pageSize: number; total: number };
type FolderNavItem = { folder?: WebmailFolder | undefined; icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>; label: string; path: string };

const pageSize = 25;
const blankPage: MessagePage = { folder: "INBOX", hasMore: false, messages: [], page: 1, pageSize, total: 0 };
const blankCompose: ComposeState = { attachments: [], bcc: "", body: "", cc: "", mode: "compose", open: false, subject: "", to: "" };
const primaryFolderConfig = [
  { label: "Inbox", aliases: ["inbox"], icon: Inbox },
  { label: "Sent", aliases: ["sent"], icon: Send },
  { label: "Drafts", aliases: ["draft"], icon: MailPlus },
  { label: "Junk", aliases: ["spam", "junk"], icon: ShieldAlert },
  { label: "Trash", aliases: ["trash", "deleted"], icon: Trash2 },
] as const;

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
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [showMoreFolders, setShowMoreFolders] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<Notice | null>(null);
  const [compose, setCompose] = React.useState<ComposeState>(blankCompose);
  const [sending, setSending] = React.useState(false);
  const [savingDraft, setSavingDraft] = React.useState(false);

  const mailbox = identity?.mailbox.address ?? "";
  const displayName = friendlyName(identity?.mailbox.displayName, mailbox);
  const workspace = identity?.portal.displayName || identity?.portal.organizationName || "Mailbox";
  const folder = folders.find((item) => item.path === activeFolder);
  const trash = /trash|deleted/i.test(activeFolder);
  const folderNav = makeFolderNavigation(folders);
  const customFolders = makeCustomFolders(folders, folderNav);
  const unreadCount = folder?.unread ?? page.messages.filter((message) => message.unread).length;
  const archivePath = findFolder(folders, "Archive")?.path;

  const showNotice = React.useCallback((message: string, tone: Notice["tone"] = "info") => { setNotice({ message, tone }); window.setTimeout(() => setNotice(null), 3500); }, []);
  const expire = React.useCallback(() => { clearWebmailSession(); window.location.assign(window.location.origin); }, []);

  const loadMessages = React.useCallback(async (activeToken: string, nextFolder: string, nextPage = 1, nextSearch = search, keep = false) => {
    setMessagesLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ folder: nextFolder, page: String(nextPage), pageSize: String(pageSize) });
      if (nextSearch.trim()) params.set("search", nextSearch.trim());
      const result = await jpostaApi.webmailMessages(activeToken, `?${params.toString()}`);
      setPage(result); setActiveFolder(result.folder);
      if (!keep) { setSelected(null); setSelectedUid(null); setMobileDetail(false); }
    } catch (caught) { if (isExpired(caught)) expire(); else setError(errorMessage(caught, "We couldn't connect to this folder. Please try again.")); }
    finally { setMessagesLoading(false); }
  }, [expire, search]);

  const refresh = React.useCallback(async (activeToken = token, folderPath = activeFolder, keep = true) => {
    if (!activeToken) return;
    setError(null);
    try {
      const [me, folderResult] = await Promise.all([jpostaApi.webmailMe(activeToken), jpostaApi.webmailFolders(activeToken)]);
      setIdentity(me); setFolders(folderResult.folders);
      await loadMessages(activeToken, resolveFolder(folderResult.folders, folderPath), page.page, search, keep);
    } catch (caught) { if (isExpired(caught)) expire(); else setError(errorMessage(caught, "We couldn't connect to your mailbox. Please try again.")); }
  }, [activeFolder, expire, loadMessages, page.page, search, token]);

  React.useEffect(() => {
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
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape" && compose.open) void closeComposer(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  async function openFolder(path: string) { setSidebarOpen(false); if (token) await loadMessages(token, path, 1, search, false); }
  async function openMessage(message: WebmailMessage) {
    if (!token) return;
    setSelectedUid(message.uid); setDetailLoading(true); setError(null);
    try {
      const detail = await jpostaApi.webmailMessage(token, message.uid, activeFolder);
      setSelected(detail); setMobileDetail(true);
      if (detail.unread) await setRead(detail, true, true);
    } catch (caught) { if (isExpired(caught)) expire(); else setError(errorMessage(caught, "This email is no longer available.")); }
    finally { setDetailLoading(false); }
  }
  async function setRead(message = selected, read?: boolean, silent = false) {
    if (!token || !message) return;
    const nextRead = read ?? message.unread;
    patchMessage(message.uid, { unread: !nextRead });
    setSelected((current) => current?.uid === message.uid ? { ...current, unread: !nextRead } : current);
    try { await jpostaApi.webmailSetRead(token, message.uid, { folder: activeFolder, read: nextRead }); await refresh(token, activeFolder, true); }
    catch (caught) { if (!silent) showActionError(caught); }
  }
  async function toggleStar(message = selected) {
    if (!token || !message) return;
    const starred = !message.starred;
    patchMessage(message.uid, { starred });
    setSelected((current) => current?.uid === message.uid ? { ...current, starred } : current);
    try { await jpostaApi.webmailSetStar(token, message.uid, { folder: activeFolder, starred }); await refresh(token, activeFolder, true); }
    catch (caught) { showActionError(caught); }
  }
  async function toggleMessageStar(message: WebmailMessage) {
    if (!token) return;
    const starred = !message.starred;
    patchMessage(message.uid, { starred });
    setSelected((current) => current?.uid === message.uid ? { ...current, starred } : current);
    try { await jpostaApi.webmailSetStar(token, message.uid, { folder: activeFolder, starred }); await refresh(token, activeFolder, true); }
    catch (caught) { showActionError(caught); }
  }
  async function moveSelected(path: string) {
    if (!token || !selected) return;
    const uid = selected.uid; removeMessage(uid); setSelected(null);
    try { await jpostaApi.webmailMove(token, uid, { fromFolder: activeFolder, toFolder: path }); await refresh(token, activeFolder, false); showNotice("Email moved.", "success"); }
    catch (caught) { showActionError(caught); await refresh(token, activeFolder, true); }
  }
  async function deleteSelected() {
    if (!token || !selected) return;
    if (trash && !window.confirm("Permanently delete this email?")) return;
    const uid = selected.uid; removeMessage(uid); setSelected(null);
    try { await jpostaApi.webmailDelete(token, uid, activeFolder); await refresh(token, activeFolder, false); showNotice(trash ? "Email deleted." : "Email moved to Trash.", "success"); }
    catch (caught) { showActionError(caught); await refresh(token, activeFolder, true); }
  }
  function beginCompose(mode: ComposeMode = "compose") {
    if (!selected || mode === "compose") { setCompose({ ...blankCompose, mode, open: true }); return; }
    const forward = mode === "forward";
    setCompose({ ...blankCompose, body: forward ? forwardedText(selected) : quotedText(selected), cc: mode === "reply-all" ? withoutSelf(selected.cc || "", mailbox) : "", ...(forward ? {} : { inReplyTo: selected.messageId, references: selected.messageId }), mode, open: true, subject: withPrefix(selected.subject, forward ? "Fwd:" : "Re:"), to: forward ? "" : mode === "reply-all" ? replyAllTo(selected, mailbox) : extractEmail(selected.from) });
  }
  async function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || sending) return;
    setSending(true);
    try {
      const data = new FormData();
      data.set("to", compose.to); data.set("cc", compose.cc); data.set("bcc", compose.bcc); data.set("subject", compose.subject); data.set("text", compose.body);
      if (compose.inReplyTo) data.set("inReplyTo", compose.inReplyTo);
      if (compose.references) data.set("references", compose.references);
      compose.attachments.forEach((file) => data.append("attachments", file));
      await jpostaApi.webmailSendForm(token, data);
      setCompose(blankCompose); showNotice("Message sent", "success");
      const sent = findFolder(folders, "Sent")?.path;
      if (sent && activeFolder === sent) await loadMessages(token, sent, 1, search, false);
    } catch (caught) { if (isExpired(caught)) expire(); else showNotice("Your message could not be sent. Please try again.", "error"); }
    finally { setSending(false); }
  }
  async function saveDraft() {
    if (!token || savingDraft || !hasComposeContent(compose)) return;
    setSavingDraft(true);
    try {
      const result = await jpostaApi.webmailSaveDraft(token, { to: compose.to || mailbox, cc: compose.cc, bcc: compose.bcc, subject: compose.subject, text: compose.body }, compose.draftUid);
      setCompose((current) => ({ ...current, draftUid: result.uid }));
      await refresh(token, activeFolder, true); showNotice("Draft saved", "success");
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
      const blob = await response.blob(); const url = URL.createObjectURL(blob); const link = document.createElement("a");
      link.href = url; link.download = attachment.filename; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
    } catch { showNotice("Attachment could not be downloaded.", "error"); }
  }
  function patchMessage(uid: number, patch: Partial<WebmailMessage>) { setPage((current) => ({ ...current, messages: current.messages.map((message) => message.uid === uid ? { ...message, ...patch } : message) })); }
  function removeMessage(uid: number) { setPage((current) => ({ ...current, total: Math.max(0, current.total - 1), messages: current.messages.filter((message) => message.uid !== uid) })); }
  function showActionError(caught: unknown) { if (isExpired(caught)) expire(); else showNotice(errorMessage(caught, "Action could not be completed. Please try again."), "error"); }

  return (
    <div className="min-h-dvh overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(147,197,253,0.45),transparent_30%),radial-gradient(circle_at_80%_10%,rgba(221,214,254,0.45),transparent_34%),linear-gradient(135deg,#edf7ff_0%,#f8fbff_45%,#eaf3ff_100%)] text-slate-950">
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(255,255,255,0.42)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.34)_1px,transparent_1px)] bg-[size:44px_44px] opacity-50" />
      <div className="pointer-events-none fixed left-[12%] top-[14%] h-72 w-72 rounded-full bg-sky-200/45 blur-3xl" />
      <div className="pointer-events-none fixed bottom-[8%] right-[18%] h-80 w-80 rounded-full bg-blue-100/70 blur-3xl" />
      <div className="relative z-10 flex min-h-dvh flex-col gap-4 p-3 sm:p-4 lg:p-5">
        <header className="grid gap-3 lg:grid-cols-[17rem_minmax(0,1fr)_auto] xl:grid-cols-[18rem_minmax(34rem,44rem)_auto]">
          <div className="hidden items-center gap-3 rounded-[1.35rem] border border-white/70 bg-white/42 px-4 py-3 shadow-[0_18px_60px_rgba(37,99,235,0.12)] backdrop-blur-2xl lg:flex"><LogoMark /><div className="min-w-0"><p className="truncate text-sm text-slate-500">Mailbox</p><p className="truncate text-base font-semibold text-blue-950">{workspace}</p></div></div>
          <div className="flex items-center gap-3 rounded-[1.35rem] border border-white/70 bg-white/58 p-2 shadow-[0_20px_70px_rgba(30,64,175,0.14)] backdrop-blur-2xl">
            <button aria-label="Open folders" className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/70 bg-white/70 text-blue-900 shadow-sm lg:hidden" onClick={() => setSidebarOpen(true)} type="button"><Menu className="h-5 w-5" aria-hidden="true" /></button>
            <Search className="ml-1 h-5 w-5 shrink-0 text-blue-900" aria-hidden="true" />
            <input aria-label="Search emails, contacts, files" className="h-11 min-w-0 flex-1 bg-transparent text-base text-blue-950 outline-none placeholder:text-slate-500" onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && token) void loadMessages(token, activeFolder, 1, search, false); }} placeholder="Search emails, contacts, files..." value={search} />
            <kbd className="hidden rounded-full border border-blue-100 bg-white/80 px-3 py-1.5 text-xs font-medium text-blue-900 sm:inline-flex">Ctrl K</kbd>
          </div>
          <div className="hidden items-center justify-end gap-3 lg:flex"><TopIconButton label="Theme"><Moon className="h-5 w-5" aria-hidden="true" /></TopIconButton><TopIconButton label="Notifications"><Bell className="h-5 w-5" aria-hidden="true" /></TopIconButton><TopIconButton label="Settings"><Settings className="h-5 w-5" aria-hidden="true" /></TopIconButton><div className="flex min-w-[15rem] items-center gap-3 rounded-[1.35rem] border border-white/70 bg-white/50 px-3 py-2 shadow-[0_18px_60px_rgba(30,64,175,0.12)] backdrop-blur-2xl"><Avatar name={displayName} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-blue-950">{displayName}</p><p className="truncate text-xs text-slate-500">{mailbox || "Mailbox"}</p></div><ChevronDown className="h-4 w-4 text-blue-900" aria-hidden="true" /></div></div>
        </header>
        <main className="grid flex-1 gap-4 overflow-hidden lg:grid-cols-[17rem_minmax(20rem,0.44fr)_minmax(0,1fr)] xl:grid-cols-[18rem_minmax(23rem,0.42fr)_minmax(0,1fr)]">
          <aside className={`${sidebarOpen ? "fixed inset-3 z-50 flex" : "hidden"} min-h-0 flex-col rounded-[1.45rem] border border-white/70 bg-white/56 shadow-[0_30px_90px_rgba(30,64,175,0.18)] backdrop-blur-2xl lg:relative lg:inset-auto lg:z-auto lg:flex`}>
            <div className="flex items-center justify-between border-b border-white/60 p-5 lg:hidden"><div className="flex items-center gap-3"><LogoMark /><p className="font-semibold text-blue-950">JPosta Mail</p></div><button aria-label="Close folders" className="rounded-full p-2 text-blue-900" onClick={() => setSidebarOpen(false)} type="button"><X className="h-5 w-5" aria-hidden="true" /></button></div>
            <div className="hidden items-center gap-3 border-b border-white/60 p-5 lg:flex"><LogoMark /><p className="text-lg font-semibold text-blue-950">JPosta Mail</p></div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <button className="mb-5 inline-flex h-14 w-full items-center justify-center gap-3 rounded-[1.1rem] bg-blue-500 text-base font-semibold text-white shadow-[0_18px_36px_rgba(37,99,235,0.28)] transition hover:-translate-y-0.5 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-300" onClick={() => beginCompose("compose")} type="button"><MailPlus className="h-5 w-5" aria-hidden="true" />Compose</button>
              <nav className="grid gap-1.5" aria-label="Mail folders">
                {folderNav.map((item) => <FolderButton active={item.path === activeFolder} item={item} key={item.path} onClick={() => void openFolder(item.path)} />)}
                <button className="flex h-12 items-center gap-3 rounded-2xl px-3 text-sm font-medium text-blue-950 transition hover:bg-white/60 focus:outline-none focus:ring-2 focus:ring-blue-200" onClick={() => setShowMoreFolders((current) => !current)} type="button"><MoreHorizontal className="h-5 w-5 text-blue-800" aria-hidden="true" /><span className="flex-1 text-left">More</span><ChevronRight className={`h-4 w-4 text-blue-800 transition ${showMoreFolders ? "rotate-90" : ""}`} aria-hidden="true" /></button>
                {showMoreFolders ? <div className="mt-1 grid gap-1 border-l border-blue-100/80 pl-3">{customFolders.length ? customFolders.map((item) => <FolderButton active={item.path === activeFolder} compact item={item} key={item.path} onClick={() => void openFolder(item.path)} />) : <p className="px-3 py-2 text-xs text-slate-500">No additional folders.</p>}</div> : null}
              </nav>
            </div>
            <div className="grid gap-3 border-t border-white/60 p-4"><div className="rounded-2xl border border-white/70 bg-white/45 p-3 shadow-inner backdrop-blur-xl"><div className="mb-2 flex items-center gap-2 text-xs font-medium text-blue-950"><Cloud className="h-4 w-4 text-blue-700" aria-hidden="true" />Storage</div><div className="h-2 overflow-hidden rounded-full bg-blue-100/70"><div className="h-full w-[24%] rounded-full bg-blue-500" /></div><p className="mt-2 text-xs text-slate-500">Mailbox storage available</p></div><div className="flex items-center gap-3 rounded-2xl border border-white/70 bg-white/45 p-3 backdrop-blur-xl lg:hidden"><Avatar name={displayName} /><div className="min-w-0"><p className="truncate text-sm font-semibold text-blue-950">{displayName}</p><p className="truncate text-xs text-slate-500">{mailbox || "Mailbox"}</p></div></div></div>
          </aside>
          <section className={`${mobileDetail ? "hidden lg:flex" : "flex"} min-h-0 flex-col rounded-[1.45rem] border border-white/70 bg-white/50 shadow-[0_24px_80px_rgba(30,64,175,0.14)] backdrop-blur-2xl`}>
            <div className="border-b border-white/60 p-4 sm:p-5"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><div className="flex items-center gap-3"><h1 className="truncate text-xl font-semibold text-blue-950">{folder?.name || activeFolder}</h1><span className="rounded-full bg-blue-100/80 px-3 py-1 text-sm font-medium text-blue-700">{unreadCount} unread</span></div><p className="mt-1 text-sm text-slate-500">{loading ? "Loading your mailbox..." : `${page.total} messages`}</p></div><button aria-label="Refresh mailbox" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-blue-100 bg-white/70 text-blue-900 shadow-sm transition hover:-translate-y-0.5 hover:bg-white focus:outline-none focus:ring-2 focus:ring-blue-200" onClick={() => void refresh()} type="button"><RefreshCw className="h-4 w-4" aria-hidden="true" /></button></div><div className="relative mt-4"><Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" /><GlassInput aria-label="Search this folder" className="h-12 rounded-2xl border-white/70 bg-white/78 pl-10 text-blue-950 placeholder:text-slate-500" onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && token) void loadMessages(token, activeFolder, 1, search, false); }} placeholder="Search this folder" value={search} /></div></div>
            {error ? <StateNotice message={error} tone="error" /> : null}
            {loading || messagesLoading ? <LoadingList /> : null}
            {!loading && !messagesLoading && !error && page.messages.length === 0 ? <StateNotice message={isInbox(activeFolder) ? "Your inbox is empty." : "No emails here."} /> : null}
            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2 sm:px-4"><div className="grid divide-y divide-blue-100/70">{page.messages.map((message) => <MessageRow active={selectedUid === message.uid} key={`${activeFolder}-${message.uid}`} message={message} onOpen={() => void openMessage(message)} onToggleStar={() => void toggleMessageStar(message)} />)}</div></div>
            <div className="flex items-center justify-between gap-3 border-t border-white/60 p-3 text-sm text-slate-500"><span>Page {page.page}</span><div className="flex gap-2"><GlassButton disabled={!token || page.page <= 1} onClick={() => token && loadMessages(token, activeFolder, page.page - 1, search, false)} size="sm" variant="ghost">Previous</GlassButton><GlassButton disabled={!token || !page.hasMore} onClick={() => token && loadMessages(token, activeFolder, page.page + 1, search, false)} size="sm" variant="ghost">Next</GlassButton></div></div>
          </section>
          <section className={`${mobileDetail ? "fixed inset-0 z-40 block overflow-y-auto bg-[linear-gradient(135deg,#edf7ff,#f8fbff)] p-3 lg:relative lg:inset-auto lg:z-auto lg:overflow-hidden lg:bg-transparent lg:p-0" : "hidden lg:block"} min-h-0 overflow-hidden rounded-[1.45rem] border border-white/70 bg-white/48 shadow-[0_24px_80px_rgba(30,64,175,0.14)] backdrop-blur-2xl`}>
            {mobileDetail ? <div className="mb-3 lg:hidden"><GlassButton onClick={() => setMobileDetail(false)} variant="glass"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Back to inbox</GlassButton></div> : null}
            {!selected && !detailLoading ? <div className="flex h-full min-h-[28rem] items-center justify-center p-8 text-center text-slate-500"><div><Mail className="mx-auto mb-4 h-12 w-12 text-blue-500" aria-hidden="true" /><p className="text-base font-medium text-blue-950">Select an email to read.</p><p className="mt-1 text-sm">Your message preview will open here.</p></div></div> : null}
            {detailLoading ? <PreviewLoading /> : null}
            {selected ? <article className="flex h-full max-h-[calc(100dvh-7.25rem)] flex-col overflow-hidden"><header className="border-b border-white/60 p-4 sm:p-5"><div className="mb-6 flex items-center justify-between gap-2 text-blue-900"><div className="flex flex-wrap gap-2"><IconAction label="Reply" onClick={() => beginCompose("reply")}><Reply className="h-4 w-4" aria-hidden="true" /></IconAction><IconAction label="Reply all" onClick={() => beginCompose("reply-all")}><ReplyAll className="h-4 w-4" aria-hidden="true" /></IconAction><IconAction label="Archive" disabled={!archivePath} onClick={() => archivePath && void moveSelected(archivePath)}><Archive className="h-4 w-4" aria-hidden="true" /></IconAction><IconAction label="Delete" onClick={() => void deleteSelected()}><Trash2 className="h-4 w-4" aria-hidden="true" /></IconAction><IconAction label={selected.unread ? "Mark read" : "Mark unread"} onClick={() => void setRead()}><Mail className="h-4 w-4" aria-hidden="true" /></IconAction><IconAction label="Move" disabled={!customFolders.length} onClick={() => customFolders[0] && void moveSelected(customFolders[0].path)}><Folder className="h-4 w-4" aria-hidden="true" /></IconAction><IconAction label="More"><MoreHorizontal className="h-4 w-4" aria-hidden="true" /></IconAction></div><IconAction label="Star" onClick={() => void toggleStar()}><Star className={`h-5 w-5 ${selected.starred ? "fill-amber-400 text-amber-500" : ""}`} aria-hidden="true" /></IconAction></div><div className="flex items-start justify-between gap-4"><div className="min-w-0"><div className="mb-3 flex flex-wrap items-center gap-2"><h2 className="text-2xl font-semibold leading-tight text-blue-950">{selected.subject}</h2><span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">{folder?.name || activeFolder}</span></div><div className="flex items-center gap-3"><Avatar name={displayAddressName(selected.from)} /><div className="min-w-0"><p className="truncate text-sm font-semibold text-blue-950">{displayAddressName(selected.from)}</p><p className="truncate text-xs text-slate-500">to {selected.to || mailbox}</p>{selected.cc ? <p className="truncate text-xs text-slate-500">cc {selected.cc}</p> : null}</div></div></div><div className="hidden shrink-0 text-right sm:block"><time className="text-sm font-medium text-blue-900">{formatDate(selected.date)}</time><p className="mt-1 text-xs text-slate-500">{formatLongDate(selected.date)}</p></div></div></header><div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-7"><div className="mx-auto max-w-[850px]"><div className="prose prose-slate prose-sm max-w-none text-blue-950 prose-a:text-blue-700 prose-blockquote:border-blue-200 prose-blockquote:bg-blue-50/60 prose-blockquote:px-4 prose-blockquote:py-2 prose-img:rounded-2xl" dangerouslySetInnerHTML={{ __html: selected.sanitizedHtml || textToHtml(selected.text) }} />{selected.attachments.length ? <div className="mt-8 grid gap-3"><h3 className="text-sm font-semibold text-blue-950">Attachments</h3>{selected.attachments.map((attachment) => <button className="flex items-center justify-between gap-3 rounded-2xl border border-blue-100 bg-white/72 p-4 text-left text-sm shadow-sm transition hover:-translate-y-0.5 hover:bg-white focus:outline-none focus:ring-2 focus:ring-blue-200" key={attachment.partId} onClick={() => void downloadAttachment(attachment)} type="button"><span className="flex min-w-0 items-center gap-3"><span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600"><Paperclip className="h-4 w-4" aria-hidden="true" /></span><span className="min-w-0"><span className="block truncate font-medium text-blue-950">{attachment.filename}</span><span className="text-xs text-slate-500">{attachment.contentType} / {formatBytes(attachment.size)}</span></span></span><Download className="h-4 w-4 shrink-0 text-blue-700" aria-hidden="true" /></button>)}</div> : null}</div></div><footer className="border-t border-white/60 p-4"><div className="grid gap-3 sm:grid-cols-2"><GlassButton onClick={() => beginCompose("reply")} variant="glass"><Reply className="h-4 w-4" aria-hidden="true" />Reply</GlassButton><GlassButton onClick={() => beginCompose("forward")} variant="glass"><Forward className="h-4 w-4" aria-hidden="true" />Forward</GlassButton></div></footer></article> : null}
          </section>
        </main>
      </div>
      {compose.open ? <div className="fixed inset-0 z-50 flex items-end justify-end bg-transparent p-0 sm:p-4 lg:pointer-events-none"><form className="pointer-events-auto flex h-dvh w-full flex-col overflow-hidden border border-white/70 bg-white/95 shadow-[0_30px_90px_rgba(30,64,175,0.24)] sm:h-[min(42rem,calc(100dvh-2rem))] sm:max-w-[44rem] sm:rounded-[1.5rem]" onSubmit={sendMessage}><div className="flex items-center justify-between border-b border-blue-100 px-4 py-3"><div><h2 className="text-sm font-semibold text-blue-950">{composeTitle(compose.mode)}</h2><p className="text-xs text-slate-500">From {mailbox}</p></div><GlassButton aria-label="Close composer" onClick={() => void closeComposer()} size="icon" type="button" variant="glass"><X className="h-4 w-4" aria-hidden="true" /></GlassButton></div><div className="grid gap-2 border-b border-blue-100 p-4"><label className="text-xs font-medium text-slate-500" htmlFor="compose-to">To</label><GlassInput id="compose-to" onChange={(event) => setCompose((current) => ({ ...current, to: event.target.value }))} required value={compose.to} /><label className="text-xs font-medium text-slate-500" htmlFor="compose-cc">Cc</label><GlassInput id="compose-cc" onChange={(event) => setCompose((current) => ({ ...current, cc: event.target.value }))} value={compose.cc} /><label className="text-xs font-medium text-slate-500" htmlFor="compose-bcc">Bcc</label><GlassInput id="compose-bcc" onChange={(event) => setCompose((current) => ({ ...current, bcc: event.target.value }))} value={compose.bcc} /><label className="text-xs font-medium text-slate-500" htmlFor="compose-subject">Subject</label><GlassInput id="compose-subject" onChange={(event) => setCompose((current) => ({ ...current, subject: event.target.value }))} value={compose.subject} /></div><label className="sr-only" htmlFor="compose-body">Message body</label><textarea className="min-h-0 flex-1 resize-none bg-white/95 p-4 text-sm leading-6 text-blue-950 outline-none focus:ring-2 focus:ring-inset focus:ring-blue-200" id="compose-body" onChange={(event) => setCompose((current) => ({ ...current, body: event.target.value }))} placeholder="Write your message" value={compose.body} />{compose.attachments.length ? <div className="grid gap-2 border-t border-blue-100 p-3">{compose.attachments.map((file) => <div className="flex items-center justify-between rounded-xl bg-blue-50 px-3 py-2 text-xs" key={`${file.name}-${file.size}`}><span className="truncate">{file.name} / {formatBytes(file.size)}</span><button aria-label={`Remove ${file.name}`} className="text-blue-700" onClick={() => setCompose((current) => ({ ...current, attachments: current.attachments.filter((item) => item !== file) }))} type="button">Remove</button></div>)}</div> : null}<div className="flex flex-wrap items-center justify-between gap-2 border-t border-blue-100 p-3"><div className="flex flex-wrap gap-2"><GlassButton disabled={sending} type="submit" variant="primary"><Send className="h-4 w-4" aria-hidden="true" />{sending ? "Sending..." : "Send"}</GlassButton><GlassButton disabled={savingDraft} onClick={() => void saveDraft()} type="button" variant="glass"><Save className="h-4 w-4" aria-hidden="true" />{savingDraft ? "Saving..." : "Save draft"}</GlassButton><label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-blue-100 bg-white/80 px-3 py-2 text-sm font-medium text-blue-950 shadow-sm transition hover:bg-white"><Paperclip className="h-4 w-4" aria-hidden="true" />Attach<input aria-label="Attach files" className="sr-only" multiple onChange={(event) => { const files = Array.from(event.target.files || []); setCompose((current) => ({ ...current, attachments: [...current.attachments, ...files].slice(0, 10) })); event.target.value = ""; }} type="file" /></label></div><GlassButton onClick={() => void closeComposer()} type="button" variant="ghost">Discard</GlassButton></div></form></div> : null}
      {notice ? <ToastNotice notice={notice} /> : null}
    </div>
  );
}
function makeFolderNavigation(folders: WebmailFolder[]): FolderNavItem[] {
  return primaryFolderConfig.flatMap((config) => {
    const folder = findFolder(folders, config.label);
    if (!folder && config.label !== "Inbox") return [];
    const path = folder?.path || "INBOX";
    const label = config.label === "Junk" && folder?.name ? folder.name : config.label;
    return [{ folder, icon: config.icon, label, path }];
  });
}
function makeCustomFolders(folders: WebmailFolder[], primary: FolderNavItem[]): FolderNavItem[] {
  const primaryPaths = new Set(primary.map((item) => item.path));
  return folders.filter((folder) => !primaryPaths.has(folder.path)).map((folder) => ({ folder, icon: Folder, label: folder.name, path: folder.path }));
}
function findFolder(folders: WebmailFolder[], label: string) {
  const config = primaryFolderConfig.find((item) => item.label === label) || { aliases: [label.toLowerCase()] };
  return folders.find((folder) => {
    const value = `${folder.specialUse || ""} ${folder.name} ${folder.path}`.toLowerCase();
    return config.aliases.some((alias) => value.includes(alias));
  });
}
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
function errorMessage(error: unknown, fallback: string) { return error instanceof Error && error.message ? error.message : fallback; }
function senderInitial(value: string) { return (displayAddressName(value)[0] || "M").toUpperCase(); }

function LogoMark() { return <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-blue-100 bg-white/76 text-blue-600 shadow-sm"><Mail className="h-5 w-5" aria-hidden="true" /></span>; }
function Avatar({ name }: { name: string }) { const initial = (name.trim()[0] || "M").toUpperCase(); return <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/70 bg-gradient-to-br from-blue-100 to-slate-200 text-sm font-semibold text-blue-950 shadow-sm">{initial}</span>; }
function TopIconButton({ children, label }: { children: React.ReactNode; label: string }) { return <button aria-label={label} className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/70 bg-white/50 text-blue-950 shadow-[0_14px_40px_rgba(30,64,175,0.12)] backdrop-blur-2xl transition hover:-translate-y-0.5 hover:bg-white/72" type="button">{children}</button>; }
function FolderButton({ active, compact = false, item, onClick }: { active: boolean; compact?: boolean; item: FolderNavItem; onClick: () => void }) {
  const Icon = item.icon;
  return <button className={`${compact ? "h-10" : "h-12"} flex items-center gap-3 rounded-2xl px-3 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-blue-200 ${active ? "bg-blue-100/80 text-blue-700 shadow-sm" : "text-blue-950 hover:bg-white/60"}`} onClick={onClick} type="button"><Icon className={`h-5 w-5 ${active ? "text-blue-600" : "text-blue-800"}`} aria-hidden="true" /><span className="min-w-0 flex-1 truncate text-left">{item.label}</span>{item.folder?.unread ? <span className="rounded-full bg-white/82 px-2 py-0.5 text-xs text-blue-700 shadow-sm">{item.folder.unread}</span> : null}</button>;
}
function MessageRow({ active, message, onOpen, onToggleStar }: { active: boolean; message: WebmailMessage; onOpen: () => void; onToggleStar: () => void }) {
  return <button aria-label={`Open email ${message.subject}`} className={`group grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3 px-2 py-3 text-left transition focus:outline-none focus:ring-2 focus:ring-blue-200 sm:px-3 ${active ? "rounded-2xl border border-blue-200 bg-blue-50/84 shadow-sm" : "hover:rounded-2xl hover:bg-white/48"}`} onClick={onOpen} type="button"><span className="mt-1 flex flex-col items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${message.unread ? "bg-blue-500" : "border border-blue-200 bg-white/70"}`} /><span className="hidden h-8 w-8 items-center justify-center rounded-full bg-white/70 text-xs font-semibold text-blue-800 shadow-sm sm:inline-flex">{senderInitial(message.from)}</span></span><span className="min-w-0"><span className="flex items-center gap-2"><span className={`truncate text-sm ${message.unread ? "font-semibold text-blue-950" : "font-medium text-slate-700"}`}>{displayAddressName(message.from)}</span>{message.hasAttachments ? <Paperclip className="h-3.5 w-3.5 shrink-0 text-blue-600" aria-label="Has attachments" /> : null}</span><span className="mt-1 block truncate text-sm font-semibold text-blue-950">{message.subject || "(No subject)"}</span><span className="mt-0.5 block truncate text-xs leading-5 text-slate-500">{message.preview || message.subject}</span></span><span className="flex flex-col items-end gap-4"><time className="whitespace-nowrap text-xs font-medium text-blue-900">{formatDate(message.date)}</time><span aria-label={message.starred ? "Unstar email" : "Star email"} className="rounded-full p-1 text-blue-700 transition hover:bg-white" onClick={(event) => { event.stopPropagation(); onToggleStar(); }} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); onToggleStar(); } }}><Star className={`h-4 w-4 ${message.starred ? "fill-amber-400 text-amber-500" : ""}`} aria-hidden="true" /></span></span></button>;
}
function StateNotice({ message, tone = "info" }: { message: string; tone?: Notice["tone"] }) { return <div className={`m-4 rounded-2xl border bg-white/68 p-4 text-sm shadow-sm backdrop-blur-xl ${tone === "error" ? "border-rose-200 text-rose-700" : "border-blue-100 text-slate-600"}`}>{message}</div>; }
function LoadingList() { return <div className="grid gap-2 p-4" aria-label="Loading your mailbox">{Array.from({ length: 7 }).map((_, index) => <div className="h-20 animate-pulse rounded-2xl bg-white/60" key={index} />)}</div>; }
function PreviewLoading() { return <div className="grid gap-4 p-6"><div className="h-8 w-2/3 animate-pulse rounded-full bg-white/78" /><div className="h-4 w-1/2 animate-pulse rounded-full bg-white/70" /><div className="h-72 animate-pulse rounded-[1.5rem] bg-white/66" /></div>; }
function IconAction({ children, disabled, label, onClick }: { children: React.ReactNode; disabled?: boolean; label: string; onClick?: () => void }) { return <button aria-label={label} className="inline-flex h-10 w-10 items-center justify-center rounded-2xl text-blue-900 transition hover:bg-white/60 disabled:cursor-not-allowed disabled:opacity-40" disabled={disabled} onClick={onClick} title={label} type="button">{children}</button>; }
function ToastNotice({ notice }: { notice: Notice }) { return <div className={`fixed right-4 top-4 z-[60] rounded-2xl border bg-white/95 px-4 py-3 text-sm shadow-[0_18px_50px_rgba(30,64,175,0.18)] ${notice.tone === "error" ? "border-rose-200 text-rose-800" : "border-blue-200 text-blue-800"}`}>{notice.message}</div>; }


