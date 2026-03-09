import React, { useState, useEffect, useRef, useCallback } from 'react';
import './ImageEditorModal.css';
import { Icons } from './ImageEditorIcons';
import { useSettingsStore } from '../store/useSettingsStore';

interface ImageEditorModalProps {
    src: string;
    onClose: () => void;
    onSaveToFeed: (base64Data: string) => void;
}

type Tool =
    | 'select' | 'pen' | 'highlighter' | 'blur' | 'rect' | 'circle'
    | 'arrow' | 'line' | 'text' | 'eraser' | 'crop' | 'magnifier' | 'stamp';

type StrokeDash = 'solid' | 'dashed' | 'dotted';
type CropHandle = 'tl' | 'tr' | 'bl' | 'br' | 'body' | null;
type Point = { x: number; y: number };

interface DrawAction {
    id: string;
    tool: Tool;
    color: string;
    lineWidth: number;
    points: Point[];
    start?: Point;
    end?: Point;
    text?: string;
    stampChar?: string;
    stampNumber?: number;   // counter-stamp: coloured circle with number
    isFinished: boolean;
    // ── extended style ────────────────────────────────────────
    opacity: number;
    shadowEnabled: boolean;
    shadowColor: string;
    shadowBlur: number;
    shadowOffsetX: number;
    shadowOffsetY: number;
    fillEnabled: boolean;
    fillColor: string;
    strokeDash: StrokeDash;
}

interface CropRect { x1: number; y1: number; x2: number; y2: number }

const WORKSPACE_PADDING = 1200;

const COLOR_PRESETS = [
    '#ef4444', '#f97316', '#eab308', '#22c55e',
    '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
    '#ffffff', '#000000',
];

const EMOJI_STAMPS = [
    { id: 'check', char: '✅', label: 'Check' },
    { id: 'cross', char: '❌', label: 'Cross' },
    { id: 'warning', char: '⚠️', label: 'Warning' },
    { id: 'info', char: 'ℹ️', label: 'Info' },
    { id: 'bug', char: '🐛', label: 'Bug' },
    { id: 'fire', char: '🔥', label: 'Hot' },
    { id: 'star', char: '⭐', label: 'Star' },
    { id: 'pin', char: '📌', label: 'Pin' },
];

const ASPECT_RATIOS = [
    { label: 'Free', value: null },
    { label: '1∶1', value: 1 },
    { label: '16∶9', value: 16 / 9 },
    { label: '4∶3', value: 4 / 3 },
    { label: '9∶16', value: 9 / 16 },
    { label: '3∶2', value: 3 / 2 },
];

const TOOL_LABELS: Record<Tool, string> = {
    select: 'Select', pen: 'Pen', highlighter: 'Highlight', blur: 'Blur',
    rect: 'Rectangle', circle: 'Circle', arrow: 'Arrow', line: 'Line',
    text: 'Text', eraser: 'Eraser', crop: 'Crop', magnifier: 'Magnifier', stamp: 'Stamp',
};

// ─────────────────────────────────────────────────────────────────────────────

export default function ImageEditorModal({ src, onClose, onSaveToFeed }: ImageEditorModalProps) {
    const accentColor = useSettingsStore(s => s.accentColor) || '#6366f1';

    // ── tool & colour ────────────────────────────────────────────────────────
    const [currentTool, setCurrentTool] = useState<Tool>('pen');
    const [currentColor, setCurrentColor] = useState(accentColor);
    const [lineWidth, setLineWidth] = useState(4);
    const [selectedStampId, setSelectedStampId] = useState<string>('counter');
    const [counterValue, setCounterValue] = useState(1);
    const [cropAspect, setCropAspect] = useState<number | null>(null);
    const [showStylePanel, setShowStylePanel] = useState(true);

    // ── extended style ───────────────────────────────────────────────────────
    const [opacity, setOpacity] = useState(100);
    const [shadowEnabled, setShadowEnabled] = useState(false);
    const [shadowColor, setShadowColor] = useState('#000000');
    const [shadowBlur, setShadowBlur] = useState(14);
    const [shadowOffsetX, setShadowOffsetX] = useState(0);
    const [shadowOffsetY, setShadowOffsetY] = useState(4);
    const [fillEnabled, setFillEnabled] = useState(false);
    const [fillColor, setFillColor] = useState(accentColor);
    const [strokeDash, setStrokeDash] = useState<StrokeDash>('solid');

    // ── viewport ─────────────────────────────────────────────────────────────
    const [scale, setScale] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [lastPan, setLastPan] = useState({ x: 0, y: 0 });

    // ── canvas refs ───────────────────────────────────────────────────────────
    const bgCanvasRef = useRef<HTMLCanvasElement>(null);
    const mainCanvasRef = useRef<HTMLCanvasElement>(null);
    const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
    const bgImageRef = useRef<HTMLImageElement | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // ── drawing ───────────────────────────────────────────────────────────────
    const [actions, setActions] = useState<DrawAction[]>([]);
    const [redoStack, setRedoStack] = useState<DrawAction[]>([]);
    const [currentAction, setCurrentAction] = useState<DrawAction | null>(null);
    const [isDrawing, setIsDrawing] = useState(false);

    // ── selection ─────────────────────────────────────────────────────────────
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [dragOrigin, setDragOrigin] = useState<Point | null>(null);

    // ── crop ──────────────────────────────────────────────────────────────────
    const [cropRect, setCropRect] = useState<CropRect | null>(null);
    const [cropHandle, setCropHandle] = useState<CropHandle>(null);
    const cropBodyRef = useRef<Point | null>(null);

    // ── loupe ─────────────────────────────────────────────────────────────────
    const [mousePos, setMousePos] = useState<Point>({ x: 0, y: 0 });
    const [showLoupe, setShowLoupe] = useState(false);

    // ── text input
    // cx/cy = canvas-space coords; sx/sy = screen coords at time of click ─────
    const [editingText, setEditingText] = useState<{
        id: string; cx: number; cy: number; sx: number; sy: number; text: string;
    } | null>(null);
    const textInputRef = useRef<HTMLInputElement>(null);

    // ─────────────────────────────────────────────────────────────────────────
    // STYLE SNAPSHOT
    // ─────────────────────────────────────────────────────────────────────────

    const styleSnap = useCallback(() => ({
        opacity, shadowEnabled, shadowColor, shadowBlur,
        shadowOffsetX, shadowOffsetY, fillEnabled, fillColor, strokeDash,
    }), [opacity, shadowEnabled, shadowColor, shadowBlur, shadowOffsetX, shadowOffsetY, fillEnabled, fillColor, strokeDash]);

    // ─────────────────────────────────────────────────────────────────────────
    // RENDERING
    // ─────────────────────────────────────────────────────────────────────────

    const applyDash = (ctx: CanvasRenderingContext2D, d: StrokeDash, lw: number) => {
        if (d === 'dashed') ctx.setLineDash([lw * 3, lw * 2]);
        else if (d === 'dotted') ctx.setLineDash([lw * 0.5, lw * 2]);
        else ctx.setLineDash([]);
    };

    const renderAction = useCallback((ctx: CanvasRenderingContext2D, action: DrawAction) => {
        ctx.save();
        ctx.globalAlpha = (action.opacity ?? 100) / 100;

        if (action.shadowEnabled) {
            ctx.shadowColor = action.shadowColor ?? '#000';
            ctx.shadowBlur = action.shadowBlur ?? 14;
            ctx.shadowOffsetX = action.shadowOffsetX ?? 0;
            ctx.shadowOffsetY = action.shadowOffsetY ?? 4;
        }
        if (action.id === selectedId) {
            ctx.shadowBlur = Math.max(ctx.shadowBlur || 0, 18);
            ctx.shadowColor = accentColor;
        }

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = action.lineWidth;
        ctx.strokeStyle = action.color;
        ctx.fillStyle = action.color;
        applyDash(ctx, action.strokeDash ?? 'solid', action.lineWidth);

        // ── pen / highlighter ─────────────────────────────────────────────
        if (action.tool === 'pen' || action.tool === 'highlighter') {
            if (action.tool === 'highlighter') {
                ctx.globalAlpha = ((action.opacity ?? 100) / 100) * 0.4;
                ctx.lineWidth = action.lineWidth * 3;
                ctx.globalCompositeOperation = 'multiply';
            }
            const pts = action.points;
            if (pts.length === 1) {
                ctx.beginPath();
                ctx.arc(pts[0].x, pts[0].y, action.lineWidth / 2, 0, Math.PI * 2);
                ctx.fill();
            } else if (pts.length >= 2) {
                ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
                for (let i = 1; i < pts.length - 1; i++) {
                    ctx.quadraticCurveTo(pts[i].x, pts[i].y,
                        (pts[i].x + pts[i + 1].x) / 2, (pts[i].y + pts[i + 1].y) / 2);
                }
                ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
                ctx.stroke();
            }
        }

        // ── eraser ────────────────────────────────────────────────────────
        else if (action.tool === 'eraser') {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.setLineDash([]);
            const pts = action.points;
            if (pts.length >= 2) {
                ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
                for (let i = 1; i < pts.length - 1; i++) {
                    ctx.quadraticCurveTo(pts[i].x, pts[i].y,
                        (pts[i].x + pts[i + 1].x) / 2, (pts[i].y + pts[i + 1].y) / 2);
                }
                ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
                ctx.stroke();
            }
        }

        // ── blur / pixelate ───────────────────────────────────────────────
        else if (action.tool === 'blur') {
            if (!action.start || !action.end || !bgImageRef.current) { ctx.restore(); return; }
            const x = Math.min(action.start.x, action.end.x), y = Math.min(action.start.y, action.end.y);
            const w = Math.abs(action.end.x - action.start.x), h = Math.abs(action.end.y - action.start.y);
            if (w < 2 || h < 2) { ctx.restore(); return; }
            const px = Math.max(6, action.lineWidth * 2);
            const tw = Math.max(1, Math.floor(w / px)), th = Math.max(1, Math.floor(h / px));
            const tmp = document.createElement('canvas'); tmp.width = tw; tmp.height = th;
            const tc = tmp.getContext('2d')!;
            tc.imageSmoothingEnabled = true;
            tc.drawImage(bgImageRef.current, x - WORKSPACE_PADDING, y - WORKSPACE_PADDING, w, h, 0, 0, tw, th);
            ctx.save(); ctx.imageSmoothingEnabled = false;
            ctx.drawImage(tmp, 0, 0, tw, th, x, y, w, h);
            ctx.restore();
        }

        // ── rect ──────────────────────────────────────────────────────────
        else if (action.tool === 'rect' && action.start && action.end) {
            const x = Math.min(action.start.x, action.end.x), y = Math.min(action.start.y, action.end.y);
            const w = Math.abs(action.end.x - action.start.x), h = Math.abs(action.end.y - action.start.y);
            if (action.fillEnabled) {
                const prevA = ctx.globalAlpha;
                ctx.globalAlpha = prevA * 0.35;
                ctx.fillStyle = action.fillColor ?? action.color;
                ctx.fillRect(x, y, w, h);
                ctx.globalAlpha = prevA;
            }
            ctx.strokeRect(x, y, w, h);
        }

        // ── circle ────────────────────────────────────────────────────────
        else if (action.tool === 'circle' && action.start && action.end) {
            const rx = (action.end.x - action.start.x) / 2, ry = (action.end.y - action.start.y) / 2;
            const cx2 = action.start.x + rx, cy2 = action.start.y + ry;
            ctx.beginPath();
            ctx.ellipse(cx2, cy2, Math.abs(rx), Math.abs(ry), 0, 0, Math.PI * 2);
            if (action.fillEnabled) {
                const prevA = ctx.globalAlpha; ctx.globalAlpha = prevA * 0.35;
                ctx.fillStyle = action.fillColor ?? action.color; ctx.fill(); ctx.globalAlpha = prevA;
            }
            ctx.stroke();
        }

        // ── arrow / line ──────────────────────────────────────────────────
        else if ((action.tool === 'arrow' || action.tool === 'line') && action.start && action.end) {
            ctx.beginPath();
            ctx.moveTo(action.start.x, action.start.y);
            ctx.lineTo(action.end.x, action.end.y);
            ctx.stroke();
            if (action.tool === 'arrow') {
                const angle = Math.atan2(action.end.y - action.start.y, action.end.x - action.start.x);
                const hl = action.lineWidth * 4 + 12;
                ctx.setLineDash([]);
                ctx.beginPath();
                ctx.moveTo(action.end.x, action.end.y);
                ctx.lineTo(action.end.x - hl * Math.cos(angle - Math.PI / 6), action.end.y - hl * Math.sin(angle - Math.PI / 6));
                ctx.lineTo(action.end.x - hl * Math.cos(angle + Math.PI / 6), action.end.y - hl * Math.sin(angle + Math.PI / 6));
                ctx.closePath(); ctx.fill();
            }
        }

        // ── text ──────────────────────────────────────────────────────────
        else if (action.tool === 'text' && action.start && action.text) {
            const fs = action.lineWidth * 4 + 16;
            ctx.font = `700 ${fs}px 'Inter','SF Pro Display',sans-serif`;
            ctx.textBaseline = 'top';
            ctx.setLineDash([]);
            // legibility stroke
            ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = fs * 0.08;
            ctx.strokeText(action.text, action.start.x, action.start.y);
            ctx.fillStyle = action.color;
            ctx.fillText(action.text, action.start.x, action.start.y);
        }

        // ── stamp ─────────────────────────────────────────────────────────
        else if (action.tool === 'stamp' && action.start) {
            const cx2 = action.start.x, cy2 = action.start.y;
            const r = action.lineWidth * 5 + 14;
            ctx.setLineDash([]);
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

            if (action.stampNumber !== undefined) {
                // coloured circle + white number
                ctx.fillStyle = action.color;
                ctx.beginPath(); ctx.arc(cx2, cy2, r, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.5;
                ctx.beginPath(); ctx.arc(cx2, cy2, r, 0, Math.PI * 2); ctx.stroke();
                const fs2 = Math.round(r * 1.25);
                ctx.fillStyle = '#fff';
                ctx.font = `800 ${fs2}px 'Inter',sans-serif`;
                ctx.fillText(String(action.stampNumber), cx2, cy2);
            } else if (action.stampChar) {
                // emoji with subtle drop-shadow background for dark-mode visibility
                const fs2 = action.lineWidth * 7 + 24;
                ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 6;
                ctx.font = `${fs2}px serif`;
                ctx.fillText(action.stampChar, cx2, cy2);
            }
        }

        ctx.restore();
    }, [selectedId, accentColor]);

    const drawBackground = useCallback(() => {
        const c = bgCanvasRef.current; const ctx = c?.getContext('2d'); const img = bgImageRef.current;
        if (!c || !ctx || !img) return;
        ctx.clearRect(0, 0, c.width, c.height);
        ctx.save(); ctx.shadowBlur = 60; ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.fillStyle = '#000'; ctx.fillRect(WORKSPACE_PADDING, WORKSPACE_PADDING, img.width, img.height);
        ctx.restore(); ctx.drawImage(img, WORKSPACE_PADDING, WORKSPACE_PADDING);
    }, []);

    const drawMain = useCallback(() => {
        const c = mainCanvasRef.current; const ctx = c?.getContext('2d');
        if (!c || !ctx) return;
        ctx.clearRect(0, 0, c.width, c.height);
        actions.forEach(a => renderAction(ctx, a));
    }, [actions, renderAction]);

    const drawOverlay = useCallback(() => {
        const c = overlayCanvasRef.current; const ctx = c?.getContext('2d');
        if (!c || !ctx) return;
        ctx.clearRect(0, 0, c.width, c.height);
        if (currentAction) renderAction(ctx, currentAction);
    }, [currentAction, renderAction]);

    // ─────────────────────────────────────────────────────────────────────────
    // SETUP
    // ─────────────────────────────────────────────────────────────────────────

    const setupCanvases = useCallback((imgW: number, imgH: number) => {
        const container = containerRef.current; if (!container) return;
        const dpr = window.devicePixelRatio || 1;
        const cw = imgW + WORKSPACE_PADDING * 2, ch = imgH + WORKSPACE_PADDING * 2;
        [bgCanvasRef, mainCanvasRef, overlayCanvasRef].forEach(ref => {
            const cv = ref.current; if (!cv) return;
            cv.width = cw * dpr; cv.height = ch * dpr;
            const ctx = cv.getContext('2d'); if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        });
        const fit = Math.min(1, (container.clientWidth - 120) / imgW, (container.clientHeight - 120) / imgH);
        setScale(fit);
        setOffset({ x: container.clientWidth / 2 - (imgW / 2 + WORKSPACE_PADDING) * fit, y: container.clientHeight / 2 - (imgH / 2 + WORKSPACE_PADDING) * fit });
    }, []);

    const fitToScreen = useCallback(() => {
        const img = bgImageRef.current; const container = containerRef.current;
        if (!img || !container) return;
        const fit = Math.min(1, (container.clientWidth - 120) / img.width, (container.clientHeight - 120) / img.height);
        setScale(fit);
        setOffset({ x: container.clientWidth / 2 - (img.width / 2 + WORKSPACE_PADDING) * fit, y: container.clientHeight / 2 - (img.height / 2 + WORKSPACE_PADDING) * fit });
    }, []);

    useEffect(() => {
        const img = new Image();
        img.onload = () => { bgImageRef.current = img; setupCanvases(img.width, img.height); drawBackground(); };
        img.src = src;
    }, [src]); // eslint-disable-line

    useEffect(() => { drawMain(); }, [drawMain]);
    useEffect(() => { drawOverlay(); }, [drawOverlay]);

    // ─────────────────────────────────────────────────────────────────────────
    // COORDINATE HELPERS
    // ─────────────────────────────────────────────────────────────────────────

    const screenToCanvas = useCallback((cx: number, cy: number): Point => ({
        x: (cx - offset.x) / scale, y: (cy - offset.y) / scale,
    }), [offset, scale]);

    const normCrop = (r: CropRect) => ({
        x: Math.min(r.x1, r.x2), y: Math.min(r.y1, r.y2),
        w: Math.abs(r.x2 - r.x1), h: Math.abs(r.y2 - r.y1),
    });

    // ─────────────────────────────────────────────────────────────────────────
    // HIT TEST
    // ─────────────────────────────────────────────────────────────────────────

    const hitTest = (pt: Point, a: DrawAction): boolean => {
        const thr = a.lineWidth + 12;
        if (a.tool === 'pen' || a.tool === 'highlighter' || a.tool === 'eraser')
            return a.points.some(p => Math.hypot(p.x - pt.x, p.y - pt.y) < thr);
        if (a.tool === 'stamp' && a.start)
            return Math.hypot(pt.x - a.start.x, pt.y - a.start.y) < a.lineWidth * 5 + 14 + 10;
        if (a.start && a.end) {
            if (a.tool === 'rect' || a.tool === 'blur') {
                const x = Math.min(a.start.x, a.end.x), y = Math.min(a.start.y, a.end.y);
                const w = Math.abs(a.end.x - a.start.x), h = Math.abs(a.end.y - a.start.y);
                return pt.x >= x - thr && pt.x <= x + w + thr && pt.y >= y - thr && pt.y <= y + h + thr;
            }
            if (a.tool === 'circle') {
                const rx = Math.abs(a.end.x - a.start.x) / 2, ry = Math.abs(a.end.y - a.start.y) / 2;
                const cx2 = (a.start.x + a.end.x) / 2, cy2 = (a.start.y + a.end.y) / 2;
                return ((pt.x - cx2) / (rx + thr)) ** 2 + ((pt.y - cy2) / (ry + thr)) ** 2 <= 1;
            }
            if (a.tool === 'arrow' || a.tool === 'line') {
                const C = a.end.x - a.start.x, D = a.end.y - a.start.y;
                const len2 = C * C + D * D;
                const t = len2 ? Math.max(0, Math.min(1, ((pt.x - a.start.x) * C + (pt.y - a.start.y) * D) / len2)) : 0;
                return Math.hypot(pt.x - (a.start.x + t * C), pt.y - (a.start.y + t * D)) < thr;
            }
        }
        if (a.tool === 'text' && a.start && a.text) {
            const fs = a.lineWidth * 4 + 16;
            return pt.x >= a.start.x && pt.x <= a.start.x + a.text.length * fs * 0.65
                && pt.y >= a.start.y && pt.y <= a.start.y + fs;
        }
        return false;
    };

    // ─────────────────────────────────────────────────────────────────────────
    // CROP HANDLE GLOBAL MOUSE TRACKING
    // ─────────────────────────────────────────────────────────────────────────

    useEffect(() => {
        if (cropHandle === null) return;
        const onMove = (e: MouseEvent) => {
            if (!cropRect) return;
            const pt = screenToCanvas(e.clientX, e.clientY);
            if (cropHandle === 'body' && cropBodyRef.current) {
                const dx = pt.x - cropBodyRef.current.x, dy = pt.y - cropBodyRef.current.y;
                setCropRect(r => r ? { x1: r.x1 + dx, y1: r.y1 + dy, x2: r.x2 + dx, y2: r.y2 + dy } : r);
                cropBodyRef.current = pt; return;
            }
            let nr = { ...cropRect };
            if (cropHandle === 'tl') { nr.x1 = pt.x; nr.y1 = pt.y; }
            else if (cropHandle === 'tr') { nr.x2 = pt.x; nr.y1 = pt.y; }
            else if (cropHandle === 'bl') { nr.x1 = pt.x; nr.y2 = pt.y; }
            else if (cropHandle === 'br') { nr.x2 = pt.x; nr.y2 = pt.y; }
            if (cropAspect !== null) {
                const w = Math.abs(nr.x2 - nr.x1), h = w / cropAspect;
                const sy = nr.y2 > nr.y1 ? 1 : -1;
                if (cropHandle === 'tl' || cropHandle === 'tr') nr.y1 = nr.y2 - h * sy;
                else nr.y2 = nr.y1 + h * sy;
            }
            setCropRect(nr);
        };
        const onUp = () => { setCropHandle(null); cropBodyRef.current = null; };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    }, [cropHandle, cropRect, screenToCanvas, cropAspect]);

    // ─────────────────────────────────────────────────────────────────────────
    // POINTER HANDLERS
    // ─────────────────────────────────────────────────────────────────────────

    const getClient = (e: React.MouseEvent | React.TouchEvent) =>
        'touches' in e ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
            : { x: e.clientX, y: e.clientY };

    const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
        const { x: cx, y: cy } = getClient(e);
        const pt = screenToCanvas(cx, cy);
        setMousePos(pt);

        if (isPanning || ('button' in e && e.button === 1)) { setIsPanning(true); setLastPan({ x: cx, y: cy }); return; }

        if (currentTool === 'select') {
            const hit = [...actions].reverse().find(a => hitTest(pt, a));
            if (hit) { setSelectedId(hit.id); setIsDragging(true); setDragOrigin(pt); }
            else setSelectedId(null);
            return;
        }
        if (currentTool === 'crop') {
            setCropRect({ x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y }); setCropHandle('br'); return;
        }
        if (currentTool === 'text') {
            // Store BOTH canvas coords (cx,cy) and screen coords (sx,sy) for positioning the input
            setEditingText({ id: Date.now().toString(), cx: pt.x, cy: pt.y, sx: cx, sy: cy, text: '' });
            return;
        }
        if (currentTool === 'magnifier') { setShowLoupe(true); return; }

        if (currentTool === 'stamp') {
            const isCounter = selectedStampId === 'counter';
            const stamp = EMOJI_STAMPS.find(s => s.id === selectedStampId);
            setActions(prev => [...prev, {
                id: Date.now().toString(), tool: 'stamp',
                color: currentColor, lineWidth,
                points: [], start: pt,
                stampChar: isCounter ? undefined : stamp?.char,
                stampNumber: isCounter ? counterValue : undefined,
                isFinished: true, ...styleSnap(),
            }]);
            setRedoStack([]);
            if (isCounter) setCounterValue(v => v + 1);
            return;
        }

        setIsDrawing(true);
        setRedoStack([]);
        setCurrentAction({
            id: Date.now().toString(), tool: currentTool,
            color: currentColor, lineWidth,
            points: [pt], start: pt, end: pt,
            isFinished: false, ...styleSnap(),
        });
    };

    const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
        const { x: cx, y: cy } = getClient(e);
        const pt = screenToCanvas(cx, cy);
        setMousePos(pt);

        if (isPanning) {
            setOffset(o => ({ x: o.x + (cx - lastPan.x), y: o.y + (cy - lastPan.y) }));
            setLastPan({ x: cx, y: cy }); return;
        }
        if (isDragging && selectedId && dragOrigin) {
            const dx = pt.x - dragOrigin.x, dy = pt.y - dragOrigin.y;
            setActions(prev => prev.map(a => {
                if (a.id !== selectedId) return a;
                return {
                    ...a,
                    start: a.start ? { x: a.start.x + dx, y: a.start.y + dy } : undefined,
                    end: a.end ? { x: a.end.x + dx, y: a.end.y + dy } : undefined,
                    points: a.points.map(p => ({ x: p.x + dx, y: p.y + dy })),
                };
            }));
            setDragOrigin(pt); return;
        }
        if (!isDrawing || !currentAction) return;
        if (currentTool === 'pen' || currentTool === 'highlighter' || currentTool === 'eraser')
            setCurrentAction(a => a ? { ...a, points: [...a.points, pt] } : a);
        else
            setCurrentAction(a => a ? { ...a, end: pt } : a);
    };

    const handlePointerUp = () => {
        if (isPanning) { setIsPanning(false); return; }
        if (isDragging) { setIsDragging(false); setDragOrigin(null); return; }
        if (showLoupe) { setShowLoupe(false); return; }
        if (cropHandle !== null) return;
        if (isDrawing && currentAction) {
            setActions(prev => [...prev, { ...currentAction, isFinished: true }]);
            setCurrentAction(null); setIsDrawing(false);
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // WHEEL ZOOM
    // ─────────────────────────────────────────────────────────────────────────

    useEffect(() => {
        const el = containerRef.current; if (!el) return;
        const onWheel = (e: WheelEvent) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                const f = 1 - e.deltaY * 0.004;
                const ns = Math.min(Math.max(0.05, scale * f), 20);
                const cx = (e.clientX - offset.x) / scale, cy = (e.clientY - offset.y) / scale;
                setScale(ns); setOffset({ x: e.clientX - cx * ns, y: e.clientY - cy * ns });
            } else {
                setOffset(o => ({ x: o.x - e.deltaX, y: o.y - e.deltaY }));
            }
        };
        el.addEventListener('wheel', onWheel, { passive: false });
        return () => el.removeEventListener('wheel', onWheel);
    }, [scale, offset]);

    // ─────────────────────────────────────────────────────────────────────────
    // TEXT FINISH
    // ─────────────────────────────────────────────────────────────────────────

    const finishText = useCallback(() => {
        if (editingText?.text.trim()) {
            setActions(prev => [...prev, {
                id: editingText.id, tool: 'text',
                color: currentColor, lineWidth,
                points: [], start: { x: editingText.cx, y: editingText.cy },
                text: editingText.text, isFinished: true, ...styleSnap(),
            }]);
            setRedoStack([]);
        }
        setEditingText(null);
    }, [editingText, currentColor, lineWidth, styleSnap]);

    useEffect(() => { if (editingText && textInputRef.current) textInputRef.current.focus(); }, [editingText]);

    // ─────────────────────────────────────────────────────────────────────────
    // UNDO / REDO / CLEAR / DUPLICATE
    // ─────────────────────────────────────────────────────────────────────────

    const undo = useCallback(() => {
        setActions(prev => { if (!prev.length) return prev; setRedoStack(r => [...r, prev[prev.length - 1]]); return prev.slice(0, -1); });
    }, []);
    const redo = useCallback(() => {
        setRedoStack(prev => { if (!prev.length) return prev; setActions(a => [...a, prev[prev.length - 1]]); return prev.slice(0, -1); });
    }, []);
    const clear = () => { if (window.confirm('Clear all edits?')) { setActions([]); setRedoStack([]); setSelectedId(null); } };
    const duplicate = useCallback(() => {
        if (!selectedId) return;
        const src2 = actions.find(a => a.id === selectedId); if (!src2) return;
        const off = 20;
        const dup: DrawAction = {
            ...src2, id: Date.now().toString(),
            start: src2.start ? { x: src2.start.x + off, y: src2.start.y + off } : undefined,
            end: src2.end ? { x: src2.end.x + off, y: src2.end.y + off } : undefined,
            points: src2.points.map(p => ({ x: p.x + off, y: p.y + off })),
        };
        setActions(prev => [...prev, dup]); setSelectedId(dup.id); setRedoStack([]);
    }, [selectedId, actions]);

    // ─────────────────────────────────────────────────────────────────────────
    // CROP APPLY
    // ─────────────────────────────────────────────────────────────────────────

    const applyCrop = () => {
        if (!cropRect || !bgCanvasRef.current || !mainCanvasRef.current || !bgImageRef.current) return;
        const { x, y, w, h } = normCrop(cropRect); if (w < 10 || h < 10) return;
        const dpr = window.devicePixelRatio || 1;
        const tmp = document.createElement('canvas');
        tmp.width = w * dpr; tmp.height = h * dpr;
        const tc = tmp.getContext('2d')!;
        tc.drawImage(bgCanvasRef.current, x * dpr, y * dpr, w * dpr, h * dpr, 0, 0, w * dpr, h * dpr);
        tc.drawImage(mainCanvasRef.current, x * dpr, y * dpr, w * dpr, h * dpr, 0, 0, w * dpr, h * dpr);
        const newImg = new Image();
        newImg.onload = () => {
            bgImageRef.current = newImg;
            setActions([]); setRedoStack([]); setCropRect(null);
            setupCanvases(w, h);
            setTimeout(() => { drawBackground(); drawMain(); }, 0);
        };
        newImg.src = tmp.toDataURL('image/png');
    };

    // ─────────────────────────────────────────────────────────────────────────
    // SAVE
    // ─────────────────────────────────────────────────────────────────────────

    const save = () => {
        const bgC = bgCanvasRef.current, mainC = mainCanvasRef.current, img = bgImageRef.current;
        if (!bgC || !mainC || !img) return;
        let mnX = WORKSPACE_PADDING, mnY = WORKSPACE_PADDING;
        let mxX = WORKSPACE_PADDING + img.width, mxY = WORKSPACE_PADDING + img.height;
        actions.forEach(a => {
            const pad = a.lineWidth + 24;
            [a.start, a.end].forEach(p => { if (!p) return; mnX = Math.min(mnX, p.x - pad); mnY = Math.min(mnY, p.y - pad); mxX = Math.max(mxX, p.x + pad); mxY = Math.max(mxY, p.y + pad); });
            a.points.forEach(p => { mnX = Math.min(mnX, p.x - pad); mnY = Math.min(mnY, p.y - pad); mxX = Math.max(mxX, p.x + pad); mxY = Math.max(mxY, p.y + pad); });
        });
        const fw = mxX - mnX, fh = mxY - mnY; if (fw <= 0 || fh <= 0) return;
        const dpr = window.devicePixelRatio || 1;
        const offC = document.createElement('canvas');
        offC.width = fw * dpr; offC.height = fh * dpr;
        const oc = offC.getContext('2d')!;
        oc.drawImage(bgC, mnX * dpr, mnY * dpr, fw * dpr, fh * dpr, 0, 0, fw * dpr, fh * dpr);
        oc.drawImage(mainC, mnX * dpr, mnY * dpr, fw * dpr, fh * dpr, 0, 0, fw * dpr, fh * dpr);
        onSaveToFeed(offC.toDataURL('image/png'));
    };

    // ─────────────────────────────────────────────────────────────────────────
    // KEYBOARD — editingText is in deps so closure is always fresh ────────────
    // ─────────────────────────────────────────────────────────────────────────

    useEffect(() => {
        const onDown = (e: KeyboardEvent) => {
            // While typing — let the input handle everything via stopPropagation on the input itself
            if (editingText) {
                if (e.key === 'Escape') { setEditingText(null); e.preventDefault(); }
                return;
            }
            if (e.key === 'Escape') { onClose(); return; }
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
            if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); redo(); }
            if ((e.ctrlKey || e.metaKey) && e.key === 'd') { e.preventDefault(); duplicate(); }
            if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
                setActions(a => a.filter(x => x.id !== selectedId)); setSelectedId(null);
            }
            if (e.key === ' ') { e.preventDefault(); setIsPanning(true); }
            if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
                const map: Record<string, Tool> = {
                    v: 'select', p: 'pen', h: 'highlighter', b: 'blur',
                    r: 'rect', c: 'circle', a: 'arrow', l: 'line',
                    t: 'text', e: 'eraser', k: 'crop', m: 'magnifier', s: 'stamp',
                };
                if (map[e.key]) setCurrentTool(map[e.key]);
            }
        };
        const onUp = (e: KeyboardEvent) => { if (e.key === ' ') setIsPanning(false); };
        window.addEventListener('keydown', onDown);
        window.addEventListener('keyup', onUp);
        return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp); };
    }, [editingText, selectedId, undo, redo, duplicate, onClose]);

    // ─────────────────────────────────────────────────────────────────────────
    // DERIVED
    // ─────────────────────────────────────────────────────────────────────────

    const cropNorm = cropRect ? normCrop(cropRect) : null;
    const cropScreen = cropNorm ? {
        left: offset.x + cropNorm.x * scale, top: offset.y + cropNorm.y * scale,
        width: cropNorm.w * scale, height: cropNorm.h * scale,
    } : null;

    const startCropHandle = (e: React.MouseEvent, h: CropHandle) => {
        e.stopPropagation(); e.preventDefault();
        if (h === 'body') cropBodyRef.current = screenToCanvas(e.clientX, e.clientY);
        setCropHandle(h);
    };

    const canvasSize = bgImageRef.current
        ? { w: bgImageRef.current.width + WORKSPACE_PADDING * 2, h: bgImageRef.current.height + WORKSPACE_PADDING * 2 }
        : { w: 0, h: 0 };

    const SHAPES = ['rect', 'circle'];
    const LINES = ['pen', 'highlighter', 'arrow', 'line', 'rect', 'circle'];
    const needsFill = SHAPES.includes(currentTool);
    const needsDash = LINES.includes(currentTool);

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────────────────

    return (
        <div className="image-editor-modal" ref={containerRef}>
            <div className="editor-backdrop" onClick={onClose} />

            {/* ══ LEFT TOOLBAR ════════════════════════════════════ */}
            <div className="side-tool-pill">
                <TB tool="select" c={currentTool} ic={<Icons.Select />} lb="Select (V)" set={setCurrentTool} />
                <div className="sep" />
                <TB tool="pen" c={currentTool} ic={<Icons.Pen />} lb="Pen (P)" set={setCurrentTool} />
                <TB tool="highlighter" c={currentTool} ic={<Icons.Highlighter />} lb="Highlight (H)" set={setCurrentTool} />
                <TB tool="blur" c={currentTool} ic={<Icons.Blur />} lb="Blur (B)" set={setCurrentTool} />
                <TB tool="eraser" c={currentTool} ic={<Icons.Eraser />} lb="Eraser (E)" set={setCurrentTool} />
                <div className="sep" />
                <TB tool="rect" c={currentTool} ic={<Icons.Rect />} lb="Rect (R)" set={setCurrentTool} />
                <TB tool="circle" c={currentTool} ic={<Icons.Circle />} lb="Circle (C)" set={setCurrentTool} />
                <TB tool="arrow" c={currentTool} ic={<Icons.Arrow />} lb="Arrow (A)" set={setCurrentTool} />
                <TB tool="line" c={currentTool} ic={<Icons.Line />} lb="Line (L)" set={setCurrentTool} />
                <TB tool="text" c={currentTool} ic={<Icons.Text />} lb="Text (T)" set={setCurrentTool} />
                <TB tool="stamp" c={currentTool} ic={<Icons.Stamp />} lb="Stamp (S)" set={setCurrentTool} />
                <div className="sep" />
                <TB tool="crop" c={currentTool} ic={<Icons.Crop />} lb="Crop (K)" set={setCurrentTool} />
                <TB tool="magnifier" c={currentTool} ic={<Icons.Magnifier />} lb="Magnify (M)" set={setCurrentTool} />
            </div>

            {/* ══ TOP BAR ═════════════════════════════════════════ */}
            <div className="top-island-bar">
                {currentTool === 'crop' && cropNorm && cropNorm.w > 4 ? (
                    <>
                        <div className="isl-sec">
                            {ASPECT_RATIOS.map(ar => (
                                <button key={ar.label}
                                    className={`aspect-btn ${cropAspect === ar.value ? 'on' : ''}`}
                                    onClick={() => setCropAspect(ar.value)}>
                                    {ar.label}
                                </button>
                            ))}
                        </div>
                        <div className="isl-div" />
                        <div className="isl-sec">
                            <span className="crop-dims">{Math.round(cropNorm.w)} × {Math.round(cropNorm.h)}</span>
                        </div>
                        <div className="isl-div" />
                        <div className="isl-sec">
                            <button className="btn-apply-crop" onClick={applyCrop}><Icons.Check /><span>Apply Crop</span></button>
                            <button className="iab" onClick={() => setCropRect(null)} title="Cancel"><Icons.Close /></button>
                        </div>
                    </>
                ) : currentTool === 'stamp' ? (
                    <>
                        <div className="isl-sec stamp-row">
                            {/* Auto-counter stamp */}
                            <button
                                className={`counter-stamp-btn ${selectedStampId === 'counter' ? 'on' : ''}`}
                                onClick={() => setSelectedStampId('counter')}
                                title="Auto-counter — increments on each click">
                                <span className="csb-circle" style={{ background: currentColor }}>{counterValue}</span>
                                <span className="csb-label">Count</span>
                            </button>
                            <button className="csb-reset" onClick={() => setCounterValue(1)} title="Reset to 1"><Icons.Undo /></button>
                            <div className="isl-div" />
                            {EMOJI_STAMPS.map(s => (
                                <button key={s.id}
                                    className={`stamp-btn ${selectedStampId === s.id ? 'on' : ''}`}
                                    onClick={() => setSelectedStampId(s.id)} title={s.label}>
                                    {s.char}
                                </button>
                            ))}
                        </div>
                        <div className="isl-div" />
                        <div className="isl-sec">
                            <div className="color-pick-wrap" title="Stamp colour">
                                <div className="cpw-preview" style={{ background: currentColor }} />
                                <input type="color" value={currentColor} onChange={e => setCurrentColor(e.target.value)} />
                            </div>
                            <span className="lbl">Size</span>
                            <input type="range" min="1" max="16" value={lineWidth} onChange={e => setLineWidth(+e.target.value)} />
                        </div>
                    </>
                ) : (
                    <>
                        <div className="isl-sec">
                            <div className="presets">
                                {COLOR_PRESETS.map(c => (
                                    <button key={c} className={`swatch ${currentColor === c ? 'on' : ''}`}
                                        style={{ background: c }} onClick={() => setCurrentColor(c)} />
                                ))}
                            </div>
                            <div className="color-pick-wrap" title="Custom colour">
                                <div className="cpw-preview" style={{ background: currentColor }} />
                                <input type="color" value={currentColor} onChange={e => setCurrentColor(e.target.value)} />
                            </div>
                        </div>
                        <div className="isl-div" />
                        <div className="isl-sec">
                            <span className="lbl">Size</span>
                            <span className="size-dot" style={{ width: Math.max(3, lineWidth), height: Math.max(3, lineWidth), background: currentColor }} />
                            <input type="range" min="1" max="50" value={lineWidth} onChange={e => setLineWidth(+e.target.value)} />
                        </div>
                        <div className="isl-div" />
                        <div className="isl-sec">
                            <button className="iab" onClick={undo} disabled={!actions.length} title="Undo ⌃Z"><Icons.Undo /></button>
                            <button className="iab" onClick={redo} disabled={!redoStack.length} title="Redo ⌃Y"><Icons.Redo /></button>
                            <button className="iab" onClick={clear} title="Clear all"><Icons.Trash /></button>
                        </div>
                        <div className="isl-div" />
                        <div className="isl-sec">
                            <button className="iab save-btn" onClick={save} title="Save"><Icons.Save /></button>
                            <button className="iab close-btn" onClick={onClose} title="Close (Esc)"><Icons.Close /></button>
                        </div>
                    </>
                )}
            </div>

            {/* ══ STYLE PANEL (right side) ═════════════════════════ */}
            {currentTool !== 'crop' && currentTool !== 'magnifier' && currentTool !== 'stamp' && (
                <div className={`style-panel ${showStylePanel ? 'open' : 'closed'}`}>
                    <button className="sp-toggle" onClick={() => setShowStylePanel(v => !v)} title="Toggle style panel">
                        <Icons.Sliders />
                        {!showStylePanel && <span className="sp-toggle-label">Style</span>}
                    </button>

                    {showStylePanel && (
                        <div className="sp-body">
                            <p className="sp-title">{TOOL_LABELS[currentTool]} Style</p>

                            {/* Opacity */}
                            <SPRow label="Opacity" icon={<Icons.Opacity />}>
                                <input type="range" min="10" max="100" value={opacity}
                                    onChange={e => setOpacity(+e.target.value)} />
                                <span className="sp-val">{opacity}%</span>
                            </SPRow>

                            {/* Stroke style */}
                            {needsDash && (
                                <SPRow label="Stroke" icon={<Icons.Dash />}>
                                    {(['solid', 'dashed', 'dotted'] as StrokeDash[]).map(d => (
                                        <button key={d} className={`dash-btn ${strokeDash === d ? 'on' : ''}`}
                                            onClick={() => setStrokeDash(d)} title={d}>
                                            <DashPreview type={d} color={currentColor} />
                                        </button>
                                    ))}
                                </SPRow>
                            )}

                            {/* Fill (shapes) */}
                            {needsFill && (
                                <SPRow label="Fill" icon={<Icons.Fill />}>
                                    <button className={`toggle-btn ${fillEnabled ? 'on' : ''}`}
                                        onClick={() => setFillEnabled(v => !v)}>
                                        {fillEnabled ? 'On' : 'Off'}
                                    </button>
                                    {fillEnabled && (
                                        <div className="color-pick-wrap sm">
                                            <div className="cpw-preview" style={{ background: fillColor }} />
                                            <input type="color" value={fillColor} onChange={e => setFillColor(e.target.value)} />
                                        </div>
                                    )}
                                </SPRow>
                            )}

                            <div className="sp-div" />

                            {/* Shadow toggle */}
                            <SPRow label="Shadow" icon={<Icons.Shadow />}>
                                <button className={`toggle-btn ${shadowEnabled ? 'on' : ''}`}
                                    onClick={() => setShadowEnabled(v => !v)}>
                                    {shadowEnabled ? 'On' : 'Off'}
                                </button>
                            </SPRow>

                            {shadowEnabled && (<>
                                <SPRow label="Color" icon={<Icons.ColorDot />}>
                                    <div className="color-pick-wrap sm">
                                        <div className="cpw-preview" style={{ background: shadowColor }} />
                                        <input type="color" value={shadowColor} onChange={e => setShadowColor(e.target.value)} />
                                    </div>
                                </SPRow>
                                <SPRow label="Blur" icon={<Icons.ShadowBlur />}>
                                    <input type="range" min="0" max="60" value={shadowBlur}
                                        onChange={e => setShadowBlur(+e.target.value)} />
                                    <span className="sp-val">{shadowBlur}</span>
                                </SPRow>
                                <SPRow label="X offset" icon={<Icons.OffsetX />}>
                                    <input type="range" min="-30" max="30" value={shadowOffsetX}
                                        onChange={e => setShadowOffsetX(+e.target.value)} />
                                    <span className="sp-val">{shadowOffsetX}</span>
                                </SPRow>
                                <SPRow label="Y offset" icon={<Icons.OffsetY />}>
                                    <input type="range" min="-30" max="30" value={shadowOffsetY}
                                        onChange={e => setShadowOffsetY(+e.target.value)} />
                                    <span className="sp-val">{shadowOffsetY}</span>
                                </SPRow>
                            </>)}
                        </div>
                    )}
                </div>
            )}

            {/* ══ CANVAS VIEWPORT ══════════════════════════════════ */}
            <div className={`canvas-viewport ${isPanning ? 'panning' : ''} tool-${currentTool}`}
                onMouseDown={handlePointerDown} onMouseMove={handlePointerMove}
                onMouseUp={handlePointerUp} onMouseLeave={handlePointerUp}
                onTouchStart={handlePointerDown} onTouchMove={handlePointerMove} onTouchEnd={handlePointerUp}>

                <div className="canvas-stack" style={{
                    transform: `translate(${offset.x}px,${offset.y}px) scale(${scale})`,
                    transformOrigin: '0 0', width: canvasSize.w, height: canvasSize.h,
                }}>
                    <canvas ref={bgCanvasRef} className="editor-layer bg" style={{ width: '100%', height: '100%' }} />
                    <canvas ref={mainCanvasRef} className="editor-layer main" style={{ width: '100%', height: '100%' }} />
                    <canvas ref={overlayCanvasRef} className="editor-layer overlay" style={{ width: '100%', height: '100%' }} />
                </div>

                {/* Crop overlay */}
                {cropScreen && cropNorm && cropNorm.w > 4 && cropNorm.h > 4 && (
                    <div className="crop-shade-overlay">
                        <div className="cs top" style={{ height: cropScreen.top }} />
                        <div className="cs bottom" style={{ top: cropScreen.top + cropScreen.height }} />
                        <div className="cs left" style={{ top: cropScreen.top, height: cropScreen.height, width: cropScreen.left }} />
                        <div className="cs right" style={{ top: cropScreen.top, height: cropScreen.height, left: cropScreen.left + cropScreen.width }} />
                        <div className="crop-box"
                            style={{ left: cropScreen.left, top: cropScreen.top, width: cropScreen.width, height: cropScreen.height }}
                            onMouseDown={e => startCropHandle(e, 'body')}>
                            <div className="cg-h" style={{ top: '33.33%' }} /> <div className="cg-h" style={{ top: '66.66%' }} />
                            <div className="cg-v" style={{ left: '33.33%' }} /> <div className="cg-v" style={{ left: '66.66%' }} />
                            <div className="ch tl" onMouseDown={e => startCropHandle(e, 'tl')} />
                            <div className="ch tr" onMouseDown={e => startCropHandle(e, 'tr')} />
                            <div className="ch bl" onMouseDown={e => startCropHandle(e, 'bl')} />
                            <div className="ch br" onMouseDown={e => startCropHandle(e, 'br')} />
                            <div className="ch tm" onMouseDown={e => startCropHandle(e, 'tl')} />
                            <div className="ch bm" onMouseDown={e => startCropHandle(e, 'bl')} />
                            <div className="ch lm" onMouseDown={e => startCropHandle(e, 'tl')} />
                            <div className="ch rm" onMouseDown={e => startCropHandle(e, 'tr')} />
                        </div>
                    </div>
                )}

                {/* Magnifier loupe */}
                {showLoupe && bgCanvasRef.current && mainCanvasRef.current && (
                    <MagnifierLoupe
                        bgCanvas={bgCanvasRef.current} mainCanvas={mainCanvasRef.current}
                        pos={{ x: offset.x + mousePos.x * scale, y: offset.y + mousePos.y * scale }}
                        imagePos={mousePos} accentColor={accentColor}
                    />
                )}
            </div>

            {/*
             * ══ TEXT INPUT ════════════════════════════════════════
             * CRITICAL: placed OUTSIDE canvas-viewport to avoid overflow:hidden clipping.
             * Uses screen coordinates (sx, sy) so position is viewport-relative.
             * e.stopPropagation() on keydown prevents global shortcut handler from
             * intercepting characters like p, e, t, r, etc. while the user types.
             */}
            {editingText && (
                <div className="floating-text-wrap" style={{
                    left: editingText.sx,
                    top: editingText.sy,
                    '--tc': currentColor,
                } as React.CSSProperties}>
                    <input
                        ref={textInputRef}
                        className="floating-text-input"
                        value={editingText.text}
                        placeholder="Type here…"
                        style={{
                            color: currentColor,
                            fontSize: `${Math.max(12, Math.min(72, (lineWidth * 4 + 16) * scale))}px`,
                            borderColor: currentColor,
                        }}
                        onChange={e => setEditingText(prev => prev ? { ...prev, text: e.target.value } : prev)}
                        onKeyDown={e => {
                            // MUST stop propagation so global handler (tool shortcuts) doesn't fire
                            e.stopPropagation();
                            if (e.key === 'Enter') { finishText(); e.preventDefault(); }
                            if (e.key === 'Escape') { setEditingText(null); e.preventDefault(); }
                        }}
                        onBlur={finishText}
                    />
                    <span className="fti-hint">Enter to place · Esc to cancel</span>
                </div>
            )}

            {/* ══ BOTTOM STATUS BAR ════════════════════════════════ */}
            <div className="status-bar">
                <div className="sb-metric"><Icons.ZoomIn /><span className="sb-val">{Math.round(scale * 100)}%</span></div>
                <button className="sb-btn" onClick={() => setScale(s => Math.min(20, s * 1.25))} title="Zoom in (+)"><Icons.Plus /></button>
                <button className="sb-btn" onClick={() => setScale(s => Math.max(0.05, s / 1.25))} title="Zoom out (-)"><Icons.Minus /></button>
                <button className="sb-btn" onClick={fitToScreen} title="Fit to screen"><Icons.FitScreen /></button>
                <div className="sb-sep" />
                {selectedId && (<>
                    <button className="sb-action" onClick={duplicate} title="Duplicate ⌃D"><Icons.Duplicate />Duplicate</button>
                    <button className="sb-action danger" onClick={() => { setActions(a => a.filter(x => x.id !== selectedId)); setSelectedId(null); }}><Icons.Trash />Delete</button>
                    <div className="sb-sep" />
                </>)}
                <div className="sb-shorts">
                    <span><kbd>Space</kbd> Pan</span><span className="sd">·</span>
                    <span><kbd>⌃ Scroll</kbd> Zoom</span><span className="sd">·</span>
                    <span><kbd>⌃Z/Y</kbd> Undo/Redo</span><span className="sd">·</span>
                    <span><kbd>⌃D</kbd> Dup</span><span className="sd">·</span>
                    <span><kbd>Del</kbd> Remove</span>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAGNIFIER LOUPE
// ─────────────────────────────────────────────────────────────────────────────

function MagnifierLoupe({ bgCanvas, mainCanvas, pos, imagePos, accentColor }: {
    bgCanvas: HTMLCanvasElement; mainCanvas: HTMLCanvasElement;
    pos: Point; imagePos: Point; accentColor: string;
}) {
    const ref = useRef<HTMLCanvasElement>(null);
    const SIZE = 180, ZOOM = 3.5;
    useEffect(() => {
        const c = ref.current; const ctx = c?.getContext('2d'); if (!c || !ctx) return;
        const dpr = window.devicePixelRatio || 1;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, SIZE, SIZE);
        ctx.save();
        ctx.beginPath(); ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2, 0, Math.PI * 2); ctx.clip();
        const sw = SIZE / ZOOM, sh = SIZE / ZOOM;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(bgCanvas, (imagePos.x - sw / 2) * dpr, (imagePos.y - sh / 2) * dpr, sw * dpr, sh * dpr, 0, 0, SIZE, SIZE);
        ctx.drawImage(mainCanvas, (imagePos.x - sw / 2) * dpr, (imagePos.y - sh / 2) * dpr, sw * dpr, sh * dpr, 0, 0, SIZE, SIZE);
        ctx.restore();
        ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 0.5;
        const pw = SIZE / sw;
        for (let i = 0; i <= Math.ceil(sw); i++) { ctx.beginPath(); ctx.moveTo(i * pw, 0); ctx.lineTo(i * pw, SIZE); ctx.stroke(); }
        for (let j = 0; j <= Math.ceil(sh); j++) { ctx.beginPath(); ctx.moveTo(0, j * pw); ctx.lineTo(SIZE, j * pw); ctx.stroke(); }
        ctx.strokeStyle = accentColor; ctx.lineWidth = 1.5;
        const c2 = SIZE / 2;
        ctx.beginPath(); ctx.moveTo(c2, c2 - 16); ctx.lineTo(c2, c2 + 16); ctx.moveTo(c2 - 16, c2); ctx.lineTo(c2 + 16, c2); ctx.stroke();
    }, [bgCanvas, mainCanvas, imagePos, accentColor]);
    const dpr = window.devicePixelRatio || 1;
    return <canvas ref={ref} width={SIZE * dpr} height={SIZE * dpr} className="magnifier-loupe"
        style={{ left: pos.x - SIZE / 2, top: pos.y - SIZE - 24, width: SIZE, height: SIZE }} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLE PANEL ROW
// ─────────────────────────────────────────────────────────────────────────────

function SPRow({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
    return (
        <div className="sp-row">
            <span className="sp-row-icon">{icon}</span>
            <span className="sp-row-label">{label}</span>
            <div className="sp-row-ctrl">{children}</div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// DASH PREVIEW SVG
// ─────────────────────────────────────────────────────────────────────────────

function DashPreview({ type, color }: { type: StrokeDash; color: string }) {
    const d = type === 'dashed' ? '6,3' : type === 'dotted' ? '1,4' : undefined;
    return (
        <svg width="28" height="8" viewBox="0 0 28 8">
            <line x1="2" y1="4" x2="26" y2="4" stroke={color} strokeWidth="2.5"
                strokeLinecap="round" strokeDasharray={d} />
        </svg>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// TOOL BUTTON
// ─────────────────────────────────────────────────────────────────────────────

function TB({ tool, c, ic, lb, set }: { tool: Tool; c: Tool; ic: React.ReactNode; lb: string; set: (t: Tool) => void }) {
    return (
        <button className={`side-icon-btn ${c === tool ? 'active' : ''}`} onClick={() => set(tool)} title={lb}>
            <div className="btn-icon-wrapper">{ic}</div>
            <div className={`indicator ${c === tool ? 'visible' : ''}`} />
        </button>
    );
}