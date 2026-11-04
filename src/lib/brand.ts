// PersonalHQ brand: the name and the logo — a white rounded block over a
// coloured rounded square on a dark rounded tile (drawn in a 1024 space; the
// tile spans 64–960). Shared by the in-app Logo (colours follow the theme)
// and the generated app icons (components/IconArt.tsx, fixed colours).
export const APP_NAME = "PersonalHQ";

// The space's heading: its own name, else "<name>'s HQ", else the app name.
export const spaceTitle = (s: { spaceName: string | null; displayName: string | null }) =>
  s.spaceName || (s.displayName ? `${s.displayName}'s HQ` : APP_NAME);

export const BRAND = {
  tile: { x: 64, y: 64, size: 896, r: 208 },
  // fixed colours for the app icon / favicon: the light Liquid Glass look
  // (frosted white-to-ice tile, navy block, blue square)
  tileFrom: "#FFFFFF",
  tileTo: "#D3E1FF",
  tileEdge: "#C3D3F5",
  bowlColor: "#071D55",
  markFrom: "#12A5F5",
  markTo: "#0750F5",
  // upper white form and lower square
  bowl: "M438 258H620C703 258 762 317 762 400C762 483 703 542 620 542H438C404 542 378 516 378 482V318C378 284 404 258 438 258Z",
  square: { x: 280, y: 558, size: 232, r: 54 },
};
