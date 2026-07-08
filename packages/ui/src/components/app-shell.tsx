"use client";

import * as React from "react";
import {
  Activity,
  Archive,
  BarChart3,
  Bell,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock3,
  Command,
  ContactRound,
  CreditCard,
  DatabaseZap,
  Edit3,
  FileText,
  Files,
  Globe2,
  HeartPulse,
  Inbox,
  LayoutGrid,
  LifeBuoy,
  Mailbox,
  MailPlus,
  Moon,
  Search,
  Send,
  Server,
  Settings,
  ShieldAlert,
  Sparkles,
  Star,
  Tickets,
  Trash2,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";

import { cn } from "../lib/cn";
import { GlassButton } from "./glass-button";
import { GlassCard } from "./glass-card";
import { GlassInput } from "./glass-input";
import { GradientBackground } from "./gradient-background";

export type ShellIcon = React.ComponentType<React.SVGProps<SVGSVGElement>>;

export type ShellIconKey =
  | "activity"
  | "analytics"
  | "archive"
  | "billing"
  | "calendar"
  | "checkServers"
  | "clock"
  | "compose"
  | "contacts"
  | "customers"
  | "database"
  | "domains"
  | "drafts"
  | "files"
  | "globe"
  | "health"
  | "inbox"
  | "inviteUser"
  | "less"
  | "logs"
  | "mailboxes"
  | "more"
  | "reply"
  | "search"
  | "sent"
  | "server"
  | "settings"
  | "spam"
  | "starred"
  | "support"
  | "tickets"
  | "trash"
  | "workspaces";

export type ShellNavItem = {
  label: string;
  iconKey: ShellIconKey;
  active?: boolean;
  badge?: string;
  onClick?: () => void;
};

export type QuickAction = {
  label: string;
  iconKey: ShellIconKey;
  onClick?: () => void;
};

export type AppShellProps = React.HTMLAttributes<HTMLDivElement> & {
  workspace?: string | undefined;
  workspaceLabel?: string | undefined;
  userName?: string | undefined;
  userEmail?: string | undefined;
  currentSection?: string;
  sidebarExpanded?: boolean;
  navigation?: ShellNavItem[] | undefined;
  quickActions?: QuickAction[] | undefined;
  quickActionsFooter?: React.ReactNode;
  quickActionsMode?: "panel" | "floating";
  searchPlaceholder?: string | undefined;
  shellTitle?: string | undefined;
  shellDescription?: string | undefined;
};

const shellIconMap: Record<ShellIconKey, ShellIcon> = {
  activity: Activity,
  analytics: BarChart3,
  archive: Archive,
  billing: CreditCard,
  calendar: CalendarDays,
  checkServers: Server,
  clock: Clock3,
  compose: MailPlus,
  contacts: ContactRound,
  customers: UsersRound,
  database: DatabaseZap,
  domains: LayoutGrid,
  drafts: Edit3,
  files: Files,
  globe: Globe2,
  health: HeartPulse,
  inbox: Inbox,
  inviteUser: UserRound,
  less: ChevronUp,
  logs: FileText,
  mailboxes: Mailbox,
  more: ChevronDown,
  reply: Send,
  search: Search,
  sent: Send,
  server: Server,
  settings: Settings,
  spam: ShieldAlert,
  starred: Star,
  support: LifeBuoy,
  tickets: Tickets,
  trash: Trash2,
  workspaces: DatabaseZap,
};

const defaultNavItems: ShellNavItem[] = [
  { label: "Inbox", iconKey: "inbox", active: true, badge: "12" },
  { label: "Domains", iconKey: "domains" },
  { label: "Mailboxes", iconKey: "mailboxes" },
  { label: "Contacts", iconKey: "customers" },
  { label: "Calendar", iconKey: "calendar" },
  { label: "Files", iconKey: "files" },
  { label: "Billing", iconKey: "billing" },
  { label: "Analytics", iconKey: "analytics" },
  { label: "Settings", iconKey: "settings" },
];

const defaultQuickActions: QuickAction[] = [
  { label: "Compose", iconKey: "activity" },
  { label: "Add domain", iconKey: "domains" },
  { label: "Invite user", iconKey: "inviteUser" },
];

export function StatusIndicator({
  className,
  label = "Operational",
  tone = "success",
}: {
  className?: string;
  label?: string;
  tone?: "success" | "warning" | "neutral";
}) {
  const toneClassName = {
    neutral: "bg-sky-400 shadow-sky-300/50",
    success: "bg-emerald-400 shadow-emerald-300/50",
    warning: "bg-amber-400 shadow-amber-300/50",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-glass-edge/28 bg-white/60 px-2.5 py-1 text-xs font-medium text-muted-foreground shadow-glass-soft backdrop-blur-glass",
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full shadow-[0_0_16px]", toneClassName[tone])} />
      {label}
    </span>
  );
}

export function GlassDivider({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "h-px w-full bg-gradient-to-r from-transparent via-sky-300/34 to-transparent",
        className,
      )}
      {...props}
    />
  );
}

export function FloatingSearch({
  className,
  placeholder = "Search mail, people, domains...",
}: {
  className?: string;
  placeholder?: string | undefined;
}) {
  return (
    <div className={cn("relative w-full max-w-xl", className)}>
      <Search
        className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
        aria-hidden="true"
      />
      <GlassInput
        className="h-11 rounded-full border-glass-edge/32 bg-white/66 pl-10 pr-24 shadow-glass-soft"
        aria-label="Global search"
        placeholder={placeholder}
      />
      <div className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 items-center gap-1 rounded-full border border-glass-edge/24 bg-white/72 px-2 py-1 text-[11px] text-slate-500 shadow-inner-glass sm:flex">
        <Command className="h-3 w-3" aria-hidden="true" />K
      </div>
    </div>
  );
}

export function NotificationCenter({ className }: { className?: string }) {
  return (
    <GlassButton
      className={cn("relative rounded-full bg-white/66", className)}
      size="icon"
      variant="glass"
      aria-label="Open notifications"
    >
      <Bell className="h-4 w-4" aria-hidden="true" />
      <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-sky-400 shadow-[0_0_14px_rgba(14,165,233,0.38)]" />
    </GlassButton>
  );
}

export function UserProfileDropdown({
  className,
  userEmail = "founder@jposta.com",
  userName = "JPosta",
}: {
  className?: string;
  userEmail?: string | undefined;
  userName?: string | undefined;
}) {
  const initials = userName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <button
      className={cn(
        "group inline-flex h-11 items-center gap-3 rounded-full border border-glass-edge/28 bg-white/66 px-2.5 pr-4 text-left shadow-glass-soft backdrop-blur-glass transition hover:-translate-y-0.5 hover:border-glass-edge/44 hover:bg-white/82",
        className,
      )}
      type="button"
    >
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-sky-200 to-violet-200 text-xs font-semibold text-slate-700 shadow-inner-glass">
        {initials || "JP"}
      </span>
      <span className="hidden min-w-0 lg:block">
        <span className="block truncate text-xs font-semibold text-foreground">{userName}</span>
        <span className="block truncate text-[11px] text-muted-foreground">{userEmail}</span>
      </span>
    </button>
  );
}

export function QuickActionsPalette({
  actions = defaultQuickActions,
  className,
  footer,
}: {
  actions?: QuickAction[] | undefined;
  className?: string;
  footer?: React.ReactNode;
}) {
  return (
    <GlassCard className={cn("hidden w-72 p-3 xl:block", className)} intensity="soft">
      <div className="mb-3 flex items-center justify-between px-1">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Quick actions
        </p>
        <Sparkles className="h-3.5 w-3.5 text-sky-500/80" aria-hidden="true" />
      </div>
      <div className="grid gap-2">
        {actions.map((action) => {
          const Icon = shellIconMap[action.iconKey];

          return (
            <button
              className="group flex items-center gap-3 rounded-control border border-transparent px-3 py-2.5 text-left text-sm text-muted-foreground transition hover:border-glass-edge/28 hover:bg-white/72 hover:text-foreground"
              key={action.label}
              type="button"
              onClick={action.onClick}
            >
              <Icon className="h-4 w-4 text-sky-600/75" aria-hidden="true" />
              <span>{action.label}</span>
            </button>
          );
        })}
      </div>
      {footer ? (
        <>
          <GlassDivider className="my-3" />
          {footer}
        </>
      ) : null}
    </GlassCard>
  );
}

export function Sidebar({
  brandDescription = "Mail command",
  brandLabel = "JPosta",
  className,
  expanded = false,
  items = defaultNavItems,
}: {
  brandDescription?: string | undefined;
  brandLabel?: string | undefined;
  className?: string;
  expanded?: boolean;
  items?: ShellNavItem[];
}) {
  return (
    <aside
      className={cn(
        "group/sidebar fixed bottom-4 left-4 top-4 z-30 hidden flex-col rounded-[1.75rem] border border-glass-edge/32 bg-white/58 p-3 shadow-glass backdrop-blur-glass-strong transition-all duration-300 lg:flex",
        expanded ? "w-64" : "w-[5.5rem] hover:w-64",
        className,
      )}
    >
      <div className="flex items-center gap-3 px-2 py-2">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-sky-200/65 bg-sky-50/72 shadow-inner-glass">
          <MailIcon />
        </div>
        <div
          className={cn(
            "min-w-0 transition-opacity duration-200",
            expanded ? "opacity-100" : "opacity-0 group-hover/sidebar:opacity-100",
          )}
        >
          <p className="truncate text-sm font-semibold text-foreground">{brandLabel}</p>
          <p className="truncate text-xs text-muted-foreground">{brandDescription}</p>
        </div>
        <ChevronLeft
          className={cn(
            "ml-auto hidden h-4 w-4 text-muted-foreground transition-opacity group-hover/sidebar:block",
            expanded ? "block" : "opacity-0 group-hover/sidebar:opacity-100",
          )}
          aria-hidden="true"
        />
      </div>
      <GlassDivider className="my-3" />
      <nav className="grid gap-1.5">
        {items.map((item) => {
          const Icon = shellIconMap[item.iconKey];

          return (
            <button
              className={cn(
                "group/item flex h-11 items-center gap-3 rounded-2xl px-3 text-sm transition",
                item.active
                  ? "border border-sky-200/72 bg-sky-100/70 text-sky-800 shadow-inner-glass"
                  : "text-muted-foreground hover:bg-white/72 hover:text-foreground",
              )}
              key={item.label}
              type="button"
              aria-label={item.label}
              onClick={item.onClick}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
              <span
                className={cn(
                  "truncate transition-opacity duration-200",
                  expanded ? "opacity-100" : "opacity-0 group-hover/sidebar:opacity-100",
                )}
              >
                {item.label}
              </span>
              {item.badge ? (
                <span
                  className={cn(
                    "ml-auto rounded-full bg-white/66 px-2 py-0.5 text-[11px] text-sky-700 transition-opacity",
                    expanded ? "opacity-100" : "opacity-0 group-hover/sidebar:opacity-100",
                  )}
                >
                  {item.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>
      <div className="mt-auto">
        <GlassDivider className="my-3" />
        <StatusIndicator
          className={cn(
            "w-full justify-center transition-all duration-200",
            expanded ? "px-2.5" : "px-0 group-hover/sidebar:px-2.5",
          )}
          label={expanded ? "All systems calm" : ""}
        />
      </div>
    </aside>
  );
}

export function TopBar({
  className,
  searchPlaceholder,
  userEmail,
  userName,
  workspace = "Acme Studio",
  workspaceLabel = "Workspace",
}: {
  className?: string;
  searchPlaceholder?: string | undefined;
  workspace?: string | undefined;
  workspaceLabel?: string | undefined;
  userEmail?: string | undefined;
  userName?: string | undefined;
}) {
  return (
    <header
      className={cn(
        "sticky top-4 z-20 flex min-h-16 items-center gap-3 rounded-[1.5rem] border border-glass-edge/28 bg-white/64 px-3 shadow-glass-soft backdrop-blur-glass-strong sm:px-4",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="hidden h-9 w-9 items-center justify-center rounded-full border border-glass-edge/28 bg-white/70 shadow-inner-glass md:flex">
          <Activity className="h-4 w-4 text-sky-600" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">{workspaceLabel}</p>
          <p className="truncate text-sm font-semibold text-foreground">{workspace}</p>
        </div>
      </div>
      <FloatingSearch className="mx-auto hidden md:block" placeholder={searchPlaceholder} />
      <div className="ml-auto flex items-center gap-2">
        <GlassButton
          className="rounded-full bg-white/66"
          size="icon"
          variant="glass"
          aria-label="Theme placeholder"
        >
          <Moon className="h-4 w-4" aria-hidden="true" />
        </GlassButton>
        <NotificationCenter />
        <UserProfileDropdown userEmail={userEmail} userName={userName} />
      </div>
    </header>
  );
}

export function AppShell({
  children,
  className,
  currentSection = "Inbox",
  navigation,
  quickActions,
  quickActionsFooter,
  quickActionsMode = "panel",
  searchPlaceholder,
  shellDescription = "Mail command",
  shellTitle = "JPosta",
  sidebarExpanded = false,
  userEmail,
  userName,
  workspace,
  workspaceLabel,
  ...props
}: AppShellProps) {
  const [quickActionsOpen, setQuickActionsOpen] = React.useState(false);
  const navItems = (navigation ?? defaultNavItems).map((item) => ({
    ...item,
    active: item.active ?? item.label === currentSection,
  }));

  return (
    <GradientBackground className="min-h-dvh">
      <Sidebar
        brandDescription={shellDescription}
        brandLabel={shellTitle}
        expanded={sidebarExpanded}
        items={navItems}
      />
      <div className="flex min-h-dvh flex-col px-4 pb-4 pt-4 lg:pl-[7.5rem]">
        <TopBar
          searchPlaceholder={searchPlaceholder}
          userEmail={userEmail}
          userName={userName}
          workspace={workspace}
          workspaceLabel={workspaceLabel}
        />
        <div className="mt-4 md:hidden">
          <FloatingSearch placeholder={searchPlaceholder} />
        </div>
        <main
          className={cn(
            "grid flex-1 gap-4 pt-4",
            quickActionsMode === "panel" ? "xl:grid-cols-[minmax(0,1fr)_18rem]" : "",
            expandedContentOffset(sidebarExpanded),
            className,
          )}
          {...props}
        >
          <section className="min-w-0 rounded-[2rem] border border-glass-edge/28 bg-white/42 p-4 shadow-glass backdrop-blur-glass sm:p-6 lg:p-8">
            {children}
          </section>
          {quickActionsMode === "panel" ? (
            <QuickActionsPalette actions={quickActions} footer={quickActionsFooter} />
          ) : null}
        </main>
      </div>
      {quickActionsMode === "floating" ? (
        <FloatingQuickActions
          actions={quickActions}
          footer={quickActionsFooter}
          open={quickActionsOpen}
          onOpenChange={setQuickActionsOpen}
        />
      ) : null}
      <MobileDock items={navItems.slice(0, 5)} />
    </GradientBackground>
  );
}

function FloatingQuickActions({
  actions,
  footer,
  onOpenChange,
  open,
}: {
  actions?: QuickAction[] | undefined;
  footer?: React.ReactNode;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  return (
    <div className="fixed bottom-20 right-4 z-50 lg:bottom-6 lg:right-6">
      {open ? (
        <div className="mb-3 w-[min(22rem,calc(100vw-2rem))] rounded-[1.75rem] border border-glass-edge/32 bg-white/72 p-2 shadow-glass backdrop-blur-glass-strong">
          <div className="mb-2 flex items-center justify-between px-2 pt-1">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Quick actions
            </p>
            <GlassButton
              size="icon"
              variant="glass"
              aria-label="Close quick actions"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </GlassButton>
          </div>
          <QuickActionsPalette
            actions={actions}
            className="block w-full border-0 bg-transparent p-1 shadow-none"
            footer={footer}
          />
        </div>
      ) : null}
      <GlassButton
        className="ml-auto flex rounded-full bg-white/76 shadow-glass"
        size="icon"
        variant="primary"
        aria-label="Open quick actions"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
      >
        <Sparkles className="h-4 w-4" aria-hidden="true" />
      </GlassButton>
    </div>
  );
}

function MobileDock({ items }: { items: ShellNavItem[] }) {
  return (
    <nav className="fixed bottom-4 left-4 right-4 z-40 flex justify-between rounded-[1.5rem] border border-glass-edge/30 bg-white/74 p-2 shadow-glass backdrop-blur-glass-strong lg:hidden">
      {items.map((item) => {
        const Icon = shellIconMap[item.iconKey];

        return (
          <button
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-2xl transition",
              item.active
                ? "bg-sky-100/78 text-sky-800"
                : "text-muted-foreground hover:bg-white/76",
            )}
            key={item.label}
            type="button"
            aria-label={item.label}
            onClick={item.onClick}
          >
            <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
          </button>
        );
      })}
      <button
        className="flex h-11 w-11 items-center justify-center rounded-2xl text-muted-foreground hover:bg-white/76"
        type="button"
        aria-label="More navigation"
      >
        <ChevronRight className="h-[18px] w-[18px]" aria-hidden="true" />
      </button>
    </nav>
  );
}

function MailIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5 text-sky-600"
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M4.75 7.75A2.75 2.75 0 0 1 7.5 5h9a2.75 2.75 0 0 1 2.75 2.75v8.5A2.75 2.75 0 0 1 16.5 19h-9a2.75 2.75 0 0 1-2.75-2.75v-8.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="m6.25 8.25 4.32 3.2a2.4 2.4 0 0 0 2.86 0l4.32-3.2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function expandedContentOffset(expanded: boolean) {
  return expanded ? "lg:pl-44" : "";
}
