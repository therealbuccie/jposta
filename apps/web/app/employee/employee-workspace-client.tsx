"use client";

import * as React from "react";
import {
  ArrowLeft,
  Bold,
  ChevronUp,
  Code2,
  Eraser,
  Forward,
  Image,
  Italic,
  Link,
  List,
  ListOrdered,
  MailOpen,
  Maximize2,
  Minimize2,
  MailPlus,
  Paperclip,
  Save,
  Search,
  Send,
  Reply,
  Quote,
  ReplyAll,
  ShieldCheck,
  Smile,
  Star,
  Table2,
  Trash2,
  Type,
  Underline,
  X,
} from "lucide-react";

import {
  AppShell,
  GlassBadge,
  GlassButton,
  GlassCard,
  StatusIndicator,
  type QuickAction,
  type ShellIconKey,
  type ShellNavItem,
} from "@jposta/ui";

import { EmployeeWebmailCore } from "./employee-webmail-core";

type EmployeeNavigationItem = {
  active?: boolean;
  badge?: string;
  iconKey: ShellIconKey;
  label: string;
};

type Attachment = {
  name: string;
  size: string;
  type: string;
};

type ThreadMessage = {
  attachments?: Attachment[];
  body: string[];
  from: string;
  time: string;
  to: string;
};

type ComposeMode = "compose" | "reply" | "reply-all" | "forward";

type ReadingMode = "preview" | "focus" | "full";

type CommandPaletteItem = {
  group: "Emails" | "Contacts" | "Folders" | "Commands" | "Settings" | "Drafts" | "Attachments";
  hint?: string;
  keywords: string;
  subtitle: string;
  title: string;
  type: "email" | "contact" | "folder" | "command" | "setting" | "draft" | "attachment";
};

type ComposeAttachment = Attachment & {
  progress: number;
};

type ComposeDraft = {
  attachments: ComposeAttachment[];
  bcc: string;
  body: string;
  cc: string;
  ccBccVisible: boolean;
  expanded: boolean;
  from: string;
  id: string;
  minimized: boolean;
  mode: ComposeMode;
  quotedPreview?: string;
  saveStatus: "saved" | "saving";
  subject: string;
  to: string;
};

type MockEmail = {
  account: string;
  attachments?: Attachment[];
  body: string[];
  messages?: ThreadMessage[];
  preview: string;
  read: boolean;
  sender: string;
  subject: string;
  time: string;
};

const visibleEmployeeNavigation: EmployeeNavigationItem[] = [
  { label: "Inbox", iconKey: "inbox", active: true, badge: "24" },
  { label: "Starred", iconKey: "starred", badge: "6" },
  { label: "Sent", iconKey: "sent" },
  { label: "Drafts", iconKey: "drafts", badge: "3" },
  { label: "Spam", iconKey: "spam" },
];

const hiddenEmployeeNavigation: EmployeeNavigationItem[] = [
  { label: "Archive", iconKey: "archive" },
  { label: "Trash", iconKey: "trash" },
  { label: "Contacts", iconKey: "contacts" },
  { label: "Calendar", iconKey: "calendar" },
  { label: "Files", iconKey: "files" },
  { label: "Settings", iconKey: "settings" },
];

const senderAccounts = ["alex@36t.studio", "support@36t.studio", "billing@36t.studio"] as const;

const labels = [
  { label: "Work", color: "bg-sky-400" },
  { label: "Finance", color: "bg-emerald-400" },
  { label: "Clients", color: "bg-violet-400" },
  { label: "Internal", color: "bg-amber-400" },
  { label: "Office", color: "bg-rose-300" },
];

const emails: MockEmail[] = [
  {
    account: "Work",
    attachments: [
      { name: "launch-copy-final.docx", size: "248 KB", type: "Document" },
      { name: "approval-notes.pdf", size: "1.1 MB", type: "PDF" },
    ],
    body: [
      "Hi Alex,",
      "Final launch copy is attached. I marked the sections that still need product approval and left notes where the voice should feel warmer.",
      "The only open decision is whether the customer quote stays near the top or moves into the second section. My vote is to keep it visible because it makes the announcement feel grounded immediately.",
      "Can you review before 2 PM?",
    ],
    messages: [
      {
        body: [
          "Hi Alex,",
          "I added a first pass at the launch announcement and kept the voice close to the product page copy.",
          "The intro is still a little formal, but the structure should be ready for review.",
        ],
        from: "Maya Chen",
        time: "Yesterday, 4:28 PM",
        to: "Alex Rivera",
      },
      {
        body: [
          "Maya, this is moving in the right direction.",
          "Can you make the approval notes more explicit and call out the sections that need product sign-off?",
        ],
        from: "Alex Rivera",
        time: "Yesterday, 5:06 PM",
        to: "Maya Chen",
      },
      {
        attachments: [
          { name: "launch-copy-final.docx", size: "248 KB", type: "Document" },
          { name: "approval-notes.pdf", size: "1.1 MB", type: "PDF" },
        ],
        body: [
          "Hi Alex,",
          "Final launch copy is attached. I marked the sections that still need product approval and left notes where the voice should feel warmer.",
          "The only open decision is whether the customer quote stays near the top or moves into the second section. My vote is to keep it visible because it makes the announcement feel grounded immediately.",
          "Can you review before 2 PM?",
        ],
        from: "Maya Chen",
        time: "9:42 AM",
        to: "Alex Rivera",
      },
    ],
    preview: "Final copy is attached. I marked the sections that still need product approval.",
    read: false,
    sender: "Maya Chen",
    subject: "Launch copy for review",
    time: "9:42 AM",
  },
  {
    account: "Clients",
    body: [
      "Hey Alex,",
      "Sharing the updated timeline before our call. The client asked for one more pass on the onboarding sequence and a cleaner owner assignment for each milestone.",
      "Nothing is blocked, but I want us aligned before we send the recap.",
    ],
    messages: [
      {
        body: [
          "Morning Alex,",
          "The client kickoff went well overall. They liked the proposed migration flow and asked for clearer ownership across support and billing touchpoints.",
        ],
        from: "Caleb Stone",
        time: "Yesterday, 2:14 PM",
        to: "Alex Rivera",
      },
      {
        body: [
          "Thanks Caleb. Let us keep the support owners explicit and avoid adding another phase unless they really need it.",
          "I can review the timeline before the recap goes out.",
        ],
        from: "Alex Rivera",
        time: "Yesterday, 2:47 PM",
        to: "Caleb Stone",
      },
      {
        body: [
          "Hey Alex,",
          "Sharing the updated timeline before our call. The client asked for one more pass on the onboarding sequence and a cleaner owner assignment for each milestone.",
          "Nothing is blocked, but I want us aligned before we send the recap.",
        ],
        from: "Caleb Stone",
        time: "8:18 AM",
        to: "Alex Rivera",
      },
    ],
    preview: "Sharing the updated timeline before our call. The client asked for one more pass.",
    read: false,
    sender: "Caleb Stone",
    subject: "Client kickoff notes",
    time: "8:18 AM",
  },
  {
    account: "Finance",
    attachments: [{ name: "invoice-approval.pdf", size: "742 KB", type: "PDF" }],
    body: [
      "Hello Alex,",
      "The vendor invoice is approved for payment. The attached approval packet includes the purchase order match and final sign-off.",
      "Please keep the reference number attached to the project record before finance closes the cycle.",
    ],
    messages: [
      {
        attachments: [{ name: "vendor-invoice.pdf", size: "516 KB", type: "PDF" }],
        body: [
          "Hi Alex,",
          "Can you confirm whether this vendor invoice should be approved under the current project budget?",
          "The amount matches the statement, but I want a final owner confirmation before routing it.",
        ],
        from: "Finance",
        time: "Tue, 11:10 AM",
        to: "Alex Rivera",
      },
      {
        body: [
          "Approved from my side.",
          "Please attach the purchase order match and route it through the normal payout cycle.",
        ],
        from: "Alex Rivera",
        time: "Tue, 12:02 PM",
        to: "Finance",
      },
      {
        attachments: [{ name: "invoice-approval.pdf", size: "742 KB", type: "PDF" }],
        body: [
          "Hello Alex,",
          "The vendor invoice is approved for payment. The attached approval packet includes the purchase order match and final sign-off.",
          "Please keep the reference number attached to the project record before finance closes the cycle.",
        ],
        from: "Finance",
        time: "Yesterday",
        to: "Alex Rivera",
      },
    ],
    preview: "The vendor invoice is approved for payment with the approval packet attached.",
    read: true,
    sender: "Finance",
    subject: "Invoice approval",
    time: "Yesterday",
  },
  {
    account: "Internal",
    body: [
      "Hi team,",
      "The weekly studio sync has moved to Thursday. Same link, updated agenda inside.",
      "Please add any blockers before noon so we can keep the meeting focused and quick.",
    ],
    preview: "The weekly studio sync has moved to Thursday. Same link, updated agenda inside.",
    read: true,
    sender: "Ops Team",
    subject: "Studio sync moved",
    time: "Mon",
  },
];

export function EmployeeWorkspaceClient() {
  const [selectedEmailIndex, setSelectedEmailIndex] = React.useState(0);
  const [readingMode, setReadingMode] = React.useState<ReadingMode>("preview");
  const [showMoreNavigation, setShowMoreNavigation] = React.useState(false);
  const [composeDrafts, setComposeDrafts] = React.useState<ComposeDraft[]>([]);
  const [commandPaletteOpen, setCommandPaletteOpen] = React.useState(false);
  const readingExpanded = readingMode !== "preview";
  const selectedEmail = emails[selectedEmailIndex]!;
  const selectedMessages = getMessages(selectedEmail);
  const latestMessage = selectedMessages[selectedMessages.length - 1]!;
  const openCompose = React.useCallback(
    (mode: ComposeMode) => {
      const participants = getParticipants(selectedMessages);
      const subject = selectedEmail.subject;
      const quotedPreview = latestMessage.body.slice(0, 2).join(" ");
      const recipient =
        mode === "compose"
          ? ""
          : mode === "reply-all"
            ? participants.join(", ")
            : latestMessage.from;

      setComposeDrafts((current) => [
        ...current,
        {
          attachments: [],
          bcc: "",
          body: "",
          cc: "",
          ccBccVisible: mode === "reply-all",
          expanded: false,
          from: senderAccounts[0],
          id: createComposeId(),
          minimized: false,
          mode,
          ...(mode === "compose" ? {} : { quotedPreview }),
          saveStatus: "saved",
          subject:
            mode === "compose"
              ? ""
              : mode === "forward"
                ? withSubjectPrefix(subject, "Fwd:")
                : withSubjectPrefix(subject, "Re:"),
          to: recipient,
        },
      ]);
    },
    [latestMessage, selectedEmail.subject, selectedMessages],
  );

  const updateComposeDraft = React.useCallback((id: string, updates: Partial<ComposeDraft>) => {
    setComposeDrafts((current) =>
      current.map((draft) => (draft.id === id ? { ...draft, ...updates } : draft)),
    );
  }, []);

  const closeComposeDraft = React.useCallback((id: string) => {
    setComposeDrafts((current) => current.filter((draft) => draft.id !== id));
  }, []);

  const executePaletteItem = React.useCallback(
    (item: CommandPaletteItem) => {
      if (item.type === "email") {
        const emailIndex = emails.findIndex((email) => email.subject === item.title);
        if (emailIndex >= 0) {
          setSelectedEmailIndex(emailIndex);
          setReadingMode("full");
        }
      }

      if (item.type === "contact") {
        openCompose("compose");
      }

      if (item.title === "Compose Email") {
        openCompose("compose");
      }

      if (item.title === "Reply") {
        openCompose("reply");
      }

      if (item.title === "Forward") {
        openCompose("forward");
      }

      if (item.title.startsWith("Open ")) {
        setReadingMode("preview");
      }

      setCommandPaletteOpen(false);
    },
    [openCompose],
  );
  const employeeQuickActions = React.useMemo<QuickAction[]>(
    () => [
      { label: "Compose mail", iconKey: "compose", onClick: () => openCompose("compose") },
      { label: "Reply", iconKey: "reply", onClick: () => openCompose("reply") },
      { label: "Schedule follow-up", iconKey: "clock" },
      { label: "Find contact", iconKey: "search", onClick: () => setCommandPaletteOpen(true) },
    ],
    [openCompose],
  );
  const employeeNavigation = React.useMemo<ShellNavItem[]>(
    () => [
      ...visibleEmployeeNavigation,
      {
        label: showMoreNavigation ? "Less" : "More",
        iconKey: showMoreNavigation ? "less" : "more",
        onClick: () => setShowMoreNavigation((current) => !current),
      },
      ...(showMoreNavigation ? hiddenEmployeeNavigation : []),
    ],
    [showMoreNavigation],
  );

  React.useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target;
      const tagName = target instanceof HTMLElement ? target.tagName : "";

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandPaletteOpen((current) => !current);
        return;
      }

      if (tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT") {
        return;
      }

      if (event.key === "Enter") {
        setReadingMode("full");
      }

      if (event.key === "Escape") {
        setReadingMode("preview");
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <AppShell
      currentSection="Inbox"
      navigation={employeeNavigation}
      quickActions={employeeQuickActions}
      quickActionsFooter={<EmployeeLabelFilters />}
      quickActionsMode="floating"
      searchPlaceholder="Search emails, contacts, files..."
      userEmail="alex@36t.studio"
      userName="Alex Rivera"
      workspace="alex@36t.studio"
      workspaceLabel="Employee Workspace"
    >
      <EmployeeWebmailCore />
      <div className="relative">
        <div className="pointer-events-none sticky top-[5.75rem] z-20 mb-4 flex justify-end gap-2">
          <GlassButton
            className="pointer-events-auto rounded-full border border-glass-edge/24 bg-white/82 px-3 shadow-glass-soft ring-1 ring-white/80 transition hover:-translate-y-0.5 hover:border-sky-200/80 hover:bg-white"
            variant="glass"
            aria-label="Open command palette"
            onClick={() => setCommandPaletteOpen(true)}
          >
            <Search className="h-4 w-4 text-sky-700" aria-hidden="true" />
            <span className="hidden text-xs font-semibold text-muted-foreground sm:inline">
              Ctrl K
            </span>
          </GlassButton>
          <GlassButton
            className="pointer-events-auto rounded-full border border-sky-200/80 bg-white/82 px-4 shadow-[0_14px_42px_rgba(14,165,233,0.24),0_0_0_5px_rgba(186,230,253,0.18)] ring-1 ring-white/80 backdrop-blur-glass-strong transition hover:-translate-y-0.5 hover:border-sky-300/80 hover:bg-white hover:shadow-[0_18px_52px_rgba(14,165,233,0.32),0_0_0_6px_rgba(186,230,253,0.24)]"
            variant="glass"
            aria-label="Compose mail"
            onClick={() => openCompose("compose")}
          >
            <MailPlus className="h-4 w-4 text-sky-700" aria-hidden="true" />
            Compose
          </GlassButton>
        </div>

        <div
          className={`grid gap-4 ${
            readingExpanded ? "lg:grid-cols-1" : "lg:grid-cols-[minmax(19rem,25rem)_minmax(0,1fr)]"
          }`}
        >
          <GlassCard
            className={`order-1 min-h-[34rem] p-3 sm:p-4 ${readingExpanded ? "hidden" : ""}`}
            intensity="default"
          >
            <div className="mb-4 flex items-center justify-between gap-3 px-1">
              <div>
                <h1 className="text-xl font-semibold text-foreground">Inbox</h1>
                <p className="mt-1 text-sm text-muted-foreground">24 messages, 2 unread</p>
              </div>
              <StatusIndicator label="Synced" />
            </div>

            <div className="grid gap-2.5">
              {emails.map((email, index) => (
                <MailListItem
                  email={email}
                  key={`${email.sender}-${email.subject}`}
                  selected={index === selectedEmailIndex}
                  onOpen={() => {
                    setSelectedEmailIndex(index);
                    setReadingMode("full");
                  }}
                  onSelect={() => setSelectedEmailIndex(index)}
                />
              ))}
            </div>
          </GlassCard>

          <PremiumReadingPane
            email={selectedEmail}
            messages={selectedMessages}
            mode={readingMode}
            onArchive={() => undefined}
            onBack={() => setReadingMode("preview")}
            onDelete={() => undefined}
            onForward={() => openCompose("forward")}
            onModeChange={setReadingMode}
            onReply={() => openCompose("reply")}
            onReplyAll={() => openCompose("reply-all")}
          />
        </div>

        <CommandPalette
          emails={emails}
          isOpen={commandPaletteOpen}
          onClose={() => setCommandPaletteOpen(false)}
          onSelect={executePaletteItem}
        />
        {composeDrafts.map((draft, index) => (
          <ComposeWindow
            draft={draft}
            key={draft.id}
            onClose={() => closeComposeDraft(draft.id)}
            onDraftChange={(updates) => updateComposeDraft(draft.id, updates)}
            onNewCompose={() => openCompose("compose")}
            stackIndex={index}
          />
        ))}
      </div>
    </AppShell>
  );
}

function PremiumReadingPane({
  email,
  messages,
  mode,
  onBack,
  onForward,
  onModeChange,
  onReply,
  onReplyAll,
}: {
  email: MockEmail;
  messages: ThreadMessage[];
  mode: ReadingMode;
  onArchive: () => void;
  onBack: () => void;
  onDelete: () => void;
  onForward: () => void;
  onModeChange: (mode: ReadingMode) => void;
  onReply: () => void;
  onReplyAll: () => void;
}) {
  const latestMessage = messages[messages.length - 1]!;
  const attachmentCount = getAttachmentCount(messages);
  const isPreview = mode === "preview";

  return (
    <GlassCard
      className={`order-2 min-h-[34rem] ${isPreview ? "p-4 sm:p-5" : "p-5 sm:p-6 lg:px-10"}`}
      intensity="default"
    >
      {mode !== "preview" ? (
        <GlassButton className="mb-6" variant="glass" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to Inbox
        </GlassButton>
      ) : null}

      <div className="mx-auto max-w-[850px]">
        <div className="sticky top-4 z-10 mb-5 flex flex-wrap items-center gap-2 rounded-[1.25rem] border border-glass-edge/20 bg-white/90 p-2 shadow-glass-soft ring-1 ring-white/80 backdrop-blur-glass-strong">
          <GlassButton size="icon" variant="glass" aria-label="Reply" onClick={onReply}>
            <Reply className="h-4 w-4" aria-hidden="true" />
          </GlassButton>
          {!isPreview ? (
            <GlassButton size="icon" variant="glass" aria-label="Reply all" onClick={onReplyAll}>
              <ReplyAll className="h-4 w-4" aria-hidden="true" />
            </GlassButton>
          ) : null}
          <GlassButton size="icon" variant="glass" aria-label="Forward" onClick={onForward}>
            <Forward className="h-4 w-4" aria-hidden="true" />
          </GlassButton>
          {!isPreview ? (
            <>
              <GlassButton size="icon" variant="glass" aria-label="Star">
                <Star className="h-4 w-4" aria-hidden="true" />
              </GlassButton>
              <GlassButton size="icon" variant="glass" aria-label="Mark unread">
                <MailOpen className="h-4 w-4" aria-hidden="true" />
              </GlassButton>
            </>
          ) : null}
          <div className="ml-auto flex rounded-full border border-glass-edge/20 bg-white/72 p-1 text-xs">
            {(["preview", "focus", "full"] as ReadingMode[]).map((readingMode) => (
              <button
                className={`rounded-full px-3 py-1.5 font-medium capitalize transition ${
                  mode === readingMode
                    ? "bg-sky-100 text-sky-800"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                key={readingMode}
                type="button"
                onClick={() => onModeChange(readingMode)}
              >
                {readingMode}
              </button>
            ))}
          </div>
        </div>

        {isPreview ? (
          <div className="rounded-[1.5rem] border border-glass-edge/20 bg-white/78 p-5 shadow-inner-glass">
            <div className="flex items-start gap-4">
              <SenderAvatar sender={latestMessage.from ?? email.sender} />
              <div className="min-w-0 flex-1">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <GlassBadge tone="premium">{email.account}</GlassBadge>
                  {messages.length > 1 ? (
                    <span className="rounded-full border border-sky-100 bg-sky-50/80 px-2.5 py-1 text-xs font-medium text-sky-700">
                      {messages.length} messages
                    </span>
                  ) : null}
                  {attachmentCount ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-glass-edge/24 bg-white/70 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                      <Paperclip className="h-3.5 w-3.5" aria-hidden="true" />
                      {attachmentCount}
                    </span>
                  ) : null}
                </div>
                <h2 className="text-2xl font-semibold leading-tight text-foreground">
                  {email.subject}
                </h2>
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">{latestMessage.from}</span>
                  <span>To {latestMessage.to}</span>
                  <span>{latestMessage.time}</span>
                </div>
              </div>
            </div>

            <article className="mt-6 rounded-[1.25rem] border border-glass-edge/18 bg-white/72 p-4 text-sm leading-7 text-muted-foreground shadow-inner-glass">
              {latestMessage.body.slice(0, 2).map((paragraph) => (
                <p className="line-clamp-3" key={paragraph}>
                  {paragraph}
                </p>
              ))}
            </article>
          </div>
        ) : (
          <>
            <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 items-start gap-4">
                <SenderAvatar sender={latestMessage.from ?? email.sender} />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <GlassBadge tone="premium">{email.account}</GlassBadge>
                    <GlassBadge tone="neutral">High importance</GlassBadge>
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                      <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                      Secure
                    </span>
                  </div>
                  <h2 className="mt-5 text-3xl font-semibold leading-tight text-foreground">
                    {email.subject}
                  </h2>
                  <div className="mt-4 grid gap-1.5 text-sm leading-6 text-muted-foreground">
                    <p>
                      <span className="font-semibold text-foreground">{latestMessage.from}</span> /
                      Product Lead at JPosta
                    </p>
                    <p>To Alex Rivera / CC Operations</p>
                    <p>{latestMessage.time}</p>
                  </div>
                </div>
              </div>
              <GlassButton size="icon" variant="glass" aria-label="Collapse header">
                <ChevronUp className="h-4 w-4" aria-hidden="true" />
              </GlassButton>
            </div>

            <div className="h-1 overflow-hidden rounded-full bg-sky-100/80">
              <div className="h-full w-2/3 rounded-full bg-sky-400" />
            </div>

            <div className="mt-8 rounded-[1.5rem] border border-glass-edge/20 bg-white/76 p-5 shadow-inner-glass sm:p-8">
              <ConversationTimeline email={email} messages={messages} />
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {messages
                  .flatMap((message) => message.attachments ?? [])
                  .map((attachment) => (
                    <div
                      className="rounded-[1.25rem] border border-glass-edge/24 bg-white/86 p-4 shadow-inner-glass"
                      key={attachment.name}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
                          <Paperclip className="h-4 w-4" aria-hidden="true" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {attachment.name}
                          </p>
                          <p className="text-xs text-muted-foreground">{attachment.size}</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <GlassButton size="sm">Preview</GlassButton>
                            <GlassButton size="sm">Open</GlassButton>
                            <GlassButton size="sm">Download</GlassButton>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </>
        )}
      </div>
    </GlassCard>
  );
}

function CommandPalette({
  emails,
  isOpen,
  onClose,
  onSelect,
}: {
  emails: MockEmail[];
  isOpen: boolean;
  onClose: () => void;
  onSelect: (item: CommandPaletteItem) => void;
}) {
  const [query, setQuery] = React.useState("");
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const items = React.useMemo(() => buildCommandPaletteItems(emails), [emails]);
  const filteredItems = React.useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return items;
    return items.filter((item) =>
      `${item.title} ${item.subtitle} ${item.keywords}`.toLowerCase().includes(normalized),
    );
  }, [items, query]);
  const groupedItems = React.useMemo(() => groupCommandItems(filteredItems), [filteredItems]);

  React.useEffect(() => {
    if (!isOpen) return;
    setQuery("");
    setSelectedIndex(0);
    window.setTimeout(() => inputRef.current?.focus(), 30);
  }, [isOpen]);

  React.useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedIndex((current) => Math.min(current + 1, Math.max(filteredItems.length - 1, 0)));
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedIndex((current) => Math.max(current - 1, 0));
      }
      if (event.key === "Enter" && filteredItems[selectedIndex]) {
        event.preventDefault();
        onSelect(filteredItems[selectedIndex]);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [filteredItems, isOpen, onClose, onSelect, selectedIndex]);

  React.useEffect(() => setSelectedIndex(0), [query]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-white/70 px-4 pt-[10vh]">
      <button
        className="absolute inset-0 cursor-default"
        type="button"
        aria-label="Close command palette"
        onClick={onClose}
      />
      <div className="relative w-[min(760px,calc(100vw-32px))] animate-[paletteIn_160ms_cubic-bezier(.2,.8,.2,1)] overflow-hidden rounded-[24px] border border-sky-100/90 bg-white/95 shadow-[0_34px_110px_rgba(14,165,233,0.28),0_18px_54px_rgba(15,23,42,0.16)] ring-1 ring-white/90 backdrop-blur-glass-strong">
        <style>{`@keyframes paletteIn { from { opacity: 0; transform: translateY(8px) scale(.98); } to { opacity: 1; transform: translateY(0) scale(1); } }`}</style>
        <div className="flex items-center gap-3 border-b border-glass-edge/20 bg-white px-4 py-4">
          <Search className="h-5 w-5 text-sky-700" aria-hidden="true" />
          <input
            ref={inputRef}
            className="min-w-0 flex-1 rounded-xl bg-white text-base text-foreground outline-none placeholder:text-muted-foreground"
            placeholder="Search emails, contacts, commands..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <kbd className="rounded-lg border border-glass-edge/24 bg-white px-2 py-1 text-xs text-muted-foreground">
            Esc
          </kbd>
        </div>
        <div className="max-h-[62vh] overflow-auto bg-white/92 p-3">
          {groupedItems.map(([group, groupItems]) => (
            <div className="mb-3" key={group}>
              <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {group}
              </p>
              <div className="grid gap-1">
                {groupItems.map((item) => {
                  const globalIndex = filteredItems.indexOf(item);
                  return (
                    <button
                      className={`flex items-center gap-3 rounded-2xl border px-3 py-3 text-left transition ${globalIndex === selectedIndex ? "border-sky-200 bg-sky-50/90 shadow-inner-glass" : "border-transparent bg-white/72 hover:border-glass-edge/20 hover:bg-white"}`}
                      key={`${item.group}-${item.title}`}
                      type="button"
                      onMouseEnter={() => setSelectedIndex(globalIndex)}
                      onClick={() => onSelect(item)}
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-sky-700 shadow-inner-glass">
                        {commandTypeInitial(item.type)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-foreground">
                          {item.title}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {item.subtitle}
                        </span>
                      </span>
                      {item.hint ? (
                        <kbd className="rounded-lg border border-glass-edge/24 bg-white px-2 py-1 text-xs text-muted-foreground">
                          {item.hint}
                        </kbd>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 border-t border-glass-edge/20 bg-white px-4 py-3 text-xs text-muted-foreground">
          <span>Ctrl N New Mail</span>
          <span>Ctrl Shift C Compose</span>
          <span>Ctrl / Focus Search</span>
        </div>
      </div>
    </div>
  );
}
function ComposeWindow({
  draft,
  onClose,
  onDraftChange,
  onNewCompose,
  stackIndex,
}: {
  draft: ComposeDraft;
  onClose: () => void;
  onDraftChange: (updates: Partial<ComposeDraft>) => void;
  onNewCompose: () => void;
  stackIndex: number;
}) {
  const [dragActive, setDragActive] = React.useState(false);
  const [showCloseConfirmation, setShowCloseConfirmation] = React.useState(false);
  const hasUnsavedChanges = React.useMemo(() => draftHasUnsavedChanges(draft), [draft]);
  const title =
    draft.mode === "compose"
      ? "New Message"
      : draft.mode === "forward"
        ? "Forward"
        : draft.mode === "reply-all"
          ? "Reply All"
          : "Reply";
  const minimizedLabel = draft.to || draft.subject || title;

  const updateDraft = React.useCallback(
    (updates: Partial<ComposeDraft>) => {
      onDraftChange({ ...updates, saveStatus: "saving" });
    },
    [onDraftChange],
  );

  const requestClose = React.useCallback(() => {
    if (hasUnsavedChanges) {
      setShowCloseConfirmation(true);
      return;
    }

    onClose();
  }, [hasUnsavedChanges, onClose]);

  React.useEffect(() => {
    if (draft.saveStatus !== "saving") {
      return;
    }

    const timer = window.setTimeout(() => onDraftChange({ saveStatus: "saved" }), 650);
    return () => window.clearTimeout(timer);
  }, [draft.saveStatus, onDraftChange]);

  React.useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey && event.key === "Enter") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "c") {
        event.preventDefault();
        onNewCompose();
        return;
      }

      if (event.ctrlKey && event.key.toLowerCase() === "s") {
        event.preventDefault();
        onDraftChange({ saveStatus: "saving" });
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        onDraftChange({ minimized: true });
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, onDraftChange, onNewCompose]);

  function addMockAttachment(name = "jposta-attachment.pdf") {
    const size = `${Math.max(180, Math.round(name.length * 18))} KB`;
    updateDraft({
      attachments: [
        ...draft.attachments,
        {
          name,
          progress: 100,
          size,
          type: name.split(".").pop()?.toUpperCase() || "File",
        },
      ],
    });
  }

  function removeAttachment(name: string) {
    updateDraft({
      attachments: draft.attachments.filter((attachment) => attachment.name !== name),
    });
  }

  if (draft.minimized) {
    return (
      <div
        className="fixed bottom-3 z-50 w-[calc(100vw-24px)] animate-[composeFloat_180ms_cubic-bezier(.2,.8,.2,1)] sm:bottom-6 sm:w-64"
        style={{
          right:
            typeof window === "undefined"
              ? 12
              : window.innerWidth < 640
                ? 12
                : 24 + stackIndex * 280,
        }}
      >
        <button
          className="flex w-full items-center justify-between gap-3 rounded-[1.15rem] border border-sky-200/80 bg-white/95 px-4 py-3 text-left shadow-[0_18px_60px_rgba(14,165,233,0.22)] ring-1 ring-white/90 transition duration-300 hover:-translate-y-0.5 hover:bg-white"
          type="button"
          onClick={() => onDraftChange({ minimized: false })}
        >
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-foreground">
              {minimizedLabel}
            </span>
            <span className="block text-xs text-sky-700">
              Draft {draft.saveStatus === "saving" ? "Saving..." : "Saved"}
            </span>
          </span>
          <MailPlus className="h-4 w-4 shrink-0 text-sky-700" aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <>
      <style>{`@keyframes composeFloat { from { opacity: 0; transform: translate3d(0,18px,0) scale(.98); } to { opacity: 1; transform: translate3d(0,0,0) scale(1); } }`}</style>
      <section
        className={`fixed z-50 animate-[composeFloat_220ms_cubic-bezier(.2,.8,.2,1)] transition-all duration-300 ease-out ${
          draft.expanded
            ? "inset-0 h-[100dvh] w-screen sm:inset-auto sm:left-1/2 sm:top-1/2 sm:h-[90vh] sm:w-[90vw] sm:-translate-x-1/2 sm:-translate-y-1/2"
            : "inset-0 h-[100dvh] w-screen sm:inset-auto sm:left-1/2 sm:top-1/2 sm:h-[85vh] sm:w-[calc(100vw-48px)] sm:max-w-[760px] sm:-translate-x-1/2 sm:-translate-y-1/2 lg:left-auto lg:top-auto lg:right-6 lg:bottom-6 lg:h-[650px] lg:w-[700px] lg:translate-x-0 lg:translate-y-0"
        }`}
        aria-label={`${title} compose window`}
      >
        <div
          className="flex h-full flex-col overflow-hidden border border-sky-100/90 bg-white/95 shadow-[0_34px_110px_rgba(14,165,233,0.34),0_16px_46px_rgba(15,23,42,0.14),0_0_0_1px_rgba(255,255,255,0.9)_inset] ring-1 ring-white/90 sm:rounded-[24px]"
          onDragEnter={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setDragActive(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setDragActive(false);
            const file = event.dataTransfer.files[0];
            addMockAttachment(file?.name);
          }}
        >
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-glass-edge/18 bg-white/95 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{title}</p>
              <p className="text-xs text-sky-700">
                {draft.saveStatus === "saving" ? "Saving..." : "Saved"}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                className="rounded-full border border-glass-edge/20 bg-white/95 p-2 text-muted-foreground transition hover:-translate-y-0.5 hover:bg-white hover:text-foreground"
                type="button"
                aria-label="Minimize compose"
                onClick={() => onDraftChange({ minimized: true })}
              >
                <Minimize2 className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <button
                className="rounded-full border border-glass-edge/20 bg-white/95 p-2 text-muted-foreground transition hover:-translate-y-0.5 hover:bg-white hover:text-foreground"
                type="button"
                aria-label={draft.expanded ? "Restore compose" : "Expand compose"}
                onClick={() => onDraftChange({ expanded: !draft.expanded })}
              >
                <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <button
                className="rounded-full border border-rose-100/80 bg-white/95 p-2 text-rose-500 transition hover:-translate-y-0.5 hover:bg-rose-50"
                type="button"
                aria-label="Close compose"
                onClick={requestClose}
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </header>

          <div className="grid shrink-0 gap-2 border-b border-glass-edge/16 bg-white/95 px-4 py-3 text-sm">
            <label className="grid gap-1 sm:grid-cols-[4rem_minmax(0,1fr)] sm:items-center">
              <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                From
              </span>
              <select
                className="rounded-xl border border-glass-edge/20 bg-white px-3 py-2 text-foreground outline-none transition focus:border-sky-200 focus:ring-2 focus:ring-sky-100"
                value={draft.from}
                onChange={(event) => updateDraft({ from: event.target.value })}
              >
                {senderAccounts.map((account) => (
                  <option key={account} value={account}>
                    {account}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 sm:grid-cols-[4rem_minmax(0,1fr)] sm:items-center">
              <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                To
              </span>
              <input
                className="rounded-xl border border-glass-edge/20 bg-white px-3 py-2 text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-sky-200 focus:ring-2 focus:ring-sky-100"
                placeholder="name@company.com"
                value={draft.to}
                onChange={(event) => updateDraft({ to: event.target.value })}
              />
            </label>
            <div className="grid gap-2 sm:grid-cols-[4rem_minmax(0,1fr)_minmax(0,1fr)] sm:items-center">
              <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Cc/Bcc
              </span>
              <input
                className="rounded-xl border border-glass-edge/20 bg-white px-3 py-2 text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-sky-200 focus:ring-2 focus:ring-sky-100"
                placeholder="Cc"
                value={draft.cc}
                onChange={(event) => updateDraft({ cc: event.target.value })}
              />
              <input
                className="rounded-xl border border-glass-edge/20 bg-white px-3 py-2 text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-sky-200 focus:ring-2 focus:ring-sky-100"
                placeholder="Bcc"
                value={draft.bcc}
                onChange={(event) => updateDraft({ bcc: event.target.value })}
              />
            </div>
            <label className="grid gap-1 sm:grid-cols-[4rem_minmax(0,1fr)] sm:items-center">
              <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Subject
              </span>
              <input
                className="rounded-xl border border-glass-edge/20 bg-white px-3 py-2 text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-sky-200 focus:ring-2 focus:ring-sky-100"
                placeholder="Subject"
                value={draft.subject}
                onChange={(event) => updateDraft({ subject: event.target.value })}
              />
            </label>
          </div>

          <RichTextToolbar onAttach={() => addMockAttachment()} />

          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-white/90">
            {dragActive ? (
              <div className="absolute inset-4 z-10 flex items-center justify-center rounded-[1.5rem] border border-dashed border-sky-300 bg-sky-50/90 text-sm font-semibold text-sky-800 shadow-inner-glass">
                Drop files to attach
              </div>
            ) : null}
            <textarea
              className="min-h-0 flex-1 resize-none overflow-auto border-0 bg-white/95 px-5 py-5 text-[15px] leading-8 text-foreground outline-none placeholder:text-muted-foreground/70"
              placeholder="Write your message..."
              value={draft.body}
              onChange={(event) => updateDraft({ body: event.target.value })}
            />
            {draft.quotedPreview ? (
              <div className="mx-4 mb-4 rounded-[1.1rem] border border-glass-edge/20 bg-white/95 p-3 text-xs leading-5 text-muted-foreground shadow-inner-glass">
                <p className="mb-1 font-semibold text-foreground">
                  {draft.mode === "forward" ? "Forwarded message" : "Quoted message"}
                </p>
                <p className="line-clamp-3">{draft.quotedPreview}</p>
              </div>
            ) : null}
          </div>

          <AttachmentStrip attachments={draft.attachments} onRemove={removeAttachment} />

          <footer className="flex shrink-0 flex-col gap-2 border-t border-glass-edge/16 bg-white/95 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              <GlassButton variant="primary" onClick={onClose}>
                <Send className="h-4 w-4" aria-hidden="true" />
                Send
              </GlassButton>
              <GlassButton onClick={() => onDraftChange({ minimized: true, saveStatus: "saved" })}>
                <Save className="h-4 w-4" aria-hidden="true" />
                Save draft
              </GlassButton>
              <GlassButton onClick={() => addMockAttachment()}>
                <Paperclip className="h-4 w-4" aria-hidden="true" />
                Attach file
              </GlassButton>
            </div>
            <GlassButton variant="ghost" onClick={requestClose}>
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Discard
            </GlassButton>
          </footer>
        </div>
      </section>

      {showCloseConfirmation ? (
        <div className="fixed left-1/2 top-1/2 z-[60] w-[min(24rem,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-[1.35rem] border border-sky-100/90 bg-white/95 p-5 shadow-[0_28px_80px_rgba(15,23,42,0.18)] ring-1 ring-white/90">
          <p className="text-base font-semibold text-foreground">Save this draft?</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            This compose window has unsaved changes. Save the draft or discard it before closing.
          </p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <GlassButton
              onClick={() => {
                onDraftChange({ minimized: true, saveStatus: "saved" });
                setShowCloseConfirmation(false);
              }}
            >
              <Save className="h-4 w-4" aria-hidden="true" />
              Save Draft
            </GlassButton>
            <GlassButton variant="ghost" onClick={onClose}>
              Discard
            </GlassButton>
            <GlassButton variant="primary" onClick={() => setShowCloseConfirmation(false)}>
              Continue Editing
            </GlassButton>
          </div>
        </div>
      ) : null}
    </>
  );
}

function RichTextToolbar({ onAttach }: { onAttach: () => void }) {
  const tools = [
    { label: "Bold", icon: Bold },
    { label: "Italic", icon: Italic },
    { label: "Underline", icon: Underline },
    { label: "Font size", icon: Type },
    { label: "Bullet list", icon: List },
    { label: "Number list", icon: ListOrdered },
    { label: "Quote", icon: Quote },
    { label: "Code", icon: Code2 },
    { label: "Link", icon: Link },
    { label: "Emoji", icon: Smile },
    { label: "Image", icon: Image, onClick: onAttach },
    { label: "Table", icon: Table2 },
    { label: "Remove formatting", icon: Eraser },
  ];

  return (
    <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-glass-edge/16 bg-white/95 px-3 py-2">
      {tools.map((tool) => {
        const Icon = tool.icon;
        return (
          <button
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-transparent text-muted-foreground transition hover:-translate-y-0.5 hover:border-sky-100 hover:bg-sky-50 hover:text-sky-700"
            key={tool.label}
            type="button"
            aria-label={tool.label}
            title={tool.label}
            onClick={tool.onClick}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}

function AttachmentStrip({
  attachments,
  onRemove,
}: {
  attachments: ComposeAttachment[];
  onRemove: (name: string) => void;
}) {
  if (!attachments.length) {
    return null;
  }

  return (
    <div className="grid shrink-0 gap-2 border-t border-glass-edge/16 bg-white/95 px-4 py-3 sm:grid-cols-2">
      {attachments.map((attachment) => (
        <div
          className="rounded-[1rem] border border-glass-edge/20 bg-white p-3 shadow-inner-glass"
          key={attachment.name}
        >
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
              <Paperclip className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {attachment.name}
                  </p>
                  <p className="text-xs text-muted-foreground">{attachment.size}</p>
                </div>
                <button
                  className="rounded-full p-1 text-muted-foreground transition hover:bg-rose-50 hover:text-rose-500"
                  type="button"
                  aria-label={`Remove ${attachment.name}`}
                  onClick={() => onRemove(attachment.name)}
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-sky-100">
                <div
                  className="h-full rounded-full bg-sky-500"
                  style={{ width: `${attachment.progress}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
function MailListItem({
  email,
  onOpen,
  onSelect,
  selected,
}: {
  email: MockEmail;
  onOpen: () => void;
  onSelect: () => void;
  selected: boolean;
}) {
  const messages = getMessages(email);
  const isThread = messages.length > 1;
  const attachmentCount = getAttachmentCount(messages);

  return (
    <button
      className={`group rounded-[1.15rem] border px-3 py-2.5 text-left transition duration-200 hover:-translate-y-0.5 hover:border-sky-200/70 hover:bg-white/78 hover:shadow-glass-soft ${
        selected
          ? "border-sky-200/80 bg-sky-50/82 shadow-glass-soft"
          : email.read
            ? "border-glass-edge/20 bg-white/48 shadow-inner-glass"
            : "border-sky-100/70 bg-white/68 shadow-inner-glass"
      }`}
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      onDoubleClick={onOpen}
    >
      <div className="flex items-start gap-2.5">
        {isThread ? (
          <ThreadAvatars messages={messages} size="sm" />
        ) : (
          <SenderAvatar sender={email.sender} unread={!email.read} size="sm" />
        )}
        <div className="min-w-0 flex-1">
          <div className="mb-0.5 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {!email.read ? <span className="h-2 w-2 rounded-full bg-sky-500" /> : null}
                <p
                  className={`truncate text-sm ${
                    email.read ? "font-medium text-foreground" : "font-semibold text-slate-950"
                  }`}
                >
                  {email.sender}
                </p>
              </div>
              <p className="mt-0.5 truncate text-sm font-semibold text-foreground">
                {email.subject}
              </p>
            </div>
            <span
              className={`shrink-0 text-xs ${email.read ? "text-muted-foreground" : "font-semibold text-sky-700"}`}
            >
              {email.time}
            </span>
          </div>
          <p className="line-clamp-1 text-xs leading-4 text-muted-foreground">{email.preview}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-glass-edge/24 bg-white/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {email.account}
            </span>
            {isThread ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-sky-100/80 bg-sky-50/70 px-2 py-0.5 text-[11px] font-medium text-sky-700 shadow-inner-glass">
                {messages.length} messages
              </span>
            ) : null}
            {attachmentCount ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-glass-edge/24 bg-white/66 px-1.5 py-0.5 text-[11px] text-muted-foreground">
                <Paperclip className="h-3 w-3" aria-hidden="true" />
                {attachmentCount}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </button>
  );
}

function ConversationTimeline({
  email,
  messages,
}: {
  email: MockEmail;
  messages: ThreadMessage[];
}) {
  const participants = getParticipants(messages);

  return (
    <div>
      <div className="mb-6 rounded-[1.35rem] border border-glass-edge/20 bg-white/44 p-4 shadow-inner-glass">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Participants
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {participants.map((participant) => (
            <span
              className="inline-flex items-center gap-2 rounded-full border border-glass-edge/24 bg-white/62 px-3 py-1.5 text-sm font-medium text-foreground"
              key={participant}
            >
              <SenderAvatar sender={participant} size="sm" />
              {participant}
            </span>
          ))}
        </div>
      </div>

      <div className="grid gap-4">
        {messages.map((message, index) => {
          const isLatest = index === messages.length - 1;

          return (
            <MessageCard
              email={email}
              expanded={isLatest || messages.length === 1}
              key={`${message.from}-${message.time}`}
              message={message}
            />
          );
        })}
      </div>
    </div>
  );
}

function MessageCard({
  email,
  expanded,
  message,
}: {
  email: MockEmail;
  expanded: boolean;
  message: ThreadMessage;
}) {
  return (
    <div
      className={`rounded-[1.35rem] border p-4 shadow-inner-glass transition ${
        expanded ? "border-sky-200/70 bg-white/66" : "border-glass-edge/18 bg-white/36"
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <SenderAvatar sender={message.from} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{message.from}</p>
            <p className="mt-1 text-xs text-muted-foreground">To {message.to}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
          {!expanded ? (
            <span className="rounded-full border border-glass-edge/24 bg-white/58 px-2 py-0.5">
              Collapsed
            </span>
          ) : null}
          <span>{message.time}</span>
        </div>
      </div>

      {expanded ? (
        <>
          <article className="mt-5 max-w-4xl space-y-4 text-base leading-8 text-muted-foreground">
            {message.body.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </article>
          <MessageAttachments attachments={message.attachments} />
        </>
      ) : (
        <p className="mt-4 line-clamp-2 text-sm leading-6 text-muted-foreground">
          {message.body[1] ?? message.body[0]}
        </p>
      )}

      <p className="sr-only">{email.subject}</p>
    </div>
  );
}

function MessageAttachments({ attachments }: { attachments: Attachment[] | undefined }) {
  if (!attachments?.length) {
    return null;
  }

  return (
    <div className="mt-6 grid gap-3 sm:grid-cols-2">
      {attachments.map((attachment) => (
        <div
          className="rounded-[1.25rem] border border-glass-edge/24 bg-white/54 p-4 shadow-inner-glass transition hover:-translate-y-0.5 hover:bg-white/72"
          key={attachment.name}
        >
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-100/70 text-sky-700 shadow-inner-glass">
            <Paperclip className="h-4 w-4" aria-hidden="true" />
          </div>
          <p className="text-sm font-semibold text-foreground">{attachment.name}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {attachment.type} / {attachment.size}
          </p>
        </div>
      ))}
    </div>
  );
}

function ThreadAvatars({
  messages,
  size = "md",
}: {
  messages: ThreadMessage[];
  size?: "sm" | "md";
}) {
  const participants = getParticipants(messages).slice(0, 3);
  const compact = size === "sm";

  return (
    <span className={`flex shrink-0 items-center ${compact ? "w-12" : "w-16"}`}>
      {participants.map((participant, index) => (
        <span className={index > 0 ? "-ml-3" : ""} key={participant}>
          <SenderAvatar sender={participant} size={compact ? "sm" : "md"} unread={index === 0} />
        </span>
      ))}
    </span>
  );
}

function SenderAvatar({
  sender,
  size = "md",
  unread = false,
}: {
  sender: string;
  size?: "sm" | "md";
  unread?: boolean;
}) {
  const sizeClass =
    size === "sm" ? "h-9 w-9 rounded-xl text-[11px]" : "h-11 w-11 rounded-2xl text-xs";

  return (
    <span
      className={`flex ${sizeClass} shrink-0 items-center justify-center border font-semibold shadow-inner-glass ${
        unread
          ? "border-sky-200/80 bg-gradient-to-br from-white to-sky-100 text-sky-800"
          : "border-glass-edge/24 bg-white/62 text-slate-600"
      }`}
    >
      {senderInitials(sender)}
    </span>
  );
}

function buildCommandPaletteItems(emailItems: MockEmail[]): CommandPaletteItem[] {
  const commandItems: CommandPaletteItem[] = [
    {
      group: "Commands",
      title: "Compose Email",
      subtitle: "Start a new message",
      keywords: "new mail compose",
      hint: "Ctrl N",
      type: "command",
    },
    {
      group: "Commands",
      title: "Reply",
      subtitle: "Reply to selected email",
      keywords: "respond answer",
      type: "command",
    },
    {
      group: "Commands",
      title: "Forward",
      subtitle: "Forward selected email",
      keywords: "share send",
      type: "command",
    },
    {
      group: "Folders",
      title: "Open Inbox",
      subtitle: "Go to inbox",
      keywords: "mail inbox",
      type: "folder",
    },
    {
      group: "Folders",
      title: "Open Starred",
      subtitle: "View starred mail",
      keywords: "favorites important",
      type: "folder",
    },
    {
      group: "Folders",
      title: "Open Drafts",
      subtitle: "View saved drafts",
      keywords: "draft saved",
      type: "folder",
    },
    {
      group: "Folders",
      title: "Open Spam",
      subtitle: "Review spam",
      keywords: "junk spam",
      type: "folder",
    },
    {
      group: "Contacts",
      title: "Maya Chen",
      subtitle: "maya@36t.studio",
      keywords: "maya chen contact",
      type: "contact",
    },
    {
      group: "Contacts",
      title: "Caleb Stone",
      subtitle: "caleb@client.example",
      keywords: "caleb stone client contact",
      type: "contact",
    },
    {
      group: "Contacts",
      title: "Finance",
      subtitle: "finance@36t.studio",
      keywords: "billing finance contact",
      type: "contact",
    },
    {
      group: "Commands",
      title: "Open Contacts",
      subtitle: "People and address book",
      keywords: "contacts people",
      type: "command",
    },
    {
      group: "Commands",
      title: "Open Calendar",
      subtitle: "Schedule and events",
      keywords: "calendar schedule",
      type: "command",
    },
    {
      group: "Commands",
      title: "Open Files",
      subtitle: "Browse shared files",
      keywords: "files documents",
      type: "command",
    },
    {
      group: "Settings",
      title: "Open Settings",
      subtitle: "Mail preferences",
      keywords: "settings preferences",
      type: "setting",
    },
    {
      group: "Drafts",
      title: "Proposal follow-up",
      subtitle: "Draft saved 12 minutes ago",
      keywords: "draft proposal",
      type: "draft",
    },
    {
      group: "Attachments",
      title: "launch-copy-final.docx",
      subtitle: "Document / 248 KB",
      keywords: "attachment document launch",
      type: "attachment",
    },
  ];

  return [
    ...emailItems.map((email) => ({
      group: "Emails" as const,
      title: email.subject,
      subtitle: `${email.sender} / ${email.preview}`,
      keywords: `${email.sender} ${email.subject} ${email.preview}`,
      type: "email" as const,
    })),
    ...commandItems,
  ];
}

function groupCommandItems(items: CommandPaletteItem[]) {
  const order: CommandPaletteItem["group"][] = [
    "Emails",
    "Contacts",
    "Folders",
    "Commands",
    "Settings",
    "Drafts",
    "Attachments",
  ];
  return order
    .map((group) => [group, items.filter((item) => item.group === group)] as const)
    .filter(([, groupItems]) => groupItems.length > 0);
}

function commandTypeInitial(type: CommandPaletteItem["type"]) {
  const labels: Record<CommandPaletteItem["type"], string> = {
    attachment: "A",
    command: "C",
    contact: "P",
    draft: "D",
    email: "E",
    folder: "F",
    setting: "S",
  };

  return labels[type];
}
function createComposeId() {
  return `compose-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
function draftHasUnsavedChanges(draft: ComposeDraft) {
  return Boolean(
    draft.to.trim() ||
      draft.cc.trim() ||
      draft.bcc.trim() ||
      draft.subject.trim() ||
      draft.body.trim(),
  );
}
function withSubjectPrefix(subject: string, prefix: "Re:" | "Fwd:") {
  return subject.startsWith(prefix) ? subject : `${prefix} ${subject}`;
}
function getMessages(email: MockEmail): ThreadMessage[] {
  if (email.messages) {
    return email.messages;
  }

  return [
    {
      ...(email.attachments ? { attachments: email.attachments } : {}),
      body: email.body,
      from: email.sender,
      time: email.time,
      to: "Alex Rivera",
    },
  ];
}

function getParticipants(messages: ThreadMessage[]) {
  return Array.from(new Set(messages.flatMap((message) => [message.from, message.to]))).filter(
    (participant) => participant !== "Alex Rivera",
  );
}

function getAttachmentCount(messages: ThreadMessage[]) {
  return messages.reduce((count, message) => count + (message.attachments?.length ?? 0), 0);
}

function senderInitials(sender: string) {
  return sender
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function EmployeeLabelFilters() {
  return (
    <div>
      <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        Labels
      </p>
      <div className="flex flex-wrap gap-2">
        {labels.map((label) => (
          <button
            className="inline-flex items-center gap-2 rounded-xl border border-transparent bg-white/36 px-2.5 py-2 text-sm text-muted-foreground transition hover:border-glass-edge/28 hover:bg-white/72 hover:text-foreground"
            key={label.label}
            type="button"
          >
            <span className={`h-2 w-2 rounded-full ${label.color}`} />
            {label.label}
          </button>
        ))}
      </div>
    </div>
  );
}