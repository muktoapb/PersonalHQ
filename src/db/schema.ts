import { sql } from "drizzle-orm";
import { index, integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { GROUP_ICONS } from "@/lib/group-icons";

// Money is stored as integer minor units (cents) so sums never drift.
// Dates are ISO strings: calendar dates "YYYY-MM-DD", timestamps full ISO.

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());
const createdAt = () =>
  text("created_at")
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`);

// One install = one person. A single row (id = 1), created by the setup screen.
export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey(),
  displayName: text("display_name"),
  // The heading in the sidebar / top bar; empty means "<name>'s HQ".
  spaceName: text("space_name"),
  currency: text("currency").notNull().default("USD"),
  // Shown instead of the currency code when set (e.g. "৳" for BDT).
  currencySymbol: text("currency_symbol"),
  locale: text("locale").notNull().default("en-US"),
  // Sign-in name (lowercase). Null only on installs made before usernames;
  // they're asked to pick one (and save a recovery key) after signing in.
  username: text("username"),
  passwordHash: text("password_hash").notNull(),
  // Hash of the one-time-shown recovery key that resets a forgotten password.
  recoveryHash: text("recovery_hash"),
  sessionSecret: text("session_secret").notNull(),
  pinHash: text("pin_hash"),
  manageDonation: integer("manage_donation", { mode: "boolean" }).notNull().default(true),
  manageInvestment: integer("manage_investment", { mode: "boolean" }).notNull().default(true),
  mcpTokenHash: text("mcp_token_hash"),
  // First day of the week for weekly tracker periods/streaks: 0 Sun, 1 Mon, 6 Sat.
  weekStart: integer("week_start").notNull().default(1),
  createdAt: createdAt(),
});

// Failed sign-in / recovery attempts per client address, for lockouts.
export const loginAttempts = sqliteTable("login_attempts", {
  key: text("key").primaryKey(),
  failures: integer("failures").notNull().default(0),
  lockedUntil: integer("locked_until").notNull().default(0), // epoch ms
  updatedAt: integer("updated_at").notNull().default(0), // epoch ms
});

// AI apps connected over OAuth (MCP). Clients register themselves; nothing
// gets access until the owner approves with their password. Only hashes of
// secrets, codes and tokens are stored.
export const oauthClients = sqliteTable("oauth_clients", {
  id: id(), // the client_id
  name: text("name").notNull(),
  redirectUris: text("redirect_uris", { mode: "json" }).$type<string[]>().notNull(),
  secretHash: text("secret_hash"), // null: a public client (PKCE only)
  approvedAt: text("approved_at"), // first approval; never-approved clients are pruned
  createdAt: createdAt(),
});

export const oauthCodes = sqliteTable("oauth_codes", {
  hash: text("hash").primaryKey(),
  clientId: text("client_id").notNull(),
  redirectUri: text("redirect_uri").notNull(),
  challenge: text("challenge").notNull(), // PKCE S256
  expiresAt: integer("expires_at").notNull(), // epoch ms
});

export const oauthTokens = sqliteTable("oauth_tokens", {
  id: id(),
  clientId: text("client_id").notNull(),
  accessHash: text("access_hash").notNull().unique(),
  accessExpiresAt: integer("access_expires_at").notNull(), // epoch ms
  refreshHash: text("refresh_hash").notNull().unique(),
  refreshExpiresAt: integer("refresh_expires_at").notNull(),
  lastUsedAt: integer("last_used_at"),
  createdAt: createdAt(),
});

export const TRANSACTION_KINDS = ["income", "expense", "investment", "donation"] as const;
export type TransactionKind = (typeof TRANSACTION_KINDS)[number];

export const categories = sqliteTable("categories", {
  id: id(),
  name: text("name").notNull(),
  kind: text("kind", { enum: TRANSACTION_KINDS }).notNull(),
  color: text("color").notNull().default("#6366f1"),
  createdAt: createdAt(),
});

// Where money sits: bank accounts, cash, mobile wallets (bKash…), cards.
// A wallet's balance = openingBalance + income into it − everything paid
// from it ± transfers (core/wallets.ts). Archived wallets keep their history
// but drop out of pickers.
export const WALLET_TYPES = ["bank", "cash", "mobile", "card", "savings", "other"] as const;
export type WalletType = (typeof WALLET_TYPES)[number];
export const wallets = sqliteTable("wallets", {
  id: id(),
  name: text("name").notNull(),
  type: text("type", { enum: WALLET_TYPES }).notNull().default("bank"),
  color: text("color").notNull().default("#7262ea"),
  openingBalance: integer("opening_balance").notNull().default(0), // minor units
  isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
  archived: integer("archived", { mode: "boolean" }).notNull().default(false),
  position: integer("position").notNull().default(0),
  createdAt: createdAt(),
});

export const transactions = sqliteTable(
  "transactions",
  {
    id: id(),
    kind: text("kind", { enum: TRANSACTION_KINDS }).notNull(),
    date: text("date").notNull(),
    amount: integer("amount").notNull(),
    description: text("description"),
    categoryId: text("category_id").references(() => categories.id, { onDelete: "set null" }),
    walletId: text("wallet_id"), // null: not tied to a wallet (e.g. from before wallets)
    createdAt: createdAt(),
    updatedAt: text("updated_at"),
  },
  (t) => [
    index("idx_transactions_kind_date").on(t.kind, t.date),
    index("idx_transactions_date").on(t.date),
    index("idx_transactions_wallet").on(t.walletId),
  ],
);

// Money moved between wallets; not income or spending. With only one side
// set it's a balance adjustment (to: money found; from: money missing). A
// transfer fee is a separate expense from the source wallet (feeTransactionId).
export const walletTransfers = sqliteTable(
  "wallet_transfers",
  {
    id: id(),
    fromWalletId: text("from_wallet_id"),
    toWalletId: text("to_wallet_id"),
    amount: integer("amount").notNull(), // minor units, > 0
    date: text("date").notNull(),
    note: text("note"),
    feeTransactionId: text("fee_transaction_id"),
    createdAt: createdAt(),
  },
  (t) => [index("idx_transfers_from").on(t.fromWalletId), index("idx_transfers_to").on(t.toWalletId)],
);

export type Settings = typeof settings.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type Wallet = typeof wallets.$inferSelect;
export type WalletTransfer = typeof walletTransfers.$inferSelect;

// ---------- tasks ----------
// Groups (Business, Family…) hold tasks and choose how they are shown: a
// checklist or a board. Each group has its own ordered board columns (renamable;
// a column can count as "done"). Tasks can have subtasks (rows with parentId),
// labels, short notes, and a due date with a reminder.
// A task's `status` is its completion flag ("done" iff its column counts as
// done; subtasks just toggle todo/done); `columnId` is its place on the board.
// Child rows are deleted explicitly in core (SQLite only enforces foreign keys
// with PRAGMA foreign_keys on).

export const TASK_STATUSES = ["todo", "doing", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export const LIST_VIEWS = ["list", "board"] as const;
export type ListView = (typeof LIST_VIEWS)[number];

export const taskGroups = sqliteTable("task_groups", {
  id: id(),
  name: text("name").notNull(),
  color: text("color").notNull().default("#7262ea"),
  icon: text("icon", { enum: GROUP_ICONS }).notNull().default("checklist"),
  view: text("view", { enum: LIST_VIEWS }).notNull().default("list"),
  createdAt: createdAt(),
});

export const taskColumns = sqliteTable(
  "task_columns",
  {
    id: id(),
    groupId: text("group_id")
      .notNull()
      .references(() => taskGroups.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    position: integer("position").notNull().default(0),
    done: integer("done", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [index("idx_task_columns_group").on(t.groupId)],
);

export const tasks = sqliteTable(
  "tasks",
  {
    id: id(),
    groupId: text("group_id")
      .notNull()
      .references(() => taskGroups.id, { onDelete: "cascade" }),
    // Set on subtasks: the task they belong to.
    parentId: text("parent_id"),
    // Board column (top-level tasks only).
    columnId: text("column_id"),
    title: text("title").notNull(),
    status: text("status", { enum: TASK_STATUSES }).notNull().default("todo"),
    due: text("due"), // "YYYY-MM-DD"
    dueTime: text("due_time"), // "HH:MM", optional
    // Reminder: minutes before the due moment (0 = at it), and that moment
    // as an absolute instant, computed in the browser so it uses the user's
    // time zone. remindedAt is set once the reminder has been shown.
    remindOffset: integer("remind_offset"),
    remindAt: text("remind_at"),
    remindedAt: text("reminded_at"),
    completedAt: text("completed_at"),
    createdAt: createdAt(),
    updatedAt: text("updated_at"),
  },
  (t) => [
    index("idx_tasks_group").on(t.groupId),
    index("idx_tasks_parent").on(t.parentId),
    index("idx_tasks_due").on(t.due),
    index("idx_tasks_remind").on(t.remindAt),
  ],
);

export const labels = sqliteTable("labels", {
  id: id(),
  name: text("name").notNull(),
  color: text("color").notNull().default("#7262ea"),
  createdAt: createdAt(),
});

export const taskLabels = sqliteTable(
  "task_labels",
  {
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    labelId: text("label_id")
      .notNull()
      .references(() => labels.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.taskId, t.labelId] }), index("idx_task_labels_label").on(t.labelId)],
);

export const taskNotes = sqliteTable(
  "task_notes",
  {
    id: id(),
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("idx_task_notes_task").on(t.taskId)],
);

export type TaskGroup = typeof taskGroups.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type TaskColumn = typeof taskColumns.$inferSelect;
export type TaskNote = typeof taskNotes.$inferSelect;
export type Label = typeof labels.$inferSelect;

// ---------- notes ----------
// Google Keep-style notes: a text body or a checklist, a card colour, pinned
// and archived flags. A note sits in at most one category; deleting a category
// keeps its notes (they become uncategorised).

export const NOTE_COLORS = ["default", "coral", "peach", "sand", "mint", "sage", "fog", "storm", "dusk", "blossom", "clay"] as const;
export type NoteColor = (typeof NOTE_COLORS)[number];
export type NoteItem = { text: string; done: boolean };

export const noteCategories = sqliteTable("note_categories", {
  id: id(),
  name: text("name").notNull(),
  color: text("color").notNull().default("#7262ea"),
  icon: text("icon", { enum: GROUP_ICONS }).notNull().default("star"),
  createdAt: createdAt(),
});

export const notes = sqliteTable(
  "notes",
  {
    id: id(),
    categoryId: text("category_id").references(() => noteCategories.id, { onDelete: "set null" }),
    title: text("title").notNull().default(""),
    body: text("body").notNull().default(""),
    // Set when the note is a checklist (then `body` is unused).
    items: text("items", { mode: "json" }).$type<NoteItem[]>(),
    color: text("color", { enum: NOTE_COLORS }).notNull().default("default"),
    pinned: integer("pinned", { mode: "boolean" }).notNull().default(false),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    // Manual order (lower first), set by dragging. Fractional so a move only
    // rewrites the moved note: it takes the midpoint of its new neighbours.
    position: real("position").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (t) => [index("idx_notes_category").on(t.categoryId), index("idx_notes_updated").on(t.updatedAt)],
);

export type NoteCategory = typeof noteCategories.$inferSelect;
export type Note = typeof notes.$inferSelect;

// ---------- trackers ----------
// Track anything over time. Modes:
// - latest:  readings (weight); progress runs from `start`/first entry to target
// - total:   amounts that add up per period (water per day, petrol per month)
// - average: the average of daily totals per period (sleep, steps, screen time)
// - check:   habits — days checked off (one entry per day), N times per period
// - since:   days since the last reset (each entry is a reset; quit smoking)
// - rating:  mood/ratings 1–5, one per day
// `goal` says whether the target is a minimum or a limit (amounts/averages);
// `quickAdd` adds a one-tap "+N" button for counters.

export const TRACKER_MODES = ["latest", "total", "average", "check", "since", "rating"] as const;
export const TRACKER_GOALS = ["atLeast", "atMost"] as const;
export type TrackerGoal = (typeof TRACKER_GOALS)[number];
export type TrackerMode = (typeof TRACKER_MODES)[number];
export const TRACKER_PERIODS = ["all", "day", "week", "month", "year"] as const;
export type TrackerPeriod = (typeof TRACKER_PERIODS)[number];

export const trackers = sqliteTable("trackers", {
  id: id(),
  name: text("name").notNull(),
  icon: text("icon", { enum: GROUP_ICONS }).notNull().default("star"),
  color: text("color").notNull().default("#7262ea"),
  unit: text("unit").notNull().default(""),
  mode: text("mode", { enum: TRACKER_MODES }).notNull().default("latest"),
  period: text("period", { enum: TRACKER_PERIODS }).notNull().default("all"),
  start: real("start"),
  target: real("target"),
  targetDate: text("target_date"),
  goal: text("goal", { enum: TRACKER_GOALS }).notNull().default("atLeast"),
  quickAdd: real("quick_add"),
  createdAt: createdAt(),
});

export const trackerEntries = sqliteTable(
  "tracker_entries",
  {
    id: id(),
    trackerId: text("tracker_id")
      .notNull()
      .references(() => trackers.id, { onDelete: "cascade" }),
    date: text("date").notNull(), // "YYYY-MM-DD"
    value: real("value").notNull(),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [index("idx_tracker_entries_tracker_date").on(t.trackerId, t.date)],
);

export type Tracker = typeof trackers.$inferSelect;
export type TrackerEntry = typeof trackerEntries.$inferSelect;
