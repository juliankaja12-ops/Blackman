import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Brush,
  MousePointer,
  Play,
  RotateCcw,
  Share2,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { analyzeTrackPoints } from '../data/catalog';
import { TrackDefinition, TrackEnvironment, TrackPoint } from '../types/game';

interface TrackBuilderProps {
  driverName: string;
  customTracks: TrackDefinition[];
  onSaveAndRace: (track: TrackDefinition) => void;
  onSaveOnly: (track: TrackDefinition) => void;
  onPublishOnline: (track: TrackDefinition) => Promise<void>;
  onDeleteCustomTrack: (id: string) => void;
}

const WORLD_EXTENT = 420; // canvas maps [-420..+420] meters

function smoothClosedTrack(pts: TrackPoint[], passes = 2): TrackPoint[] {
  if (pts.length < 5) return pts;
  let curr = pts.map((p) => ({ ...p }));
  for (let pass = 0; pass < passes; pass++) {
    const next: TrackPoint[] = [];
    const n = curr.length;
    for (let i = 0; i < n; i++) {
      const prev = curr[(i - 1 + n) % n];
      const self = curr[i];
      const after = curr[(i + 1) % n];
      next.push({
        x: Math.round(prev.x * 0.2 + self.x * 0.6 + after.x * 0.2),
        z: Math.round(prev.z * 0.2 + self.z * 0.6 + after.z * 0.2),
        elevation: Math.round((prev.elevation * 0.25 + self.elevation * 0.5 + after.elevation * 0.25) * 10) / 10,
        bankDeg: self.bankDeg,
      });
    }
    curr = next;
  }
  return curr;
}

function resampleFreehandPoints(raw: { x: number; z: number }[]): TrackPoint[] {
  if (raw.length < 4) return [];
  const dists: number[] = [0];
  for (let i = 1; i < raw.length; i++) {
    dists.push(dists[i - 1] + Math.hypot(raw[i].x - raw[i - 1].x, raw[i].z - raw[i - 1].z));
  }
  const total = dists[dists.length - 1];
  if (total < 180) return [];

  const targetNodes = Math.max(14, Math.min(24, Math.round(total / 105)));
  const result: TrackPoint[] = [];
  for (let k = 0; k < targetNodes; k++) {
    const targetD = (k / targetNodes) * total;
    let idx = 0;
    while (idx < dists.length - 2 && dists[idx + 1] < targetD) idx++;
    const segLen = Math.max(0.001, dists[idx + 1] - dists[idx]);
    const t = (targetD - dists[idx]) / segLen;
    result.push({
      x: Math.round(raw[idx].x + (raw[idx + 1].x - raw[idx].x) * t),
      z: Math.round(raw[idx].z + (raw[idx + 1].z - raw[idx].z) * t),
      elevation: 0,
      bankDeg: 0,
    });
  }
  // Apply FIA apex smoothing & gentle natural corner banking
  const smoothed = smoothClosedTrack(result, 2);
  return smoothed.map((pt, i) => {
    const prev = smoothed[(i - 1 + smoothed.length) % smoothed.length];
    const next = smoothed[(i + 1) % smoothed.length];
    const v1x = pt.x - prev.x;
    const v1z = pt.z - prev.z;
    const v2x = next.x - pt.x;
    const v2z = next.z - pt.z;
    const cross = v1x * v2z - v1z * v2x;
    const mag = Math.max(1, Math.hypot(v1x, v1z) * Math.hypot(v2x, v2z));
    const turn = cross / mag;
    return {
      ...pt,
      elevation: Math.round(Math.max(0, Math.sin((i / smoothed.length) * Math.PI * 2) * 3 + 2)),
      bankDeg: Math.abs(turn) > 0.25 ? Math.round(Math.sign(turn) * 3) : 0,
    };
  });
}

function segmentsIntersect(
  a: { x: number; z: number },
  b: { x: number; z: number },
  c: { x: number; z: number },
  d: { x: number; z: number }
): boolean {
  const ccw = (p1: { x: number; z: number }, p2: { x: number; z: number }, p3: { x: number; z: number }) =>
    (p3.z - p1.z) * (p2.x - p1.x) > (p2.z - p1.z) * (p3.x - p1.x);
  return ccw(a, c, d) !== ccw(b, c, d) && ccw(a, b, c) !== ccw(a, b, d);
}

function hasSelfIntersection(pts: TrackPoint[]): boolean {
  const n = pts.length;
  if (n < 4) return false;
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      const c = pts[j];
      const d = pts[(j + 1) % n];
      if (segmentsIntersect(a, b, c, d)) return true;
    }
  }
  return false;
}

const FIA_PRESETS: {
  id: string;
  label: string;
  env: TrackEnvironment;
  width: number;
  points: TrackPoint[];
}[] = [
  {
    id: 'velocita',
    label: 'Tempio Velocità',
    env: 'autodromo_day',
    width: 15,
    points: [
      { x: -175, z: -230, elevation: 0, bankDeg: 0 },
      { x: 165, z: -230, elevation: 0, bankDeg: 0 },
      { x: 255, z: -215, elevation: 0, bankDeg: 0 },
      { x: 295, z: -155, elevation: 1, bankDeg: 3 },
      { x: 325, z: -55, elevation: 2, bankDeg: 4 },
      { x: 230, z: 30, elevation: 3, bankDeg: 2 },
      { x: 295, z: 145, elevation: 1, bankDeg: 4 },
      { x: 220, z: 245, elevation: 0, bankDeg: 5 },
      { x: 25, z: 220, elevation: 1, bankDeg: 1 },
      { x: -115, z: 130, elevation: 3, bankDeg: 2 },
      { x: -245, z: 205, elevation: 2, bankDeg: 3 },
      { x: -330, z: 95, elevation: 0, bankDeg: 4 },
      { x: -275, z: -35, elevation: 1, bankDeg: 1 },
      { x: -300, z: -175, elevation: 0, bankDeg: 4 },
    ],
  },
  {
    id: 'tecnico',
    label: 'Tecnico Misto FIA',
    env: 'autodromo_day',
    width: 14,
    points: [
      { x: -160, z: -225, elevation: 0, bankDeg: 0 },
      { x: 160, z: -225, elevation: 0, bankDeg: 0 },
      { x: 280, z: -195, elevation: 2, bankDeg: 3 },
      { x: 305, z: -90, elevation: 4, bankDeg: 2 },
      { x: 175, z: -75, elevation: 5, bankDeg: 2 },
      { x: 135, z: 20, elevation: 3, bankDeg: 0 },
      { x: 270, z: 95, elevation: 1, bankDeg: 3 },
      { x: 240, z: 225, elevation: 0, bankDeg: 4 },
      { x: 70, z: 245, elevation: 0, bankDeg: 1 },
      { x: -15, z: 140, elevation: 2, bankDeg: 0 },
      { x: -115, z: 220, elevation: 3, bankDeg: 3 },
      { x: -270, z: 170, elevation: 2, bankDeg: 2 },
      { x: -215, z: 45, elevation: 4, bankDeg: 0 },
      { x: -305, z: -65, elevation: 2, bankDeg: 3 },
      { x: -265, z: -185, elevation: 0, bankDeg: 2 },
    ],
  },
  {
    id: 'ardenne',
    label: 'Saliscendi Ardenne',
    env: 'alpine_pass',
    width: 14,
    points: [
      { x: -145, z: -230, elevation: 0, bankDeg: 0 },
      { x: 135, z: -230, elevation: 0, bankDeg: 0 },
      { x: 240, z: -185, elevation: 3, bankDeg: 4 },
      { x: 315, z: -70, elevation: 11, bankDeg: 5 },
      { x: 245, z: 75, elevation: 14, bankDeg: 3 },
      { x: 115, z: 45, elevation: 9, bankDeg: 2 },
      { x: 155, z: 175, elevation: 5, bankDeg: 4 },
      { x: 20, z: 255, elevation: 2, bankDeg: 3 },
      { x: -155, z: 205, elevation: 4, bankDeg: 4 },
      { x: -275, z: 105, elevation: 8, bankDeg: 3 },
      { x: -200, z: -20, elevation: 6, bankDeg: 2 },
      { x: -310, z: -110, elevation: 3, bankDeg: 3 },
      { x: -245, z: -215, elevation: 1, bankDeg: 2 },
    ],
  },
  {
    id: 'cittadino',
    label: 'Cittadino Notturno',
    env: 'night_street',
    width: 12,
    points: [
      { x: -135, z: -215, elevation: 0, bankDeg: 0 },
      { x: 125, z: -215, elevation: 0, bankDeg: 0 },
      { x: 235, z: -175, elevation: 3, bankDeg: 2 },
      { x: 245, z: -60, elevation: 7, bankDeg: 0 },
      { x: 155, z: -20, elevation: 9, bankDeg: 2 },
      { x: 215, z: 85, elevation: 6, bankDeg: 0 },
      { x: 145, z: 160, elevation: 3, bankDeg: 2 },
      { x: 225, z: 225, elevation: 1, bankDeg: 2 },
      { x: 75, z: 255, elevation: 0, bankDeg: 0 },
      { x: -65, z: 185, elevation: 0, bankDeg: 0 },
      { x: -165, z: 230, elevation: 0, bankDeg: 2 },
      { x: -265, z: 145, elevation: 0, bankDeg: 2 },
      { x: -225, z: 20, elevation: 0, bankDeg: 0 },
      { x: -290, z: -95, elevation: 2, bankDeg: 2 },
      { x: -235, z: -195, elevation: 1, bankDeg: 0 },
    ],
  },
];

const DEFAULT_BLUEPRINT: TrackPoint[] = FIA_PRESETS[0].points;

export const TrackBuilder: React.FC<TrackBuilderProps> = ({
  driverName,
  customTracks,
  onSaveAndRace,
  onSaveOnly,
  onPublishOnline,
  onDeleteCustomTrack,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [drawMode, setDrawMode] = useState<'freehand' | 'nodes'>('freehand');
  const [points, setPoints] = useState<TrackPoint[]>(DEFAULT_BLUEPRINT);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(0);
  const [trackName, setTrackName] = useState('Circuito Personale Darwin');
  const [environment, setEnvironment] = useState<TrackEnvironment>('autodromo_day');
  const [widthMeters, setWidthMeters] = useState(14);
  const [laps, setLaps] = useState(3);
  const [publishing, setPublishing] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const isDrawingRef = useRef(false);
  const draggingNodeRef = useRef<number | null>(null);
  const freehandStrokeRef = useRef<{ x: number; z: number }[]>([]);

  const stats = useMemo(() => analyzeTrackPoints(points), [points]);
  const selfCrossing = useMemo(() => hasSelfIntersection(points), [points]);

  const toWorld = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, z: 0 };
    const rect = canvas.getBoundingClientRect();
    const nx = ((clientX - rect.left) / rect.width) * 2 - 1;
    const nz = ((clientY - rect.top) / rect.height) * 2 - 1;
    return {
      x: Math.round(Math.max(-380, Math.min(380, nx * WORLD_EXTENT))),
      z: Math.round(Math.max(-380, Math.min(380, nz * WORLD_EXTENT))),
    };
  };

  // Render interactive FIA Circuit Architect CAD Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const toCanvas = (wx: number, wz: number) => ({
      cx: ((wx / WORLD_EXTENT) * 0.5 + 0.5) * w,
      cy: ((wz / WORLD_EXTENT) * 0.5 + 0.5) * h,
    });

    ctx.clearRect(0, 0, w, h);

    // CAD Blueprint Dark Background & Topographic Metric Grid
    ctx.fillStyle = '#0c1017';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    const step = w / 16;
    for (let i = 0; i <= 16; i++) {
      ctx.beginPath();
      ctx.moveTo(i * step, 0);
      ctx.lineTo(i * step, h);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, i * step);
      ctx.lineTo(w, i * step);
      ctx.stroke();
    }

    // Center crosshairs
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.moveTo(w / 2, 0);
    ctx.lineTo(w / 2, h);
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    // Freehand preview stroke if drawing
    if (isDrawingRef.current && freehandStrokeRef.current.length > 1) {
      ctx.strokeStyle = '#e10600';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      freehandStrokeRef.current.forEach((pt, idx) => {
        const { cx, cy } = toCanvas(pt.x, pt.z);
        if (idx === 0) ctx.moveTo(cx, cy);
        else ctx.lineTo(cx, cy);
      });
      ctx.stroke();
    }

    if (points.length >= 3) {
      const sampled: { x: number; y: number; wx: number; wz: number }[] = [];
      const n = points.length;
      const subSteps = 20;
      for (let i = 0; i < n; i++) {
        const p0 = points[(i - 1 + n) % n];
        const p1 = points[i];
        const p2 = points[(i + 1) % n];
        const p3 = points[(i + 2) % n];
        for (let s = 0; s < subSteps; s++) {
          const t = s / subSteps;
          const t2 = t * t;
          const t3 = t2 * t;
          const wx =
            0.5 *
            (2 * p1.x +
              (-p0.x + p2.x) * t +
              (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
              (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
          const wz =
            0.5 *
            (2 * p1.z +
              (-p0.z + p2.z) * t +
              (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 +
              (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3);
          const c = toCanvas(wx, wz);
          sampled.push({ x: c.cx, y: c.cy, wx, wz });
        }
      }

      const pxWidth = Math.max(10, (widthMeters / WORLD_EXTENT) * w * 0.55);

      // Runoff / Gravel Apron Contour
      ctx.strokeStyle = 'rgba(100, 116, 139, 0.25)';
      ctx.lineWidth = pxWidth + 14;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      sampled.forEach((p, idx) => (idx === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.closePath();
      ctx.stroke();

      // Parallel Pit Lane Preview along Start/Finish Straight
      const pitSpan = Math.min(28, Math.floor(sampled.length * 0.1));
      if (pitSpan > 4) {
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = Math.max(4, pxWidth * 0.42);
        ctx.beginPath();
        for (let k = -pitSpan; k <= pitSpan; k++) {
          const idx = (k + sampled.length) % sampled.length;
          const next = sampled[(idx + 1) % sampled.length];
          const curr = sampled[idx];
          const dx = next.x - curr.x;
          const dy = next.y - curr.y;
          const len = Math.max(1, Math.hypot(dx, dy));
          const nx = dy / len;
          const ny = -dx / len;
          const px = curr.x + nx * (pxWidth * 0.85);
          const py = curr.y + ny * (pxWidth * 0.85);
          if (k === -pitSpan) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }

      // Outer Kerb / Shoulder Stroke
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = pxWidth + 4;
      ctx.beginPath();
      sampled.forEach((p, idx) => (idx === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.closePath();
      ctx.stroke();

      // Asphalt Ribbon
      ctx.strokeStyle = '#242934';
      ctx.lineWidth = pxWidth;
      ctx.beginPath();
      sampled.forEach((p, idx) => (idx === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.closePath();
      ctx.stroke();

      // Speed / Curvature Analysis Overlay (DRS Straight = Emerald, Heavy Braking/Apex = Amber/Red)
      for (let i = 0; i < sampled.length; i += 2) {
        const pPrev = sampled[(i - 4 + sampled.length) % sampled.length];
        const pCurr = sampled[i];
        const pNext = sampled[(i + 4) % sampled.length];
        const a1 = Math.atan2(pCurr.y - pPrev.y, pCurr.x - pPrev.x);
        const a2 = Math.atan2(pNext.y - pCurr.y, pNext.x - pCurr.x);
        let dAng = Math.abs(a2 - a1);
        if (dAng > Math.PI) dAng = Math.PI * 2 - dAng;

        ctx.strokeStyle =
          dAng > 0.28 ? '#ef4444' : dAng < 0.08 ? 'rgba(16, 185, 129, 0.78)' : 'rgba(245, 158, 11, 0.65)';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(pCurr.x, pCurr.y);
        const pStep = sampled[(i + 2) % sampled.length];
        ctx.lineTo(pStep.x, pStep.y);
        ctx.stroke();
      }

      // FIA Sector 1 / 2 / 3 Split Badges
      [
        [0, 'S1 / START', '#22c55e'],
        [Math.floor(sampled.length * 0.33), 'S2', '#38bdf8'],
        [Math.floor(sampled.length * 0.66), 'S3', '#f59e0b'],
      ].forEach(([idxVal, label, col]) => {
        const pt = sampled[idxVal as number];
        if (!pt) return;
        ctx.fillStyle = col as string;
        ctx.font = 'bold 10px "JetBrains Mono", monospace';
        ctx.fillText(label as string, pt.x + 10, pt.y - 10);
      });

      // Start/Finish Checkered Line & Direction Arrow at sample[0]
      if (sampled.length > 2) {
        const s0 = sampled[0];
        const s1 = sampled[1];
        const ang = Math.atan2(s1.y - s0.y, s1.x - s0.x);
        ctx.save();
        ctx.translate(s0.x, s0.y);
        ctx.rotate(ang);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-3, -pxWidth / 2, 6, pxWidth);
        ctx.fillStyle = '#e10600';
        ctx.beginPath();
        ctx.moveTo(12, 0);
        ctx.lineTo(3, -6);
        ctx.lineTo(3, 6);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    // Draw Control Nodes
    points.forEach((pt, idx) => {
      const { cx, cy } = toCanvas(pt.x, pt.z);
      const isSelected = selectedIdx === idx;
      ctx.beginPath();
      ctx.arc(cx, cy, isSelected ? 7 : drawMode === 'nodes' ? 5.5 : 3.5, 0, Math.PI * 2);
      ctx.fillStyle = idx === 0 ? '#22c55e' : isSelected ? '#e10600' : '#f8fafc';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#0b0d11';
      ctx.stroke();

      if (pt.elevation > 0 || pt.bankDeg !== 0) {
        ctx.fillStyle = '#94a3b8';
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.fillText(
          `${pt.elevation > 0 ? `+${pt.elevation}m` : ''}${pt.bankDeg !== 0 ? ` ${pt.bankDeg}°` : ''}`.trim(),
          cx + 9,
          cy - 6
        );
      }
    });

    // 100m Metric Scale Bar & Legend
    const scalePx = (100 / (WORLD_EXTENT * 2)) * w;
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(18, h - 18);
    ctx.lineTo(18 + scalePx, h - 18);
    ctx.stroke();
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillText('100 m', 18, h - 24);
  }, [points, selectedIdx, drawMode, widthMeters]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const world = toWorld(e.clientX, e.clientY);
    if (drawMode === 'freehand') {
      isDrawingRef.current = true;
      freehandStrokeRef.current = [world];
      setSelectedIdx(null);
      return;
    }

    const hitIdx = points.findIndex(
      (p) => Math.hypot(p.x - world.x, p.z - world.z) < 24
    );
    if (hitIdx >= 0) {
      draggingNodeRef.current = hitIdx;
      setSelectedIdx(hitIdx);
    } else {
      let insertAt = points.length;
      if (points.length >= 2) {
        let bestDist = Infinity;
        for (let i = 0; i < points.length; i++) {
          const a = points[i];
          const b = points[(i + 1) % points.length];
          const mx = (a.x + b.x) * 0.5;
          const mz = (a.z + b.z) * 0.5;
          const d = Math.hypot(mx - world.x, mz - world.z);
          if (d < bestDist) {
            bestDist = d;
            insertAt = i + 1;
          }
        }
      }
      const next = [...points];
      next.splice(insertAt, 0, { ...world, elevation: 0, bankDeg: 0 });
      setPoints(next);
      setSelectedIdx(insertAt);
      draggingNodeRef.current = insertAt;
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const world = toWorld(e.clientX, e.clientY);
    if (drawMode === 'freehand' && isDrawingRef.current) {
      const stroke = freehandStrokeRef.current;
      const last = stroke[stroke.length - 1];
      if (!last || Math.hypot(world.x - last.x, world.z - last.z) > 10) {
        stroke.push(world);
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (canvas && ctx && last) {
          const w = canvas.width;
          const h = canvas.height;
          ctx.strokeStyle = '#e10600';
          ctx.lineWidth = 4;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(
            ((last.x / WORLD_EXTENT) * 0.5 + 0.5) * w,
            ((last.z / WORLD_EXTENT) * 0.5 + 0.5) * h
          );
          ctx.lineTo(
            ((world.x / WORLD_EXTENT) * 0.5 + 0.5) * w,
            ((world.z / WORLD_EXTENT) * 0.5 + 0.5) * h
          );
          ctx.stroke();
        }
      }
      return;
    }

    if (drawMode === 'nodes' && draggingNodeRef.current !== null) {
      const idx = draggingNodeRef.current;
      setPoints((prev) =>
        prev.map((p, i) => (i === idx ? { ...p, x: world.x, z: world.z } : p))
      );
    }
  };

  const handlePointerUp = () => {
    if (drawMode === 'freehand' && isDrawingRef.current) {
      isDrawingRef.current = false;
      const resampled = resampleFreehandPoints(freehandStrokeRef.current);
      if (resampled.length >= 6) {
        setPoints(resampled);
        setSelectedIdx(0);
        setStatusMsg('Tracciato levigato con curve FIA e corsia box pronto in 3D.');
      } else {
        setStatusMsg('Disegna un anello più ampio per generare un circuito valido.');
      }
      freehandStrokeRef.current = [];
    }
    draggingNodeRef.current = null;
  };

  // Authentic FIA Procedural Generator: straight pit sector + braking hairpin + Esses + fast sweeper
  const generateRandomCircuit = () => {
    const straightHalf = 145 + Math.round(Math.random() * 45);
    const straightZ = -(210 + Math.round(Math.random() * 35));
    const generated: TrackPoint[] = [
      { x: -straightHalf, z: straightZ, elevation: 0, bankDeg: 0 },
      { x: straightHalf * 0.4, z: straightZ, elevation: 0, bankDeg: 0 },
      { x: straightHalf, z: straightZ, elevation: 0, bankDeg: 0 },
    ];

    const bodyNodes = 11;
    const phaseShift = Math.random() * Math.PI * 2;
    for (let i = 0; i < bodyNodes; i++) {
      // Sweep cleanly from right (+0.2 rad) clockwise around to left (+PI - 0.25 rad)
      const frac = i / (bodyNodes - 1);
      const ang = -0.35 + frac * (Math.PI + 0.72);
      const lobe =
        Math.sin(frac * Math.PI * 3 + phaseShift) * 58 +
        (i % 3 === 1 ? -45 : 32);
      const rx = 250 + lobe;
      const rz = 225 + lobe * 0.65;
      generated.push({
        x: Math.round(Math.max(-350, Math.min(350, Math.cos(ang) * rx))),
        z: Math.round(Math.max(-175, Math.min(290, Math.sin(ang) * rz + 35))),
        elevation: Math.round(Math.max(0, Math.sin(frac * Math.PI * 2.2) * 6 + 2)),
        bankDeg: i % 2 === 0 ? 3 : 1,
      });
    }
    const smoothed = smoothClosedTrack(generated, 1);
    setPoints(smoothed);
    setSelectedIdx(0);
    setStatusMsg('Layout FIA realistico generato con rettilineo box e curve tecniche.');
  };

  const buildTrackObject = (): TrackDefinition => ({
    id: `custom_${Date.now().toString(36)}`,
    name: trackName.trim() || 'Circuito Senza Nome',
    author: driverName,
    environment,
    widthMeters,
    laps,
    points,
    lengthKm: stats.lengthKm,
    cornersCount: stats.cornersCount,
    difficulty: stats.difficulty,
    prizePool: stats.prizePool,
    isCustom: true,
  });

  const selectedNode = selectedIdx !== null ? points[selectedIdx] : null;

  return (
    <div className="flex-1 overflow-y-auto bg-[#0b0d11] p-6">
      <div className="max-w-[1380px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Interactive FIA Circuit Architect Board */}
        <div className="lg:col-span-8 bg-[#12161f] border border-white/10 rounded-lg p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
            <div>
              <h1 className="font-display text-xl font-bold text-white">
                Studio Progettazione Circuiti FIA
              </h1>
              <p className="text-xs text-slate-400">
                {drawMode === 'freehand'
                  ? 'Disegna il tracciato: verrà levigato con cordoli in curva, zone DRS (verde), staccate (rosso) e corsia box.'
                  : 'Clicca per inserire curve o trascina i nodi per disegnare chicane, paraboliche e dislivelli reali.'}
              </p>
            </div>

            <div className="flex items-center gap-1 p-1 bg-[#0b0d11] rounded-md border border-white/10">
              <button
                type="button"
                onClick={() => setDrawMode('freehand')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
                  drawMode === 'freehand'
                    ? 'bg-[#e10600] text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Brush className="w-3.5 h-3.5" />
                Disegno Libero
              </button>
              <button
                type="button"
                onClick={() => setDrawMode('nodes')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
                  drawMode === 'nodes'
                    ? 'bg-[#e10600] text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <MousePointer className="w-3.5 h-3.5" />
                Punti Precisione
              </button>
            </div>
          </div>

          {/* Real Architectural FIA Circuit Presets */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-slate-400 mr-1">Modelli Reali:</span>
            {FIA_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  setPoints(preset.points);
                  setEnvironment(preset.env);
                  setWidthMeters(preset.width);
                  setSelectedIdx(0);
                  setStatusMsg(`Caricato modello reale "${preset.label}".`);
                }}
                className="px-2.5 py-1 rounded bg-[#0b0d11] hover:bg-white/10 border border-white/10 text-slate-200 cursor-pointer"
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="relative rounded-md overflow-hidden border border-white/10 bg-[#0c1017]">
            <canvas
              ref={canvasRef}
              width={880}
              height={540}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
              className="w-full h-auto block cursor-crosshair touch-none"
            />
            {/* CAD Legend Overlay */}
            <div className="absolute top-2.5 right-2.5 bg-[#0b0d11]/90 border border-white/10 rounded px-2.5 py-1.5 flex items-center gap-3 text-[10px] text-slate-300 pointer-events-none">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-0.5 bg-emerald-400 inline-block" /> DRS/Rettilineo
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-0.5 bg-rose-500 inline-block" /> Staccata/Apex
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-0.5 bg-slate-400 inline-block" /> Pit Lane
              </span>
            </div>
          </div>

          {/* Elevation Profile Bar */}
          <div className="bg-[#0b0d11] border border-white/5 rounded px-3 py-2 flex items-center justify-between gap-4">
            <span className="text-[11px] text-slate-400 shrink-0">Profilo Altimetrico:</span>
            <div className="flex items-end gap-1 flex-1 h-6">
              {points.map((pt, idx) => (
                <div
                  key={idx}
                  onClick={() => setSelectedIdx(idx)}
                  title={`Nodo #${idx + 1}: +${pt.elevation}m / Parabolica ${pt.bankDeg}°`}
                  className={`flex-1 rounded-t cursor-pointer transition-colors ${
                    selectedIdx === idx ? 'bg-[#e10600]' : 'bg-sky-500/50 hover:bg-sky-400'
                  }`}
                  style={{ height: `${Math.max(18, (pt.elevation / 16) * 100)}%` }}
                />
              ))}
            </div>
            {selfCrossing && (
              <span className="text-[11px] text-amber-400 font-medium shrink-0">
                Attenzione: il tracciato si incrocia
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs text-slate-400">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={generateRandomCircuit}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-white/5 hover:bg-white/10 text-slate-200 cursor-pointer transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Genera Circuito FIA Realistico
              </button>
              <button
                type="button"
                onClick={() => {
                  setPoints(DEFAULT_BLUEPRINT);
                  setSelectedIdx(0);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-white/5 hover:bg-white/10 text-slate-200 cursor-pointer transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Ripristina Base
              </button>
            </div>
            {statusMsg && <span className="text-emerald-400">{statusMsg}</span>}
          </div>
        </div>

        {/* Right: Parameters & Saved Circuits */}
        <div className="lg:col-span-4 space-y-5">
          <div className="bg-[#12161f] border border-white/10 rounded-lg p-5 space-y-4">
            <h2 className="font-display text-base font-bold text-white">
              Specifiche &amp; Ambientazione
            </h2>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Nome Circuito
                </label>
                <input
                  type="text"
                  value={trackName}
                  onChange={(e) => setTrackName(e.target.value)}
                  maxLength={42}
                  className="w-full px-3 py-2 rounded bg-[#0b0d11] border border-white/10 text-sm text-white focus:outline-none focus:border-[#e10600]"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Ambientazione 3D
                </label>
                <select
                  value={environment}
                  onChange={(e) => setEnvironment(e.target.value as TrackEnvironment)}
                  className="w-full px-3 py-2 rounded bg-[#0b0d11] border border-white/10 text-sm text-white focus:outline-none focus:border-[#e10600]"
                >
                  <option value="autodromo_day">Autodromo Classico (Giorno)</option>
                  <option value="night_street">Circuito Cittadino Notturno</option>
                  <option value="desert_sunset">Gran Premio nel Deserto (Tramonto)</option>
                  <option value="alpine_pass">Passo Alpino Veloce</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Larghezza ({widthMeters} m)
                  </label>
                  <input
                    type="range"
                    min={10}
                    max={20}
                    value={widthMeters}
                    onChange={(e) => setWidthMeters(Number(e.target.value))}
                    className="w-full accent-[#e10600]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Giri Gara ({laps})
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={laps}
                    onChange={(e) => setLaps(Number(e.target.value))}
                    className="w-full accent-[#e10600]"
                  />
                </div>
              </div>
            </div>

            {selectedNode && selectedIdx !== null && (
              <div className="pt-3 border-t border-white/10 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-medium">
                    Nodo #{selectedIdx + 1} selezionato
                  </span>
                  {points.length > 5 && (
                    <button
                      type="button"
                      onClick={() => {
                        setPoints((prev) => prev.filter((_, i) => i !== selectedIdx));
                        setSelectedIdx(null);
                      }}
                      className="text-rose-400 hover:text-rose-300 cursor-pointer"
                    >
                      Rimuovi nodo
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Altitudine ({selectedNode.elevation} m)
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={16}
                      value={selectedNode.elevation}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setPoints((prev) =>
                          prev.map((p, i) =>
                            i === selectedIdx ? { ...p, elevation: val } : p
                          )
                        );
                      }}
                      className="w-full accent-[#e10600]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Parabolica ({selectedNode.bankDeg}°)
                    </label>
                    <input
                      type="range"
                      min={-6}
                      max={10}
                      value={selectedNode.bankDeg}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setPoints((prev) =>
                          prev.map((p, i) =>
                            i === selectedIdx ? { ...p, bankDeg: val } : p
                          )
                        );
                      }}
                      className="w-full accent-[#e10600]"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Calculated Geometry Metrics */}
            <div className="grid grid-cols-2 gap-2 pt-3 border-t border-white/10 text-xs">
              <div className="bg-[#0b0d11] p-2.5 rounded border border-white/5">
                <div className="text-slate-400">Lunghezza</div>
                <div className="font-mono text-base font-semibold text-white tabular-nums">
                  {stats.lengthKm.toFixed(2)} km
                </div>
              </div>
              <div className="bg-[#0b0d11] p-2.5 rounded border border-white/5">
                <div className="text-slate-400">Curve Rilevate</div>
                <div className="font-mono text-base font-semibold text-white tabular-nums">
                  {stats.cornersCount} · {stats.difficulty}
                </div>
              </div>
              <div className="col-span-2 bg-[#0b0d11] p-2.5 rounded border border-white/5 flex items-center justify-between">
                <span className="text-slate-400">Montepremi Stimato P1</span>
                <span className="font-mono text-base font-semibold text-amber-400 tabular-nums">
                  {stats.prizePool.toLocaleString('it-IT')} CR
                </span>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                disabled={points.length < 4}
                onClick={() => onSaveAndRace(buildTrackObject())}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-md bg-[#e10600] hover:bg-[#ff1e17] disabled:opacity-40 text-white text-sm font-semibold cursor-pointer transition-colors"
              >
                <Play className="w-4 h-4" />
                Salva &amp; Corri Subito in 3D
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={points.length < 4}
                  onClick={() => {
                    onSaveOnly(buildTrackObject());
                    setStatusMsg('Circuito salvato nei tuoi tracciati.');
                  }}
                  className="py-2 px-3 rounded-md bg-white/10 hover:bg-white/15 text-xs font-medium text-white cursor-pointer transition-colors"
                >
                  Salva in Archivio
                </button>
                <button
                  type="button"
                  disabled={points.length < 4 || publishing}
                  onClick={async () => {
                    setPublishing(true);
                    try {
                      await onPublishOnline(buildTrackObject());
                      setStatusMsg('Pubblicato sui server multiplayer!');
                    } finally {
                      setPublishing(false);
                    }
                  }}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-md bg-white/10 hover:bg-white/15 text-xs font-medium text-white cursor-pointer transition-colors"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  Pubblica Online
                </button>
              </div>
            </div>
          </div>

          {/* Saved Custom Circuits */}
          {customTracks.length > 0 && (
            <div className="bg-[#12161f] border border-white/10 rounded-lg p-5 space-y-3">
              <h3 className="font-display text-sm font-bold text-white">
                I Tuoi Circuiti Salvati ({customTracks.length})
              </h3>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {customTracks.map((tr) => (
                  <div
                    key={tr.id}
                    className="flex items-center justify-between gap-2 p-2.5 rounded bg-[#0b0d11] border border-white/5"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-white truncate">
                        {tr.name}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono tabular-nums">
                        {tr.lengthKm} km · {tr.cornersCount} curve · {tr.laps} giri
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => onSaveAndRace(tr)}
                        className="px-2.5 py-1 rounded bg-[#e10600] hover:bg-[#ff1e17] text-[11px] font-semibold text-white cursor-pointer"
                      >
                        Corri
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteCustomTrack(tr.id)}
                        className="p-1.5 rounded text-slate-400 hover:text-rose-400 cursor-pointer"
                        aria-label="Elimina circuito"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
