import {
  AirplaneTilt,
  Archive,
  ArrowsLeftRight,
  Bank,
  Bell,
  WarningCircle,
  Cardholder,
  CreditCard,
  DeviceMobile,
  Scales,
  Database,
  PlugsConnected,
  UserCircle,
  Vault,
  Baby,
  Barbell,
  BookOpen,
  Briefcase,
  CalendarBlank,
  Note,
  Camera,
  Car,
  Code,
  GameController,
  GraduationCap,
  Heart,
  Lightbulb,
  Money,
  MusicNotes,
  PaintBrush,
  PawPrint,
  Rocket,
  ShoppingCart,
  Star,
  UsersThree,
  ChartLineUp,
  ChartPieSlice,
  CheckCircle,
  Coins,
  GearSix,
  HandHeart,
  Kanban,
  ListChecks,
  House,
  Plant,
  ShoppingBagOpen,
  Sparkle,
  Target,
  Wallet,
} from "@phosphor-icons/react/ssr";
import type { GroupIcon } from "@/lib/group-icons";

// The icons a task group can pick (keys stored in the database).
const GROUP_GLYPHS = {
  checklist: ListChecks,
  briefcase: Briefcase,
  graduation: GraduationCap,
  house: House,
  family: UsersThree,
  heart: Heart,
  fitness: Barbell,
  cart: ShoppingCart,
  travel: AirplaneTilt,
  money: Money,
  code: Code,
  design: PaintBrush,
  book: BookOpen,
  rocket: Rocket,
  idea: Lightbulb,
  calendar: CalendarBlank,
  car: Car,
  baby: Baby,
  pet: PawPrint,
  plant: Plant,
  music: MusicNotes,
  camera: Camera,
  game: GameController,
  star: Star,
} satisfies Record<GroupIcon, unknown>;

// Line icons in a soft circle; `active` fills the circle in deep indigo, and
// `color` tints it (task groups). Referenced by name so server components can
// hand them to client components.
const ICONS = {
  ...GROUP_GLYPHS,
  overview: House,
  tasks: CheckCircle,
  list: ListChecks,
  board: Kanban,
  finance: Wallet,
  summary: ChartPieSlice,
  analytics: ChartLineUp,
  income: Coins,
  expense: ShoppingBagOpen,
  investment: Plant,
  donation: HandHeart,
  savings: Vault,
  notes: Note,
  archive: Archive,
  trackers: Target,
  settings: GearSix,
  profile: UserCircle,
  wallets: Cardholder,
  bell: Bell,
  overdue: WarningCircle,
  bank: Bank,
  mobile: DeviceMobile,
  card: CreditCard,
  transfer: ArrowsLeftRight,
  adjust: Scales,
  data: Database,
  mcp: PlugsConnected,
  sparkle: Sparkle,
} as const;

export type IconName = keyof typeof ICONS;

export function AppIcon({ name, size = 32, active = false, color }: { name: IconName; size?: number; active?: boolean; color?: string }) {
  const Icon = ICONS[name];
  const tint = color && !active ? { background: `color-mix(in oklab, ${color} 16%, var(--surface))`, color, borderColor: "transparent" } : {};
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full border transition ${
        active ? "border-black/20 bg-accent-strong text-white shadow-md shadow-accent-strong/30" : "border-rule bg-surface-2 text-accent-text"
      }`}
      style={{ width: size, height: size, ...tint }}
    >
      <Icon weight={active ? "fill" : "regular"} size={Math.round(size * 0.52)} />
    </span>
  );
}

// The bare glyph, for places that draw their own circle (the nav rail).
AppIcon.Glyph = function Glyph({ name, size, weight }: { name: IconName; size: number; weight: "regular" | "fill" }) {
  const Icon = ICONS[name];
  return <Icon size={size} weight={weight} />;
};
