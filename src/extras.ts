import { DEFAULT_FONT_FAMILY, DEFAULT_PALETTE } from "./constants";
import { escapeXml } from "./utils";

const DIAGRAM_COLORS = {
  primary: "#111827",
  secondary: "#475569",
  tertiary: "#94a3b8",
  faint: "#e2e8f0",
  ultraFaint: "#f1f5f9",
  paper: "#fbfdff",
};

const DIAGRAM_TYPE = {
  title: 20,
  body: 13,
  small: 11.5,
};

const DIAGRAM_STROKES = {
  primary: 1.9,
  heavy: 2.3,
  helper: 0.8,
  faint: 0.7,
};

const DIAGRAM_OPACITY = {
  helper: 0.22,
  frame: 0.95,
};

const FORCE_LABEL_CHIP = {
  fill: "rgba(251,253,255,0.9)",
  stroke: "rgba(226,232,240,0.95)",
  shadow: "rgba(148,163,184,0.16)",
  sheen: "rgba(255,255,255,0.72)",
  paddingX: 7,
  paddingY: 4,
  radius: 8,
  leaderInset: 3,
};

function makeSvgShell(width: number, height: number, title: string, body: string) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <style>text { font-family: ${DEFAULT_FONT_FAMILY}; }</style>
  <defs>
    <marker id="forceArrow" markerWidth="4.8" markerHeight="4.8" refX="4.2" refY="2" orient="auto" markerUnits="strokeWidth">
      <path d="M0,0 L0,4 L4.2,2 z" fill="#1f2937" />
    </marker>
    <marker id="resultantArrow" markerWidth="5.4" markerHeight="5.4" refX="4.8" refY="2.2" orient="auto" markerUnits="strokeWidth">
      <path d="M0,0 L0,4.4 L4.8,2.2 z" fill="#111827" />
    </marker>
    <marker id="circuitArrow" markerWidth="5" markerHeight="5" refX="4.4" refY="2.2" orient="auto" markerUnits="strokeWidth">
      <path d="M0,0 L0,4.4 L4.4,2.2 z" fill="#111827" />
    </marker>
  </defs>
  <rect width="100%" height="100%" fill="white"/>
  <text x="24" y="32" font-size="${DIAGRAM_TYPE.title}" font-weight="600" fill="${DIAGRAM_COLORS.primary}">${escapeXml(title)}</text>
  ${body}
</svg>`;
}

function polarPoint(cx: number, cy: number, radius: number, angleDeg: number) {
  const angle = angleDeg * Math.PI / 180;
  return {
    x: cx + Math.cos(angle) * radius,
    y: cy - Math.sin(angle) * radius,
  };
}

function vectorLabelPosition(
  x: number,
  y: number,
  dx: number,
  dy: number,
  index: number,
  groupIndex = 0,
  groupSize = 1,
  radialPadding = 0,
  ringIndex = 0,
  ringCount = 1,
) {
  const length = Math.hypot(dx, dy) || 1;
  const nx = dx / length;
  const ny = dy / length;
  const spread = groupSize > 1 ? 18 : 12;
  const normalDirection = groupIndex - (groupSize - 1) / 2;
  const ringOffset = ringCount > 1 ? (ringIndex - (ringCount - 1) / 2) * 16 : 0;
  const lateralOffset = spread * normalDirection + ringOffset + ((index % 2) === 0 ? 4 : -4);
  const alongOffset = radialPadding + (groupSize > 1 ? 20 : 14) + ringIndex * 10;
  return {
    x: x + dx + nx * alongOffset + (-ny * lateralOffset),
    y: y - dy - ny * alongOffset + (nx * lateralOffset),
  };
}

function vectorLabelAnchor(dx: number, dy: number) {
  if (Math.abs(dx) > Math.abs(dy) * 1.2) return dx >= 0 ? "start" : "end";
  return "middle";
}

function linePoint(x1: number, y1: number, x2: number, y2: number, t: number) {
  return {
    x: x1 + (x2 - x1) * t,
    y: y1 + (y2 - y1) * t,
  };
}

function estimateTextWidth(text: string, fontSize: number, weight = 1) {
  const plain = String(text || "");
  return plain.length * fontSize * (0.56 + (weight - 1) * 0.03);
}

function wrapDiagramText(text: string, maxWidth: number, fontSize: number, bullet = ""): string[] {
  const content = String(text || "").trim();
  if (!content) return bullet ? [bullet] : [];
  const lines: string[] = [];
  const continuation = bullet ? "  " : "";
  let current = bullet;

  const pushCurrent = () => {
    if (current.trim()) lines.push(current.trimEnd());
  };

  Array.from(content).forEach((char) => {
    const next = `${current}${char}`;
    if (current.trim() && estimateTextWidth(next, fontSize) > maxWidth) {
      pushCurrent();
      current = `${continuation}${char.trimStart()}`;
      return;
    }
    current = next;
  });

  pushCurrent();
  return lines;
}

function makeBounds(minX: number, minY: number, maxX: number, maxY: number) {
  return { minX, minY, maxX, maxY };
}

function expandBounds(bounds: { minX: number; minY: number; maxX: number; maxY: number }, padding: number) {
  return makeBounds(bounds.minX - padding, bounds.minY - padding, bounds.maxX + padding, bounds.maxY + padding);
}

function mergeBounds(
  base: { minX: number; minY: number; maxX: number; maxY: number },
  next: { minX: number; minY: number; maxX: number; maxY: number },
) {
  return makeBounds(
    Math.min(base.minX, next.minX),
    Math.min(base.minY, next.minY),
    Math.max(base.maxX, next.maxX),
    Math.max(base.maxY, next.maxY),
  );
}

function normalizeVector(dx: number, dy: number) {
  const length = Math.hypot(dx, dy) || 1;
  return { x: dx / length, y: dy / length };
}

function rotateIntoBodyLocal(dx: number, dy: number, angleDeg: number) {
  const angle = angleDeg * Math.PI / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: dx * cos + dy * sin,
    y: -dx * sin + dy * cos,
  };
}

function bodyContactDistance(body: Record<string, unknown>, direction: { x: number; y: number }) {
  const kind = String(body.kind || "block");
  const unit = normalizeVector(direction.x, direction.y);
  if (kind === "particle" || kind === "pulley") {
    return Number(body.radius || 22);
  }
  const width = Number(body.width || (kind === "support" ? 140 : kind === "hanging_mass" ? 62 : 72));
  const height = Number(body.height || (kind === "support" ? 10 : kind === "hanging_mass" ? 78 : 48));
  const angleDeg = kind === "block" ? Number(body.angle_deg || 0) : 0;
  const local = rotateIntoBodyLocal(unit.x, -unit.y, angleDeg);
  return Math.abs(local.x) * width / 2 + Math.abs(local.y) * height / 2;
}

function surfaceFrame(surface: Record<string, unknown>, side: 1 | -1 = -1) {
  const x1 = Number(surface.x1 || 0);
  const y1 = Number(surface.y1 || 0);
  const x2 = Number(surface.x2 || 0);
  const y2 = Number(surface.y2 || 0);
  const tangent = normalizeVector(x2 - x1, y2 - y1);
  return {
    tangent,
    normal: normalizeVector(-tangent.y * side, tangent.x * side),
  };
}

export function placeBodyOnSurface(
  body: Record<string, unknown>,
  surface: Record<string, unknown>,
  t: number,
  side: 1 | -1 = -1,
  gap = 0,
) {
  const anchor = linePoint(
    Number(surface.x1 || 0),
    Number(surface.y1 || 0),
    Number(surface.x2 || 0),
    Number(surface.y2 || 0),
    Math.max(0, Math.min(1, t)),
  );
  const frame = surfaceFrame(surface, side);
  const distance = bodyContactDistance(body, frame.normal) + gap;
  return {
    x: anchor.x + frame.normal.x * distance,
    y: anchor.y + frame.normal.y * distance,
    tangent: frame.tangent,
    normal: frame.normal,
    distance,
  };
}

function renderForceBody(body: Record<string, unknown>): string {
  const kind = String(body.kind || "block");
  const x = Number(body.x || 320);
  const y = Number(body.y || 260);
  const width = Number(body.width || 72);
  const height = Number(body.height || 48);
  const radius = Number(body.radius || 22);
  const label = escapeXml(String(body.label || "m"));
  const angle = Number(body.angle_deg || 0);
  if (kind === "pulley") {
    return `<g>
      <line x1="${x}" y1="${y - radius - 22}" x2="${x}" y2="${y - radius}" stroke="#475569" stroke-width="1.8" />
      <rect x="${x - 24}" y="${y - radius - 30}" width="48" height="8" rx="3" fill="#e2e8f0" stroke="#94a3b8" stroke-width="0.9" />
      <circle cx="${x}" cy="${y}" r="${radius}" fill="#ffffff" stroke="#111827" stroke-width="2.1" />
      <circle cx="${x}" cy="${y}" r="4" fill="#111827" />
      <text x="${x}" y="${y + radius + 22}" text-anchor="middle" font-size="14" font-weight="600" fill="#111827">${label}</text>
    </g>`;
  }
  if (kind === "hanging_mass") {
    return `<g>
      <line x1="${x}" y1="${y - height / 2 - 24}" x2="${x}" y2="${y - height / 2}" stroke="#475569" stroke-width="1.8" />
      <rect x="${x - 30}" y="${y - height / 2 - 32}" width="60" height="8" rx="3" fill="#e2e8f0" stroke="#94a3b8" stroke-width="0.9" />
      <rect x="${x - width / 2}" y="${y - height / 2}" width="${width}" height="${height}" rx="7" fill="#fbfdff" stroke="#111827" stroke-width="1.9" />
      <text x="${x}" y="${y + 5}" text-anchor="middle" font-size="16" font-weight="600" fill="#111827">${label}</text>
    </g>`;
  }
  if (kind === "support") {
    return `<g>
      <rect x="${x - width / 2}" y="${y - 5}" width="${width}" height="10" rx="4" fill="#e2e8f0" stroke="#94a3b8" stroke-width="0.9" />
      <line x1="${x - width / 2 + 8}" y1="${y + 6}" x2="${x - width / 2 + 16}" y2="${y + 16}" stroke="#cbd5e1" stroke-width="1" />
      <line x1="${x}" y1="${y + 6}" x2="${x + 8}" y2="${y + 16}" stroke="#cbd5e1" stroke-width="1" />
      <line x1="${x + width / 2 - 16}" y1="${y + 6}" x2="${x + width / 2 - 8}" y2="${y + 16}" stroke="#cbd5e1" stroke-width="1" />
    </g>`;
  }
  if (kind === "particle") {
    return `<g>
      <circle cx="${x}" cy="${y}" r="${radius}" fill="#fbfdff" stroke="#111827" stroke-width="1.8" />
      <circle cx="${x}" cy="${y}" r="${Math.max(4, radius * 0.18)}" fill="#e2e8f0" stroke="#cbd5e1" stroke-width="0.8" />
      <text x="${x}" y="${y + 5}" text-anchor="middle" font-size="16" font-weight="600" fill="#111827">${label}</text>
    </g>`;
  }
  return `<g transform="translate(${x} ${y}) rotate(${-angle})">
    <rect x="${-width / 2}" y="${-height / 2}" width="${width}" height="${height}" rx="5" fill="#fbfdff" stroke="#111827" stroke-width="1.9" />
    <rect x="${-width / 2 + 7}" y="${-height / 2 + 7}" width="${Math.max(14, width - 14)}" height="${Math.max(14, height - 14)}" rx="4" fill="#ffffff" stroke="#e2e8f0" stroke-width="0.9" />
    <text x="0" y="5" text-anchor="middle" font-size="16" font-weight="600" fill="#111827" transform="rotate(${angle})">${label}</text>
  </g>`;
}

function renderForceSurface(surface: Record<string, unknown>): string {
  const kind = String(surface.kind || "ground");
  const x1 = Number(surface.x1 || 80);
  const y1 = Number(surface.y1 || 340);
  const x2 = Number(surface.x2 || 560);
  const y2 = Number(surface.y2 || 340);
  const label = escapeXml(String(surface.label || ""));
  const parts: string[] = [];
  if (kind === "ground" || kind === "incline") {
    parts.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${DIAGRAM_COLORS.secondary}" stroke-width="${DIAGRAM_STROKES.heavy}" stroke-linecap="round" />`);
    for (let i = 0; i < 9; i += 1) {
      const p = linePoint(x1, y1, x2, y2, i / 8);
      parts.push(`<line x1="${p.x}" y1="${p.y}" x2="${p.x - 8}" y2="${p.y + 10}" stroke="${DIAGRAM_COLORS.faint}" stroke-width="${DIAGRAM_STROKES.helper}" />`);
    }
  } else if (kind === "wall") {
    parts.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${DIAGRAM_COLORS.secondary}" stroke-width="${DIAGRAM_STROKES.heavy}" stroke-linecap="round" />`);
    for (let i = 0; i < 8; i += 1) {
      const p = linePoint(x1, y1, x2, y2, i / 7);
      parts.push(`<line x1="${p.x}" y1="${p.y}" x2="${p.x + 10}" y2="${p.y + 8}" stroke="${DIAGRAM_COLORS.faint}" stroke-width="${DIAGRAM_STROKES.helper}" />`);
    }
  } else if (kind === "ceiling") {
    parts.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${DIAGRAM_COLORS.secondary}" stroke-width="${DIAGRAM_STROKES.heavy}" stroke-linecap="round" />`);
    for (let i = 0; i < 8; i += 1) {
      const p = linePoint(x1, y1, x2, y2, i / 7);
      parts.push(`<line x1="${p.x}" y1="${p.y}" x2="${p.x - 8}" y2="${p.y - 8}" stroke="${DIAGRAM_COLORS.faint}" stroke-width="${DIAGRAM_STROKES.helper}" />`);
    }
  } else {
    parts.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${DIAGRAM_COLORS.secondary}" stroke-width="${DIAGRAM_STROKES.primary}" stroke-linecap="round" />`);
  }
  if (label) {
    parts.push(`<text x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2 - 10}" text-anchor="middle" font-size="${DIAGRAM_TYPE.small}" font-weight="600" fill="${DIAGRAM_COLORS.secondary}">${label}</text>`);
  }
  return parts.join("\n");
}

function renderForceConnector(connector: Record<string, unknown>): string {
  const kind = String(connector.kind || "rope");
  const x1 = Number(connector.x1 || 0);
  const y1 = Number(connector.y1 || 0);
  const x2 = Number(connector.x2 || 0);
  const y2 = Number(connector.y2 || 0);
  const label = escapeXml(String(connector.label || ""));
  if (kind === "spring") {
    const turns = 7;
    const dx = (x2 - x1) / (turns * 2 + 2);
    const dy = (y2 - y1) / (turns * 2 + 2);
    let path = `M ${x1} ${y1} `;
    for (let i = 1; i <= turns * 2; i += 1) {
      const px = x1 + dx * i;
      const py = y1 + dy * i + (i % 2 === 0 ? -8 : 8);
      path += `L ${px} ${py} `;
    }
    path += `L ${x2} ${y2}`;
    return `<path d="${path}" fill="none" stroke="${DIAGRAM_COLORS.secondary}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />${label ? `<text x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2 - 14}" text-anchor="middle" font-size="${DIAGRAM_TYPE.small}" font-weight="600" fill="${DIAGRAM_COLORS.secondary}">${label}</text>` : ""}`;
  }
  if (kind === "rope") {
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${DIAGRAM_COLORS.secondary}" stroke-width="2.2" stroke-linecap="round" />${label ? `<text x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2 - 10}" text-anchor="middle" font-size="${DIAGRAM_TYPE.small}" font-weight="600" fill="${DIAGRAM_COLORS.secondary}">${label}</text>` : ""}`;
  }
  return `<path d="M ${x1} ${y1} Q ${(x1 + x2) / 2} ${Math.min(y1, y2) - 22} ${x2} ${y2}" fill="none" stroke="${DIAGRAM_COLORS.secondary}" stroke-width="1.8" stroke-linecap="round" />${label ? `<text x="${(x1 + x2) / 2}" y="${Math.min(y1, y2) - 16}" text-anchor="middle" font-size="${DIAGRAM_TYPE.small}" font-weight="600" fill="${DIAGRAM_COLORS.secondary}">${label}</text>` : ""}`;
}

type AngleAnnotationOptions = {
  stroke?: string;
  textColor?: string;
  textSize?: number;
};

function renderAngleAnnotation(cx: number, cy: number, startDeg: number, endDeg: number, radius: number, label: string, options: AngleAnnotationOptions = {}) {
  const start = polarPoint(cx, cy, radius, startDeg);
  const end = polarPoint(cx, cy, radius, endDeg);
  const delta = ((endDeg - startDeg) % 360 + 360) % 360;
  const effectiveDelta = delta > 180 ? 360 - delta : delta;
  const largeArc = delta > 180 ? 1 : 0;
  const sweep = delta <= 180 ? 0 : 1;
  const midDeg = startDeg + delta / 2;
  const labelPoint = polarPoint(cx, cy, radius + (effectiveDelta < 20 ? 20 : 14), midDeg);
  const stroke = escapeXml(options.stroke || DIAGRAM_COLORS.secondary);
  const textColor = escapeXml(options.textColor || stroke);
  const textSize = Math.max(10, Number(options.textSize || 12));
  const strokeOpacity = effectiveDelta < 20 ? 0.72 : 0.9;
  return `<path d="M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} ${sweep} ${end.x} ${end.y}" fill="none" stroke="${stroke}" stroke-width="1.2" opacity="${strokeOpacity}" />
  <text x="${labelPoint.x}" y="${labelPoint.y}" text-anchor="middle" font-size="${textSize}" font-weight="600" fill="${textColor}">${escapeXml(label)}</text>`;
}

function vectorLengthScale(magnitude: number, maxMagnitude: number) {
  const ratio = maxMagnitude <= 0 ? 1 : Math.max(0, Math.min(1, magnitude / maxMagnitude));
  return 54 + ratio * 46;
}

type ForceGroupMeta = {
  groupIndex: number;
  groupSize: number;
  startX: number;
  startY: number;
  dx: number;
  dy: number;
  rawLabel: string;
  labelX: number;
  labelY: number;
  labelText: string;
  labelAnchor: "start" | "middle" | "end";
  color: string;
  side: "left" | "right" | "center";
  endX: number;
  endY: number;
  connectorLane: number;
  columnBoundShift: number;
};

function compactForceLabelText(text: string, maxWidth: number) {
  const plain = String(text || "").trim();
  if (!plain) return "";
  if (estimateTextWidth(plain, DIAGRAM_TYPE.body, 1.1) <= maxWidth) return plain;
  let compact = plain;
  while (compact.length > 1 && estimateTextWidth(`${compact}…`, DIAGRAM_TYPE.body, 1.1) > maxWidth) {
    compact = compact.slice(0, -1).trimEnd();
  }
  return `${compact || plain[0]}…`;
}

function forceLabelMaxWidth(side: ForceGroupMeta["side"]) {
  if (side === "left") return 88;
  if (side === "right") return 96;
  return 84;
}

function forceLabelChipPadding(item: Pick<ForceGroupMeta, "side">) {
  if (item.side === "left") return { left: 6, right: 9, top: 4, bottom: 4 };
  if (item.side === "right") return { left: 9, right: 6, top: 4, bottom: 4 };
  return { left: 7, right: 7, top: 4, bottom: 4 };
}

function forceLabelChipRect(item: ForceGroupMeta) {
  const padding = forceLabelChipPadding(item);
  const textWidth = estimateTextWidth(item.labelText, DIAGRAM_TYPE.body, 1.1);
  const width = textWidth + padding.left + padding.right;
  const height = DIAGRAM_TYPE.body + padding.top + padding.bottom;
  const anchorX = item.labelAnchor === "start"
    ? item.labelX - padding.left
    : item.labelAnchor === "end"
      ? item.labelX - textWidth - padding.right
      : item.labelX - width / 2;
  const x = anchorX;
  const y = item.labelY - DIAGRAM_TYPE.body + 1 - padding.top;
  return { x, y, width, height };
}

function forceLabelLeaderAnchor(item: ForceGroupMeta) {
  const rect = forceLabelChipRect(item);
  const centerY = rect.y + rect.height / 2;
  if (item.labelAnchor === "start") {
    return { x: rect.x - FORCE_LABEL_CHIP.leaderInset, y: centerY };
  }
  if (item.labelAnchor === "end") {
    return { x: rect.x + rect.width + FORCE_LABEL_CHIP.leaderInset, y: centerY };
  }
  const dx = item.endX - item.labelX;
  const dy = item.endY - item.labelY;
  if (item.side === "center") {
    const prefersTopExit = dy < 0;
    return {
      x: rect.x + rect.width / 2,
      y: prefersTopExit ? rect.y - FORCE_LABEL_CHIP.leaderInset : rect.y + rect.height + FORCE_LABEL_CHIP.leaderInset,
    };
  }
  if (Math.abs(dx) >= Math.abs(dy)) {
    return {
      x: dx >= 0 ? rect.x + rect.width + FORCE_LABEL_CHIP.leaderInset : rect.x - FORCE_LABEL_CHIP.leaderInset,
      y: centerY,
    };
  }
  return {
    x: rect.x + rect.width / 2,
    y: dy >= 0 ? rect.y + rect.height + FORCE_LABEL_CHIP.leaderInset : rect.y - FORCE_LABEL_CHIP.leaderInset,
  };
}

function renderForceLabelChip(item: ForceGroupMeta) {
  const rect = forceLabelChipRect(item);
  const innerWidth = Math.max(10, rect.width - 4);
  const innerHeight = Math.max(8, Math.min(rect.height - 7, rect.height * 0.42));
  const widthTightness = Math.max(0, Math.min(1, (rect.width - 54) / 46));
  const shadowOffsetX = (item.side === "left" ? -1.2 : item.side === "right" ? 1.8 : 0.8) + widthTightness * 0.5;
  const shadowOffsetY = (item.side === "center" ? 2.4 : 1.8) + widthTightness * 0.35;
  const sheenOffsetX = (item.side === "left" ? 1.2 : item.side === "right" ? 2.8 : 1.8) + widthTightness * 0.3;
  const sheenOffsetY = (item.side === "center" ? 1.1 : 1.5) + widthTightness * 0.15;
  const sheenInset = 2 + widthTightness * 1.4;
  const sheenWidth = Math.max(9, innerWidth - (item.side === "center" ? 6 : item.side === "left" ? 8 : 2) - widthTightness * 4);
  const sheenHeight = Math.max(7, innerHeight - (item.side === "center" ? 1 : 0) - widthTightness * 0.8);
  const sheenRadius = Math.max(4, FORCE_LABEL_CHIP.radius - 3 - widthTightness * 0.6);
  return [
    `<rect x="${rect.x + shadowOffsetX}" y="${rect.y + shadowOffsetY}" width="${rect.width}" height="${rect.height}" rx="${FORCE_LABEL_CHIP.radius}" fill="${FORCE_LABEL_CHIP.shadow}" opacity="0.9" />`,
    `<rect x="${rect.x}" y="${rect.y}" width="${rect.width}" height="${rect.height}" rx="${FORCE_LABEL_CHIP.radius}" fill="${FORCE_LABEL_CHIP.fill}" stroke="${FORCE_LABEL_CHIP.stroke}" stroke-width="0.9" />`,
    `<rect x="${rect.x + sheenOffsetX + sheenInset * 0.15}" y="${rect.y + sheenOffsetY}" width="${sheenWidth}" height="${sheenHeight}" rx="${sheenRadius}" fill="${FORCE_LABEL_CHIP.sheen}" opacity="0.85" />`,
  ].join("");
}

function renderForceLabelConnector(item: ForceGroupMeta, anchorX: number, anchorY: number) {
  const rect = forceLabelChipRect(item);
  const dx = anchorX - item.endX;
  const dy = anchorY - item.endY;
  const distance = Math.hypot(dx, dy);
  if (distance <= 10) return "";
  const widthTightness = Math.max(0, Math.min(1, (rect.width - 54) / 46));
  const boundCompression = Math.max(0, Math.min(1, Math.abs(item.columnBoundShift) / 24));
  const centerRhythm = item.side === "center" ? Math.min(1, item.connectorLane / 3) : 0;
  const step = Math.min(16 + widthTightness * 4 - boundCompression * 2.2 + centerRhythm * 1.6, Math.max(8, distance * (0.18 + widthTightness * 0.04 - boundCompression * 0.03 + centerRhythm * 0.02)));
  const laneOffset = item.side === "center" ? item.connectorLane * (4.5 + widthTightness * 1.2) : item.connectorLane * (7 + widthTightness * 2.5 - boundCompression * 1.8);
  const exitX = item.endX + (Math.abs(dx) >= Math.abs(dy) ? Math.sign(dx || 1) * step : 0);
  const exitY = item.endY + (Math.abs(dy) > Math.abs(dx) ? Math.sign(dy || 1) * step : 0);
  const midX = item.side === "center"
    ? anchorX + ((item.connectorLane % 2 === 0 ? -1 : 1) * laneOffset)
    : exitX + (item.side === "right" ? laneOffset : -laneOffset);
  const midY = item.side === "center"
    ? exitY + laneOffset * (0.55 + centerRhythm * 0.18)
    : anchorY - laneOffset * (0.35 - widthTightness * 0.08 + boundCompression * 0.05);
  const tailDx = anchorX - midX;
  const tailDy = anchorY - midY;
  const tailLength = Math.hypot(tailDx, tailDy) || 1;
  const connectorGap = Math.min(7 + widthTightness - boundCompression * 0.6, Math.max(3.5, tailLength * (0.18 - widthTightness * 0.04 + boundCompression * 0.02)));
  const endX = anchorX - tailDx / tailLength * connectorGap;
  const endY = anchorY - tailDy / tailLength * connectorGap;
  return `<polyline points="${item.endX},${item.endY} ${midX},${midY} ${endX},${endY}" fill="none" stroke="${item.color}" stroke-width="1" stroke-dasharray="3 3" stroke-linecap="round" stroke-linejoin="round" opacity="0.4" />`;
}

function assignForceConnectorLanes(items: ForceGroupMeta[]) {
  const laneCountBySide = new Map<ForceGroupMeta["side"], number>();
  return items.map((item) => {
    const lane = laneCountBySide.get(item.side) || 0;
    laneCountBySide.set(item.side, lane + 1);
    return { ...item, connectorLane: lane };
  });
}

function coordinateForceLabelColumns(items: ForceGroupMeta[]) {
  const widthTargetBySide = new Map<ForceGroupMeta["side"], number>();
  (["left", "right"] as const).forEach((side) => {
    const sideItems = items.filter((item) => item.side === side);
    if (sideItems.length < 2) return;
    const widths = sideItems.map((item) => estimateTextWidth(item.labelText, DIAGRAM_TYPE.body, 1.1));
    const target = Math.min(Math.max(...widths), Math.max(...widths.slice().sort((a, b) => a - b).slice(0, Math.max(1, widths.length - 1))) + 10);
    widthTargetBySide.set(side, target);
  });
  return items.map((item) => {
    const target = widthTargetBySide.get(item.side);
    if (!target) return item;
    const compactLabel = compactForceLabelText(item.rawLabel, target);
    return { ...item, labelText: escapeXml(compactLabel) };
  });
}

function adjustForceLabelPositions(items: ForceGroupMeta[]) {
  const minGap = 8;
  const adjustedBySide = new Map<ForceGroupMeta["side"], ForceGroupMeta[]>();

  (["left", "center", "right"] as const).forEach((side) => {
    const sorted = items
      .filter((item) => item.side === side)
      .sort((a, b) => a.labelY - b.labelY);
    const adjusted: ForceGroupMeta[] = [];
    const columnLimit = side === "left" ? 214 : side === "right" ? 426 : null;
    sorted.forEach((item) => {
      const previous = adjusted[adjusted.length - 1];
      let nextY = item.labelY;
      let nextX = item.labelX;
      if (previous) {
        const previousRect = forceLabelChipRect(previous);
        let nextRect = forceLabelChipRect({ ...item, labelX: nextX, labelY: nextY });
        const horizontalOverlap = Math.min(previousRect.x + previousRect.width, nextRect.x + nextRect.width) - Math.max(previousRect.x, nextRect.x);
        const verticalOverlap = Math.min(previousRect.y + previousRect.height, nextRect.y + nextRect.height) - Math.max(previousRect.y, nextRect.y);
        const sideMinGap = side === "center" ? 12 : minGap;
        if (verticalOverlap > -sideMinGap && horizontalOverlap > 0) {
          nextY += verticalOverlap + sideMinGap;
          if (side === "center") {
            nextY += Math.min(8, 2 + adjusted.length * 0.8);
          } else {
            const horizontalBump = 12 + Math.min(22, nextRect.width * 0.12);
            nextX += side === "right" ? horizontalBump : -horizontalBump;
          }
          nextRect = forceLabelChipRect({ ...item, labelX: nextX, labelY: nextY });
          const secondHorizontalOverlap = Math.min(previousRect.x + previousRect.width, nextRect.x + nextRect.width) - Math.max(previousRect.x, nextRect.x);
          const secondVerticalOverlap = Math.min(previousRect.y + previousRect.height, nextRect.y + nextRect.height) - Math.max(previousRect.y, nextRect.y);
          if (secondHorizontalOverlap > 0 && secondVerticalOverlap > -sideMinGap) {
            nextY += secondVerticalOverlap + sideMinGap;
          }
        }
      }
      let boundShift = 0;
      if (columnLimit !== null) {
        const boundedRect = forceLabelChipRect({ ...item, labelX: nextX, labelY: nextY });
        if (side === "left") {
          const overflow = boundedRect.x - columnLimit;
          if (overflow > 0) {
            nextX -= overflow;
            boundShift = overflow;
          }
        } else {
          const overflow = columnLimit - (boundedRect.x + boundedRect.width);
          if (overflow > 0) {
            nextX += overflow;
            boundShift = overflow;
          }
        }
      }
      adjusted.push({ ...item, labelX: nextX, labelY: nextY, columnBoundShift: boundShift });
    });
    adjustedBySide.set(side, adjusted);
  });

  const indexBySignature = new Map<string, ForceGroupMeta>();
  adjustedBySide.forEach((group) => {
    group.forEach((item) => {
      indexBySignature.set(`${item.endX}:${item.endY}:${item.labelText}`, item);
    });
  });

  return items.map((item) => indexBySignature.get(`${item.endX}:${item.endY}:${item.labelText}`) || item);
}

type RenderForceContext = {
  inclineDeg?: number;
  preferLocalAngles?: boolean;
  annotateIncline?: boolean;
  suppressGlobalAxes?: boolean;
  compactMode?: boolean;
};

function forceReferenceAngle(angleDeg: number, inclineDeg: number) {
  const tangent = 180 - inclineDeg;
  const normal = 90 - inclineDeg;
  const normalize = (value: number) => ((value % 360) + 360) % 360;
  const difference = (a: number, b: number) => {
    const diff = normalize(a - b);
    return diff > 180 ? 360 - diff : diff;
  };
  const tangentDiff = difference(angleDeg, tangent);
  const normalDiff = difference(angleDeg, normal);
  if (tangentDiff <= normalDiff) {
    return {
      startDeg: tangent,
      label: `${Math.round(difference(angleDeg, tangent))}°`,
    };
  }
  return {
    startDeg: normal,
    label: `${Math.round(difference(angleDeg, normal))}°`,
  };
}

type RenderedBodyForces = {
  vectorLines: string[];
  helperLines: string[];
  annotationLines: string[];
  sumX: number;
  sumY: number;
  x: number;
  y: number;
};

function buildAngleGroups(forces: Array<Record<string, unknown>>) {
  const groups = new Map<number, number[]>();
  forces.forEach((force, index) => {
    const angleDeg = Number(force.angle_deg || 0);
    const normalized = ((angleDeg % 360) + 360) % 360;
    const key = Math.round(normalized / 12);
    const items = groups.get(key) || [];
    items.push(index);
    groups.set(key, items);
  });
  return groups;
}

function renderBodyForces(
  body: Record<string, unknown>,
  showComponents: boolean,
  showAngleLabels: boolean,
  context: RenderForceContext = {},
): RenderedBodyForces {
  const x = Number(body.x || 320);
  const y = Number(body.y || 250);
  const forces = Array.isArray(body.forces) ? body.forces as Array<Record<string, unknown>> : [];
  const vectorLines: string[] = [];
  const helperLines: string[] = [];
  const annotationLines: string[] = [];
  let sumX = 0;
  let sumY = 0;
  const maxMagnitude = Math.max(...forces.map((force) => Math.max(0.5, Number(force.magnitude || 1))), 1);
  const componentOpacity = context.preferLocalAngles ? 0.08 : 0.12;
  const angleGroups = buildAngleGroups(forces);
  const groupOrder = new Map<number, number>();
  const metaByIndex = new Map<number, ForceGroupMeta>();
  const pendingLabels: ForceGroupMeta[] = [];
  const compactMode = Boolean(context.compactMode);
  const bodyCenter = compactMode ? { x, y } : null;
  const ringCount = compactMode ? Math.max(1, Math.ceil(forces.length / 2)) : 1;

  forces.forEach((force, index) => {
    const angleDeg = Number(force.angle_deg || 0);
    const angle = angleDeg * Math.PI / 180;
    const magnitude = Math.max(0.5, Number(force.magnitude || 1));
    const color = escapeXml(String(force.color || "#1d4ed8"));
    const rawLabel = String(force.label || "F");
    const normalized = ((angleDeg % 360) + 360) % 360;
    const groupKey = Math.round(normalized / 12);
    const group = angleGroups.get(groupKey) || [index];
    const groupIndex = groupOrder.get(groupKey) || 0;
    groupOrder.set(groupKey, groupIndex + 1);
    const ringIndex = compactMode ? Math.floor(index / 2) : 0;
    const lateralBase = context.preferLocalAngles ? 16 : 12;
    const lateralShift = group.length > 1 ? (groupIndex - (group.length - 1) / 2) * lateralBase : 0;
    const unitX = Math.cos(angle);
    const unitY = Math.sin(angle);
    const normalX = -Math.sin(angle);
    const normalY = -Math.cos(angle);
    const contactRadius = compactMode
      ? bodyContactDistance(body, { x: unitX, y: unitY }) + 6
      : 0;
    const startX = x;
    const startY = y;
    const length = vectorLengthScale(magnitude, maxMagnitude);
    const shaftLength = Math.max(18, length - contactRadius);
    const dx = Math.cos(angle) * shaftLength;
    const dy = Math.sin(angle) * shaftLength;
    const x2 = startX + dx;
    const y2 = startY - dy;
    const tipX = x + unitX * length + normalX * lateralShift;
    const tipY = y - unitY * length + normalY * lateralShift;
    const labelPos = vectorLabelPosition(
      startX,
      startY,
      tipX - startX,
      startY - tipY,
      index,
      groupIndex,
      group.length,
      contactRadius,
      ringIndex,
      ringCount,
    );
    const labelAnchor = vectorLabelAnchor(dx, dy);
    const side = labelAnchor === "start" ? "right" : labelAnchor === "end" ? "left" : "center";
    const label = escapeXml(compactMode ? compactForceLabelText(rawLabel, forceLabelMaxWidth(side)) : rawLabel);
    sumX += dx;
    sumY += dy;
    const meta = { groupIndex, groupSize: group.length, startX, startY, dx: tipX - startX, dy: startY - tipY, rawLabel, labelX: labelPos.x, labelY: labelPos.y, labelText: label, labelAnchor, color, side, endX: x2, endY: y2, connectorLane: 0, columnBoundShift: 0 } satisfies ForceGroupMeta;
    metaByIndex.set(index, meta);
    pendingLabels.push(meta);
    if (bodyCenter) {
      vectorLines.push(`<line x1="${bodyCenter.x}" y1="${bodyCenter.y}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="2.1" marker-end="url(#forceArrow)" stroke-linecap="round" />`);
      if (contactRadius > 0) {
        vectorLines.push(`<line x1="${x2}" y1="${y2}" x2="${tipX}" y2="${tipY}" stroke="${color}" stroke-width="1.2" opacity="0.28" />`);
      }
    } else {
      vectorLines.push(`<line x1="${startX}" y1="${startY}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="2.1" marker-end="url(#forceArrow)" stroke-linecap="round" />`);
    }
    if (showComponents && (group.length === 1 || groupIndex === 0)) {
      helperLines.push(`<line x1="${startX}" y1="${startY}" x2="${x2}" y2="${startY}" stroke="${color}" stroke-width="${DIAGRAM_STROKES.helper}" stroke-dasharray="4 4" opacity="${componentOpacity}" />`);
      helperLines.push(`<line x1="${x2}" y1="${startY}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${DIAGRAM_STROKES.helper}" stroke-dasharray="4 4" opacity="${componentOpacity}" />`);
    }
  });

  const placedLabels = compactMode ? assignForceConnectorLanes(adjustForceLabelPositions(coordinateForceLabelColumns(pendingLabels))) : pendingLabels;
  placedLabels.forEach((item) => {
    const chipAnchor = compactMode ? forceLabelLeaderAnchor(item) : null;
    const anchorX = chipAnchor ? chipAnchor.x : item.labelAnchor === "start"
      ? item.labelX - 4
      : item.labelAnchor === "end"
        ? item.labelX + 4
        : item.labelX;
    const anchorY = chipAnchor ? chipAnchor.y : item.labelY - 5;
    if (compactMode && (Math.abs(anchorX - item.endX) > 10 || Math.abs(anchorY - item.endY) > 10)) {
      vectorLines.push(renderForceLabelConnector(item, anchorX, anchorY));
    }
    if (compactMode) {
      vectorLines.push(renderForceLabelChip(item));
    }
    vectorLines.push(`<text x="${item.labelX}" y="${item.labelY}" text-anchor="${item.labelAnchor}" font-size="${DIAGRAM_TYPE.body}" font-weight="600" fill="${item.color}">${item.labelText}</text>`);
  });

  if (showAngleLabels) {
    const inclineDeg = Number(context.inclineDeg || 0);
    const preferLocalAngles = Boolean(context.preferLocalAngles);
    const meaningfulAngles = forces
      .map((force, index) => ({ force, index }))
      .filter(({ force }) => {
        const label = String(force.label || "");
        if (!label) return false;
        if (!preferLocalAngles) return true;
        return /支持|摩擦|拉力|重力|弹力|推力/.test(label);
      })
      .filter(({ force }) => {
        if (!preferLocalAngles) return true;
        const angleDeg = Number(force.angle_deg || 0);
        const reference = forceReferenceAngle(angleDeg, inclineDeg);
        const delta = Math.abs((((angleDeg - reference.startDeg) % 360) + 540) % 360 - 180);
        return delta >= 12;
      })
      .slice(0, preferLocalAngles ? 1 : 2);

    meaningfulAngles.forEach(({ force, index }, annotationIndex) => {
      const angleDeg = Number(force.angle_deg || 0);
      const meta = metaByIndex.get(index);
      if (!meta || (meta.groupSize > 1 && meta.groupIndex > 0)) return;
      const angleOriginX = compactMode ? meta.startX : x;
      const angleOriginY = compactMode ? meta.startY : y;
      if (preferLocalAngles) {
        const reference = forceReferenceAngle(angleDeg, inclineDeg);
        annotationLines.push(renderAngleAnnotation(
          angleOriginX,
          angleOriginY,
          reference.startDeg,
          angleDeg,
          30 + annotationIndex * 12,
          reference.label,
          { stroke: String(force.color || DIAGRAM_COLORS.secondary), textColor: String(force.color || DIAGRAM_COLORS.secondary), textSize: 11 },
        ));
        return;
      }
      annotationLines.push(renderAngleAnnotation(
        angleOriginX,
        angleOriginY,
        0,
        angleDeg,
        28 + annotationIndex * 12,
        `${Math.round(angleDeg)}°`,
        { stroke: String(force.color || DIAGRAM_COLORS.secondary), textColor: String(force.color || DIAGRAM_COLORS.secondary), textSize: 11 },
      ));
    });
  }

  return { vectorLines, helperLines, annotationLines, sumX, sumY, x, y };
}

export function renderForceDiagramSvg(payload: Record<string, unknown>): string {
  const bodyLabel = escapeXml(String(payload.body_label || "m"));
  const forces = Array.isArray(payload.forces) ? payload.forces as Array<Record<string, unknown>> : [];
  const showComponents = payload.show_components !== false;
  const cx = 260;
  const cy = 220;
  const scale = 38;
  const lines: string[] = [];
  const componentLines: string[] = [];
  forces.forEach((force, index) => {
    const angle = Number(force.angle_deg || 0) * Math.PI / 180;
    const magnitude = Math.max(0.5, Number(force.magnitude || 1));
    const color = escapeXml(String(force.color || "#c2410c"));
    const dx = Math.cos(angle) * magnitude * scale;
    const dy = Math.sin(angle) * magnitude * scale;
    const x2 = cx + dx;
    const y2 = cy - dy;
    const labelPos = vectorLabelPosition(cx, cy, dx, dy, index);
    lines.push(`<line x1="${cx}" y1="${cy}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="1.9" marker-end="url(#forceArrow)" stroke-linecap="round" />`);
    lines.push(`<text x="${labelPos.x}" y="${labelPos.y}" font-size="${DIAGRAM_TYPE.body}" font-weight="600" fill="${color}">${escapeXml(String(force.label || "F"))}</text>`);
    if (showComponents) {
      componentLines.push(`<line x1="${cx}" y1="${cy}" x2="${x2}" y2="${cy}" stroke="${color}" stroke-width="${DIAGRAM_STROKES.helper}" stroke-dasharray="4 4" opacity="${DIAGRAM_OPACITY.helper}" />`);
      componentLines.push(`<line x1="${x2}" y1="${cy}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${DIAGRAM_STROKES.helper}" stroke-dasharray="4 4" opacity="${DIAGRAM_OPACITY.helper}" />`);
    }
  });
  return makeSvgShell(520, 420, "Free-body / force diagram", `
  <line x1="40" y1="220" x2="480" y2="220" stroke="${DIAGRAM_COLORS.ultraFaint}" stroke-width="${DIAGRAM_STROKES.faint}" />
  <line x1="260" y1="40" x2="260" y2="380" stroke="${DIAGRAM_COLORS.ultraFaint}" stroke-width="${DIAGRAM_STROKES.faint}" />
  <circle cx="${cx}" cy="${cy}" r="20" fill="${DIAGRAM_COLORS.paper}" stroke="${DIAGRAM_COLORS.primary}" stroke-width="1.6" />
  <text x="${cx}" y="${cy + 5}" text-anchor="middle" font-size="17" font-weight="600" fill="${DIAGRAM_COLORS.primary}">${bodyLabel}</text>
  ${componentLines.join("\n")}
  ${lines.join("\n")}
  `);
}

export function renderForceAnalysisSvg(payload: Record<string, unknown>): string {
  const title = String(payload.title || "Force analysis");
  const showComponents = payload.show_components !== false;
  const showAxes = payload.show_axes !== false;
  const showResultant = payload.show_resultant !== false;
  const showAngleLabels = Boolean(payload.show_angle_labels);
  const incline = Number(payload.incline_deg || 0);
  const preferLocalAngles = Math.abs(incline) > 0.01;
  const bodies = Array.isArray(payload.bodies) && payload.bodies.length > 0
    ? payload.bodies as Array<Record<string, unknown>>
    : [{ x: 320, y: 250, label: String(payload.body_label || "m"), kind: "particle", forces: Array.isArray(payload.forces) ? payload.forces : [] }];
  const surfaces = Array.isArray(payload.surfaces) ? payload.surfaces as Array<Record<string, unknown>> : [];
  const connectors = Array.isArray(payload.connectors) ? payload.connectors as Array<Record<string, unknown>> : [];
  const totalForces = bodies.reduce((sum, body) => sum + ((Array.isArray(body.forces) ? body.forces.length : 0)), 0);
  const compactMode = totalForces >= 5 || (preferLocalAngles && bodies.some((body) => Array.isArray(body.forces) && body.forces.length >= 4));
  const backgroundParts: string[] = [];
  const sceneParts: string[] = [];
  const helperLines: string[] = [];
  const annotationLines: string[] = [];
  const vectorLines: string[] = [];
  const width = 700;
  const height = 520;
  const axisX = 340;
  const axisY = 290;

  if (showAxes && !preferLocalAngles) {
    backgroundParts.push(`<line x1="80" y1="${axisY}" x2="620" y2="${axisY}" stroke="${DIAGRAM_COLORS.ultraFaint}" stroke-width="${DIAGRAM_STROKES.faint}" />`);
    backgroundParts.push(`<line x1="${axisX}" y1="80" x2="${axisX}" y2="470" stroke="${DIAGRAM_COLORS.ultraFaint}" stroke-width="${DIAGRAM_STROKES.faint}" />`);
    backgroundParts.push(`<text x="625" y="${axisY - 5}" font-size="${DIAGRAM_TYPE.small}" font-weight="600" fill="${DIAGRAM_COLORS.tertiary}">x</text>`);
    backgroundParts.push(`<text x="${axisX + 6}" y="75" font-size="${DIAGRAM_TYPE.small}" font-weight="600" fill="${DIAGRAM_COLORS.tertiary}">y</text>`);
  }
  if (Math.abs(incline) > 0.01 && surfaces.length === 0) {
    const inclineRad = incline * Math.PI / 180;
    const x1 = 180;
    const y1 = 380;
    const x2 = 500;
    const y2 = 380 - Math.tan(inclineRad) * 300;
    sceneParts.push(renderForceSurface({ kind: "incline", x1, y1, x2, y2, label: "" }));
    if (showAngleLabels) {
      annotationLines.push(renderAngleAnnotation(x1, y1, 0, incline, compactMode ? 26 : 32, `${Math.round(incline)}°`, { stroke: DIAGRAM_COLORS.secondary, textColor: DIAGRAM_COLORS.secondary }));
    }
  }

  surfaces.forEach((surface) => {
    sceneParts.push(renderForceSurface(surface));
    if (showAngleLabels && preferLocalAngles && String(surface.kind || "") === "incline") {
      const x1 = Number(surface.x1 || 0);
      const y1 = Number(surface.y1 || 0);
      annotationLines.push(renderAngleAnnotation(x1, y1, 0, incline, compactMode ? 24 : 30, `${Math.round(incline)}°`, { stroke: DIAGRAM_COLORS.secondary, textColor: DIAGRAM_COLORS.secondary, textSize: 11.5 }));
    }
  });
  connectors.forEach((connector) => {
    sceneParts.push(renderForceConnector(connector));
  });

  let resultantAnchor: RenderedBodyForces | null = null;
  for (const body of bodies) {
    sceneParts.push(renderForceBody(body));
    const rendered = renderBodyForces(body, showComponents, showAngleLabels, {
      inclineDeg: incline,
      preferLocalAngles,
      annotateIncline: preferLocalAngles,
      suppressGlobalAxes: preferLocalAngles,
      compactMode,
    });
    helperLines.push(...rendered.helperLines);
    annotationLines.push(...rendered.annotationLines);
    vectorLines.push(...rendered.vectorLines);
    if (!resultantAnchor && Array.isArray(body.forces) && body.forces.length > 0) {
      resultantAnchor = rendered;
    }
  }

  if (showResultant && resultantAnchor && (Math.abs(resultantAnchor.sumX) > 1 || Math.abs(resultantAnchor.sumY) > 1)) {
    const rx = resultantAnchor.x + resultantAnchor.sumX;
    const ry = resultantAnchor.y - resultantAnchor.sumY;
    vectorLines.push(`<line x1="${resultantAnchor.x}" y1="${resultantAnchor.y}" x2="${rx}" y2="${ry}" stroke="${DIAGRAM_COLORS.primary}" stroke-width="2.3" marker-end="url(#resultantArrow)" stroke-linecap="round" />`);
    vectorLines.push(`<text x="${rx + 10}" y="${ry - 10}" font-size="14" font-weight="700" fill="${DIAGRAM_COLORS.primary}">R</text>`);
  }

  const warning = String(payload.warning || "").trim();
  const warningLines = compactMode && warning
    ? wrapDiagramText(`已自动简化：${warning}`, width - 136, DIAGRAM_TYPE.small)
    : [];
  const warningPanel = warningLines.length > 0
    ? `<rect x="24" y="452" width="652" height="${28 + warningLines.length * 16}" fill="#fff7ed" stroke="#fdba74" stroke-width="0.9" rx="5" />
      ${warningLines.map((line, index) => `<text x="38" y="${472 + index * 16}" font-size="${DIAGRAM_TYPE.small}" font-weight="${index === 0 ? 600 : 500}" fill="#9a3412">${escapeXml(line)}</text>`).join("\n")}`
    : "";

  return makeSvgShell(width, height, title, `
  ${backgroundParts.join("\n")}
  ${sceneParts.join("\n")}
  ${helperLines.join("\n")}
  ${annotationLines.join("\n")}
  ${vectorLines.join("\n")}
  ${warningPanel}
  `);
}

function circuitComponentMetrics(type: string, orientation = "horizontal") {
  const vertical = orientation === "vertical";
  if (type === "battery") {
    return vertical
      ? { left: 24, right: 24, top: 34, bottom: 34, labelY: -44 }
      : { left: 34, right: 34, top: 24, bottom: 24, labelY: -34 };
  }
  if (type === "source" || type === "current_source" || type === "voltage_source") {
    return vertical
      ? { left: 20, right: 20, top: 36, bottom: 36, labelY: -44 }
      : { left: 36, right: 36, top: 20, bottom: 20, labelY: -34 };
  }
  if (type === "resistor") {
    return vertical
      ? { left: 14, right: 14, top: 36, bottom: 36, labelY: -42 }
      : { left: 36, right: 36, top: 14, bottom: 14, labelY: -30 };
  }
  if (type === "capacitor") {
    return vertical
      ? { left: 22, right: 22, top: 30, bottom: 30, labelY: -40 }
      : { left: 30, right: 30, top: 22, bottom: 22, labelY: -30 };
  }
  if (type === "inductor") {
    return vertical
      ? { left: 12, right: 12, top: 34, bottom: 34, labelY: -42 }
      : { left: 34, right: 34, top: 12, bottom: 12, labelY: -30 };
  }
  if (type === "switch") {
    return vertical
      ? { left: 14, right: 14, top: 36, bottom: 36, labelY: -42 }
      : { left: 36, right: 36, top: 14, bottom: 14, labelY: -30 };
  }
  if (type === "diode" || type === "led") {
    return vertical
      ? { left: 18, right: 18, top: 34, bottom: 34, labelY: -42 }
      : { left: 34, right: 34, top: 18, bottom: 18, labelY: -30 };
  }
  if (type === "ammeter" || type === "voltmeter" || type === "lamp" || type === "load" || type === "pulley") {
    return vertical
      ? { left: 18, right: 18, top: 36, bottom: 36, labelY: -44 }
      : { left: 36, right: 36, top: 18, bottom: 18, labelY: -32 };
  }
  if (type === "transistor") {
    return vertical
      ? { left: 24, right: 24, top: 36, bottom: 30, labelY: -44 }
      : { left: 36, right: 24, top: 24, bottom: 24, labelY: -34 };
  }
  if (type === "relay") {
    return vertical
      ? { left: 20, right: 20, top: 40, bottom: 36, labelY: -46 }
      : { left: 36, right: 40, top: 18, bottom: 20, labelY: -32 };
  }
  if (type === "buzzer") {
    return vertical
      ? { left: 18, right: 18, top: 36, bottom: 34, labelY: -44 }
      : { left: 36, right: 34, top: 18, bottom: 18, labelY: -32 };
  }
  if (type === "opamp") {
    return { left: 40, right: 38, top: 24, bottom: 24, labelY: -34 };
  }
  if (type === "ground") {
    return vertical
      ? { left: 12, right: 16, top: 16, bottom: 16, labelY: 34 }
      : { left: 16, right: 16, top: 16, bottom: 12, labelY: 32 };
  }
  return { left: 6, right: 6, top: 6, bottom: 6, labelY: -22 };
}

function componentAnchor(component: Record<string, unknown>) {
  const type = String(component.type || "node");
  const orientation = String(component.orientation || "horizontal") === "vertical" ? "vertical" : "horizontal";
  const x = Number(component.x || 0);
  const y = Number(component.y || 0);
  const labelText = String(component.label || "");
  const label = escapeXml(labelText);
  const metrics = circuitComponentMetrics(type, orientation);
  return {
    id: String(component.id || ""),
    x,
    y,
    label,
    labelText,
    type,
    orientation,
    metrics,
    anchors: {
      left: { x: x - metrics.left, y },
      right: { x: x + metrics.right, y },
      top: { x, y: y - metrics.top },
      bottom: { x, y: y + metrics.bottom },
      base: orientation === "vertical" ? { x, y: y - metrics.top } : { x: x - metrics.left, y },
      collector: orientation === "vertical" ? { x: x - 10, y: y + metrics.bottom } : { x: x + 10, y: y - metrics.top },
      emitter: orientation === "vertical" ? { x: x + 10, y: y + metrics.bottom } : { x: x + 10, y: y + metrics.bottom },
      plus: orientation === "vertical" ? { x: x, y: y - metrics.top } : { x: x - metrics.left, y: y - 10 },
      minus: orientation === "vertical" ? { x: x, y: y + metrics.bottom } : { x: x - metrics.left, y: y + 10 },
      out: orientation === "vertical" ? { x, y: y + metrics.bottom } : { x: x + metrics.right, y },
    },
  };
}

function circuitLabelPosition(type: string, x: number, y: number, label = "", orientation = "horizontal") {
  const metrics = circuitComponentMetrics(type, orientation);
  const labelWidth = estimateTextWidth(label, DIAGRAM_TYPE.body, 1.1);
  return {
    x,
    y: y + metrics.labelY,
    width: labelWidth,
    height: DIAGRAM_TYPE.body + 4,
  };
}

function circuitWireLabelPosition(x1: number, y1: number, x2: number, y2: number, label = "") {
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const horizontal = Math.abs(x2 - x1) >= Math.abs(y2 - y1);
  const x = horizontal ? midX : midX + 12;
  const y = horizontal ? midY - 10 : midY - 3;
  return {
    x,
    y,
    width: estimateTextWidth(label, DIAGRAM_TYPE.small, 1.05),
    height: DIAGRAM_TYPE.small + 4,
  };
}

function circuitComponentBounds(component: Record<string, unknown>) {
  const anchor = componentAnchor(component);
  let bounds = makeBounds(
    anchor.x - anchor.metrics.left,
    anchor.y - anchor.metrics.top,
    anchor.x + anchor.metrics.right,
    anchor.y + anchor.metrics.bottom,
  );
  if (anchor.labelText) {
    const labelPos = circuitLabelPosition(anchor.type, anchor.x, anchor.y, anchor.labelText, anchor.orientation);
    bounds = mergeBounds(bounds, makeBounds(
      labelPos.x - labelPos.width / 2 - 6,
      labelPos.y - labelPos.height,
      labelPos.x + labelPos.width / 2 + 6,
      labelPos.y + 6,
    ));
  }
  return expandBounds(bounds, 4);
}

function circuitWireBounds(wire: Record<string, unknown>) {
  const x1 = Number(wire.x1 || 0);
  const y1 = Number(wire.y1 || 0);
  const x2 = Number(wire.x2 || 0);
  const y2 = Number(wire.y2 || 0);
  let bounds = makeBounds(Math.min(x1, x2), Math.min(y1, y2), Math.max(x1, x2), Math.max(y1, y2));
  const labelText = String(wire.label || "");
  if (labelText) {
    const labelPos = circuitWireLabelPosition(x1, y1, x2, y2, labelText);
    bounds = mergeBounds(bounds, makeBounds(
      labelPos.x - labelPos.width / 2 - 5,
      labelPos.y - labelPos.height,
      labelPos.x + labelPos.width / 2 + 5,
      labelPos.y + 5,
    ));
  }
  return expandBounds(bounds, 3);
}

function resolveCircuitWireEndpoint(
  components: Array<Record<string, unknown>>,
  x: number,
  y: number,
  otherX: number,
  otherY: number,
) {
  for (const component of components) {
    const anchor = componentAnchor(component);
    const withinX = x >= anchor.x - anchor.metrics.left - 1 && x <= anchor.x + anchor.metrics.right + 1;
    const withinY = y >= anchor.y - anchor.metrics.top - 1 && y <= anchor.y + anchor.metrics.bottom + 1;
    if (!withinX || !withinY) continue;
    const dx = otherX - anchor.x;
    const dy = otherY - anchor.y;
    if (Math.abs(dx) >= Math.abs(dy)) {
      return dx < 0 ? anchor.anchors.left : anchor.anchors.right;
    }
    return dy < 0 ? anchor.anchors.top : anchor.anchors.bottom;
  }
  return { x, y };
}

function renderCircuitComponent(component: Record<string, unknown>) {
  const { x, y, label, labelText, type, orientation } = componentAnchor(component);
  const stroke = escapeXml(String(component.color || "#111827"));
  const vertical = orientation === "vertical";
  const parts: string[] = [];
  if (type === "battery") {
    if (vertical) {
      parts.push(`<line x1="${x - 12}" y1="${y - 24}" x2="${x + 12}" y2="${y - 24}" stroke="${stroke}" stroke-width="1.8" />`);
      parts.push(`<line x1="${x - 20}" y1="${y - 10}" x2="${x + 20}" y2="${y - 10}" stroke="${stroke}" stroke-width="2.6" />`);
      parts.push(`<line x1="${x - 12}" y1="${y + 10}" x2="${x + 12}" y2="${y + 10}" stroke="${stroke}" stroke-width="1.8" />`);
      parts.push(`<line x1="${x - 20}" y1="${y + 24}" x2="${x + 20}" y2="${y + 24}" stroke="${stroke}" stroke-width="2.6" />`);
      parts.push(`<line x1="${x}" y1="${y - 36}" x2="${x}" y2="${y - 24}" stroke="${stroke}" stroke-width="1.9" />`);
      parts.push(`<line x1="${x}" y1="${y + 24}" x2="${x}" y2="${y + 36}" stroke="${stroke}" stroke-width="1.9" />`);
    } else {
      parts.push(`<line x1="${x - 24}" y1="${y - 12}" x2="${x - 24}" y2="${y + 12}" stroke="${stroke}" stroke-width="1.8" />`);
      parts.push(`<line x1="${x - 10}" y1="${y - 20}" x2="${x - 10}" y2="${y + 20}" stroke="${stroke}" stroke-width="2.6" />`);
      parts.push(`<line x1="${x + 10}" y1="${y - 12}" x2="${x + 10}" y2="${y + 12}" stroke="${stroke}" stroke-width="1.8" />`);
      parts.push(`<line x1="${x + 24}" y1="${y - 20}" x2="${x + 24}" y2="${y + 20}" stroke="${stroke}" stroke-width="2.6" />`);
    }
  } else if (type === "source" || type === "current_source" || type === "voltage_source") {
    const sourceLabel = type === "current_source" ? "I" : "V";
    if (vertical) {
      parts.push(`<line x1="${x}" y1="${y - 36}" x2="${x}" y2="${y - 18}" stroke="${stroke}" stroke-width="1.9" />`);
      parts.push(`<circle cx="${x}" cy="${y}" r="18" fill="#ffffff" stroke="${stroke}" stroke-width="1.9" />`);
      if (type === "current_source") {
        parts.push(`<line x1="${x}" y1="${y + 8}" x2="${x}" y2="${y - 9}" stroke="${stroke}" stroke-width="1.6" marker-end="url(#circuitArrow)" />`);
      } else {
        parts.push(`<text x="${x}" y="${y - 4}" text-anchor="middle" font-size="11" font-weight="700" fill="${stroke}">+</text>`);
        parts.push(`<text x="${x}" y="${y + 13}" text-anchor="middle" font-size="13" font-weight="700" fill="${stroke}">−</text>`);
      }
      parts.push(`<text x="${x + 26}" y="${y - 12}" text-anchor="middle" font-size="10.5" font-weight="700" fill="${DIAGRAM_COLORS.tertiary}">${sourceLabel}</text>`);
      parts.push(`<line x1="${x}" y1="${y + 18}" x2="${x}" y2="${y + 36}" stroke="${stroke}" stroke-width="1.9" />`);
    } else {
      parts.push(`<line x1="${x - 36}" y1="${y}" x2="${x - 18}" y2="${y}" stroke="${stroke}" stroke-width="1.9" />`);
      parts.push(`<circle cx="${x}" cy="${y}" r="18" fill="#ffffff" stroke="${stroke}" stroke-width="1.9" />`);
      if (type === "current_source") {
        parts.push(`<line x1="${x}" y1="${y + 9}" x2="${x}" y2="${y - 8}" stroke="${stroke}" stroke-width="1.6" marker-end="url(#circuitArrow)" />`);
      } else {
        parts.push(`<text x="${x}" y="${y - 4}" text-anchor="middle" font-size="11" font-weight="700" fill="${stroke}">+</text>`);
        parts.push(`<text x="${x}" y="${y + 13}" text-anchor="middle" font-size="13" font-weight="700" fill="${stroke}">−</text>`);
      }
      parts.push(`<text x="${x + 24}" y="${y - 12}" text-anchor="middle" font-size="10.5" font-weight="700" fill="${DIAGRAM_COLORS.tertiary}">${sourceLabel}</text>`);
      parts.push(`<line x1="${x + 18}" y1="${y}" x2="${x + 36}" y2="${y}" stroke="${stroke}" stroke-width="1.9" />`);
    }
  } else if (type === "resistor") {
    if (vertical) {
      parts.push(`<line x1="${x}" y1="${y - 36}" x2="${x}" y2="${y - 22}" stroke="${stroke}" stroke-width="1.9" />`);
      parts.push(`<rect x="${x - 9}" y="${y - 22}" width="18" height="44" fill="#ffffff" stroke="${stroke}" stroke-width="1.9" />`);
      parts.push(`<line x1="${x}" y1="${y + 22}" x2="${x}" y2="${y + 36}" stroke="${stroke}" stroke-width="1.9" />`);
    } else {
      parts.push(`<line x1="${x - 36}" y1="${y}" x2="${x - 22}" y2="${y}" stroke="${stroke}" stroke-width="1.9" />`);
      parts.push(`<rect x="${x - 22}" y="${y - 9}" width="44" height="18" fill="#ffffff" stroke="${stroke}" stroke-width="1.9" />`);
      parts.push(`<line x1="${x + 22}" y1="${y}" x2="${x + 36}" y2="${y}" stroke="${stroke}" stroke-width="1.9" />`);
    }
  } else if (type === "capacitor") {
    if (vertical) {
      parts.push(`<line x1="${x}" y1="${y - 30}" x2="${x}" y2="${y - 8}" stroke="${stroke}" stroke-width="1.9" />`);
      parts.push(`<line x1="${x - 18}" y1="${y - 8}" x2="${x + 18}" y2="${y - 8}" stroke="${stroke}" stroke-width="2.1" />`);
      parts.push(`<line x1="${x - 18}" y1="${y + 8}" x2="${x + 18}" y2="${y + 8}" stroke="${stroke}" stroke-width="2.1" />`);
      parts.push(`<line x1="${x}" y1="${y + 8}" x2="${x}" y2="${y + 30}" stroke="${stroke}" stroke-width="1.9" />`);
    } else {
      parts.push(`<line x1="${x - 30}" y1="${y}" x2="${x - 8}" y2="${y}" stroke="${stroke}" stroke-width="1.9" />`);
      parts.push(`<line x1="${x - 8}" y1="${y - 18}" x2="${x - 8}" y2="${y + 18}" stroke="${stroke}" stroke-width="2.1" />`);
      parts.push(`<line x1="${x + 8}" y1="${y - 18}" x2="${x + 8}" y2="${y + 18}" stroke="${stroke}" stroke-width="2.1" />`);
      parts.push(`<line x1="${x + 8}" y1="${y}" x2="${x + 30}" y2="${y}" stroke="${stroke}" stroke-width="1.9" />`);
    }
  } else if (type === "inductor") {
    if (vertical) {
      parts.push(`<line x1="${x}" y1="${y - 34}" x2="${x}" y2="${y - 24}" stroke="${stroke}" stroke-width="1.9" />`);
      parts.push(`<path d="M ${x} ${y - 24} a 6 6 0 0 1 0 12 a 6 6 0 0 1 0 12 a 6 6 0 0 1 0 12 a 6 6 0 0 1 0 12" fill="none" stroke="${stroke}" stroke-width="1.9" />`);
      parts.push(`<line x1="${x}" y1="${y + 24}" x2="${x}" y2="${y + 34}" stroke="${stroke}" stroke-width="1.9" />`);
    } else {
      parts.push(`<line x1="${x - 34}" y1="${y}" x2="${x - 24}" y2="${y}" stroke="${stroke}" stroke-width="1.9" />`);
      parts.push(`<path d="M ${x - 24} ${y} a 6 6 0 0 1 12 0 a 6 6 0 0 1 12 0 a 6 6 0 0 1 12 0 a 6 6 0 0 1 12 0" fill="none" stroke="${stroke}" stroke-width="1.9" />`);
      parts.push(`<line x1="${x + 24}" y1="${y}" x2="${x + 34}" y2="${y}" stroke="${stroke}" stroke-width="1.9" />`);
    }
  } else if (type === "switch") {
    if (vertical) {
      parts.push(`<line x1="${x}" y1="${y - 36}" x2="${x}" y2="${y - 18}" stroke="${stroke}" stroke-width="1.9" />`);
      parts.push(`<circle cx="${x}" cy="${y - 18}" r="2.8" fill="${stroke}" />`);
      parts.push(`<circle cx="${x}" cy="${y + 18}" r="2.8" fill="${stroke}" />`);
      parts.push(`<line x1="${x}" y1="${y - 18}" x2="${x + 11}" y2="${y + 10}" stroke="${stroke}" stroke-width="1.9" stroke-linecap="round" />`);
      parts.push(`<line x1="${x}" y1="${y + 18}" x2="${x}" y2="${y + 36}" stroke="${stroke}" stroke-width="1.9" />`);
    } else {
      parts.push(`<line x1="${x - 36}" y1="${y}" x2="${x - 18}" y2="${y}" stroke="${stroke}" stroke-width="1.9" />`);
      parts.push(`<circle cx="${x - 18}" cy="${y}" r="2.8" fill="${stroke}" />`);
      parts.push(`<circle cx="${x + 18}" cy="${y}" r="2.8" fill="${stroke}" />`);
      parts.push(`<line x1="${x - 18}" y1="${y}" x2="${x + 10}" y2="${y - 11}" stroke="${stroke}" stroke-width="1.9" stroke-linecap="round" />`);
      parts.push(`<line x1="${x + 18}" y1="${y}" x2="${x + 36}" y2="${y}" stroke="${stroke}" stroke-width="1.9" />`);
    }
  } else if (type === "diode" || type === "led") {
    if (vertical) {
      parts.push(`<line x1="${x}" y1="${y - 34}" x2="${x}" y2="${y - 16}" stroke="${stroke}" stroke-width="1.9" />`);
      parts.push(`<polygon points="${x - 13},${y - 16} ${x + 13},${y - 16} ${x},${y + 6}" fill="#ffffff" stroke="${stroke}" stroke-width="1.9" />`);
      parts.push(`<line x1="${x - 17}" y1="${y + 10}" x2="${x + 17}" y2="${y + 10}" stroke="${stroke}" stroke-width="1.9" />`);
      parts.push(`<line x1="${x}" y1="${y + 10}" x2="${x}" y2="${y + 34}" stroke="${stroke}" stroke-width="1.9" />`);
      if (type === "led") {
        parts.push(`<line x1="${x + 14}" y1="${y - 14}" x2="${x + 26}" y2="${y - 26}" stroke="${stroke}" stroke-width="1.2" marker-end="url(#circuitArrow)" />`);
        parts.push(`<line x1="${x + 4}" y1="${y - 8}" x2="${x + 16}" y2="${y - 20}" stroke="${stroke}" stroke-width="1.2" marker-end="url(#circuitArrow)" />`);
      }
    } else {
      parts.push(`<line x1="${x - 34}" y1="${y}" x2="${x - 16}" y2="${y}" stroke="${stroke}" stroke-width="1.9" />`);
      parts.push(`<polygon points="${x - 16},${y - 13} ${x - 16},${y + 13} ${x + 6},${y}" fill="#ffffff" stroke="${stroke}" stroke-width="1.9" />`);
      parts.push(`<line x1="${x + 10}" y1="${y - 17}" x2="${x + 10}" y2="${y + 17}" stroke="${stroke}" stroke-width="1.9" />`);
      parts.push(`<line x1="${x + 10}" y1="${y}" x2="${x + 34}" y2="${y}" stroke="${stroke}" stroke-width="1.9" />`);
      if (type === "led") {
        parts.push(`<line x1="${x + 14}" y1="${y - 15}" x2="${x + 26}" y2="${y - 27}" stroke="${stroke}" stroke-width="1.2" marker-end="url(#circuitArrow)" />`);
        parts.push(`<line x1="${x + 8}" y1="${y - 5}" x2="${x + 20}" y2="${y - 17}" stroke="${stroke}" stroke-width="1.2" marker-end="url(#circuitArrow)" />`);
      }
    }
  } else if (type === "ammeter" || type === "voltmeter") {
    const meterLabel = type === "ammeter" ? "A" : "V";
    if (vertical) {
      parts.push(`<line x1="${x}" y1="${y - 36}" x2="${x}" y2="${y - 18}" stroke="${stroke}" stroke-width="1.9" />`);
      parts.push(`<circle cx="${x}" cy="${y}" r="18" fill="#ffffff" stroke="${stroke}" stroke-width="1.9" />`);
      parts.push(`<text x="${x}" y="${y + 5}" text-anchor="middle" font-size="14" font-weight="700" fill="${stroke}">${meterLabel}</text>`);
      parts.push(`<line x1="${x}" y1="${y + 18}" x2="${x}" y2="${y + 36}" stroke="${stroke}" stroke-width="1.9" />`);
    } else {
      parts.push(`<line x1="${x - 36}" y1="${y}" x2="${x - 18}" y2="${y}" stroke="${stroke}" stroke-width="1.9" />`);
      parts.push(`<circle cx="${x}" cy="${y}" r="18" fill="#ffffff" stroke="${stroke}" stroke-width="1.9" />`);
      parts.push(`<text x="${x}" y="${y + 5}" text-anchor="middle" font-size="14" font-weight="700" fill="${stroke}">${meterLabel}</text>`);
      parts.push(`<line x1="${x + 18}" y1="${y}" x2="${x + 36}" y2="${y}" stroke="${stroke}" stroke-width="1.9" />`);
    }
  } else if (type === "transistor") {
    if (vertical) {
      parts.push(`<circle cx="${x}" cy="${y}" r="16" fill="#ffffff" stroke="${stroke}" stroke-width="1.8" />`);
      parts.push(`<line x1="${x - 11}" y1="${y + 12}" x2="${x + 11}" y2="${y + 12}" stroke="${stroke}" stroke-width="1.8" />`);
      parts.push(`<line x1="${x}" y1="${y - 16}" x2="${x}" y2="${y - 36}" stroke="${stroke}" stroke-width="1.8" />`);
      parts.push(`<line x1="${x - 6}" y1="${y + 2}" x2="${x - 22}" y2="${y + 24}" stroke="${stroke}" stroke-width="1.8" />`);
      parts.push(`<line x1="${x + 6}" y1="${y + 2}" x2="${x + 22}" y2="${y + 24}" stroke="${stroke}" stroke-width="1.8" />`);
      parts.push(`<line x1="${x + 10}" y1="${y + 12}" x2="${x + 22}" y2="${y + 24}" stroke="${stroke}" stroke-width="1.3" marker-end="url(#circuitArrow)" />`);
    } else {
      parts.push(`<circle cx="${x}" cy="${y}" r="16" fill="#ffffff" stroke="${stroke}" stroke-width="1.8" />`);
      parts.push(`<line x1="${x - 12}" y1="${y - 11}" x2="${x - 12}" y2="${y + 11}" stroke="${stroke}" stroke-width="1.8" />`);
      parts.push(`<line x1="${x - 12}" y1="${y}" x2="${x - 36}" y2="${y}" stroke="${stroke}" stroke-width="1.8" />`);
      parts.push(`<line x1="${x - 2}" y1="${y - 6}" x2="${x + 22}" y2="${y - 24}" stroke="${stroke}" stroke-width="1.8" />`);
      parts.push(`<line x1="${x - 2}" y1="${y + 6}" x2="${x + 22}" y2="${y + 24}" stroke="${stroke}" stroke-width="1.8" />`);
      parts.push(`<line x1="${x + 10}" y1="${y + 13}" x2="${x + 22}" y2="${y + 24}" stroke="${stroke}" stroke-width="1.3" marker-end="url(#circuitArrow)" />`);
    }
  } else if (type === "relay") {
    if (vertical) {
      parts.push(`<line x1="${x}" y1="${y - 40}" x2="${x}" y2="${y - 20}" stroke="${stroke}" stroke-width="1.9" />`);
      parts.push(`<rect x="${x - 13}" y="${y - 20}" width="26" height="28" fill="#ffffff" stroke="${stroke}" stroke-width="1.8" />`);
      parts.push(`<path d="M ${x - 6} ${y - 14} q 11 4 0 8 q 11 4 0 8" fill="none" stroke="${stroke}" stroke-width="1.5" />`);
      parts.push(`<line x1="${x - 10}" y1="${y + 14}" x2="${x - 20}" y2="${y + 30}" stroke="${stroke}" stroke-width="1.8" />`);
      parts.push(`<circle cx="${x + 8}" cy="${y + 34}" r="2.8" fill="${stroke}" />`);
      parts.push(`<line x1="${x}" y1="${y + 8}" x2="${x}" y2="${y + 36}" stroke="${stroke}" stroke-width="1.9" />`);
    } else {
      parts.push(`<line x1="${x - 36}" y1="${y}" x2="${x - 18}" y2="${y}" stroke="${stroke}" stroke-width="1.9" />`);
      parts.push(`<rect x="${x - 18}" y="${y - 13}" width="28" height="26" fill="#ffffff" stroke="${stroke}" stroke-width="1.8" />`);
      parts.push(`<path d="M ${x - 12} ${y + 6} q 4 -11 8 0 q 4 -11 8 0" fill="none" stroke="${stroke}" stroke-width="1.5" />`);
      parts.push(`<line x1="${x + 16}" y1="${y - 10}" x2="${x + 34}" y2="${y - 18}" stroke="${stroke}" stroke-width="1.8" />`);
      parts.push(`<circle cx="${x + 38}" cy="${y + 8}" r="2.8" fill="${stroke}" />`);
    }
  } else if (type === "buzzer") {
    if (vertical) {
      parts.push(`<line x1="${x}" y1="${y - 36}" x2="${x}" y2="${y - 18}" stroke="${stroke}" stroke-width="1.9" />`);
      parts.push(`<path d="M ${x - 11} ${y - 18} L ${x + 11} ${y - 18} L ${x + 8} ${y} L ${x - 8} ${y} Z" fill="#ffffff" stroke="${stroke}" stroke-width="1.8" />`);
      parts.push(`<path d="M ${x - 9} ${y + 8} q 9 10 18 0" fill="none" stroke="${stroke}" stroke-width="1.4" />`);
      parts.push(`<path d="M ${x - 13} ${y + 14} q 13 15 26 0" fill="none" stroke="${stroke}" stroke-width="1.2" />`);
      parts.push(`<line x1="${x}" y1="${y}" x2="${x}" y2="${y + 34}" stroke="${stroke}" stroke-width="1.9" />`);
    } else {
      parts.push(`<line x1="${x - 36}" y1="${y}" x2="${x - 18}" y2="${y}" stroke="${stroke}" stroke-width="1.9" />`);
      parts.push(`<path d="M ${x - 18} ${y - 11} L ${x - 18} ${y + 11} L ${x} ${y + 8} L ${x} ${y - 8} Z" fill="#ffffff" stroke="${stroke}" stroke-width="1.8" />`);
      parts.push(`<path d="M ${x + 8} ${y - 9} q 10 9 0 18" fill="none" stroke="${stroke}" stroke-width="1.4" />`);
      parts.push(`<path d="M ${x + 14} ${y - 13} q 15 13 0 26" fill="none" stroke="${stroke}" stroke-width="1.2" />`);
    }
  } else if (type === "opamp") {
    if (vertical) {
      parts.push(`<polygon points="${x - 24},${y - 26} ${x + 24},${y - 26} ${x},${y + 24}" fill="#ffffff" stroke="${stroke}" stroke-width="1.9" />`);
      parts.push(`<text x="${x - 8}" y="${y - 12}" text-anchor="middle" font-size="11" font-weight="700" fill="${stroke}">+</text>`);
      parts.push(`<text x="${x + 8}" y="${y - 12}" text-anchor="middle" font-size="11" font-weight="700" fill="${stroke}">−</text>`);
      parts.push(`<line x1="${x - 10}" y1="${y - 40}" x2="${x - 10}" y2="${y - 26}" stroke="${stroke}" stroke-width="1.8" />`);
      parts.push(`<line x1="${x + 10}" y1="${y - 40}" x2="${x + 10}" y2="${y - 26}" stroke="${stroke}" stroke-width="1.8" />`);
      parts.push(`<line x1="${x}" y1="${y + 24}" x2="${x}" y2="${y + 38}" stroke="${stroke}" stroke-width="1.8" />`);
    } else {
      parts.push(`<polygon points="${x - 26},${y - 24} ${x - 26},${y + 24} ${x + 24},${y}" fill="#ffffff" stroke="${stroke}" stroke-width="1.9" />`);
      parts.push(`<text x="${x - 14}" y="${y - 6}" text-anchor="middle" font-size="11" font-weight="700" fill="${stroke}">+</text>`);
      parts.push(`<text x="${x - 14}" y="${y + 13}" text-anchor="middle" font-size="11" font-weight="700" fill="${stroke}">−</text>`);
      parts.push(`<line x1="${x - 40}" y1="${y - 10}" x2="${x - 26}" y2="${y - 10}" stroke="${stroke}" stroke-width="1.8" />`);
      parts.push(`<line x1="${x - 40}" y1="${y + 10}" x2="${x - 26}" y2="${y + 10}" stroke="${stroke}" stroke-width="1.8" />`);
      parts.push(`<line x1="${x + 24}" y1="${y}" x2="${x + 38}" y2="${y}" stroke="${stroke}" stroke-width="1.8" />`);
    }
  } else if (type === "pulley") {
    parts.push(`<circle cx="${x}" cy="${y}" r="18" fill="#ffffff" stroke="${stroke}" stroke-width="1.9" />`);
    parts.push(`<circle cx="${x}" cy="${y}" r="4" fill="${stroke}" />`);
  } else if (type === "lamp" || type === "load") {
    if (vertical) {
      parts.push(`<line x1="${x}" y1="${y - 36}" x2="${x}" y2="${y - 18}" stroke="${stroke}" stroke-width="1.9" />`);
      parts.push(`<circle cx="${x}" cy="${y}" r="18" fill="#ffffff" stroke="${stroke}" stroke-width="1.9" />`);
      parts.push(`<line x1="${x - 10}" y1="${y - 10}" x2="${x + 10}" y2="${y + 10}" stroke="${stroke}" stroke-width="1.7" />`);
      parts.push(`<line x1="${x - 10}" y1="${y + 10}" x2="${x + 10}" y2="${y - 10}" stroke="${stroke}" stroke-width="1.7" />`);
      parts.push(`<line x1="${x}" y1="${y + 18}" x2="${x}" y2="${y + 36}" stroke="${stroke}" stroke-width="1.9" />`);
    } else {
      parts.push(`<line x1="${x - 36}" y1="${y}" x2="${x - 18}" y2="${y}" stroke="${stroke}" stroke-width="1.9" />`);
      parts.push(`<circle cx="${x}" cy="${y}" r="18" fill="#ffffff" stroke="${stroke}" stroke-width="1.9" />`);
      parts.push(`<line x1="${x - 10}" y1="${y - 10}" x2="${x + 10}" y2="${y + 10}" stroke="${stroke}" stroke-width="1.7" />`);
      parts.push(`<line x1="${x - 10}" y1="${y + 10}" x2="${x + 10}" y2="${y - 10}" stroke="${stroke}" stroke-width="1.7" />`);
      parts.push(`<line x1="${x + 18}" y1="${y}" x2="${x + 36}" y2="${y}" stroke="${stroke}" stroke-width="1.9" />`);
    }
  } else if (type === "ground") {
    if (vertical) {
      parts.push(`<line x1="${x - 14}" y1="${y}" x2="${x - 2}" y2="${y}" stroke="${stroke}" stroke-width="1.8" />`);
      parts.push(`<line x1="${x}" y1="${y - 14}" x2="${x}" y2="${y + 14}" stroke="${stroke}" stroke-width="1.8" />`);
      parts.push(`<line x1="${x + 5}" y1="${y - 9}" x2="${x + 5}" y2="${y + 9}" stroke="${stroke}" stroke-width="1.8" />`);
      parts.push(`<line x1="${x + 10}" y1="${y - 4}" x2="${x + 10}" y2="${y + 4}" stroke="${stroke}" stroke-width="1.8" />`);
    } else {
      parts.push(`<line x1="${x}" y1="${y - 14}" x2="${x}" y2="${y - 2}" stroke="${stroke}" stroke-width="1.8" />`);
      parts.push(`<line x1="${x - 14}" y1="${y}" x2="${x + 14}" y2="${y}" stroke="${stroke}" stroke-width="1.8" />`);
      parts.push(`<line x1="${x - 9}" y1="${y + 5}" x2="${x + 9}" y2="${y + 5}" stroke="${stroke}" stroke-width="1.8" />`);
      parts.push(`<line x1="${x - 4}" y1="${y + 10}" x2="${x + 4}" y2="${y + 10}" stroke="${stroke}" stroke-width="1.8" />`);
    }
  } else {
    parts.push(`<circle cx="${x}" cy="${y}" r="4.5" fill="${stroke}" />`);
  }
  if (label) {
    const labelPos = circuitLabelPosition(type, x, y, labelText, orientation);
    parts.push(`<text x="${labelPos.x}" y="${labelPos.y}" text-anchor="middle" font-size="${DIAGRAM_TYPE.body}" font-weight="600" fill="${DIAGRAM_COLORS.secondary}">${label}</text>`);
  }
  return parts.join("\n");
}

export function renderVennDiagramSvg(payload: Record<string, unknown>): string {
  const title = String(payload.title || "Venn diagram");
  const sets = Array.isArray(payload.sets) ? payload.sets as Array<Record<string, unknown>> : [];
  const labels = sets.length > 0 ? sets.slice(0, 3).map((set, index) => escapeXml(String(set.label || String.fromCharCode(65 + index)))) : ["A", "B", "C"];
  const colors = sets.length > 0 ? sets.slice(0, 3).map((set, index) => escapeXml(String(set.color || DEFAULT_PALETTE[index % DEFAULT_PALETTE.length]))) : [DEFAULT_PALETTE[0], DEFAULT_PALETTE[1], DEFAULT_PALETTE[2]];
  const regions = (payload.regions && typeof payload.regions === "object") ? payload.regions as Record<string, unknown> : {};
  const mode = labels.length >= 3 ? 3 : 2;
  const width = 720;
  const height = 460;
  const regionText = (key: string, fallback = "") => escapeXml(String(regions[key] ?? fallback));
  if (mode === 2) {
    return makeSvgShell(width, height, title, `
    <g opacity="0.55">
      <circle cx="300" cy="245" r="118" fill="${colors[0]}" />
      <circle cx="420" cy="245" r="118" fill="${colors[1]}" />
    </g>
    <circle cx="300" cy="245" r="118" fill="none" stroke="${colors[0]}" stroke-width="2" />
    <circle cx="420" cy="245" r="118" fill="none" stroke="${colors[1]}" stroke-width="2" />
    <text x="242" y="140" text-anchor="middle" font-size="18" font-weight="700" fill="${DIAGRAM_COLORS.primary}">${labels[0]}</text>
    <text x="478" y="140" text-anchor="middle" font-size="18" font-weight="700" fill="${DIAGRAM_COLORS.primary}">${labels[1]}</text>
    <text x="255" y="250" text-anchor="middle" font-size="20" font-weight="600" fill="${DIAGRAM_COLORS.primary}">${regionText("A_only")}</text>
    <text x="360" y="250" text-anchor="middle" font-size="20" font-weight="700" fill="${DIAGRAM_COLORS.primary}">${regionText("A_B")}</text>
    <text x="465" y="250" text-anchor="middle" font-size="20" font-weight="600" fill="${DIAGRAM_COLORS.primary}">${regionText("B_only")}</text>
    <text x="108" y="248" text-anchor="middle" font-size="18" fill="${DIAGRAM_COLORS.secondary}">${regionText("outside")}</text>
    `);
  }
  return makeSvgShell(width, height, title, `
  <g opacity="0.5">
    <circle cx="300" cy="228" r="108" fill="${colors[0]}" />
    <circle cx="420" cy="228" r="108" fill="${colors[1]}" />
    <circle cx="360" cy="324" r="108" fill="${colors[2]}" />
  </g>
  <circle cx="300" cy="228" r="108" fill="none" stroke="${colors[0]}" stroke-width="2" />
  <circle cx="420" cy="228" r="108" fill="none" stroke="${colors[1]}" stroke-width="2" />
  <circle cx="360" cy="324" r="108" fill="none" stroke="${colors[2]}" stroke-width="2" />
  <text x="236" y="118" text-anchor="middle" font-size="18" font-weight="700" fill="${DIAGRAM_COLORS.primary}">${labels[0]}</text>
  <text x="484" y="118" text-anchor="middle" font-size="18" font-weight="700" fill="${DIAGRAM_COLORS.primary}">${labels[1]}</text>
  <text x="360" y="452" text-anchor="middle" font-size="18" font-weight="700" fill="${DIAGRAM_COLORS.primary}">${labels[2]}</text>
  <text x="250" y="225" text-anchor="middle" font-size="18" font-weight="600" fill="${DIAGRAM_COLORS.primary}">${regionText("A_only")}</text>
  <text x="470" y="225" text-anchor="middle" font-size="18" font-weight="600" fill="${DIAGRAM_COLORS.primary}">${regionText("B_only")}</text>
  <text x="360" y="378" text-anchor="middle" font-size="18" font-weight="600" fill="${DIAGRAM_COLORS.primary}">${regionText("C_only")}</text>
  <text x="360" y="212" text-anchor="middle" font-size="18" font-weight="700" fill="${DIAGRAM_COLORS.primary}">${regionText("A_B")}</text>
  <text x="304" y="294" text-anchor="middle" font-size="17" font-weight="700" fill="${DIAGRAM_COLORS.primary}">${regionText("A_C")}</text>
  <text x="416" y="294" text-anchor="middle" font-size="17" font-weight="700" fill="${DIAGRAM_COLORS.primary}">${regionText("B_C")}</text>
  <text x="360" y="268" text-anchor="middle" font-size="18" font-weight="800" fill="${DIAGRAM_COLORS.primary}">${regionText("A_B_C")}</text>
  <text x="104" y="250" text-anchor="middle" font-size="18" fill="${DIAGRAM_COLORS.secondary}">${regionText("outside")}</text>
  `);
}

export function renderCMemoryDiagramSvg(payload: Record<string, unknown>): string {
  const title = String(payload.title || "C memory layout");
  const blocks = Array.isArray(payload.blocks) ? payload.blocks as Array<Record<string, unknown>> : [];
  const width = 860;
  const rowHeight = 56;
  const top = 96;
  const left = 84;
  const cellWidth = 112;
  const totalRows = Math.max(1, blocks.length);
  const height = top + totalRows * rowHeight + 72;
  const parts: string[] = [];
  blocks.forEach((block, index) => {
    const y = top + index * rowHeight;
    const name = escapeXml(String(block.name || `slot_${index}`));
    const type = escapeXml(String(block.type || ""));
    const value = escapeXml(String(block.value || ""));
    const address = escapeXml(String(block.address || `0x${(4096 + index * 4).toString(16)}`));
    const bytes = Array.isArray(block.bytes) ? (block.bytes as Array<unknown>).slice(0, 8).map((byte) => escapeXml(String(byte))) : [];
    const note = escapeXml(String(block.note || ""));
    parts.push(`<text x="${left - 16}" y="${y + 34}" text-anchor="end" font-size="14" font-weight="600" fill="${DIAGRAM_COLORS.secondary}">${address}</text>`);
    parts.push(`<rect x="${left}" y="${y}" width="120" height="34" rx="6" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.2" />`);
    parts.push(`<text x="${left + 60}" y="${y + 23}" text-anchor="middle" font-size="15" font-weight="700" fill="${DIAGRAM_COLORS.primary}">${name}</text>`);
    parts.push(`<rect x="${left + 132}" y="${y}" width="110" height="34" rx="6" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.2" />`);
    parts.push(`<text x="${left + 187}" y="${y + 23}" text-anchor="middle" font-size="14" fill="${DIAGRAM_COLORS.secondary}">${type}</text>`);
    parts.push(`<rect x="${left + 254}" y="${y}" width="146" height="34" rx="6" fill="#eff6ff" stroke="#93c5fd" stroke-width="1.2" />`);
    parts.push(`<text x="${left + 327}" y="${y + 23}" text-anchor="middle" font-size="15" font-weight="600" fill="#1d4ed8">${value}</text>`);
    bytes.forEach((byte, byteIndex) => {
      const x = left + 420 + byteIndex * cellWidth * 0.58;
      parts.push(`<rect x="${x}" y="${y}" width="58" height="34" rx="5" fill="#ffffff" stroke="#cbd5e1" stroke-width="1" />`);
      parts.push(`<text x="${x + 29}" y="${y + 23}" text-anchor="middle" font-size="13" fill="${DIAGRAM_COLORS.primary}">${byte}</text>`);
    });
    if (note) {
      parts.push(`<text x="${left + 420}" y="${y + 52}" font-size="12.5" fill="${DIAGRAM_COLORS.secondary}">${note}</text>`);
    }
  });
  return makeSvgShell(width, height, title, `
  <text x="${left + 60}" y="78" text-anchor="middle" font-size="12" font-weight="600" fill="${DIAGRAM_COLORS.tertiary}">变量</text>
  <text x="${left + 187}" y="78" text-anchor="middle" font-size="12" font-weight="600" fill="${DIAGRAM_COLORS.tertiary}">类型</text>
  <text x="${left + 327}" y="78" text-anchor="middle" font-size="12" font-weight="600" fill="${DIAGRAM_COLORS.tertiary}">值</text>
  <text x="${left + 510}" y="78" text-anchor="middle" font-size="12" font-weight="600" fill="${DIAGRAM_COLORS.tertiary}">内存内容</text>
  ${parts.join("\n")}
  `);
}

export function renderCircuitDiagramSvg(payload: Record<string, unknown>): string {
  const title = String(payload.title || "Circuit diagram");
  const components = Array.isArray(payload.components) ? payload.components as Array<Record<string, unknown>> : [];
  const wires = Array.isArray(payload.wires) ? payload.wires as Array<Record<string, unknown>> : [];
  const notes = Array.isArray(payload.notes) ? payload.notes as string[] : [];

  const contentBounds = [...components.map((component) => circuitComponentBounds(component)), ...wires.map((wire) => circuitWireBounds(wire))]
    .reduce((acc, bounds) => acc ? mergeBounds(acc, bounds) : bounds, null as { minX: number; minY: number; maxX: number; maxY: number } | null)
    ?? makeBounds(80, 120, 620, 360);

  const padX = 36;
  const padY = 26;
  const frameX = Math.max(20, Math.floor(contentBounds.minX - padX));
  const frameY = Math.max(52, Math.floor(contentBounds.minY - padY));
  const frameWidth = Math.max(420, Math.ceil(contentBounds.maxX - contentBounds.minX + padX * 2));
  const frameHeight = Math.max(240, Math.ceil(contentBounds.maxY - contentBounds.minY + padY * 2));
  const noteWrapWidth = 150;
  const wrappedNotes = notes.map((note) => wrapDiagramText(note, noteWrapWidth, DIAGRAM_TYPE.small, "• "));
  const noteLines = wrappedNotes.flat();
  const noteTextWidth = noteLines.length > 0 ? Math.max(...noteLines.map((note) => estimateTextWidth(note, DIAGRAM_TYPE.small))) : 0;
  const notesWidth = noteLines.length > 0 ? Math.max(196, Math.ceil(noteTextWidth + 36)) : 0;
  const noteLineHeight = 16;
  const notesHeight = noteLines.length > 0 ? Math.max(76, 28 + noteLines.length * noteLineHeight + 10) : 0;
  const notesX = frameX + frameWidth + 18;
  const wireParts = wires.map((wire) => {
    const rawX1 = Number(wire.x1 || 0);
    const rawY1 = Number(wire.y1 || 0);
    const rawX2 = Number(wire.x2 || 0);
    const rawY2 = Number(wire.y2 || 0);
    const start = resolveCircuitWireEndpoint(components, rawX1, rawY1, rawX2, rawY2);
    const end = resolveCircuitWireEndpoint(components, rawX2, rawY2, rawX1, rawY1);
    const x1 = start.x;
    const y1 = start.y;
    const x2 = end.x;
    const y2 = end.y;
    const labelText = String(wire.label || "");
    const label = escapeXml(labelText);
    const labelPos = circuitWireLabelPosition(x1, y1, x2, y2, labelText);
    const path = `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${DIAGRAM_COLORS.primary}" stroke-width="${DIAGRAM_STROKES.primary}" stroke-linecap="square" />`;
    const text = label ? `<text x="${labelPos.x}" y="${labelPos.y}" text-anchor="middle" font-size="${DIAGRAM_TYPE.small}" font-weight="600" fill="${DIAGRAM_COLORS.secondary}">${label}</text>` : "";
    return `${path}${text}`;
  });
  const componentParts = components.map((component) => renderCircuitComponent(component));
  const noteParts = noteLines.map((note, index) => `<text x="${notesX + 14}" y="${frameY + 33 + index * noteLineHeight}" font-size="${DIAGRAM_TYPE.small}" fill="${DIAGRAM_COLORS.secondary}">${escapeXml(note)}</text>`);
  return makeSvgShell(Math.max(756, notesX + notesWidth + 18), Math.max(468, Math.max(frameY + frameHeight + 32, frameY + notesHeight + 24)), title, `
  <rect x="${frameX}" y="${frameY}" width="${frameWidth}" height="${frameHeight}" fill="#ffffff" stroke="${DIAGRAM_COLORS.ultraFaint}" stroke-width="${DIAGRAM_STROKES.faint}" rx="4" opacity="${DIAGRAM_OPACITY.frame}" />
  ${noteLines.length > 0 ? `<rect x="${notesX}" y="${frameY}" width="${notesWidth}" height="${notesHeight}" fill="#ffffff" stroke="${DIAGRAM_COLORS.ultraFaint}" stroke-width="${DIAGRAM_STROKES.faint}" rx="4" />` : ""}
  ${noteLines.length > 0 ? `<text x="${notesX + 14}" y="${frameY + 19}" font-size="12" font-weight="600" fill="${DIAGRAM_COLORS.secondary}">Notes</text>` : ""}
  ${wireParts.join("\n")}
  ${componentParts.join("\n")}
  ${noteParts.join("\n")}
  `);
}

export function renderShape3DHtml(payload: Record<string, unknown>): string {
  const shape = String(payload.shape || "cube");
  const title = escapeXml(String(payload.title || "3D Shape"));
  const color = escapeXml(String(payload.color || "#4f46e5"));
  const size = Number(payload.size || 1);
  const radius = Number(payload.radius || 1);
  const height = Number(payload.height || 2);
  const vector = Array.isArray(payload.vector) && payload.vector.length === 3 ? payload.vector.map((value) => Number(value)) : [1, 1, 1];
  const scenePayload = JSON.stringify({
    expr: String(payload.expr || "sin(x) * cos(y)"),
    x_min: Number(payload.x_min ?? -3),
    x_max: Number(payload.x_max ?? 3),
    y_min: Number(payload.y_min ?? -3),
    y_max: Number(payload.y_max ?? 3),
    samples: Math.max(8, Number(payload.samples || 36)),
    colorscale: String(payload.colorscale || "Viridis"),
    show_scale: payload.show_scale !== false,
    show_contours: Boolean(payload.show_contours),
    z_min: payload.z_min === null || payload.z_min === undefined ? null : Number(payload.z_min),
    z_max: payload.z_max === null || payload.z_max === undefined ? null : Number(payload.z_max),
    surfaces: Array.isArray(payload.surfaces) ? payload.surfaces : [],
    lines: Array.isArray(payload.lines) ? payload.lines : [],
    points: Array.isArray(payload.points) ? payload.points : [],
    palette: DEFAULT_PALETTE,
  });
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${title}</title>
<script src="https://cdn.plot.ly/plotly-2.35.2.min.js"><\/script>
<script src="https://cdn.jsdelivr.net/npm/expr-eval@2.0.2/dist/bundle.min.js"><\/script>
<style>body{font-family:${DEFAULT_FONT_FAMILY};margin:0;padding:24px;background:#fff;color:#111827}h2{margin:0 0 16px;font-size:24px;font-weight:600}#plot{width:100%;height:80vh}</style>
</head><body><h2>${title}</h2><div id="plot"></div>
<script>
const color='${color}';
const shape='${shape}';
const scene=${scenePayload};
const parser = new exprEval.Parser({
  allowMemberAccess:false,
  operators:{assignment:false,concatenate:false,conditional:false,logical:false,comparison:false,in:false,random:false,fndef:false}
});
const pickColor = (index, fallback) => fallback || scene.palette[index % scene.palette.length] || color;
const surfaceCount = Array.isArray(scene.surfaces) ? scene.surfaces.length : 0;
const shouldShowScale = (surface, count) => {
  if (surface.show_scale === true) return true;
  if (surface.show_scale === false) return false;
  return count <= 1 && scene.show_scale !== false;
};
const makeSurfaceTrace = (surface, index, count) => {
  let compiled;
  try {
    compiled = parser.parse(String(surface.expr || 'sin(x) * cos(y)'));
  } catch (error) {
    throw new Error('surface ' + (index + 1) + ' expression error: ' + error.message);
  }
  const samples = Math.max(8, Number(surface.samples || scene.samples || 36));
  const xMin = Number(surface.x_min ?? scene.x_min ?? -3);
  const xMax = Number(surface.x_max ?? scene.x_max ?? 3);
  const yMin = Number(surface.y_min ?? scene.y_min ?? -3);
  const yMax = Number(surface.y_max ?? scene.y_max ?? 3);
  const xs=[], ys=[], zs=[];
  for(let iy=0; iy<samples; iy++){ ys.push(yMin + (yMax - yMin) * iy / (samples - 1)); }
  for(let ix=0; ix<samples; ix++){ xs.push(xMin + (xMax - xMin) * ix / (samples - 1)); }
  for(let iy=0; iy<ys.length; iy++){
    const row=[];
    for(let ix=0; ix<xs.length; ix++){
      let z;
      try {
        z = Number(compiled.evaluate({x: xs[ix], y: ys[iy]}));
      } catch (error) {
        throw new Error('surface ' + (index + 1) + ' evaluation error: ' + error.message);
      }
      row.push(Number.isFinite(z) ? z : null);
    }
    zs.push(row);
  }
  return {
    type:'surface',
    name:String(surface.label || ('surface ' + (index + 1))),
    x:xs,
    y:ys,
    z:zs,
    colorscale:String(surface.colorscale || scene.colorscale || 'Viridis'),
    showscale:shouldShowScale(surface, count),
    opacity:Math.max(0.15, Math.min(1, Number(surface.opacity ?? (count > 1 ? 0.8 : 0.88)))),
    contours:surface.show_contours ? {z:{show:true,usecolormap:true,highlightcolor:'#111827',project:{z:true}}} : {},
    cmin:surface.z_min === null || surface.z_min === undefined ? undefined : Number(surface.z_min),
    cmax:surface.z_max === null || surface.z_max === undefined ? undefined : Number(surface.z_max),
    hovertemplate:'x=%{x}<br>y=%{y}<br>z=%{z}<extra>%{fullData.name}</extra>'
  };
};
const makeLineTrace = (line, index) => ({
  type:'scatter3d',
  mode:'lines',
  name:String(line.label || ('line ' + (index + 1))),
  x:(line.points || []).map((point) => Number(point.x)),
  y:(line.points || []).map((point) => Number(point.y)),
  z:(line.points || []).map((point) => Number(point.z)),
  line:{color:String(line.color || pickColor(index + 2, '')), width:Math.max(1.5, Number(line.width || 5))},
  hovertemplate:'x=%{x}<br>y=%{y}<br>z=%{z}<extra>%{fullData.name}</extra>'
});
const makePointTrace = (pointSet, index) => {
  const pts = Array.isArray(pointSet.points) ? pointSet.points : [];
  const labels = pts.map((point, pointIndex) => String(point.label || ('P' + (pointIndex + 1))));
  const showLabels = Boolean(pointSet.labels) || pts.some((point) => point.label);
  return {
    type:'scatter3d',
    mode:showLabels ? 'markers+text' : 'markers',
    name:String(pointSet.label || ('points ' + (index + 1))),
    x:pts.map((point) => Number(point.x)),
    y:pts.map((point) => Number(point.y)),
    z:pts.map((point) => Number(point.z)),
    text:showLabels ? labels : undefined,
    customdata:labels,
    textposition:'top center',
    marker:{size:Math.max(2, Number(pointSet.size || 5)), color:String(pointSet.color || pickColor(index + 4, '')), line:{color:'#ffffff', width:0.5}},
    hovertemplate:'%{customdata}<br>x=%{x}<br>y=%{y}<br>z=%{z}<extra>%{fullData.name}</extra>'
  };
};
let data=[];
if(shape==='cube'){
  const s=${size};
  data=[{type:'mesh3d',x:[0,s,s,0,0,s,s,0],y:[0,0,s,s,0,0,s,s],z:[0,0,0,0,s,s,s,s],i:[0,0,0,1,4,4,5,5,0,1,2,3],j:[1,2,3,2,5,6,6,7,4,5,6,7],k:[2,3,1,0,6,7,4,4,5,6,7,4],opacity:0.62,color:color,name:'cube'}];
} else if(shape==='sphere'){
  const r=${radius}; const x=[], y=[], z=[]; for(let i=0;i<=20;i++){for(let j=0;j<=20;j++){const th=Math.PI*i/20, ph=2*Math.PI*j/20; x.push(r*Math.sin(th)*Math.cos(ph)); y.push(r*Math.sin(th)*Math.sin(ph)); z.push(r*Math.cos(th));}}
  data=[{type:'scatter3d',mode:'markers',x,y,z,marker:{size:2,color:color},name:'sphere'}];
} else if(shape==='cylinder' || shape==='cone'){
  const r=${radius}, h=${height}; const x=[],y=[],z=[]; for(let i=0;i<=40;i++){const a=2*Math.PI*i/40; for(let j=0;j<=20;j++){const zz=h*j/20; const rr=shape==='cone'?r*(1-j/20):r; x.push(rr*Math.cos(a)); y.push(rr*Math.sin(a)); z.push(zz);}}
  data=[{type:'scatter3d',mode:'markers',x,y,z,marker:{size:2,color:color},name:shape}];
} else if(shape==='vector3d'){
  data=[{type:'scatter3d',mode:'lines+markers+text',x:[0,${vector[0]}],y:[0,${vector[1]}],z:[0,${vector[2]}],text:['O','v'],textposition:'top center',line:{width:6,color:color},marker:{size:4,color:color},name:'vector'}];
} else {
  const surfaces = surfaceCount > 0 ? scene.surfaces : [{
    expr: scene.expr,
    label: 'surface',
    colorscale: scene.colorscale,
    show_scale: scene.show_scale,
    show_contours: scene.show_contours,
    x_min: scene.x_min,
    x_max: scene.x_max,
    y_min: scene.y_min,
    y_max: scene.y_max,
    z_min: scene.z_min,
    z_max: scene.z_max,
    samples: scene.samples,
    opacity: 0.88,
  }];
  data = surfaces.map((surface, index) => makeSurfaceTrace(surface, index, surfaces.length));
  data.push(...(Array.isArray(scene.lines) ? scene.lines : []).map((line, index) => makeLineTrace(line, index)));
  data.push(...(Array.isArray(scene.points) ? scene.points : []).map((pointSet, index) => makePointTrace(pointSet, index)));
}
Plotly.newPlot('plot', data, {
  margin:{l:0,r:0,b:0,t:0},
  showlegend:data.length > 1,
  legend:{bgcolor:'rgba(255,255,255,0.82)', bordercolor:'#e5e7eb', borderwidth:1},
  scene:{
    aspectmode:'data',
    xaxis:{title:'x',backgroundcolor:'#ffffff',gridcolor:'#e5e7eb',zerolinecolor:'#cbd5e1'},
    yaxis:{title:'y',backgroundcolor:'#ffffff',gridcolor:'#e5e7eb',zerolinecolor:'#cbd5e1'},
    zaxis:{title:'z',backgroundcolor:'#ffffff',gridcolor:'#e5e7eb',zerolinecolor:'#cbd5e1'}
  }
}).catch((error) => {
  document.getElementById('plot').innerHTML = '<pre style="white-space:pre-wrap;font:14px/1.5 ' + '${DEFAULT_FONT_FAMILY}' + ';color:#991b1b;background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:16px">' + String(error && error.message ? error.message : error) + '</pre>';
});
<\/script></body></html>`;
}
