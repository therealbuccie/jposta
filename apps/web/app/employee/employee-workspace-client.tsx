
"use client";

import * as React from "react";
import { AlignCenter, AlignLeft, AlignRight, Archive, ArrowLeft, Bell, Bold, Calendar, Check, ChevronDown, ChevronRight, Cloud, Code, Command, Download, Forward, Folder, Image, Inbox, Italic, Link, List, LogOut, Mail, MailPlus, Maximize2, Menu, Mic, Minimize2, Monitor, Moon, MoreHorizontal, Paperclip, Printer, Quote, Redo2, RefreshCw, Reply, ReplyAll, Save, Search, Send, Settings, ShieldAlert, Smile, Sparkles, Star, Sun, Trash2, Underline, Undo2, User, Users, X } from "lucide-react";
import { GlassButton, GlassInput } from "@jposta/ui";
import { jpostaApi, type WebmailFolder, type WebmailMe, type WebmailMessage, type WebmailMessageDetail } from "@/lib/api-client";
import { clearWebmailSession, getStoredWebmailSession } from "@/lib/webmail-session";

type ComposeMode = "compose" | "reply" | "reply-all" | "forward";
type Notice = { message: string; tone: "info" | "success" | "error" };
type ComposeState = { attachments: File[]; bcc: string; body: string; cc: string; draftUid?: number; inReplyTo?: string; mode: ComposeMode; open: boolean; references?: string; subject: string; to: string };
type MessagePage = { folder: string; hasMore: boolean; messages: WebmailMessage[]; page: number; pageSize: number; total: number };
type FolderNavItem = { folder?: WebmailFolder | undefined; icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>; label: string; path: string };
type TopbarPanel = "command" | "theme" | "notifications" | "settings" | "profile" | null;
type MessageActionPanel = "move" | "more" | null;
type ThemeMode = "light" | "dark" | "system";
type DensityMode = "compact" | "comfortable";
type EmployeePreferences = { autoMarkRead: boolean; autoSaveDrafts: boolean; confirmDelete: boolean; defaultComposeMode: "window" | "focus"; density: DensityMode; defaultCcBcc: boolean; refreshInterval: string; remoteImages: boolean; theme: ThemeMode };
type UiNotification = { description: string; id: string; read: boolean; timestamp: number; title: string; tone?: Notice["tone"] };
type CommandItem = { action: () => void; disabled?: boolean; hint?: string; label: string };

const pageSize = 25;
const blankPage: MessagePage = { folder: "INBOX", hasMore: false, messages: [], page: 1, pageSize, total: 0 };
const blankCompose: ComposeState = { attachments: [], bcc: "", body: "", cc: "", mode: "compose", open: false, subject: "", to: "" };
const employeePrefsKey = "jposta.employee.preferences";
const employeeNotificationsKey = "jposta.employee.notifications";
const defaultEmployeePreferences: EmployeePreferences = { autoMarkRead: true, autoSaveDrafts: true, confirmDelete: true, defaultComposeMode: "window", defaultCcBcc: false, density: "comfortable", refreshInterval: "45", remoteImages: true, theme: "system" };

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
  const [activeFolderPath, setActiveFolderPath] = React.useState("INBOX");
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
  const [topbarPanel, setTopbarPanel] = React.useState<TopbarPanel>(null);
  const [commandQuery, setCommandQuery] = React.useState("");
  const [commandIndex, setCommandIndex] = React.useState(0);
  const [preferences, setPreferences] = React.useState<EmployeePreferences>(defaultEmployeePreferences);
  const [systemDark, setSystemDark] = React.useState(false);
  const [notifications, setNotifications] = React.useState<UiNotification[]>([]);
  const [messageActionPanel, setMessageActionPanel] = React.useState<MessageActionPanel>(null);
  const [folderPickerQuery, setFolderPickerQuery] = React.useState("");
  const [movingMessage, setMovingMessage] = React.useState(false);
  const [fullscreenMessageOpen, setFullscreenMessageOpen] = React.useState(false);
  const bootstrapTokenRef = React.useRef<string | null>(null);
  const activeFolderPathRef = React.useRef("INBOX");
  const loadRequestRef = React.useRef(0);
  const refreshRef = React.useRef<((activeToken?: string | null, folderPath?: string, keep?: boolean) => Promise<void>) | null>(null);
  const fullscreenReaderRef = React.useRef<HTMLDivElement | null>(null);
  const messageFocusReturnRef = React.useRef<HTMLElement | null>(null);
  const setSelectedFolder = React.useCallback((path: string) => {
    activeFolderPathRef.current = path;
    setActiveFolderPath(path);
  }, []);
  const activeFolder = activeFolderPath;

  const mailbox = identity?.mailbox.address ?? "";
  const displayName = friendlyName(identity?.mailbox.displayName, mailbox);
  const workspace = identity?.portal.displayName || identity?.portal.organizationName || "Mailbox";
  const folder = folders.find((item) => item.path === activeFolder);
  const trash = /trash|deleted/i.test(activeFolder);
  const folderNav = makeFolderNavigation(folders);
  const customFolders = makeCustomFolders(folders, folderNav);
  const unreadCount = folder?.unread ?? page.messages.filter((message) => message.unread).length;
  const archiveFolder = findArchiveFolder(folders);
  const archivePath = archiveFolder?.path;
  const inArchive = Boolean(archivePath && archivePath === activeFolder);
  const moveFolders = folders.filter((item) => item.path !== activeFolder);
  const filteredMoveFolders = moveFolders.filter((item) => `${item.name} ${item.path}`.toLowerCase().includes(folderPickerQuery.toLowerCase().trim()));
  const effectiveTheme = preferences.theme === "system" ? (systemDark ? "dark" : "light") : preferences.theme;
  const compact = preferences.density === "compact";
  const unreadNotifications = notifications.filter((item) => !item.read).length + (unreadCount > 0 ? 1 : 0);

  const showNotice = React.useCallback((message: string, tone: Notice["tone"] = "info") => { setNotice({ message, tone }); window.setTimeout(() => setNotice(null), 3500); setNotifications((current) => persistNotifications([{ id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, title: tone === "error" ? "Mailbox needs attention" : message, description: message, read: false, timestamp: Date.now(), tone }, ...current].slice(0, 12))); }, []);
  const expire = React.useCallback(() => { clearWebmailSession(); window.location.assign(window.location.origin); }, []);
  const signOut = React.useCallback(() => { clearWebmailSession(); window.location.assign(window.location.origin); }, []);
  const openPanel = React.useCallback((panel: Exclude<TopbarPanel, null>) => { setMessageActionPanel(null); setTopbarPanel((current) => current === panel ? null : panel); if (panel === "command") { setCommandQuery(""); setCommandIndex(0); } }, []);
  const openCommandPalette = React.useCallback(() => openPanel("command"), [openPanel]);
  const openThemeMenu = React.useCallback(() => openPanel("theme"), [openPanel]);
  const openNotificationsPanel = React.useCallback(() => openPanel("notifications"), [openPanel]);
  const openSettingsDrawer = React.useCallback(() => openPanel("settings"), [openPanel]);
  const openProfileMenu = React.useCallback(() => openPanel("profile"), [openPanel]);

  const loadMessages = React.useCallback(async (activeToken: string, requestedFolderPath: string, nextPage = 1, nextSearch = search, keep = false) => {
    const requestId = ++loadRequestRef.current;
    setMessagesLoading(true); setError(null); setSelectedFolder(requestedFolderPath);
    try {
      const params = new URLSearchParams({ folder: requestedFolderPath, page: String(nextPage), pageSize: String(pageSize) });
      if (nextSearch.trim()) params.set("search", nextSearch.trim());
      const result = await jpostaApi.webmailMessages(activeToken, `?${params.toString()}`);
      if (requestId !== loadRequestRef.current) return;
      setPage({ ...result, folder: requestedFolderPath });
      if (!keep) { setSelected(null); setSelectedUid(null); setMobileDetail(false); }
    } catch (caught) {
      if (requestId !== loadRequestRef.current) return;
      if (isExpired(caught)) expire(); else setError(errorMessage(caught, "We couldn't connect to this folder. Please try again."));
    } finally {
      if (requestId === loadRequestRef.current) setMessagesLoading(false);
    }
  }, [expire, search, setSelectedFolder]);

  const refresh = React.useCallback(async (activeToken = token, folderPath = activeFolderPathRef.current, keep = true) => {
    if (!activeToken) return;
    setError(null);
    try {
      const [me, folderResult] = await Promise.all([jpostaApi.webmailMe(activeToken), jpostaApi.webmailFolders(activeToken)]);
      setIdentity(me); setFolders(folderResult.folders);
      await loadMessages(activeToken, resolveFolder(folderResult.folders, folderPath), page.page, search, keep);
    } catch (caught) { if (isExpired(caught)) expire(); else setError(errorMessage(caught, "We couldn't connect to your mailbox. Please try again.")); }
  }, [expire, loadMessages, page.page, search, token]);

  React.useEffect(() => {
    setPreferences(readEmployeePreferences());
    setNotifications(readStoredNotifications());
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const syncSystemTheme = () => setSystemDark(media.matches);
    syncSystemTheme();
    media.addEventListener("change", syncSystemTheme);
    return () => media.removeEventListener("change", syncSystemTheme);
  }, []);

  React.useEffect(() => {
    document.documentElement.dataset.jpostaEmployeeTheme = effectiveTheme;
    return () => { delete document.documentElement.dataset.jpostaEmployeeTheme; };
  }, [effectiveTheme]);

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = Boolean(target?.closest("input, textarea, [contenteditable='true']"));
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k" && !typing) {
        event.preventDefault();
        openCommandPalette();
        return;
      }
      if (event.key === "Escape") setTopbarPanel(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openCommandPalette]);
  React.useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  React.useEffect(() => {
    const stored = getStoredWebmailSession();
    if (!stored) { setLoading(false); setError("Loading your mailbox failed. Please sign in from your company portal."); return; }
    if (bootstrapTokenRef.current === stored.token) return;
    bootstrapTokenRef.current = stored.token;
    setToken(stored.token);
    void refresh(stored.token, "INBOX", false).finally(() => setLoading(false));
    // Bootstrap must run once per mounted mailbox session; refresh is intentionally not a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (!token) return;
    let running = false;
    const id = window.setInterval(() => {
      if (document.visibilityState === "hidden" || running) return;
      const currentRefresh = refreshRef.current;
      if (!currentRefresh) return;
      running = true;
      void currentRefresh(token, activeFolder, true).finally(() => { running = false; });
    }, 45000);
    return () => window.clearInterval(id);
  }, [activeFolder, token]);

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && fullscreenMessageOpen) { closeFullscreenMessage(); return; }
      if (event.key === "Escape" && messageActionPanel) setMessageActionPanel(null);
      if (event.key === "Escape" && compose.open && !topbarPanel && !messageActionPanel) void closeComposer();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // closeComposer intentionally stays as the existing async discard flow.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compose.open, fullscreenMessageOpen, messageActionPanel, topbarPanel]);

  React.useEffect(() => {
    if (!fullscreenMessageOpen) return;
    window.setTimeout(() => fullscreenReaderRef.current?.focus(), 0);
    window.history.pushState({ jpostaFullscreenMessage: true }, "");
    const onPopState = () => setFullscreenMessageOpen(false);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [fullscreenMessageOpen]);

  function closeFullscreenMessage() {
    setFullscreenMessageOpen(false);
    window.setTimeout(() => messageFocusReturnRef.current?.focus(), 0);
  }
  function toggleMessagePanel(panel: Exclude<MessageActionPanel, null>) {
    setTopbarPanel(null);
    setMessageActionPanel((current) => current === panel ? null : panel);
    if (panel === "move") setFolderPickerQuery("");
  }

  function updatePreferences(patch: Partial<EmployeePreferences>) {
    setPreferences((current) => persistPreferences({ ...current, ...patch }));
  }
  function markNotificationsRead() { setNotifications((current) => persistNotifications(current.map((item) => ({ ...item, read: true })))); }
  function clearNotifications() { setNotifications(persistNotifications([])); }
  const commandItems: CommandItem[] = [
    { action: () => { beginCompose("compose"); setTopbarPanel(null); }, hint: "Ctrl Shift C", label: "Compose new message" },
    ...folderNav.map((item) => ({ action: () => { void openFolder(item.path); setTopbarPanel(null); }, label: `Open ${item.label}` })),
    { action: () => { void refresh(); setTopbarPanel(null); }, disabled: !token, label: "Refresh mailbox" },
    { action: () => { setTopbarPanel(null); window.setTimeout(() => document.querySelector<HTMLInputElement>("input[aria-label='Search emails, contacts, files']")?.focus(), 0); }, label: "Search mail" },
    { action: () => { void setRead(); setTopbarPanel(null); }, disabled: !selected, label: selected?.unread ? "Mark selected message read" : "Mark selected message unread" },
    { action: () => { void toggleStar(); setTopbarPanel(null); }, disabled: !selected, label: selected?.starred ? "Unstar selected message" : "Star selected message" },
    { action: openSettingsDrawer, label: "Open Settings" },
    { action: signOut, label: "Sign out" },
  ];

  async function openFolder(path: string) { setSidebarOpen(false); if (token) await loadMessages(token, path, 1, search, false); }
  async function openMessage(message: WebmailMessage, options: { mobileDetail?: boolean } = {}) {
    if (!token) return;
    setSelectedUid(message.uid); setDetailLoading(true); setError(null);
    try {
      const detail = await jpostaApi.webmailMessage(token, message.uid, activeFolder);
      setSelected(detail); setMobileDetail(options.mobileDetail ?? true);
      if (detail.unread) await setRead(detail, true, true);
    } catch (caught) { if (isExpired(caught)) expire(); else setError(errorMessage(caught, "This email is no longer available.")); }
    finally { setDetailLoading(false); }
  }
  async function openMessageFullscreen(message: WebmailMessage) {
    messageFocusReturnRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (selected?.uid === message.uid) {
      setSelectedUid(message.uid);
      setMobileDetail(false);
      setFullscreenMessageOpen(true);
      return;
    }
    await openMessage(message, { mobileDetail: false });
    setFullscreenMessageOpen(true);
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
    if (!token || !selected || path === activeFolder || movingMessage) return;
    const uid = selected.uid;
    setMovingMessage(true);
    removeMessage(uid); setSelected(null); setSelectedUid(null); setMessageActionPanel(null);
    try { await jpostaApi.webmailMove(token, uid, { fromFolder: activeFolder, toFolder: path }); await refresh(token, activeFolder, false); showNotice("Email moved.", "success"); }
    catch (caught) { showActionError(caught); await refresh(token, activeFolder, true); }
    finally { setMovingMessage(false); }
  }
  async function deleteSelected() {
    if (!token || !selected) return;
    if (trash && !window.confirm("Permanently delete this email?")) return;
    const uid = selected.uid; setMessageActionPanel(null); removeMessage(uid); setSelected(null); setSelectedUid(null);
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
      const draftUid = compose.draftUid;
      await jpostaApi.webmailSendForm(token, data);
      if (draftUid) await jpostaApi.webmailDeleteDraft(token, draftUid).catch(() => null);
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
  function printSelectedMessage() {
    if (!selected) return;
    const printWindow = window.open("", "jposta-print-message", "width=900,height=700");
    if (!printWindow) { showNotice("Pop-up blocked. Allow pop-ups to print this message.", "error"); return; }
    printWindow.document.write(`<!doctype html><html><head><title>${escapeHtml(selected.subject)}</title><style>body{font-family:Inter,Arial,sans-serif;padding:32px;color:#0f172a;line-height:1.55}.meta{color:#475569;margin-bottom:24px}hr{border:0;border-top:1px solid #dbeafe;margin:24px 0}</style></head><body><h1>${escapeHtml(selected.subject)}</h1><div class="meta"><p><strong>From:</strong> ${escapeHtml(selected.from)}</p><p><strong>To:</strong> ${escapeHtml(selected.to || mailbox)}</p><p><strong>Date:</strong> ${escapeHtml(formatLongDate(selected.date))}</p></div><hr />${renderEmailHtml(selected)}</body></html>`);
    printWindow.document.close(); printWindow.focus(); printWindow.print();
  }

  function patchMessage(uid: number, patch: Partial<WebmailMessage>) { setPage((current) => ({ ...current, messages: current.messages.map((message) => message.uid === uid ? { ...message, ...patch } : message) })); }
  function removeMessage(uid: number) { setPage((current) => ({ ...current, total: Math.max(0, current.total - 1), messages: current.messages.filter((message) => message.uid !== uid) })); }
  function showActionError(caught: unknown) { if (isExpired(caught)) expire(); else showNotice(errorMessage(caught, "Action could not be completed. Please try again."), "error"); }

  return (
    <div className={`jposta-employee-root h-dvh min-h-0 overflow-hidden text-slate-950 transition-colors ${effectiveTheme === "dark" ? "jposta-employee-root-dark bg-[radial-gradient(circle_at_top_left,rgba(76,141,255,0.20),transparent_34%),radial-gradient(circle_at_82%_12%,rgba(99,102,241,0.15),transparent_36%),linear-gradient(135deg,#07111F_0%,#091527_48%,#0C1628_100%)]" : "jposta-employee-root-light bg-[radial-gradient(circle_at_top_left,rgba(147,197,253,0.45),transparent_30%),radial-gradient(circle_at_80%_10%,rgba(221,214,254,0.45),transparent_34%),linear-gradient(135deg,#edf7ff_0%,#f8fbff_45%,#eaf3ff_100%)]"}`}>
      <style>{`
        .jposta-email-preview { max-width: 100%; overflow-x: auto; overflow-wrap: anywhere; }
        .jposta-email-preview :where(img) { max-width: 100%; height: auto; }
        .jposta-email-preview :where(table) { max-width: 100%; }
        .jposta-employee-root-dark { color-scheme: dark; }
        .jposta-employee-root-dark .jposta-backdrop-grid { background-image: linear-gradient(rgba(76,141,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(76,141,255,0.055) 1px, transparent 1px); opacity: 0.34; }
        .jposta-employee-root-dark .jposta-glow-one { background: rgba(76,141,255,0.18); filter: blur(74px); }
        .jposta-employee-root-dark .jposta-glow-two { background: rgba(56,189,248,0.10); filter: blur(82px); }
        .jposta-employee-dark { --jp-bg: #07111f; --jp-surface: rgba(12,22,40,0.72); --jp-surface-strong: rgba(16,29,51,0.82); --jp-hover: rgba(21,37,68,0.82); --jp-selected: rgba(29,55,104,0.78); --jp-accent: #4c8dff; --jp-border: rgba(255,255,255,0.08); --jp-border-strong: rgba(148,185,255,0.26); --jp-text: rgba(255,255,255,0.95); --jp-secondary: rgba(210,220,245,0.82); --jp-muted: rgba(165,180,205,0.68); --jp-placeholder: rgba(145,160,190,0.55); --jp-glow: rgba(76,141,255,0.18); color: var(--jp-text); }
        .jposta-employee-dark :where(aside, main > section, header > div, .jposta-glass-panel) { background: linear-gradient(145deg, rgba(16,29,51,0.76), rgba(8,18,34,0.58)) !important; border-color: var(--jp-border) !important; box-shadow: inset 0 1px 0 rgba(255,255,255,0.075), inset 0 -1px 0 rgba(76,141,255,0.04), 0 28px 90px rgba(0,0,0,0.34), 0 0 54px rgba(76,141,255,0.065) !important; backdrop-filter: blur(26px) saturate(145%); }
        .jposta-employee-dark :where(aside, main > section) { outline: 1px solid rgba(76,141,255,0.10); outline-offset: -1px; }
        .jposta-employee-dark :where(h1,h2,h3,p,span,time,button,label,input,textarea,select) { color: inherit; }
        .jposta-employee-dark :where(.text-blue-950,.text-blue-900,.text-blue-800,.text-slate-700) { color: var(--jp-text) !important; }
        .jposta-employee-dark :where(.text-slate-600,.text-slate-500,.text-slate-400) { color: var(--jp-muted) !important; }
        .jposta-employee-dark :where(.text-blue-700,.text-blue-600) { color: #78a8ff !important; }
        .jposta-employee-dark :where([class*="border-white/"],[class*="border-blue-100"],.border-blue-200) { border-color: var(--jp-border) !important; }
        .jposta-employee-dark :where([class*="bg-white/"]) { background-color: var(--jp-surface) !important; }
        .jposta-employee-dark :where(.bg-blue-50,[class*="bg-blue-50/"],.bg-blue-100,[class*="bg-blue-100/"]) { background-color: rgba(29,55,104,0.42) !important; }
        .jposta-employee-dark :where(input,textarea,select) { background-color: rgba(7,17,31,0.42) !important; color: var(--jp-text) !important; border-color: var(--jp-border) !important; caret-color: var(--jp-accent); }
        .jposta-employee-dark :where(input,textarea)::placeholder { color: var(--jp-placeholder) !important; }
        .jposta-employee-dark :where(button,a) { transition-duration: 180ms; }
        .jposta-employee-dark :where(button:hover:not(:disabled),a:hover) { background-color: var(--jp-hover) !important; box-shadow: 0 10px 34px rgba(76,141,255,0.10); }
        .jposta-employee-dark nav button[class*="bg-blue-100"], .jposta-employee-dark .jposta-message-row[class*="bg-blue-50"] { background: linear-gradient(135deg, rgba(29,55,104,0.82), rgba(30,64,175,0.38)) !important; border-color: rgba(76,141,255,0.62) !important; box-shadow: inset 0 1px 0 rgba(255,255,255,0.12), 0 0 0 1px rgba(76,141,255,0.18), 0 16px 48px rgba(76,141,255,0.16) !important; color: #fff !important; }
        .jposta-employee-dark .jposta-message-row { border-color: rgba(255,255,255,0.07) !important; }
        .jposta-employee-dark .jposta-message-row:hover { background: rgba(21,37,68,0.56) !important; }
        .jposta-employee-dark .jposta-message-row :where(.bg-blue-500) { background-color: #4c8dff !important; box-shadow: 0 0 16px rgba(76,141,255,0.65); }
        .jposta-email-canvas { border-radius: 1rem; padding: 1rem; line-height: 1.58; }
        .jposta-employee-dark .jposta-email-canvas-html { color: #0f172a; background: #f8fbff; border: 1px solid rgba(255,255,255,0.12); box-shadow: 0 18px 60px rgba(0,0,0,0.24); }
        .jposta-employee-dark .jposta-email-canvas-text { color: rgba(236,244,255,0.92); background: linear-gradient(145deg, rgba(16,29,51,0.72), rgba(7,17,31,0.52)); border: 1px solid rgba(255,255,255,0.08); box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 18px 60px rgba(0,0,0,0.22); }
        .jposta-employee-dark .jposta-email-canvas-text :where(a) { color: #8bb5ff; }
        .jposta-employee-dark ::-webkit-scrollbar { width: 9px; height: 9px; }
        .jposta-employee-dark ::-webkit-scrollbar-track { background: transparent; }
        .jposta-employee-dark ::-webkit-scrollbar-thumb { background: rgba(76,141,255,0.28); border: 2px solid transparent; border-radius: 999px; background-clip: padding-box; }
        .jposta-employee-dark ::-webkit-scrollbar-thumb:hover { background: rgba(76,141,255,0.44); border: 2px solid transparent; background-clip: padding-box; }
        .jposta-employee-dark button:focus-visible, .jposta-employee-dark input:focus-visible, .jposta-employee-dark select:focus-visible, .jposta-employee-dark textarea:focus-visible { outline: 2px solid rgba(76,141,255,0.72); outline-offset: 2px; }
        .jposta-density-compact .jposta-message-row { padding-top: 0.375rem !important; padding-bottom: 0.375rem !important; gap: 0.625rem !important; }
        .jposta-density-compact .jposta-message-row :where(.h-7.w-7) { height: 1.5rem !important; width: 1.5rem !important; }
        .jposta-density-compact nav button { min-height: 0; }
        @media (min-width: 1024px) {
          .jposta-employee-shell { padding: 0.375rem !important; gap: 0.375rem !important; }
          .jposta-employee-shell > header { gap: 0.375rem !important; grid-template-columns: 11rem minmax(0,32rem) auto !important; }
          .jposta-employee-shell > main { gap: 0.375rem !important; grid-template-columns: 11rem minmax(19.5rem,23rem) minmax(0,1fr) !important; }
          .jposta-employee-shell aside { border-radius: 0.9rem !important; }
          .jposta-employee-shell nav { gap: 0.125rem !important; }
          .jposta-employee-shell nav button { height: 2rem !important; border-radius: 0.7rem !important; gap: 0.45rem !important; padding-left: 0.5rem !important; padding-right: 0.5rem !important; font-size: 12px !important; }
          .jposta-employee-shell nav button svg { height: 0.875rem !important; width: 0.875rem !important; }
          .jposta-compose-main { height: 2.125rem !important; margin-bottom: 0.375rem !important; border-radius: 0.8rem !important; font-size: 12px !important; }
          .jposta-message-list-scroll { padding: 0.25rem 0.5rem !important; }
          .jposta-message-row { gap: 0.45rem !important; padding: 0.25rem 0.5rem !important; }
          .jposta-message-row .jposta-row-dot { height: 0.4rem !important; width: 0.4rem !important; }
          .jposta-message-row .jposta-row-avatar { height: 1.25rem !important; width: 1.25rem !important; font-size: 10px !important; }
          .jposta-preview-header { padding: 0.5rem 0.625rem !important; }
          .jposta-preview-toolbar { gap: 0.25rem !important; margin-bottom: 0.375rem !important; }
          .jposta-preview-toolbar button { height: 1.55rem !important; width: 1.55rem !important; }
          .jposta-preview-body { padding: 0.625rem !important; }
          .jposta-email-canvas { padding: 0.75rem !important; font-size: 13px; line-height: 1.52; }
        }

      `}</style>
      <div className="jposta-backdrop-grid pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(255,255,255,0.42)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.34)_1px,transparent_1px)] bg-[size:44px_44px] opacity-50" />
      <div className="jposta-glow-one pointer-events-none fixed left-[12%] top-[14%] h-72 w-72 rounded-full bg-sky-200/45 blur-3xl" />
      <div className="jposta-glow-two pointer-events-none fixed bottom-[8%] right-[18%] h-80 w-80 rounded-full bg-blue-100/70 blur-3xl" />
      <div className={`jposta-employee-shell relative z-10 flex h-dvh min-h-0 flex-col overflow-hidden p-1.5 transition-colors lg:p-2 ${compact ? "jposta-density-compact gap-1.5" : "jposta-density-comfortable gap-2"} ${effectiveTheme === "dark" ? "jposta-employee-dark" : "jposta-employee-light"}`}>
        <header className="relative z-30 grid gap-2 lg:grid-cols-[12rem_minmax(0,34rem)_auto] xl:grid-cols-[12.5rem_minmax(28rem,36rem)_auto]">
          <div className="hidden items-center gap-2 rounded-[0.95rem] border border-white/70 bg-white/42 px-2.5 py-1.5 shadow-[0_18px_60px_rgba(37,99,235,0.12)] backdrop-blur-2xl lg:flex"><LogoMark /><div className="min-w-0"><p className="truncate text-xs text-slate-500">Mailbox</p><p className="truncate text-[16px] font-semibold text-blue-950">{workspace}</p></div></div>
          <div className="flex items-center gap-3 rounded-[1rem] border border-white/70 bg-white/58 p-1 shadow-[0_20px_70px_rgba(30,64,175,0.14)] backdrop-blur-2xl">
            <button aria-label="Open folders" className="inline-flex h-7 w-7 items-center justify-center rounded-2xl border border-white/70 bg-white/70 text-blue-900 shadow-sm lg:hidden" onClick={() => setSidebarOpen(true)} type="button"><Menu className="h-[18px] w-[18px]" aria-hidden="true" /></button>
            <Search className="ml-1 h-[18px] w-[18px] shrink-0 text-blue-900" aria-hidden="true" />
            <input aria-label="Search emails, contacts, files" className="h-7 min-w-0 flex-1 bg-transparent text-[13px] text-blue-950 outline-none placeholder:text-slate-500" onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && token) void loadMessages(token, activeFolder, 1, search, false); }} placeholder="Search emails, contacts, files..." value={search} />
            <button aria-controls="employee-command-palette" aria-expanded={topbarPanel === "command"} aria-label="Open command palette" className="pointer-events-auto hidden cursor-pointer rounded-full border border-blue-100 bg-white/80 px-2.5 py-1 text-[11px] font-medium text-blue-900 transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 sm:inline-flex" onClick={openCommandPalette} type="button"><Command className="mr-1 h-3 w-3" aria-hidden="true" />Ctrl K</button>
          </div>
          <div className="flex items-center justify-end gap-2"><TopIconButton ariaControls="employee-theme-menu" expanded={topbarPanel === "theme"} label="Theme" onClick={openThemeMenu}><Moon className="h-[18px] w-[18px]" aria-hidden="true" /></TopIconButton><TopIconButton ariaControls="employee-notifications" badge={unreadNotifications} expanded={topbarPanel === "notifications"} label="Notifications" onClick={openNotificationsPanel}><Bell className="h-[18px] w-[18px]" aria-hidden="true" /></TopIconButton><TopIconButton ariaControls="employee-settings" expanded={topbarPanel === "settings"} label="Settings" onClick={openSettingsDrawer}><Settings className="h-[18px] w-[18px]" aria-hidden="true" /></TopIconButton><button aria-controls="employee-profile-menu" aria-expanded={topbarPanel === "profile"} aria-label="Open profile menu" className="pointer-events-auto flex min-w-0 cursor-pointer items-center gap-2 rounded-[1.1rem] border border-white/70 bg-white/50 px-2.5 py-1.5 shadow-[0_18px_60px_rgba(30,64,175,0.12)] backdrop-blur-2xl transition hover:bg-white/70 focus:outline-none focus:ring-2 focus:ring-blue-200 sm:min-w-[11rem] lg:min-w-[13.5rem]" onClick={openProfileMenu} type="button"><Avatar name={displayName} /><div className="hidden min-w-0 flex-1 text-left sm:block"><p className="truncate text-[13px] font-semibold text-blue-950">{displayName}</p><p className="truncate text-xs text-slate-500">{mailbox || "Mailbox"}</p></div><ChevronDown className="h-4 w-4 shrink-0 text-blue-900" aria-hidden="true" /></button></div>
        </header>
        <main className="grid min-h-0 flex-1 gap-2 overflow-hidden lg:grid-cols-[12rem_minmax(21rem,25rem)_minmax(0,1fr)] xl:grid-cols-[12.5rem_minmax(21.5rem,25.5rem)_minmax(0,1fr)]">
          <aside className={`${sidebarOpen ? "fixed inset-3 z-50 flex" : "hidden"} min-h-0 min-w-0 flex-col rounded-[1rem] border border-white/70 bg-white/56 shadow-[0_30px_90px_rgba(30,64,175,0.18)] backdrop-blur-2xl lg:relative lg:inset-auto lg:z-auto lg:flex`}>
            <div className="flex items-center justify-between border-b border-white/60 p-2.5 lg:hidden"><div className="flex items-center gap-3"><LogoMark /><p className="font-semibold text-blue-950">JPosta Mail</p></div><button aria-label="Close folders" className="rounded-full p-2 text-blue-900" onClick={() => setSidebarOpen(false)} type="button"><X className="h-[18px] w-[18px]" aria-hidden="true" /></button></div>
            <div className="hidden items-center gap-3 border-b border-white/60 p-2 lg:flex"><LogoMark /><p className="text-[15px] font-semibold text-blue-950">JPosta Mail</p></div>
            <div className="min-h-0 flex-1 overflow-hidden p-2">
              <button className="jposta-compose-main mb-2 inline-flex h-9 w-full items-center justify-center gap-2 rounded-[0.9rem] bg-blue-500 text-[13px] font-semibold text-white shadow-[0_18px_36px_rgba(37,99,235,0.28)] transition hover:-translate-y-0.5 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-300" onClick={() => beginCompose("compose")} type="button"><MailPlus className="h-[18px] w-[18px]" aria-hidden="true" />Compose</button>
              <nav className="min-h-0 overflow-y-auto pr-1 grid gap-1" aria-label="Mail folders">
                {folderNav.map((item) => <FolderButton active={item.path === activeFolder} compact={compact} item={item} key={item.path} onClick={() => void openFolder(item.path)} />)}
                <button className="flex h-9 items-center gap-2.5 rounded-xl px-2.5 text-[13px] font-medium text-blue-950 transition hover:bg-white/60 focus:outline-none focus:ring-2 focus:ring-blue-200" onClick={() => setShowMoreFolders((current) => !current)} type="button"><MoreHorizontal className="h-3.5 w-3.5 text-blue-800" aria-hidden="true" /><span className="flex-1 text-left">More</span><ChevronRight className={`h-3.5 w-3.5 text-blue-800 transition ${showMoreFolders ? "rotate-90" : ""}`} aria-hidden="true" /></button>
                {showMoreFolders ? <div className="mt-1 grid gap-1 border-l border-blue-100/80 pl-3">{customFolders.length ? customFolders.map((item) => <FolderButton active={item.path === activeFolder} compact item={item} key={item.path} onClick={() => void openFolder(item.path)} />) : <p className="px-3 py-2 text-xs text-slate-500">No additional folders.</p>}</div> : null}
              </nav>
            </div>
            <div className="grid shrink-0 gap-2 border-t border-white/60 p-2"><div className="rounded-xl border border-white/70 bg-white/45 p-2.5 shadow-inner backdrop-blur-xl"><div className="mb-1.5 flex items-center gap-2 text-[11px] font-medium text-blue-950"><Cloud className="h-4 w-4 text-blue-700" aria-hidden="true" />Storage</div><div className="h-2 overflow-hidden rounded-full bg-blue-100/70"><div className="h-full w-[24%] rounded-full bg-blue-500" /></div><p className="mt-1.5 text-[11px] text-slate-500">Mailbox storage available</p></div><div className="flex items-center gap-3 rounded-xl border border-white/70 bg-white/45 p-2.5 backdrop-blur-xl lg:hidden"><Avatar name={displayName} /><div className="min-w-0"><p className="truncate text-[13px] font-semibold text-blue-950">{displayName}</p><p className="truncate text-xs text-slate-500">{mailbox || "Mailbox"}</p></div></div></div>
          </aside>
          <section className={`${mobileDetail ? "hidden lg:flex" : "flex"} min-h-0 min-w-0 flex-col rounded-[1rem] border border-white/70 bg-white/50 shadow-[0_24px_80px_rgba(30,64,175,0.14)] backdrop-blur-2xl`}>
            <div className="border-b border-white/60 p-2.5 sm:p-3"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><div className="flex items-center gap-3"><h1 className="truncate text-[16px] font-semibold text-blue-950">{folder?.name || activeFolder}</h1><span className="rounded-full bg-blue-100/80 px-2.5 py-0.5 text-xs font-medium text-blue-700">{unreadCount} unread</span></div><p className="mt-0.5 text-xs text-slate-500">{loading ? "Loading your mailbox..." : `${page.total} messages`}</p></div><button aria-label="Refresh mailbox" className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-2xl border border-blue-100 bg-white/70 text-blue-900 shadow-sm transition hover:-translate-y-0.5 hover:bg-white focus:outline-none focus:ring-2 focus:ring-blue-200" onClick={() => void refresh()} type="button"><RefreshCw className="h-4 w-4" aria-hidden="true" /></button></div><div className="relative mt-2"><Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" /><GlassInput aria-label="Search this folder" className="h-8 rounded-xl border-white/70 bg-white/78 pl-9 text-[13px] text-blue-950 placeholder:text-slate-500" onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && token) void loadMessages(token, activeFolder, 1, search, false); }} placeholder="Search this folder" value={search} /></div></div>
            {error ? <StateNotice message={error} tone="error" /> : null}
            {loading || messagesLoading ? <LoadingList /> : null}
            {!loading && !messagesLoading && !error && page.messages.length === 0 ? <StateNotice message={isInbox(activeFolder) ? "Your inbox is empty." : "No emails here."} /> : null}
            <div className="jposta-message-list-scroll min-h-0 flex-1 overflow-y-auto px-2.5 py-1.5 sm:px-3"><div className="grid divide-y divide-blue-100/70">{page.messages.map((message) => <MessageRow active={selectedUid === message.uid} key={`${activeFolder}-${message.uid}`} message={message} onOpen={() => void openMessage(message)} onOpenFullscreen={() => void openMessageFullscreen(message)} onToggleStar={() => void toggleMessageStar(message)} />)}</div></div>
            <div className="flex items-center justify-between gap-3 border-t border-white/60 p-2.5 text-xs text-slate-500"><span>Page {page.page}</span><div className="flex gap-2"><GlassButton disabled={!token || page.page <= 1} onClick={() => token && loadMessages(token, activeFolder, page.page - 1, search, false)} size="sm" variant="ghost">Previous</GlassButton><GlassButton disabled={!token || !page.hasMore} onClick={() => token && loadMessages(token, activeFolder, page.page + 1, search, false)} size="sm" variant="ghost">Next</GlassButton></div></div>
          </section>
          <section className={`${mobileDetail ? "fixed inset-0 z-40 block overflow-y-auto bg-[linear-gradient(135deg,#edf7ff,#f8fbff)] p-3 lg:relative lg:inset-auto lg:z-auto lg:overflow-hidden lg:bg-transparent lg:p-0" : "hidden lg:block"} min-h-0 min-w-0 overflow-hidden rounded-[1rem] border border-white/70 bg-white/48 shadow-[0_24px_80px_rgba(30,64,175,0.14)] backdrop-blur-2xl`}>
            {mobileDetail ? <div className="mb-3 lg:hidden"><GlassButton onClick={() => setMobileDetail(false)} variant="glass"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Back to inbox</GlassButton></div> : null}
            {!selected && !detailLoading ? <div className="flex h-full min-h-[28rem] items-center justify-center p-8 text-center text-slate-500"><div><Mail className="mx-auto mb-4 h-8 w-8 text-blue-500" aria-hidden="true" /><p className="text-sm font-medium text-blue-950">Select an email to read.</p><p className="mt-1 text-sm">Your message preview will open here.</p></div></div> : null}
            {detailLoading ? <PreviewLoading /> : null}
            {selected ? <article className="flex h-full min-h-0 flex-col overflow-hidden"><header className="jposta-preview-header border-b border-white/60 p-2.5 sm:p-3"><div className="jposta-preview-toolbar mb-2 flex items-center justify-between gap-1.5 text-blue-900"><div className="flex flex-wrap gap-2"><IconAction label="Reply" onClick={() => beginCompose("reply")}><Reply className="h-4 w-4" aria-hidden="true" /></IconAction><IconAction label="Reply all" onClick={() => beginCompose("reply-all")}><ReplyAll className="h-4 w-4" aria-hidden="true" /></IconAction><IconAction label="Archive" disabled={!archivePath || inArchive || movingMessage} onClick={() => archivePath && void moveSelected(archivePath)}><Archive className="h-4 w-4" aria-hidden="true" /></IconAction><IconAction label="Delete" onClick={() => void deleteSelected()}><Trash2 className="h-4 w-4" aria-hidden="true" /></IconAction><IconAction label={selected.unread ? "Mark read" : "Mark unread"} onClick={() => void setRead()}><Mail className="h-4 w-4" aria-hidden="true" /></IconAction><IconAction expanded={messageActionPanel === "move"} label="Move" disabled={!moveFolders.length || movingMessage} onClick={() => toggleMessagePanel("move")}><Folder className="h-4 w-4" aria-hidden="true" /></IconAction><IconAction expanded={messageActionPanel === "more"} label="More" onClick={() => toggleMessagePanel("more")}><MoreHorizontal className="h-4 w-4" aria-hidden="true" /></IconAction></div><IconAction label={selected.starred ? "Unstar" : "Star"} onClick={() => void toggleStar()}><Star className={`h-[18px] w-[18px] ${selected.starred ? "fill-amber-400 text-amber-500" : ""}`} aria-hidden="true" /></IconAction></div><div className="flex items-start justify-between gap-4"><div className="min-w-0"><div className="mb-2 flex flex-wrap items-center gap-2"><h2 className="text-lg font-semibold leading-tight text-blue-950">{selected.subject}</h2><span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">{folder?.name || activeFolder}</span></div><div className="flex items-center gap-2"><Avatar name={displayAddressName(selected.from)} /><div className="min-w-0"><p className="truncate text-[13px] font-semibold text-blue-950">{displayAddressName(selected.from)}</p><p className="truncate text-xs text-slate-500">to {selected.to || mailbox}</p>{selected.cc ? <p className="truncate text-xs text-slate-500">cc {selected.cc}</p> : null}</div></div></div><div className="hidden shrink-0 text-right sm:block"><time className="text-xs font-medium text-blue-900">{formatDate(selected.date)}</time><p className="mt-1 text-xs text-slate-500">{formatLongDate(selected.date)}</p></div></div></header><div className="jposta-preview-body min-h-0 flex-1 overflow-y-auto p-3 sm:p-4"><div className="mx-auto max-w-[850px]"><div className={`jposta-email-preview jposta-email-canvas ${selected.sanitizedHtml ? "jposta-email-canvas-html" : "jposta-email-canvas-text"} max-w-none text-slate-950`} dangerouslySetInnerHTML={{ __html: renderEmailHtml(selected) }} />{selected.attachments.length ? <div className="mt-4 grid gap-2"><h3 className="text-[13px] font-semibold text-blue-950">Attachments</h3>{selected.attachments.map((attachment) => <button className="flex items-center justify-between gap-3 rounded-2xl border border-blue-100 bg-white/72 p-2.5 text-left text-xs shadow-sm transition hover:-translate-y-0.5 hover:bg-white focus:outline-none focus:ring-2 focus:ring-blue-200" key={attachment.partId} onClick={() => void downloadAttachment(attachment)} type="button"><span className="flex min-w-0 items-center gap-3"><span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600"><Paperclip className="h-4 w-4" aria-hidden="true" /></span><span className="min-w-0"><span className="block truncate font-medium text-blue-950">{attachment.filename}</span><span className="text-xs text-slate-500">{attachment.contentType} / {formatBytes(attachment.size)}</span></span></span><Download className="h-4 w-4 shrink-0 text-blue-700" aria-hidden="true" /></button>)}</div> : null}</div></div><footer className="shrink-0 border-t border-white/60 p-2"><div className="grid gap-2 sm:grid-cols-2"><GlassButton onClick={() => beginCompose("reply")} variant="glass"><Reply className="h-4 w-4" aria-hidden="true" />Reply</GlassButton><GlassButton onClick={() => beginCompose("forward")} variant="glass"><Forward className="h-4 w-4" aria-hidden="true" />Forward</GlassButton></div></footer></article> : null}
          </section>
        </main>
      </div>
      {fullscreenMessageOpen && selected ? (
        <FullscreenMessageReader
          archivePath={archivePath}
          folderName={folder?.name || activeFolder}
          inArchive={inArchive}
          mailbox={mailbox}
          message={selected}
          moving={movingMessage}
          onArchive={() => archivePath && void moveSelected(archivePath)}
          onClose={closeFullscreenMessage}
          onDelete={() => void deleteSelected()}
          onDownloadAttachment={downloadAttachment}
          onForward={() => beginCompose("forward")}
          onMarkRead={() => void setRead()}
          onMove={() => toggleMessagePanel("move")}
          onMore={() => toggleMessagePanel("more")}
          onReply={() => beginCompose("reply")}
          onReplyAll={() => beginCompose("reply-all")}
          onToggleStar={() => void toggleStar()}
          readerRef={fullscreenReaderRef}
        />
      ) : null}
      <TopbarOverlays
        activeFolder={activeFolder}
        commandIndex={commandIndex}
        commandItems={commandItems}
        commandQuery={commandQuery}
        displayName={displayName}
        effectiveTheme={effectiveTheme}
        mailbox={mailbox}
        notifications={notifications}
        onClearNotifications={clearNotifications}
        onClose={() => setTopbarPanel(null)}
        onCommandIndexChange={setCommandIndex}
        onCommandQueryChange={setCommandQuery}
        onMarkNotificationsRead={markNotificationsRead}
        onPreferencesChange={updatePreferences}
        onSignOut={signOut}
        openPanel={openPanel}
        panel={topbarPanel}
        preferences={preferences}
        setNotifications={setNotifications}
        storageText="Mailbox storage available"
        unreadCount={unreadCount}
        workspace={workspace}
      />
      <MessageActionOverlays
        activeFolder={activeFolder}
        archivePath={archivePath}
        filteredMoveFolders={filteredMoveFolders}
        folders={folders}
        inArchive={inArchive}
        moving={movingMessage}
        onArchive={() => archivePath && void moveSelected(archivePath)}
        onClose={() => setMessageActionPanel(null)}
        onDelete={() => void deleteSelected()}
        onMove={(path) => void moveSelected(path)}
        onMoveQueryChange={setFolderPickerQuery}
        onOpenMove={() => { setMessageActionPanel("move"); setFolderPickerQuery(""); }}
        onPrint={printSelectedMessage}
        onSetRead={() => void setRead()}
        onToggleStar={() => void toggleStar()}
        panel={messageActionPanel}
        query={folderPickerQuery}
        selected={selected}
      />
      {compose.open ? (
        <ComposeWindow
          compose={compose}
          mailbox={mailbox}
          onChange={setCompose}
          onClose={() => void closeComposer()}
          onSaveDraft={() => void saveDraft()}
          onSubmit={sendMessage}
          savingDraft={savingDraft}
          sending={sending}
        />
      ) : null}
      {notice ? <ToastNotice notice={notice} /> : null}
    </div>
  );
}
function FullscreenMessageReader({ archivePath, folderName, inArchive, mailbox, message, moving, onArchive, onClose, onDelete, onDownloadAttachment, onForward, onMarkRead, onMove, onMore, onReply, onReplyAll, onToggleStar, readerRef }: { archivePath: string | undefined; folderName: string; inArchive: boolean; mailbox: string; message: WebmailMessageDetail; moving: boolean; onArchive: () => void; onClose: () => void; onDelete: () => void; onDownloadAttachment: (attachment: WebmailMessageDetail["attachments"][number]) => void; onForward: () => void; onMarkRead: () => void; onMove: () => void; onMore: () => void; onReply: () => void; onReplyAll: () => void; onToggleStar: () => void; readerRef: React.RefObject<HTMLDivElement | null> }) {
  return (
    <div className="fixed inset-0 z-[53] overflow-hidden bg-slate-950/72 p-2 text-blue-950 backdrop-blur-2xl sm:p-3" role="dialog" aria-modal="true" aria-labelledby="fullscreen-message-title" ref={readerRef} tabIndex={-1}>
      <div className="pointer-events-none absolute left-[10%] top-[8%] h-72 w-72 rounded-full bg-blue-500/18 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[8%] right-[12%] h-80 w-80 rounded-full bg-cyan-300/10 blur-3xl" />
      <article className="relative mx-auto flex h-full max-w-[1400px] flex-col overflow-hidden rounded-[1.35rem] border border-white/12 bg-white/92 shadow-[0_34px_120px_rgba(0,0,0,0.38)] backdrop-blur-2xl dark:bg-slate-950/70">
        <header className="shrink-0 border-b border-white/15 bg-white/70 px-3 py-2 backdrop-blur-2xl dark:bg-slate-950/52 sm:px-4">
          <div className="mb-2 flex items-center justify-between gap-3 text-blue-900">
            <div className="flex flex-wrap items-center gap-1.5">
              <IconAction label="Close fullscreen reader" onClick={onClose}><ArrowLeft className="h-4 w-4" aria-hidden="true" /></IconAction>
              <IconAction label="Reply" onClick={onReply}><Reply className="h-4 w-4" aria-hidden="true" /></IconAction>
              <IconAction label="Reply all" onClick={onReplyAll}><ReplyAll className="h-4 w-4" aria-hidden="true" /></IconAction>
              <IconAction label="Archive" disabled={!archivePath || inArchive || moving} onClick={onArchive}><Archive className="h-4 w-4" aria-hidden="true" /></IconAction>
              <IconAction label="Delete" onClick={onDelete}><Trash2 className="h-4 w-4" aria-hidden="true" /></IconAction>
              <IconAction label={message.unread ? "Mark read" : "Mark unread"} onClick={onMarkRead}><Mail className="h-4 w-4" aria-hidden="true" /></IconAction>
              <IconAction label="Move" onClick={onMove}><Folder className="h-4 w-4" aria-hidden="true" /></IconAction>
              <IconAction label="More" onClick={onMore}><MoreHorizontal className="h-4 w-4" aria-hidden="true" /></IconAction>
            </div>
            <IconAction label={message.starred ? "Unstar" : "Star"} onClick={onToggleStar}><Star className={`h-5 w-5 ${message.starred ? "fill-amber-400 text-amber-500" : ""}`} aria-hidden="true" /></IconAction>
          </div>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2"><h2 id="fullscreen-message-title" className="text-xl font-semibold leading-tight text-blue-950">{message.subject || "(No subject)"}</h2><span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-medium text-blue-700">{folderName}</span></div>
              <div className="flex items-center gap-2.5"><Avatar name={displayAddressName(message.from)} /><div className="min-w-0"><p className="truncate text-[13px] font-semibold text-blue-950">{displayAddressName(message.from)}</p><p className="truncate text-[11px] text-slate-500">to {message.to || mailbox}</p>{message.cc ? <p className="truncate text-[11px] text-slate-500">cc {message.cc}</p> : null}</div></div>
            </div>
            <div className="hidden shrink-0 text-right sm:block"><time className="text-[11px] font-medium text-blue-900">{formatDate(message.date)}</time><p className="mt-1 text-[11px] text-slate-500">{formatLongDate(message.date)}</p></div>
          </div>
        </header>
        <div className="jposta-preview-body min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
          <div className="mx-auto max-w-[980px]">
            <div className={`jposta-email-preview jposta-email-canvas ${message.sanitizedHtml ? "jposta-email-canvas-html" : "jposta-email-canvas-text"} max-w-none text-slate-950`} dangerouslySetInnerHTML={{ __html: renderEmailHtml(message) }} />
            {message.attachments.length ? <div className="mt-4 grid gap-2"><h3 className="text-[13px] font-semibold text-blue-950">Attachments</h3>{message.attachments.map((attachment) => <button className="flex items-center justify-between gap-3 rounded-2xl border border-blue-100 bg-white/72 p-2.5 text-left text-xs shadow-sm transition hover:-translate-y-0.5 hover:bg-white focus:outline-none focus:ring-2 focus:ring-blue-200" key={attachment.partId} onClick={() => onDownloadAttachment(attachment)} type="button"><span className="flex min-w-0 items-center gap-3"><span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600"><Paperclip className="h-4 w-4" aria-hidden="true" /></span><span className="min-w-0"><span className="block truncate font-medium text-blue-950">{attachment.filename}</span><span className="text-xs text-slate-500">{attachment.contentType} / {formatBytes(attachment.size)}</span></span></span><Download className="h-4 w-4 shrink-0 text-blue-700" aria-hidden="true" /></button>)}</div> : null}
          </div>
        </div>
        <footer className="shrink-0 border-t border-white/15 bg-white/70 p-2.5 backdrop-blur-2xl dark:bg-slate-950/52"><div className="mx-auto grid max-w-[980px] gap-2 sm:grid-cols-3"><GlassButton onClick={onReply} variant="glass"><Reply className="h-4 w-4" aria-hidden="true" />Reply</GlassButton><GlassButton onClick={onReplyAll} variant="glass"><ReplyAll className="h-4 w-4" aria-hidden="true" />Reply all</GlassButton><GlassButton onClick={onForward} variant="glass"><Forward className="h-4 w-4" aria-hidden="true" />Forward</GlassButton></div></footer>
      </article>
    </div>
  );
}
function MessageActionOverlays({ activeFolder, archivePath, filteredMoveFolders, folders, inArchive, moving, onArchive, onClose, onDelete, onMove, onMoveQueryChange, onOpenMove, onPrint, onSetRead, onToggleStar, panel, query, selected }: { activeFolder: string; archivePath: string | undefined; filteredMoveFolders: WebmailFolder[]; folders: WebmailFolder[]; inArchive: boolean; moving: boolean; onArchive: () => void; onClose: () => void; onDelete: () => void; onMove: (path: string) => void; onMoveQueryChange: (value: string) => void; onOpenMove: () => void; onPrint: () => void; onSetRead: () => void; onToggleStar: () => void; panel: MessageActionPanel; query: string; selected: WebmailMessageDetail | null }) {
  if (!panel || !selected) return null;
  const junkPath = findFolder(folders, "Junk")?.path;
  const trashPath = findFolder(folders, "Trash")?.path;
  return (
    <div className="fixed inset-0 z-[54]" onMouseDown={onClose}>
      {panel === "move" ? (
        <div aria-label="Add to folder" aria-modal="true" className="absolute right-4 top-24 w-[min(24rem,calc(100vw-2rem))] rounded-[1.35rem] border border-white/75 bg-white/94 p-3 shadow-[0_28px_90px_rgba(30,64,175,0.22)] backdrop-blur-2xl" onMouseDown={(event) => event.stopPropagation()} role="dialog">
          <div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-sm font-semibold text-blue-950">Add to folder</h2><button aria-label="Close folder picker" className="rounded-full p-1.5 text-blue-900 transition hover:bg-blue-50" onClick={onClose} type="button"><X className="h-4 w-4" aria-hidden="true" /></button></div>
          <label className="sr-only" htmlFor="employee-move-folder-search">Search folders</label>
          <input autoFocus className="mb-3 h-9 w-full rounded-xl border border-blue-100 bg-white/95 px-3 text-sm text-blue-950 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-blue-200" id="employee-move-folder-search" onChange={(event) => onMoveQueryChange(event.target.value)} placeholder="Search folders..." value={query} />
          <div className="grid max-h-[20rem] gap-1 overflow-y-auto pr-1" role="listbox">
            {filteredMoveFolders.length ? filteredMoveFolders.map((folder) => <button className="flex h-10 items-center gap-3 rounded-xl px-3 text-left text-sm text-blue-950 transition hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-200" disabled={moving} key={folder.path} onClick={() => onMove(folder.path)} role="option" type="button"><Folder className="h-4 w-4 shrink-0 text-blue-700" aria-hidden="true" /><span className="min-w-0 flex-1 truncate">{folder.name}</span>{folder.total ? <span className="text-xs text-slate-500">{folder.total}</span> : null}</button>) : <p className="rounded-xl border border-dashed border-blue-100 bg-blue-50/40 px-3 py-6 text-center text-sm text-slate-500">No matching folders.</p>}
          </div>
        </div>
      ) : null}
      {panel === "more" ? (
        <div aria-label="More message actions" className="absolute right-4 top-24 w-[min(20rem,calc(100vw-2rem))] rounded-[1.35rem] border border-white/75 bg-white/94 p-2 shadow-[0_28px_90px_rgba(30,64,175,0.22)] backdrop-blur-2xl" onMouseDown={(event) => event.stopPropagation()} role="menu">
          <MessageMenuAction icon={<Mail className="h-4 w-4" aria-hidden="true" />} label={selected.unread ? "Mark as read" : "Mark as unread"} onClick={onSetRead} />
          <MessageMenuAction icon={<Star className={`h-4 w-4 ${selected.starred ? "fill-amber-400 text-amber-500" : ""}`} aria-hidden="true" />} label={selected.starred ? "Unstar" : "Star"} onClick={onToggleStar} />
          <MessageMenuAction icon={<Folder className="h-4 w-4" aria-hidden="true" />} label="Move to folder" onClick={onOpenMove} />
          <MessageMenuAction disabled={!archivePath || inArchive || moving} icon={<Archive className="h-4 w-4" aria-hidden="true" />} label="Archive" onClick={onArchive} />
          <MessageMenuAction disabled={!junkPath || junkPath === activeFolder || moving} icon={<ShieldAlert className="h-4 w-4" aria-hidden="true" />} label="Mark as junk" onClick={() => junkPath && onMove(junkPath)} />
          <MessageMenuAction disabled={!trashPath || trashPath === activeFolder || moving} icon={<Trash2 className="h-4 w-4" aria-hidden="true" />} label="Move to trash" onClick={() => trashPath ? onMove(trashPath) : onDelete()} />
          <div className="my-1 h-px bg-blue-100" />
          <MessageMenuAction icon={<Printer className="h-4 w-4" aria-hidden="true" />} label="Print" onClick={onPrint} />
          <MessageMenuAction disabled icon={<Code className="h-4 w-4" aria-hidden="true" />} label="View message source" />
        </div>
      ) : null}
    </div>
  );
}

function MessageMenuAction({ disabled, icon, label, onClick }: { disabled?: boolean; icon: React.ReactNode; label: string; onClick?: () => void }) {
  return <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-blue-950 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-45" disabled={disabled} onClick={onClick} role="menuitem" type="button">{icon}<span className="flex-1">{label}</span>{disabled && label === "View message source" ? <span className="text-xs text-slate-400">Soon</span> : null}</button>;
}
function TopbarOverlays({ activeFolder, commandIndex, commandItems, commandQuery, displayName, effectiveTheme, mailbox, notifications, onClearNotifications, onClose, onCommandIndexChange, onCommandQueryChange, onMarkNotificationsRead, onPreferencesChange, onSignOut, openPanel, panel, preferences, setNotifications, storageText, unreadCount, workspace }: { activeFolder: string; commandIndex: number; commandItems: CommandItem[]; commandQuery: string; displayName: string; effectiveTheme: "light" | "dark"; mailbox: string; notifications: UiNotification[]; onClearNotifications: () => void; onClose: () => void; onCommandIndexChange: (value: number) => void; onCommandQueryChange: (value: string) => void; onMarkNotificationsRead: () => void; onPreferencesChange: (patch: Partial<EmployeePreferences>) => void; onSignOut: () => void; openPanel: (panel: Exclude<TopbarPanel, null>) => void; panel: TopbarPanel; preferences: EmployeePreferences; setNotifications: React.Dispatch<React.SetStateAction<UiNotification[]>>; storageText: string; unreadCount: number; workspace: string }) {
  const filteredCommands = commandItems.filter((item) => item.label.toLowerCase().includes(commandQuery.toLowerCase().trim()));
  React.useEffect(() => { onCommandIndexChange(0); }, [commandQuery, onCommandIndexChange]);
  if (!panel) return null;
  return (
    <div className="fixed inset-0 z-[55] overflow-hidden" onMouseDown={onClose}>
      {panel === "command" ? <CommandPalette commandIndex={commandIndex} commands={filteredCommands} onCommandIndexChange={onCommandIndexChange} onQueryChange={onCommandQueryChange} query={commandQuery} /> : null}
      {panel === "theme" ? <ThemeMenu effectiveTheme={effectiveTheme} onChange={(theme) => onPreferencesChange({ theme })} preferences={preferences} /> : null}
      {panel === "notifications" ? <NotificationPanel notifications={notifications} onClear={onClearNotifications} onMarkRead={onMarkNotificationsRead} setNotifications={setNotifications} unreadCount={unreadCount} /> : null}
      {panel === "settings" ? <SettingsDrawer onChange={onPreferencesChange} preferences={preferences} /> : null}
      {panel === "profile" ? <ProfileMenu activeFolder={activeFolder} displayName={displayName} mailbox={mailbox} onOpenSettings={() => openPanel("settings")} onSignOut={onSignOut} storageText={storageText} workspace={workspace} /> : null}
    </div>
  );
}

function CommandPalette({ commandIndex, commands, onCommandIndexChange, onQueryChange, query }: { commandIndex: number; commands: CommandItem[]; onCommandIndexChange: (value: number) => void; onQueryChange: (value: string) => void; query: string }) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => { inputRef.current?.focus(); }, []);
  return <div aria-modal="true" className="mx-auto mt-[12vh] w-[min(46rem,calc(100vw-1.5rem))] rounded-[1.75rem] border border-white/75 bg-white/88 p-3 shadow-[0_32px_110px_rgba(30,64,175,0.28)] backdrop-blur-2xl" onMouseDown={(event) => event.stopPropagation()} role="dialog" id="employee-command-palette"><div className="flex items-center gap-3 rounded-2xl border border-blue-100 bg-white/80 px-4 py-3"><Command className="h-[18px] w-[18px] text-blue-700" aria-hidden="true" /><input ref={inputRef} aria-label="Search commands" className="min-w-0 flex-1 bg-transparent text-sm text-blue-950 outline-none placeholder:text-slate-400" onChange={(event) => onQueryChange(event.target.value)} onKeyDown={(event) => { if (event.key === "ArrowDown") { event.preventDefault(); onCommandIndexChange(Math.min(commands.length - 1, commandIndex + 1)); } if (event.key === "ArrowUp") { event.preventDefault(); onCommandIndexChange(Math.max(0, commandIndex - 1)); } if (event.key === "Enter") { event.preventDefault(); const command = commands[commandIndex]; if (command && !command.disabled) command.action(); } }} placeholder="Search emails, contacts, commands..." value={query} /><kbd className="rounded-full border border-blue-100 bg-white px-2 py-1 text-[11px] text-blue-900">Esc</kbd></div><div className="mt-3 max-h-[50vh] overflow-y-auto pr-1" role="listbox">{commands.length ? commands.map((command, index) => <button aria-disabled={command.disabled} className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm transition ${index === commandIndex ? "bg-blue-50 text-blue-950" : "text-slate-700 hover:bg-white/70"} ${command.disabled ? "cursor-not-allowed opacity-45" : ""}`} disabled={command.disabled} key={command.label} onMouseEnter={() => onCommandIndexChange(index)} onClick={() => command.action()} role="option" type="button"><span>{command.label}</span>{command.hint ? <span className="text-xs text-slate-400">{command.hint}</span> : null}</button>) : <p className="px-4 py-8 text-center text-sm text-slate-500">No commands found.</p>}</div></div>;
}

function ThemeMenu({ effectiveTheme, onChange, preferences }: { effectiveTheme: "light" | "dark"; onChange: (theme: ThemeMode) => void; preferences: EmployeePreferences }) {
  const modes: Array<{ icon: React.ReactNode; label: string; value: ThemeMode }> = [{ icon: <Sun className="h-4 w-4" aria-hidden="true" />, label: "Light", value: "light" }, { icon: <Moon className="h-4 w-4" aria-hidden="true" />, label: "Dark", value: "dark" }, { icon: <Monitor className="h-4 w-4" aria-hidden="true" />, label: `System (${effectiveTheme})`, value: "system" }];
  return <div className="absolute right-40 top-16 w-56 rounded-3xl border border-white/75 bg-white/90 p-2 shadow-[0_24px_80px_rgba(30,64,175,0.2)] backdrop-blur-2xl" id="employee-theme-menu" onMouseDown={(event) => event.stopPropagation()} role="menu">{modes.map((mode) => <button className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm text-blue-950 transition hover:bg-blue-50" key={mode.value} onClick={() => onChange(mode.value)} role="menuitemradio" type="button">{mode.icon}<span className="flex-1 text-left">{mode.label}</span>{preferences.theme === mode.value ? <Check className="h-4 w-4 text-blue-600" aria-hidden="true" /> : null}</button>)}</div>;
}

function NotificationPanel({ notifications, onClear, onMarkRead, setNotifications, unreadCount }: { notifications: UiNotification[]; onClear: () => void; onMarkRead: () => void; setNotifications: React.Dispatch<React.SetStateAction<UiNotification[]>>; unreadCount: number }) {
  const liveItems = unreadCount ? [{ id: "live-unread", title: "Unread mail", description: `${unreadCount} unread message${unreadCount === 1 ? "" : "s"} in this folder.`, read: false, timestamp: Date.now() } satisfies UiNotification, ...notifications] : notifications;
  return <div className="absolute right-24 top-16 w-[min(24rem,calc(100vw-1rem))] rounded-3xl border border-white/75 bg-white/90 p-3 shadow-[0_24px_80px_rgba(30,64,175,0.2)] backdrop-blur-2xl" id="employee-notifications" onMouseDown={(event) => event.stopPropagation()} role="dialog"><div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold text-blue-950">Notifications</h2><div className="flex gap-2"><button className="text-xs font-medium text-blue-700" onClick={onMarkRead} type="button">Mark all read</button><button className="text-xs font-medium text-slate-500" onClick={() => { onClear(); setNotifications(persistNotifications([])); }} type="button">Clear</button></div></div>{liveItems.length ? <div className="grid max-h-[22rem] gap-2 overflow-y-auto">{liveItems.map((item) => <div className="rounded-2xl border border-blue-100 bg-white/70 p-3" key={item.id}><div className="flex items-start gap-2"><span className={`mt-1 h-2 w-2 rounded-full ${item.read ? "bg-slate-300" : "bg-blue-500"}`} /><div className="min-w-0"><p className="text-sm font-semibold text-blue-950">{item.title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{item.description}</p><time className="mt-2 block text-[11px] text-slate-400">{relativeTime(item.timestamp)}</time></div></div></div>)}</div> : <div className="rounded-2xl border border-blue-100 bg-white/70 p-8 text-center text-sm text-slate-500">You&apos;re all caught up</div>}</div>;
}

function SettingsDrawer({ onChange, preferences }: { onChange: (patch: Partial<EmployeePreferences>) => void; preferences: EmployeePreferences }) {
  return <aside aria-modal="true" className="absolute right-3 top-3 flex h-[calc(100dvh-1.5rem)] w-[min(28rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-[1.75rem] border border-white/75 bg-white/92 shadow-[0_30px_100px_rgba(30,64,175,0.24)] backdrop-blur-2xl" id="employee-settings" onMouseDown={(event) => event.stopPropagation()} role="dialog"><header className="border-b border-blue-100 p-5"><h2 className="text-lg font-semibold text-blue-950">Settings</h2><p className="mt-1 text-sm text-slate-500">Frontend preferences for this mailbox.</p></header><div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5"><SettingsSection title="Appearance"><SegmentedPreference options={["light", "dark", "system"]} value={preferences.theme} onChange={(value) => onChange({ theme: value as ThemeMode })} /><SegmentedPreference options={["compact", "comfortable"]} value={preferences.density} onChange={(value) => onChange({ density: value as DensityMode })} /></SettingsSection><SettingsSection title="Mail"><TogglePreference checked={preferences.autoMarkRead} label="Automatically mark message as read when opened" onChange={(value) => onChange({ autoMarkRead: value })} /><TogglePreference checked={preferences.confirmDelete} label="Confirm before deleting" onChange={(value) => onChange({ confirmDelete: value })} /><TogglePreference checked={preferences.remoteImages} label="Show remote images" onChange={(value) => onChange({ remoteImages: value })} /><label className="grid gap-1 text-sm text-blue-950">Refresh interval<select className="h-10 rounded-2xl border border-blue-100 bg-white/80 px-3 outline-none" onChange={(event) => onChange({ refreshInterval: event.target.value })} value={preferences.refreshInterval}><option value="30">30 seconds</option><option value="45">45 seconds</option><option value="60">1 minute</option><option value="120">2 minutes</option></select></label></SettingsSection><SettingsSection title="Compose"><TogglePreference checked={preferences.defaultCcBcc} label="Show Cc/Bcc by default" onChange={(value) => onChange({ defaultCcBcc: value })} /><TogglePreference checked={preferences.autoSaveDrafts} label="Auto-save drafts" onChange={(value) => onChange({ autoSaveDrafts: value })} /><SegmentedPreference options={["window", "focus"]} value={preferences.defaultComposeMode} onChange={(value) => onChange({ defaultComposeMode: value as EmployeePreferences["defaultComposeMode"] })} /><div className="rounded-2xl border border-dashed border-blue-200 bg-blue-50/50 p-3 text-sm text-slate-500">Signature support is coming soon.</div></SettingsSection></div></aside>;
}

function ProfileMenu({ activeFolder, displayName, mailbox, onOpenSettings, onSignOut, storageText, workspace }: { activeFolder: string; displayName: string; mailbox: string; onOpenSettings: () => void; onSignOut: () => void; storageText: string; workspace: string }) {
  return <div className="absolute right-3 top-16 w-[min(22rem,calc(100vw-1rem))] rounded-3xl border border-white/75 bg-white/92 p-3 shadow-[0_24px_80px_rgba(30,64,175,0.2)] backdrop-blur-2xl" id="employee-profile-menu" onMouseDown={(event) => event.stopPropagation()} role="menu"><div className="flex items-center gap-3 rounded-2xl bg-blue-50/70 p-3"><Avatar name={displayName} /><div className="min-w-0"><p className="truncate text-sm font-semibold text-blue-950">{displayName}</p><p className="truncate text-xs text-slate-500">{mailbox || "Mailbox"}</p><p className="mt-1 text-[11px] text-blue-700">{workspace} / {activeFolder}</p></div></div><div className="mt-3 rounded-2xl border border-blue-100 bg-white/70 p-3 text-xs text-slate-500"><p className="font-medium text-blue-950">Mailbox status: Active</p><p className="mt-1">{storageText}</p></div><div className="mt-3 grid gap-1"><MenuAction icon={<Settings className="h-4 w-4" aria-hidden="true" />} label="Account settings" onClick={onOpenSettings} /><MenuAction icon={<User className="h-4 w-4" aria-hidden="true" />} label="Change password" disabled /><MenuAction icon={<Smile className="h-4 w-4" aria-hidden="true" />} label="Help" disabled /><MenuAction icon={<LogOut className="h-4 w-4" aria-hidden="true" />} label="Sign out" onClick={onSignOut} /></div></div>;
}

function SettingsSection({ children, title }: { children: React.ReactNode; title: string }) { return <section className="grid gap-3"><h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{title}</h3>{children}</section>; }
function TogglePreference({ checked, label, onChange }: { checked: boolean; label: string; onChange: (checked: boolean) => void }) { return <label className="flex items-center justify-between gap-3 rounded-2xl border border-blue-100 bg-white/70 px-3 py-2.5 text-sm text-blue-950"><span>{label}</span><input checked={checked} className="h-4 w-4 accent-blue-600" onChange={(event) => onChange(event.target.checked)} type="checkbox" /></label>; }
function SegmentedPreference({ onChange, options, value }: { onChange: (value: string) => void; options: string[]; value: string }) { return <div className="flex rounded-2xl border border-blue-100 bg-white/70 p-1">{options.map((option) => <button className={`flex-1 rounded-xl px-3 py-2 text-sm capitalize transition ${value === option ? "bg-blue-100 text-blue-700" : "text-slate-500 hover:bg-white"}`} key={option} onClick={() => onChange(option)} type="button">{option}</button>)}</div>; }
function MenuAction({ disabled, icon, label, onClick }: { disabled?: boolean; icon: React.ReactNode; label: string; onClick?: () => void }) { return <button className="flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm text-blue-950 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-45" disabled={disabled} onClick={onClick} role="menuitem" type="button">{icon}<span>{label}</span>{disabled ? <span className="ml-auto text-xs text-slate-400">Soon</span> : null}</button>; }
function persistPreferences(preferences: EmployeePreferences) { if (typeof window !== "undefined") window.localStorage.setItem(employeePrefsKey, JSON.stringify(preferences)); return preferences; }
function readEmployeePreferences() { if (typeof window === "undefined") return defaultEmployeePreferences; try { return { ...defaultEmployeePreferences, ...JSON.parse(window.localStorage.getItem(employeePrefsKey) || "{}") } as EmployeePreferences; } catch { return defaultEmployeePreferences; } }
function persistNotifications(notifications: UiNotification[]) { if (typeof window !== "undefined") window.localStorage.setItem(employeeNotificationsKey, JSON.stringify(notifications)); return notifications; }
function readStoredNotifications(): UiNotification[] { if (typeof window === "undefined") return []; try { const value: unknown = JSON.parse(window.localStorage.getItem(employeeNotificationsKey) || "[]"); return Array.isArray(value) ? (value.slice(0, 12) as UiNotification[]) : []; } catch { return []; } }
function relativeTime(timestamp: number) { const seconds = Math.max(1, Math.round((Date.now() - timestamp) / 1000)); if (seconds < 60) return "Just now"; const minutes = Math.round(seconds / 60); if (minutes < 60) return `${minutes}m ago`; const hours = Math.round(minutes / 60); return `${hours}h ago`; }
function ComposeWindow({ compose, mailbox, onChange, onClose, onSaveDraft, onSubmit, savingDraft, sending }: { compose: ComposeState; mailbox: string; onChange: React.Dispatch<React.SetStateAction<ComposeState>>; onClose: () => void; onSaveDraft: () => void; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void; savingDraft: boolean; sending: boolean }) {
  const [showCc, setShowCc] = React.useState(Boolean(compose.cc));
  const [showBcc, setShowBcc] = React.useState(Boolean(compose.bcc));
  const toRecipients = recipientChips(compose.to);
  const ccRecipients = recipientChips(compose.cc);
  const bccRecipients = recipientChips(compose.bcc);
  const characterCount = compose.body.length;
  const draftStatus = savingDraft ? "Saving..." : compose.draftUid ? "Saved just now" : hasComposeContent(compose) ? "Draft ready" : "Start writing";

  function updateField(field: "to" | "cc" | "bcc" | "subject" | "body", value: string) {
    onChange((current) => ({ ...current, [field]: value }));
  }
  function removeRecipient(field: "to" | "cc" | "bcc", value: string) {
    onChange((current) => ({ ...current, [field]: recipientChips(current[field]).filter((recipient) => recipient !== value).join(", ") }));
  }
  function attachFiles(files: FileList | null) {
    if (!files?.length) return;
    onChange((current) => ({ ...current, attachments: [...current.attachments, ...Array.from(files)].slice(0, 10) }));
  }
  function removeAttachment(file: File) {
    onChange((current) => ({ ...current, attachments: current.attachments.filter((item) => item !== file) }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-sky-100/38 p-2 backdrop-blur-2xl sm:p-5">
      <div className="pointer-events-none absolute left-[12%] top-[8%] h-64 w-64 rounded-full bg-blue-300/35 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[10%] right-[14%] h-72 w-72 rounded-full bg-indigo-200/45 blur-3xl" />
      <form className="relative flex h-dvh w-full max-w-[76rem] flex-col overflow-hidden border border-white/75 bg-white/88 shadow-[0_34px_120px_rgba(30,64,175,0.28)] backdrop-blur-2xl sm:h-[85dvh] sm:rounded-[2rem]" onSubmit={onSubmit}>
        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-white/90" />
        <header className="flex shrink-0 items-start justify-between gap-4 px-4 py-4 sm:px-7 sm:py-6">
          <div className="flex min-w-0 items-start gap-4">
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[1rem] border border-white/80 bg-gradient-to-br from-blue-500 to-violet-500 text-white shadow-[0_18px_38px_rgba(59,130,246,0.32)]"><MailPlus className="h-[18px] w-[18px]" aria-hidden="true" /></span>
            <div className="min-w-0">
              <h2 className="truncate text-[1.35rem] font-semibold tracking-[-0.01em] text-blue-950 sm:text-[1.85rem]">{composeTitle(compose.mode)}</h2>
              <p className="mt-1 truncate text-sm text-slate-600">From: <span className="font-medium text-blue-950">{mailbox || "Mailbox"}</span></p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ComposeIconButton label="Minimize" onClick={onClose}><Minimize2 className="h-4 w-4" aria-hidden="true" /></ComposeIconButton>
            <ComposeIconButton label="Pop out"><Maximize2 className="h-4 w-4" aria-hidden="true" /></ComposeIconButton>
            <ComposeIconButton label="Close" onClick={onClose}><X className="h-4 w-4" aria-hidden="true" /></ComposeIconButton>
          </div>
        </header>
        <div className="flex min-h-0 flex-1 gap-4 px-3 pb-3 sm:px-6 sm:pb-6">
          <aside className="hidden w-12 shrink-0 flex-col items-center gap-3 rounded-[1.35rem] border border-white/70 bg-white/46 p-2 shadow-inner backdrop-blur-xl md:flex">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-violet-500 text-white shadow-lg"><Sparkles className="h-4 w-4" aria-hidden="true" /></span>
            <ComposeRailButton label="Attach"><Paperclip className="h-4 w-4" aria-hidden="true" /></ComposeRailButton>
            <ComposeRailButton label="Link"><Link className="h-4 w-4" aria-hidden="true" /></ComposeRailButton>
            <ComposeRailButton label="Emoji"><Smile className="h-4 w-4" aria-hidden="true" /></ComposeRailButton>
            <ComposeRailButton label="Text"><span className="text-sm font-semibold">T</span></ComposeRailButton>
          </aside>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[1.45rem] border border-blue-100/80 bg-white/72 shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_22px_70px_rgba(37,99,235,0.14)] backdrop-blur-xl">
            <div className="shrink-0 divide-y divide-blue-100/80">
              <ComposeRecipientRow chips={toRecipients} id="compose-to" label="To" onRemove={(value) => removeRecipient("to", value)} onValueChange={(value) => updateField("to", value)} placeholder="Add recipients..." required value={compose.to}>
                <button className="rounded-full px-2 py-1 text-sm font-medium text-blue-700 transition hover:bg-blue-50" onClick={() => setShowCc(true)} type="button">Cc</button>
                <button className="rounded-full px-2 py-1 text-sm font-medium text-blue-700 transition hover:bg-blue-50" onClick={() => setShowBcc(true)} type="button">Bcc</button>
              </ComposeRecipientRow>
              {showCc || compose.cc ? <ComposeRecipientRow chips={ccRecipients} id="compose-cc" label="Cc" onRemove={(value) => removeRecipient("cc", value)} onValueChange={(value) => updateField("cc", value)} placeholder="Add Cc recipients..." value={compose.cc} /> : null}
              {showBcc || compose.bcc ? <ComposeRecipientRow chips={bccRecipients} id="compose-bcc" label="Bcc" onRemove={(value) => removeRecipient("bcc", value)} onValueChange={(value) => updateField("bcc", value)} placeholder="Add Bcc recipients..." value={compose.bcc} /> : null}
              <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
                <span className="inline-flex h-9 min-w-24 items-center gap-2 rounded-2xl border border-blue-100 bg-white/74 px-3 text-sm font-semibold text-blue-950 shadow-sm"><Mail className="h-4 w-4 text-blue-700" aria-hidden="true" />Subject</span>
                <input aria-label="Subject" className="h-10 min-w-0 flex-1 bg-transparent text-[15px] text-blue-950 outline-none placeholder:text-slate-400" onChange={(event) => updateField("subject", event.target.value)} placeholder="Add subject..." value={compose.subject} />
              </div>
            </div>
            <div className="shrink-0 px-4 pt-4 sm:px-6">
              <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
                {["Improve", "Rewrite", "Professional", "Friendly", "Translate", "Summarize"].map((label) => <button className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-blue-100 bg-white/74 px-3 text-xs font-semibold text-blue-800 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:bg-white" key={label} type="button"><Sparkles className="h-3.5 w-3.5" aria-hidden="true" />{label}</button>)}
              </div>
              <div className="flex items-center gap-2 overflow-x-auto rounded-[1.25rem] border border-blue-100/80 bg-white/68 px-3 py-2 text-blue-950 shadow-sm transition duration-200 focus-within:bg-white/82">
                <ComposeToolbarButton label="Undo"><Undo2 className="h-4 w-4" aria-hidden="true" /></ComposeToolbarButton>
                <ComposeToolbarButton label="Redo"><Redo2 className="h-4 w-4" aria-hidden="true" /></ComposeToolbarButton>
                <span className="mx-1 h-6 w-px shrink-0 bg-blue-100" />
                <select aria-label="Font" className="h-9 rounded-xl border border-blue-100 bg-white/82 px-3 text-sm outline-none"><option>Inter</option><option>Serif</option><option>Mono</option></select>
                <select aria-label="Font size" className="h-9 rounded-xl border border-blue-100 bg-white/82 px-2 text-sm outline-none"><option>14</option><option>15</option><option>16</option><option>18</option></select>
                <span className="mx-1 h-6 w-px shrink-0 bg-blue-100" />
                <ComposeToolbarButton label="Bold"><Bold className="h-4 w-4" aria-hidden="true" /></ComposeToolbarButton>
                <ComposeToolbarButton label="Italic"><Italic className="h-4 w-4" aria-hidden="true" /></ComposeToolbarButton>
                <ComposeToolbarButton label="Underline"><Underline className="h-4 w-4" aria-hidden="true" /></ComposeToolbarButton>
                <ComposeToolbarButton label="List"><List className="h-4 w-4" aria-hidden="true" /></ComposeToolbarButton>
                <ComposeToolbarButton label="Align left"><AlignLeft className="h-4 w-4" aria-hidden="true" /></ComposeToolbarButton>
                <ComposeToolbarButton label="Align center"><AlignCenter className="h-4 w-4" aria-hidden="true" /></ComposeToolbarButton>
                <ComposeToolbarButton label="Align right"><AlignRight className="h-4 w-4" aria-hidden="true" /></ComposeToolbarButton>
                <ComposeToolbarButton label="Quote"><Quote className="h-4 w-4" aria-hidden="true" /></ComposeToolbarButton>
                <ComposeToolbarButton label="Code"><Code className="h-4 w-4" aria-hidden="true" /></ComposeToolbarButton>
                <ComposeToolbarButton label="More"><MoreHorizontal className="h-4 w-4" aria-hidden="true" /></ComposeToolbarButton>
              </div>
            </div>
            <label className="sr-only" htmlFor="compose-body">Message body</label>
            <textarea className="min-h-0 flex-1 resize-none bg-transparent px-5 py-5 text-[15px] leading-7 text-blue-950 outline-none placeholder:text-slate-400 sm:px-7" id="compose-body" onChange={(event) => updateField("body", event.target.value)} placeholder="Write something amazing..." value={compose.body} />
            {compose.attachments.length ? <div className="grid shrink-0 gap-2 border-t border-blue-100/70 px-4 py-3 sm:px-6">{compose.attachments.map((file) => <div className="flex items-center justify-between gap-3 rounded-2xl border border-blue-100 bg-white/76 px-3 py-2 text-xs text-blue-950 shadow-sm" key={`${file.name}-${file.size}`}><span className="min-w-0 truncate"><Paperclip className="mr-2 inline h-3.5 w-3.5 text-blue-700" aria-hidden="true" />{file.name} / {formatBytes(file.size)}</span><button aria-label={`Remove ${file.name}`} className="rounded-full px-2 py-1 font-medium text-blue-700 transition hover:bg-blue-50" onClick={() => removeAttachment(file)} type="button">Remove</button></div>)}</div> : null}
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-blue-100/80 px-4 py-3 sm:px-6">
              <div className="flex flex-wrap items-center gap-2 text-sm text-blue-950">
                <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-full px-2.5 font-medium transition hover:bg-white/70"><Paperclip className="h-4 w-4 text-blue-700" aria-hidden="true" />Attach<input aria-label="Attach files" className="sr-only" multiple onChange={(event) => { attachFiles(event.target.files); event.target.value = ""; }} type="file" /></label>
                <ComposeFooterButton label="Drive"><Cloud className="h-4 w-4" aria-hidden="true" />Drive</ComposeFooterButton>
                <ComposeFooterButton label="Image"><Image className="h-4 w-4" aria-hidden="true" />Image</ComposeFooterButton>
                <ComposeFooterButton label="Calendar"><Calendar className="h-4 w-4" aria-hidden="true" />Calendar</ComposeFooterButton>
                <ComposeFooterButton label="Contacts"><Users className="h-4 w-4" aria-hidden="true" />Contacts</ComposeFooterButton>
                <ComposeFooterButton label="Voice note"><Mic className="h-4 w-4" aria-hidden="true" />Voice</ComposeFooterButton>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500"><span>{draftStatus}</span><span>{characterCount.toLocaleString()} chars</span></div>
            </div>
          </div>
        </div>
        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 px-4 pb-4 sm:px-7 sm:pb-6">
          <div className="flex flex-wrap items-center gap-3">
            <button className="inline-flex h-12 items-center overflow-hidden rounded-2xl bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 text-sm font-semibold text-white shadow-[0_18px_42px_rgba(59,130,246,0.34)] transition duration-200 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:cursor-not-allowed disabled:opacity-70" disabled={sending} type="submit"><span className="inline-flex h-full items-center gap-2 px-5"><Send className="h-4 w-4" aria-hidden="true" />{sending ? "Sending..." : "Send"}</span><span className="flex h-full items-center border-l border-white/24 px-3"><ChevronDown className="h-4 w-4" aria-hidden="true" /></span></button>
            <button className="inline-flex h-12 items-center gap-2 rounded-2xl border border-white/70 bg-white/70 px-4 text-sm font-medium text-blue-950 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:bg-white" onClick={onSaveDraft} type="button"><Save className="h-4 w-4 text-blue-700" aria-hidden="true" />Save now</button>
            <button className="inline-flex h-12 items-center gap-2 rounded-2xl border border-white/70 bg-white/70 px-4 text-sm font-medium text-blue-950 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:bg-white" type="button"><Calendar className="h-4 w-4 text-blue-700" aria-hidden="true" />Schedule</button>
          </div>
          <button className="inline-flex h-12 items-center rounded-2xl border border-white/70 bg-white/62 px-5 text-sm font-medium text-blue-950 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:bg-white" onClick={onClose} type="button">Discard</button>
        </footer>
      </form>
    </div>
  );
}

function ComposeRecipientRow({ children, chips, id, label, onRemove, onValueChange, placeholder, required, value }: { children?: React.ReactNode; chips: string[]; id: string; label: string; onRemove: (value: string) => void; onValueChange: (value: string) => void; placeholder: string; required?: boolean; value: string }) {
  return <div className="flex min-h-16 items-center gap-3 px-4 py-3 sm:px-6"><label className="inline-flex h-10 min-w-20 items-center justify-center rounded-2xl border border-blue-100 bg-white/76 px-3 text-sm font-semibold text-blue-950 shadow-sm" htmlFor={id}>{label}</label><div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{chips.map((chip) => <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-blue-100 bg-blue-50/80 px-3 py-1.5 text-sm font-medium text-blue-950" key={chip}>{chip}<button aria-label={`Remove ${chip}`} className="text-blue-600 hover:text-blue-900" onClick={() => onRemove(chip)} type="button">x</button></span>)}<input className="h-9 min-w-[11rem] flex-1 bg-transparent text-[15px] text-blue-950 outline-none placeholder:text-slate-400" id={id} onChange={(event) => onValueChange(event.target.value)} placeholder={chips.length ? "Add another..." : placeholder} required={required && !chips.length} value={value} /></div>{children ? <div className="flex shrink-0 items-center gap-1">{children}</div> : null}</div>;
}

function ComposeIconButton({ children, label, onClick }: { children: React.ReactNode; label: string; onClick?: () => void }) { return <button aria-label={label} className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/70 bg-white/58 text-blue-950 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:bg-white focus:outline-none focus:ring-2 focus:ring-blue-200" onClick={onClick} type="button">{children}</button>; }
function ComposeRailButton({ children, label }: { children: React.ReactNode; label: string }) { return <button aria-label={label} className="inline-flex h-9 w-9 items-center justify-center rounded-2xl text-blue-950 transition duration-200 hover:bg-white/70" type="button">{children}</button>; }
function ComposeToolbarButton({ children, label }: { children: React.ReactNode; label: string }) { return <button aria-label={label} className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-blue-950 transition duration-200 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-200" type="button">{children}</button>; }
function ComposeFooterButton({ children, label }: { children: React.ReactNode; label: string }) { return <button aria-label={label} className="inline-flex h-9 items-center gap-2 rounded-full px-2.5 font-medium transition duration-200 hover:bg-white/70" type="button">{children}</button>; }
function recipientChips(value: string) { return value.split(/[;,]/).map((item) => item.trim()).filter(Boolean); }
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
  const specialUse = specialUseForLabel(label);
  if (specialUse) {
    const specialFolder = folders.find((folder) => normalizeSpecialUse(folder.specialUse) === specialUse);
    if (specialFolder) return specialFolder;
  }
  return folders.find((folder) => {
    const value = `${folder.specialUse || ""} ${folder.name} ${folder.path}`.toLowerCase();
    return config.aliases.some((alias) => value.includes(alias));
  });
}
function findArchiveFolder(folders: WebmailFolder[]) {
  const specialFolder = folders.find((folder) => normalizeSpecialUse(folder.specialUse) === "\\archive");
  if (specialFolder) return specialFolder;
  return folders.find((folder) => {
    const value = `${folder.name} ${folder.path}`.toLowerCase();
    return /(^|[\s/.])(archive|archives|all mail)([\s/.]|$)/i.test(value);
  });
}function specialUseForLabel(label: string) {
  const values: Record<string, string> = { Drafts: "\\drafts", Inbox: "\\inbox", Junk: "\\junk", Sent: "\\sent", Trash: "\\trash" };
  return values[label];
}
function normalizeSpecialUse(value?: string) { return value?.toLowerCase(); }
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
function renderEmailHtml(message: WebmailMessageDetail) { const html = message.sanitizedHtml || textToHtml(message.text); return html.replace(/\[\s*remote image blocked\s*\]/gi, "").replace(/<p>\s*<\/p>/gi, ""); }
function textToHtml(value: string) { return value.split(/\n{2,}/).map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`).join(""); }
function escapeHtml(value: string) { return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function isExpired(error: unknown) { return error instanceof Error && /401|session|unauthorized|expired/i.test(error.message); }
function errorMessage(error: unknown, fallback: string) { return error instanceof Error && error.message ? error.message : fallback; }
function senderInitial(value: string) { return (displayAddressName(value)[0] || "M").toUpperCase(); }

function LogoMark() { return <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-2xl border border-blue-100 bg-white/76 text-blue-600 shadow-sm"><Mail className="h-[18px] w-[18px]" aria-hidden="true" /></span>; }
function Avatar({ name }: { name: string }) { const initial = (name.trim()[0] || "M").toUpperCase(); return <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/70 bg-gradient-to-br from-blue-100 to-slate-200 text-[13px] font-semibold text-blue-950 shadow-sm">{initial}</span>; }
function TopIconButton({ ariaControls, badge, children, expanded, label, onClick }: { ariaControls?: string; badge?: number; children: React.ReactNode; expanded?: boolean; label: string; onClick?: () => void }) { return <button aria-controls={ariaControls} aria-expanded={expanded} aria-label={label} className="pointer-events-auto relative inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-white/70 bg-white/50 text-blue-950 shadow-[0_14px_40px_rgba(30,64,175,0.12)] backdrop-blur-2xl transition hover:-translate-y-0.5 hover:bg-white/72 focus:outline-none focus:ring-2 focus:ring-blue-200" onClick={onClick} type="button">{children}{badge ? <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-blue-500 px-1 text-[10px] font-semibold leading-4 text-white">{Math.min(badge, 9)}</span> : null}</button>; }
function FolderButton({ active, compact = false, item, onClick }: { active: boolean; compact?: boolean; item: FolderNavItem; onClick: () => void }) {
  const Icon = item.icon;
  return <button className={`${compact ? "h-10" : "h-12"} flex items-center gap-3 rounded-2xl px-3 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-blue-200 ${active ? "bg-blue-100/80 text-blue-700 shadow-sm" : "text-blue-950 hover:bg-white/60"}`} onClick={onClick} type="button"><Icon className={`h-[18px] w-[18px] ${active ? "text-blue-600" : "text-blue-800"}`} aria-hidden="true" /><span className="min-w-0 flex-1 truncate text-left">{item.label}</span>{item.folder?.unread ? <span className="rounded-full bg-white/82 px-2 py-0.5 text-xs text-blue-700 shadow-sm">{item.folder.unread}</span> : null}</button>;
}
function MessageRow({ active, message, onOpen, onOpenFullscreen, onToggleStar }: { active: boolean; message: WebmailMessage; onOpen: () => void; onOpenFullscreen: () => void; onToggleStar: () => void }) {
  return <button aria-label={`Open email ${message.subject}`} className={`jposta-message-row group grid grid-cols-[auto_minmax(0,1fr)_auto] gap-2 px-2 py-1.5 text-left transition focus:outline-none focus:ring-2 focus:ring-blue-200 sm:px-2.5 ${active ? "rounded-xl border border-blue-200 bg-blue-50/84 shadow-sm" : "hover:rounded-xl hover:bg-white/48"}`} onClick={onOpen} onDoubleClick={(event) => { event.preventDefault(); onOpenFullscreen(); }} onKeyDown={(event) => { if (event.key === "Enter" && event.shiftKey) { event.preventDefault(); onOpenFullscreen(); } }} type="button"><span className="mt-1 flex flex-col items-center gap-1.5"><span className={`jposta-row-dot h-2 w-2 rounded-full ${message.unread ? "bg-blue-500" : "border border-blue-200 bg-white/70"}`} /><span className="jposta-row-avatar hidden h-6 w-6 items-center justify-center rounded-full bg-white/70 text-[11px] font-semibold text-blue-800 shadow-sm sm:inline-flex">{senderInitial(message.from)}</span></span><span className="min-w-0"><span className="flex items-center gap-2"><span className={`truncate text-[13px] ${message.unread ? "font-semibold text-blue-950" : "font-medium text-slate-700"}`}>{displayAddressName(message.from)}</span>{message.hasAttachments ? <Paperclip className="h-3 w-3 shrink-0 text-blue-600" aria-label="Has attachments" /> : null}</span><span className="mt-0.5 block truncate text-[13px] font-semibold leading-5 text-blue-950">{message.subject || "(No subject)"}</span><span className="mt-0.5 block truncate text-[11px] leading-4 text-slate-500">{message.preview || message.subject}</span></span><span className="flex flex-col items-end gap-1.5"><time className="whitespace-nowrap text-[11px] font-medium text-blue-900">{formatDate(message.date)}</time><span aria-label={message.starred ? "Unstar email" : "Star email"} className="rounded-full p-1 text-blue-700 transition hover:bg-white" onClick={(event) => { event.stopPropagation(); onToggleStar(); }} onDoubleClick={(event) => event.stopPropagation()} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); onToggleStar(); } }}><Star className={`h-3.5 w-3.5 ${message.starred ? "fill-amber-400 text-amber-500" : ""}`} aria-hidden="true" /></span></span></button>;
}
function StateNotice({ message, tone = "info" }: { message: string; tone?: Notice["tone"] }) { return <div className={`m-3 rounded-2xl border bg-white/68 p-3 text-sm shadow-sm backdrop-blur-xl ${tone === "error" ? "border-rose-200 text-rose-700" : "border-blue-100 text-slate-600"}`}>{message}</div>; }
function LoadingList() { return <div className="grid gap-2 p-3" aria-label="Loading your mailbox">{Array.from({ length: 7 }).map((_, index) => <div className="h-16 animate-pulse rounded-2xl bg-white/60" key={index} />)}</div>; }
function PreviewLoading() { return <div className="grid gap-4 p-6"><div className="h-8 w-2/3 animate-pulse rounded-full bg-white/78" /><div className="h-4 w-1/2 animate-pulse rounded-full bg-white/70" /><div className="h-48 animate-pulse rounded-[1.5rem] bg-white/66" /></div>; }
function IconAction({ children, disabled, expanded, label, onClick }: { children: React.ReactNode; disabled?: boolean; expanded?: boolean; label: string; onClick?: () => void }) { return <button aria-expanded={expanded} aria-label={label} className="inline-flex h-7 w-7 items-center justify-center rounded-2xl text-blue-900 transition hover:bg-white/60 disabled:cursor-not-allowed disabled:opacity-40" disabled={disabled} onClick={onClick} title={label} type="button">{children}</button>; }
function ToastNotice({ notice }: { notice: Notice }) { return <div className={`fixed right-3 top-3 z-[60] rounded-2xl border bg-white/95 px-4 py-3 text-sm shadow-[0_18px_50px_rgba(30,64,175,0.18)] ${notice.tone === "error" ? "border-rose-200 text-rose-800" : "border-blue-200 text-blue-800"}`}>{notice.message}</div>; }
