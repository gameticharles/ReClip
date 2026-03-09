import React, { useState, useEffect, useRef, useCallback } from 'react';
import './ImageEditorModal.css';
import { Icons } from './ImageEditorIcons';
import { useSettingsStore } from '../store/useSettingsStore';

interface ImageEditorModalProps {
    src: string;
    onClose: () => void;
    onSaveToFeed: (base64Data: string) => void;
}

type Tool = 'select' | 'pen' | 'highlighter' | 'blur' | 'rect' | 'circle' | 'arrow' | 'line' | 'text' | 'eraser' | 'crop' | 'magnifier' | 'stamp';
type Point = { x: number; y: number };
type CropHandle = 'tl' | 'tr' | 'bl' | 'br' | 'body' | null;

interface CropRect { x1: number; y1: number; x2: number; y2: number; }

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
    isFinished: boolean;
}

const WORKSPACE_PADDING = 1200;

const COLOR_PRESETS = [
    '#ef4444', '#f97316', '#eab308', '#22c55e',
    '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
    '#ffffff', '#000000',
];

const STAMPS = [
    { id: 'check', char: '✅', label: 'Check' },
    { id: 'cross', char: '❌', label: 'Cross' },
    { id: 'warning', char: '⚠️', label: 'Warning' },
    { id: 'info', char: 'ℹ️', label: 'Info' },
    { id: 'bug', char: '🐛', label: 'Bug' },
    { id: 'fire', char: '🔥', label: 'Hot' },
    { id: 'star', char: '⭐', label: 'Star' },
    { id: 'pin', char: '📌', label: 'Pin' },
    { id: 'n1', char: '①', label: '1' },
    { id: 'n2', char: '②', label: '2' },
    { id: 'n3', char: '③', label: '3' },
    { id: 'n4', char: '④', label: '4' },
    { id: 'n5', char: '⑤', label: '5' },
    { id: 'n6', char: '⑥', label: '6' },
];

const ASPECT_RATIOS: { label: string; value: number | null }[] = [
    { label: 'Free', value: null },
    { label: '1:1', value: 1 },
    { label: '16:9', value: 16 / 9 },
    { label: '4:3', value: 4 / 3 },
    { label: '9:16', value: 9 / 16 },
];

export default function ImageEditorModal({ src, onClose, onSaveToFeed }: ImageEditorModalProps) {
    const accentColor = useSettingsStore(state => state.accentColor);

    // ─── Tool & Style ──────────────────────────────────────────────────────────
    const [currentTool, setCurrentTool] = useState<Tool>('pen');
    const [currentColor, setCurrentColor] = useState(accentColor || '#6366f1');
    const [lineWidth, setLineWidth] = useState(4);
    const [selectedStamp, setSelectedStamp] = useState(STAMPS[0]);
    const [cropAspect, setCropAspect] = useState<number | null>(null);

    // ─── Viewport Transform ────────────────────────────────────────────────────
    const [scale, setScale] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [lastPanPos, setLastPanPos] = useState({ x: 0, y: 0 });

    // ─── Canvas Refs ───────────────────────────────────────────────────────────
    const bgCanvasRef = useRef<HTMLCanvasElement>(null);
    const mainCanvasRef = useRef<HTMLCanvasElement>(null);
    const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
    const bgImageRef = useRef<HTMLImageElement | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // ─── Drawing State ─────────────────────────────────────────────────────────
    const [actions, setActions] = useState<DrawAction[]>([]);
    const [redoStack, setRedoStack] = useState<DrawAction[]>([]);
    const [currentAction, setCurrentAction] = useState<DrawAction | null>(null);
    const [isDrawing, setIsDrawing] = useState(false);

    // ─── Selection ─────────────────────────────────────────────────────────────
    const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
    const [isDraggingAction, setIsDraggingAction] = useState(false);
    const [dragStartPoint, setDragStartPoint] = useState<Point | null>(null);

    // ─── Crop ──────────────────────────────────────────────────────────────────
    const [cropRect, setCropRect] = useState<CropRect | null>(null);
    const [activeCropHandle, setActiveCropHandle] = useState<CropHandle>(null);
    // Whether the INITIAL drag (creating the crop) is in progress on the viewport
    const [isCreatingCrop, setIsCreatingCrop] = useState(false);
    const cropBodyDragRef = useRef<Point | null>(null);

    // ─── Loupe / Magnifier ─────────────────────────────────────────────────────
    const [mousePos, setMousePos] = useState<Point>({ x: 0, y: 0 });
    const [showLoupe, setShowLoupe] = useState(false);

    // ─── Text editing ──────────────────────────────────────────────────────────
    const [editingText, setEditingText] = useState<{ id: string; x: number; y: number; text: string } | null>(null);
    const textInputRef = useRef<HTMLInputElement>(null);

    // ══════════════════════════════════════════════════════════════════════════
    //  HELPERS
    // ══════════════════════════════════════════════════════════════════════════

    const screenToCanvas = useCallback((clientX: number, clientY: number): Point => ({
        x: (clientX - offset.x) / scale,
        y: (clientY - offset.y) / scale,
    }), [offset, scale]);

    const normalizeCrop = (r: CropRect) => ({
        x: Math.min(r.x1, r.x2),
        y: Math.min(r.y1, r.y2),
        w: Math.abs(r.x2 - r.x1),
        h: Math.abs(r.y2 - r.y1),
    });

    // ══════════════════════════════════════════════════════════════════════════
    //  RENDERING
    // ══════════════════════════════════════════════════════════════════════════

    /** Render a single action onto ctx with full quality */
    const renderAction = useCallback((ctx: CanvasRenderingContext2D, action: DrawAction) => {
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = action.lineWidth;
        ctx.strokeStyle = action.color;
        ctx.fillStyle = action.color;

        if (action.id === selectedActionId) {
            ctx.shadowBlur = 16;
            ctx.shadowColor = accentColor || '#6366f1';
        }

        if (action.tool === 'pen' || action.tool === 'highlighter') {
            if (action.tool === 'highlighter') {
                ctx.globalAlpha = 0.38;
                ctx.lineWidth = action.lineWidth * 3;
                ctx.globalCompositeOperation = 'multiply';
            }
            const pts = action.points;
            if (pts.length === 1) {
                ctx.beginPath();
                ctx.arc(pts[0].x, pts[0].y, action.lineWidth / 2, 0, Math.PI * 2);
                ctx.fill();
            } else if (pts.length === 2) {
                ctx.beginPath();
                ctx.moveTo(pts[0].x, pts[0].y);
                ctx.lineTo(pts[1].x, pts[1].y);
                ctx.stroke();
            } else if (pts.length > 2) {
                // Smooth bezier interpolation for high-quality strokes
                ctx.beginPath();
                ctx.moveTo(pts[0].x, pts[0].y);
                for (let i = 1; i < pts.length - 1; i++) {
                    const mx = (pts[i].x + pts[i + 1].x) / 2;
                    const my = (pts[i].y + pts[i + 1].y) / 2;
                    ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
                }
                ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
                ctx.stroke();
            }

        } else if (action.tool === 'eraser') {
            ctx.globalCompositeOperation = 'destination-out';
            const pts = action.points;
            if (pts.length > 1) {
                ctx.beginPath();
                ctx.moveTo(pts[0].x, pts[0].y);
                for (let i = 1; i < pts.length - 1; i++) {
                    const mx = (pts[i].x + pts[i + 1].x) / 2;
                    const my = (pts[i].y + pts[i + 1].y) / 2;
                    ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
                }
                ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
                ctx.stroke();
            }

        } else if (action.tool === 'blur') {
            renderBlurAction(ctx, action);

        } else if (action.tool === 'rect' && action.start && action.end) {
            const rx = Math.min(action.start.x, action.end.x);
            const ry = Math.min(action.start.y, action.end.y);
            const rw = Math.abs(action.end.x - action.start.x);
            const rh = Math.abs(action.end.y - action.start.y);
            ctx.strokeRect(rx, ry, rw, rh);

        } else if (action.tool === 'circle' && action.start && action.end) {
            const rx = (action.end.x - action.start.x) / 2;
            const ry = (action.end.y - action.start.y) / 2;
            ctx.beginPath();
            ctx.ellipse(action.start.x + rx, action.start.y + ry, Math.abs(rx), Math.abs(ry), 0, 0, Math.PI * 2);
            ctx.stroke();

        } else if ((action.tool === 'arrow' || action.tool === 'line') && action.start && action.end) {
            ctx.beginPath();
            ctx.moveTo(action.start.x, action.start.y);
            ctx.lineTo(action.end.x, action.end.y);
            ctx.stroke();
            if (action.tool === 'arrow') {
                const angle = Math.atan2(action.end.y - action.start.y, action.end.x - action.start.x);
                const hl = action.lineWidth * 4 + 12;
                ctx.beginPath();
                ctx.moveTo(action.end.x, action.end.y);
                ctx.lineTo(action.end.x - hl * Math.cos(angle - Math.PI / 6), action.end.y - hl * Math.sin(angle - Math.PI / 6));
                ctx.lineTo(action.end.x - hl * Math.cos(angle + Math.PI / 6), action.end.y - hl * Math.sin(angle + Math.PI / 6));
                ctx.closePath();
                ctx.fill();
            }

        } else if (action.tool === 'text' && action.start && action.text) {
            const fontSize = action.lineWidth * 4 + 16;
            ctx.font = `700 ${fontSize}px "Inter", sans-serif`;
            ctx.textBaseline = 'top';
            // Text shadow for legibility
            ctx.shadowBlur = 4;
            ctx.shadowColor = 'rgba(0,0,0,0.5)';
            ctx.fillText(action.text, action.start.x, action.start.y);

        } else if (action.tool === 'stamp' && action.start && action.stampChar) {
            const fontSize = action.lineWidth * 8 + 28;
            ctx.font = `${fontSize}px serif`;
            ctx.textBaseline = 'middle';
            ctx.textAlign = 'center';
            ctx.fillText(action.stampChar, action.start.x, action.start.y);
        }

        ctx.restore();
    }, [selectedActionId, accentColor]);

    const renderBlurAction = useCallback((ctx: CanvasRenderingContext2D, action: DrawAction) => {
        if (!action.start || !action.end || !bgImageRef.current) return;
        const x = Math.min(action.start.x, action.end.x);
        const y = Math.min(action.start.y, action.end.y);
        const w = Math.abs(action.end.x - action.start.x);
        const h = Math.abs(action.end.y - action.start.y);
        if (w < 2 || h < 2) return;

        // Pixelate by downsampling/upsampling
        const pixelSize = Math.max(6, action.lineWidth * 1.5);
        const tw = Math.max(1, Math.floor(w / pixelSize));
        const th = Math.max(1, Math.floor(h / pixelSize));

        const tmp = document.createElement('canvas');
        tmp.width = tw; tmp.height = th;
        const tc = tmp.getContext('2d')!;
        tc.imageSmoothingEnabled = true;
        tc.drawImage(bgImageRef.current, x - WORKSPACE_PADDING, y - WORKSPACE_PADDING, w, h, 0, 0, tw, th);

        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(tmp, 0, 0, tw, th, x, y, w, h);
        ctx.restore();
    }, []);

    const drawBackground = useCallback(() => {
        const canvas = bgCanvasRef.current;
        const ctx = canvas?.getContext('2d');
        const img = bgImageRef.current;
        if (!canvas || !ctx || !img) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.shadowBlur = 60;
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.fillStyle = '#000';
        ctx.fillRect(WORKSPACE_PADDING, WORKSPACE_PADDING, img.width, img.height);
        ctx.restore();
        ctx.drawImage(img, WORKSPACE_PADDING, WORKSPACE_PADDING);
    }, []);

    const drawMain = useCallback(() => {
        const canvas = mainCanvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        actions.forEach(a => renderAction(ctx, a));
    }, [actions, renderAction]);

    const drawOverlay = useCallback(() => {
        const canvas = overlayCanvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (currentAction) renderAction(ctx, currentAction);
    }, [currentAction, renderAction]);

    // ══════════════════════════════════════════════════════════════════════════
    //  CANVAS SETUP
    // ══════════════════════════════════════════════════════════════════════════

    const setupCanvases = useCallback((imgW: number, imgH: number) => {
        const container = containerRef.current;
        if (!container) return;
        const dpr = window.devicePixelRatio || 1;
        const cw = imgW + WORKSPACE_PADDING * 2;
        const ch = imgH + WORKSPACE_PADDING * 2;

        [bgCanvasRef, mainCanvasRef, overlayCanvasRef].forEach(ref => {
            const canvas = ref.current;
            if (!canvas) return;
            canvas.width = cw * dpr;
            canvas.height = ch * dpr;
            const ctx = canvas.getContext('2d');
            if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        });

        const fitScale = Math.min(1,
            (container.clientWidth - 120) / imgW,
            (container.clientHeight - 120) / imgH
        );
        setScale(fitScale);
        setOffset({
            x: container.clientWidth / 2 - (imgW / 2 + WORKSPACE_PADDING) * fitScale,
            y: container.clientHeight / 2 - (imgH / 2 + WORKSPACE_PADDING) * fitScale,
        });
    }, []);

    useEffect(() => {
        const img = new Image();
        img.onload = () => {
            bgImageRef.current = img;
            setupCanvases(img.width, img.height);
            drawBackground();
            drawMain();
        };
        img.src = src;
    }, [src]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => { drawMain(); }, [drawMain]);
    useEffect(() => { drawOverlay(); }, [drawOverlay]);

    // ══════════════════════════════════════════════════════════════════════════
    //  HIT TESTING
    // ══════════════════════════════════════════════════════════════════════════

    const isPointNearAction = (point: Point, action: DrawAction): boolean => {
        const thresh = action.lineWidth + 12;
        const { tool, points, start, end } = action;

        if (tool === 'pen' || tool === 'highlighter' || tool === 'eraser') {
            return points.some(p => Math.hypot(p.x - point.x, p.y - point.y) < thresh);
        }
        if (tool === 'stamp' && start) {
            const fs = action.lineWidth * 8 + 28;
            return Math.hypot(point.x - start.x, point.y - start.y) < fs / 2 + 10;
        }
        if (start && end) {
            if (tool === 'rect' || tool === 'blur') {
                const x = Math.min(start.x, end.x), y = Math.min(start.y, end.y);
                const w = Math.abs(end.x - start.x), h = Math.abs(end.y - start.y);
                return point.x >= x - thresh && point.x <= x + w + thresh &&
                    point.y >= y - thresh && point.y <= y + h + thresh;
            }
            if (tool === 'circle') {
                const rx = Math.abs(end.x - start.x) / 2;
                const ry = Math.abs(end.y - start.y) / 2;
                const cx = (start.x + end.x) / 2, cy = (start.y + end.y) / 2;
                return ((point.x - cx) / (rx + thresh)) ** 2 + ((point.y - cy) / (ry + thresh)) ** 2 <= 1;
            }
            if (tool === 'arrow' || tool === 'line') {
                const A = point.x - start.x, B = point.y - start.y;
                const C = end.x - start.x, D = end.y - start.y;
                const len2 = C * C + D * D;
                const t = len2 ? Math.max(0, Math.min(1, (A * C + B * D) / len2)) : 0;
                return Math.hypot(point.x - (start.x + t * C), point.y - (start.y + t * D)) < thresh;
            }
        }
        if (tool === 'text' && start && action.text) {
            const fs = action.lineWidth * 4 + 16;
            return point.x >= start.x && point.x <= start.x + action.text.length * fs * 0.65 &&
                point.y >= start.y && point.y <= start.y + fs;
        }
        return false;
    };

    // ══════════════════════════════════════════════════════════════════════════
    //  CROP HANDLE GLOBAL LISTENERS
    // ══════════════════════════════════════════════════════════════════════════

    useEffect(() => {
        if (activeCropHandle === null) return;

        const onMove = (e: MouseEvent) => {
            if (!cropRect) return;
            const point = screenToCanvas(e.clientX, e.clientY);

            if (activeCropHandle === 'body' && cropBodyDragRef.current) {
                const dx = point.x - cropBodyDragRef.current.x;
                const dy = point.y - cropBodyDragRef.current.y;
                setCropRect({ x1: cropRect.x1 + dx, y1: cropRect.y1 + dy, x2: cropRect.x2 + dx, y2: cropRect.y2 + dy });
                cropBodyDragRef.current = point;
                return;
            }

            let nr = { ...cropRect };
            if (activeCropHandle === 'tl') { nr.x1 = point.x; nr.y1 = point.y; }
            else if (activeCropHandle === 'tr') { nr.x2 = point.x; nr.y1 = point.y; }
            else if (activeCropHandle === 'bl') { nr.x1 = point.x; nr.y2 = point.y; }
            else if (activeCropHandle === 'br') { nr.x2 = point.x; nr.y2 = point.y; }

            if (cropAspect !== null) {
                const w = Math.abs(nr.x2 - nr.x1);
                const h = w / cropAspect;
                const signY = (nr.y2 > nr.y1) ? 1 : -1;
                if (activeCropHandle === 'tl') nr.y1 = nr.y2 - h * signY;
                else if (activeCropHandle === 'tr') nr.y1 = nr.y2 - h * signY;
                else if (activeCropHandle === 'bl') nr.y2 = nr.y1 + h * signY;
                else if (activeCropHandle === 'br') nr.y2 = nr.y1 + h * signY;
            }
            setCropRect(nr);
        };

        const onUp = () => {
            setActiveCropHandle(null);
            cropBodyDragRef.current = null;
        };

        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        return () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
    }, [activeCropHandle, cropRect, screenToCanvas, cropAspect]);

    // ══════════════════════════════════════════════════════════════════════════
    //  POINTER EVENTS
    // ══════════════════════════════════════════════════════════════════════════

    const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        const point = screenToCanvas(clientX, clientY);
        setMousePos(point);

        // Middle mouse or space = pan
        if (isPanning || ('button' in e && e.button === 1)) {
            setIsPanning(true);
            setLastPanPos({ x: clientX, y: clientY });
            return;
        }

        if (currentTool === 'select') {
            const hit = [...actions].reverse().find(a => isPointNearAction(point, a));
            if (hit) {
                setSelectedActionId(hit.id);
                setIsDraggingAction(true);
                setDragStartPoint(point);
            } else {
                setSelectedActionId(null);
            }
            return;
        }

        if (currentTool === 'crop') {
            // Start a new crop rect dragging from BR handle
            setCropRect({ x1: point.x, y1: point.y, x2: point.x, y2: point.y });
            setActiveCropHandle('br');
            setIsCreatingCrop(true);
            return;
        }

        if (currentTool === 'text') {
            setEditingText({ id: Date.now().toString(), x: point.x, y: point.y, text: '' });
            return;
        }

        if (currentTool === 'magnifier') {
            setShowLoupe(true);
            return;
        }

        if (currentTool === 'stamp') {
            const newAction: DrawAction = {
                id: Date.now().toString(),
                tool: 'stamp',
                color: currentColor,
                lineWidth,
                points: [],
                start: point,
                stampChar: selectedStamp.char,
                isFinished: true,
            };
            setActions(prev => [...prev, newAction]);
            setRedoStack([]);
            return;
        }

        setIsDrawing(true);
        setRedoStack([]);
        setCurrentAction({
            id: Date.now().toString(),
            tool: currentTool,
            color: currentColor,
            lineWidth,
            points: [point],
            start: point,
            end: point,
            isFinished: false,
        });
    };

    const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        const point = screenToCanvas(clientX, clientY);
        setMousePos(point);

        if (isPanning) {
            setOffset(prev => ({ x: prev.x + (clientX - lastPanPos.x), y: prev.y + (clientY - lastPanPos.y) }));
            setLastPanPos({ x: clientX, y: clientY });
            return;
        }

        if (isDraggingAction && selectedActionId && dragStartPoint) {
            const dx = point.x - dragStartPoint.x;
            const dy = point.y - dragStartPoint.y;
            setActions(prev => prev.map(a => {
                if (a.id !== selectedActionId) return a;
                return {
                    ...a,
                    start: a.start ? { x: a.start.x + dx, y: a.start.y + dy } : undefined,
                    end: a.end ? { x: a.end.x + dx, y: a.end.y + dy } : undefined,
                    points: a.points.map(p => ({ x: p.x + dx, y: p.y + dy })),
                };
            }));
            setDragStartPoint(point);
            return;
        }

        if (!isDrawing || !currentAction) return;

        if (currentTool === 'pen' || currentTool === 'highlighter' || currentTool === 'eraser') {
            setCurrentAction(prev => prev ? { ...prev, points: [...prev.points, point] } : prev);
        } else {
            setCurrentAction(prev => prev ? { ...prev, end: point } : prev);
        }
    };

    const handlePointerUp = () => {
        if (isPanning) { setIsPanning(false); return; }
        if (isDraggingAction) { setIsDraggingAction(false); setDragStartPoint(null); return; }
        if (showLoupe) { setShowLoupe(false); return; }
        if (isCreatingCrop) { setIsCreatingCrop(false); setActiveCropHandle(null); return; }

        if (isDrawing && currentAction) {
            setActions(prev => [...prev, { ...currentAction, isFinished: true }]);
            setCurrentAction(null);
            setIsDrawing(false);
        }
    };

    // ══════════════════════════════════════════════════════════════════════════
    //  WHEEL ZOOM
    // ══════════════════════════════════════════════════════════════════════════

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const onWheel = (e: WheelEvent) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                const factor = 1 - e.deltaY * 0.004;
                const newScale = Math.min(Math.max(0.05, scale * factor), 20);
                const cx = (e.clientX - offset.x) / scale;
                const cy = (e.clientY - offset.y) / scale;
                setScale(newScale);
                setOffset({ x: e.clientX - cx * newScale, y: e.clientY - cy * newScale });
            } else {
                setOffset(prev => ({ x: prev.x - e.deltaX, y: prev.y - e.deltaY }));
            }
        };
        el.addEventListener('wheel', onWheel, { passive: false });
        return () => el.removeEventListener('wheel', onWheel);
    }, [scale, offset]);

    // ══════════════════════════════════════════════════════════════════════════
    //  TEXT / UNDO / CLEAR / CROP / SAVE
    // ══════════════════════════════════════════════════════════════════════════

    const finishText = () => {
        if (editingText?.text.trim()) {
            setActions(prev => [...prev, {
                id: editingText.id,
                tool: 'text',
                color: currentColor,
                lineWidth,
                points: [],
                start: { x: editingText.x, y: editingText.y },
                text: editingText.text,
                isFinished: true,
            }]);
            setRedoStack([]);
        }
        setEditingText(null);
    };

    const undo = () => {
        setActions(prev => {
            if (!prev.length) return prev;
            const last = prev[prev.length - 1];
            setRedoStack(r => [...r, last]);
            return prev.slice(0, -1);
        });
    };

    const redo = () => {
        setRedoStack(prev => {
            if (!prev.length) return prev;
            const last = prev[prev.length - 1];
            setActions(a => [...a, last]);
            return prev.slice(0, -1);
        });
    };

    const clear = () => {
        if (!window.confirm('Clear all edits?')) return;
        setRedoStack([]);
        setActions([]);
        setSelectedActionId(null);
    };

    const applyCrop = () => {
        if (!cropRect || !bgImageRef.current || !bgCanvasRef.current || !mainCanvasRef.current) return;
        const { x, y, w, h } = normalizeCrop(cropRect);
        if (w < 10 || h < 10) return;

        const dpr = window.devicePixelRatio || 1;
        const tmp = document.createElement('canvas');
        tmp.width = w * dpr;
        tmp.height = h * dpr;
        const tc = tmp.getContext('2d')!;

        // Bake bg + annotations into the new image
        tc.drawImage(bgCanvasRef.current, x * dpr, y * dpr, w * dpr, h * dpr, 0, 0, w * dpr, h * dpr);
        tc.drawImage(mainCanvasRef.current, x * dpr, y * dpr, w * dpr, h * dpr, 0, 0, w * dpr, h * dpr);

        const newImg = new Image();
        newImg.onload = () => {
            bgImageRef.current = newImg;
            setActions([]);
            setRedoStack([]);
            setCropRect(null);
            setupCanvases(w, h);
            setTimeout(() => {
                drawBackground();
                drawMain();
            }, 0);
        };
        newImg.src = tmp.toDataURL('image/png');
    };

    const save = async () => {
        const bgC = bgCanvasRef.current;
        const mainC = mainCanvasRef.current;
        const img = bgImageRef.current;
        if (!bgC || !mainC || !img) return;

        let minX = WORKSPACE_PADDING, minY = WORKSPACE_PADDING;
        let maxX = WORKSPACE_PADDING + img.width, maxY = WORKSPACE_PADDING + img.height;

        actions.forEach(a => {
            const pad = a.lineWidth + 24;
            [a.start, a.end].forEach(p => { if (!p) return; minX = Math.min(minX, p.x - pad); minY = Math.min(minY, p.y - pad); maxX = Math.max(maxX, p.x + pad); maxY = Math.max(maxY, p.y + pad); });
            a.points.forEach(p => { minX = Math.min(minX, p.x - pad); minY = Math.min(minY, p.y - pad); maxX = Math.max(maxX, p.x + pad); maxY = Math.max(maxY, p.y + pad); });
            if (a.tool === 'text' && a.text && a.start) { const fs = a.lineWidth * 4 + 16; maxX = Math.max(maxX, a.start.x + a.text.length * fs * 0.7); maxY = Math.max(maxY, a.start.y + fs + pad); }
        });

        const fw = maxX - minX, fh = maxY - minY;
        if (fw <= 0 || fh <= 0) return;

        const dpr = window.devicePixelRatio || 1;
        const off = document.createElement('canvas');
        off.width = fw * dpr;
        off.height = fh * dpr;
        const oc = off.getContext('2d')!;

        oc.drawImage(bgC, minX * dpr, minY * dpr, fw * dpr, fh * dpr, 0, 0, fw * dpr, fh * dpr);
        oc.drawImage(mainC, minX * dpr, minY * dpr, fw * dpr, fh * dpr, 0, 0, fw * dpr, fh * dpr);

        onSaveToFeed(off.toDataURL('image/png'));
    };

    // ══════════════════════════════════════════════════════════════════════════
    //  KEYBOARD SHORTCUTS
    // ══════════════════════════════════════════════════════════════════════════

    useEffect(() => {
        const onDown = (e: KeyboardEvent) => {
            if (editingText) {
                if (e.key === 'Enter') finishText();
                if (e.key === 'Escape') setEditingText(null);
                return;
            }
            if (e.key === 'Escape') { onClose(); return; }
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
            if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); redo(); }
            if ((e.key === 'Delete' || e.key === 'Backspace') && selectedActionId && !editingText) {
                setActions(prev => prev.filter(a => a.id !== selectedActionId));
                setSelectedActionId(null);
            }
            if (e.key === ' ' && !editingText) { e.preventDefault(); setIsPanning(true); }
            // Tool shortcuts
            const shortcuts: Record<string, Tool> = { v: 'select', p: 'pen', h: 'highlighter', b: 'blur', r: 'rect', c: 'circle', a: 'arrow', l: 'line', t: 'text', e: 'eraser', k: 'crop', m: 'magnifier', s: 'stamp' };
            if (!e.ctrlKey && !e.metaKey && shortcuts[e.key]) setCurrentTool(shortcuts[e.key]);
        };
        const onUp = (e: KeyboardEvent) => { if (e.key === ' ') setIsPanning(false); };
        window.addEventListener('keydown', onDown);
        window.addEventListener('keyup', onUp);
        return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp); };
    }, [actions, editingText, onClose, selectedActionId]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => { if (editingText && textInputRef.current) textInputRef.current.focus(); }, [editingText]);

    // ══════════════════════════════════════════════════════════════════════════
    //  CROP OVERLAY HELPERS
    // ══════════════════════════════════════════════════════════════════════════

    const cropNorm = cropRect ? normalizeCrop(cropRect) : null;

    const cropScreenRect = cropNorm ? {
        left: offset.x + cropNorm.x * scale,
        top: offset.y + cropNorm.y * scale,
        width: cropNorm.w * scale,
        height: cropNorm.h * scale,
    } : null;

    // Handle the four corners — we need to map them back to x1/y1/x2/y2 handles
    // regardless of sign, so we expose visual handles from the normalised rect
    const handleStartCropHandle = (e: React.MouseEvent, handle: CropHandle) => {
        e.stopPropagation();
        e.preventDefault();
        if (handle === 'body') {
            cropBodyDragRef.current = screenToCanvas(e.clientX, e.clientY);
        }
        setActiveCropHandle(handle);
    };

    // ══════════════════════════════════════════════════════════════════════════
    //  RENDER
    // ══════════════════════════════════════════════════════════════════════════

    const canvasSize = bgImageRef.current
        ? { w: bgImageRef.current.width + WORKSPACE_PADDING * 2, h: bgImageRef.current.height + WORKSPACE_PADDING * 2 }
        : { w: 0, h: 0 };

    return (
        <div className="image-editor-modal" ref={containerRef}>
            <div className="editor-backdrop" onClick={onClose} />

            {/* ── LEFT TOOLBAR ─────────────────────────────────────────────── */}
            <div className="side-tool-pill">
                <ToolBtn tool="select" current={currentTool} icon={<Icons.Select />} label="Select (V)" onClick={setCurrentTool} />
                <div className="side-pill-divider" />
                <ToolBtn tool="pen" current={currentTool} icon={<Icons.Pen />} label="Pen (P)" onClick={setCurrentTool} />
                <ToolBtn tool="highlighter" current={currentTool} icon={<Icons.Highlighter />} label="Highlight (H)" onClick={setCurrentTool} />
                <ToolBtn tool="blur" current={currentTool} icon={<Icons.Blur />} label="Blur (B)" onClick={setCurrentTool} />
                <ToolBtn tool="eraser" current={currentTool} icon={<Icons.Eraser />} label="Eraser (E)" onClick={setCurrentTool} />
                <div className="side-pill-divider" />
                <ToolBtn tool="rect" current={currentTool} icon={<Icons.Rect />} label="Rectangle (R)" onClick={setCurrentTool} />
                <ToolBtn tool="circle" current={currentTool} icon={<Icons.Circle />} label="Circle (C)" onClick={setCurrentTool} />
                <ToolBtn tool="arrow" current={currentTool} icon={<Icons.Arrow />} label="Arrow (A)" onClick={setCurrentTool} />
                <ToolBtn tool="line" current={currentTool} icon={<Icons.Line />} label="Line (L)" onClick={setCurrentTool} />
                <ToolBtn tool="text" current={currentTool} icon={<Icons.Text />} label="Text (T)" onClick={setCurrentTool} />
                <ToolBtn tool="stamp" current={currentTool} icon={<Icons.Stamp />} label="Stamp (S)" onClick={setCurrentTool} />
                <div className="side-pill-divider" />
                <ToolBtn tool="crop" current={currentTool} icon={<Icons.Crop />} label="Crop (K)" onClick={setCurrentTool} />
                <ToolBtn tool="magnifier" current={currentTool} icon={<Icons.Magnifier />} label="Magnifier (M)" onClick={setCurrentTool} />
            </div>

            {/* ── TOP BAR ──────────────────────────────────────────────────── */}
            <div className="top-island-bar">
                {currentTool === 'crop' && cropNorm && cropNorm.w > 10 ? (
                    <>
                        {/* Aspect ratio pills */}
                        <div className="island-section">
                            {ASPECT_RATIOS.map(ar => (
                                <button
                                    key={ar.label}
                                    className={`aspect-btn ${cropAspect === ar.value ? 'active' : ''}`}
                                    onClick={() => setCropAspect(ar.value)}
                                >{ar.label}</button>
                            ))}
                        </div>
                        <div className="island-divider" />
                        <div className="island-section">
                            <span className="crop-dims">{Math.round(cropNorm.w)} × {Math.round(cropNorm.h)}</span>
                        </div>
                        <div className="island-divider" />
                        <div className="island-section">
                            <button className="btn-apply-crop" onClick={applyCrop}>
                                <Icons.Check /> <span>Apply Crop</span>
                            </button>
                            <button className="island-action-btn" onClick={() => { setCropRect(null); }} title="Cancel crop">
                                <Icons.Close />
                            </button>
                        </div>
                    </>
                ) : currentTool === 'stamp' ? (
                    <>
                        <div className="island-section stamp-grid">
                            {STAMPS.map(s => (
                                <button
                                    key={s.id}
                                    className={`stamp-btn ${selectedStamp.id === s.id ? 'active' : ''}`}
                                    onClick={() => setSelectedStamp(s)}
                                    title={s.label}
                                >{s.char}</button>
                            ))}
                        </div>
                        <div className="island-divider" />
                        <div className="island-section">
                            <span className="size-label">Size</span>
                            <input type="range" min="1" max="20" value={lineWidth} onChange={e => setLineWidth(Number(e.target.value))} />
                        </div>
                    </>
                ) : (
                    <>
                        {/* Color presets */}
                        <div className="island-section">
                            <div className="color-presets">
                                {COLOR_PRESETS.map(c => (
                                    <button
                                        key={c}
                                        className={`color-preset-swatch ${currentColor === c ? 'active' : ''}`}
                                        style={{ background: c }}
                                        onClick={() => setCurrentColor(c)}
                                        title={c}
                                    />
                                ))}
                            </div>
                            <div className="color-wheel-button" title="Custom colour">
                                <div className="color-preview-circle" style={{ background: currentColor }} />
                                <input type="color" value={currentColor} onChange={e => setCurrentColor(e.target.value)} />
                            </div>
                        </div>

                        <div className="island-divider" />

                        {/* Size slider */}
                        <div className="island-section">
                            <span className="size-preview-dot" style={{ width: Math.max(3, lineWidth), height: Math.max(3, lineWidth), background: currentColor }} />
                            <input type="range" min="1" max="50" value={lineWidth} onChange={e => setLineWidth(Number(e.target.value))} />
                        </div>

                        <div className="island-divider" />

                        {/* Actions */}
                        <div className="island-section">
                            <button className="island-action-btn" onClick={undo} disabled={!actions.length} title="Undo (Ctrl+Z)">
                                <Icons.Undo />
                            </button>
                            <button className="island-action-btn" onClick={redo} disabled={!redoStack.length} title="Redo (Ctrl+Y)">
                                <Icons.Redo />
                            </button>
                            <button className="island-action-btn" onClick={clear} title="Clear all">
                                <Icons.Trash />
                            </button>
                        </div>

                        <div className="island-divider" />

                        <div className="island-section">
                            <button className="island-action-btn save-btn" onClick={save} title="Save (Enter)">
                                <Icons.Save />
                            </button>
                            <button className="island-action-btn close-btn" onClick={onClose} title="Close (Esc)">
                                <Icons.Close />
                            </button>
                        </div>
                    </>
                )}
            </div>

            {/* ── CANVAS VIEWPORT ──────────────────────────────────────────── */}
            <div
                className={`canvas-viewport ${isPanning ? 'panning' : ''} tool-${currentTool}`}
                onMouseDown={handlePointerDown}
                onMouseMove={handlePointerMove}
                onMouseUp={handlePointerUp}
                onMouseLeave={handlePointerUp}
                onTouchStart={handlePointerDown}
                onTouchMove={handlePointerMove}
                onTouchEnd={handlePointerUp}
            >
                <div
                    className="canvas-stack"
                    style={{
                        transform: `translate(${offset.x}px,${offset.y}px) scale(${scale})`,
                        transformOrigin: '0 0',
                        width: canvasSize.w,
                        height: canvasSize.h,
                    }}
                >
                    <canvas ref={bgCanvasRef} className="editor-layer bg" style={{ width: '100%', height: '100%' }} />
                    <canvas ref={mainCanvasRef} className="editor-layer main" style={{ width: '100%', height: '100%' }} />
                    <canvas ref={overlayCanvasRef} className="editor-layer overlay" style={{ width: '100%', height: '100%' }} />
                </div>

                {/* ── CROP OVERLAY ─────────────────────────────────────────── */}
                {cropScreenRect && cropNorm && cropNorm.w > 4 && cropNorm.h > 4 && (
                    <div className="crop-shade-overlay">
                        {/* Four dimmed quadrants */}
                        <div className="crop-shade top" style={{ height: cropScreenRect.top }} />
                        <div className="crop-shade bottom" style={{ top: cropScreenRect.top + cropScreenRect.height }} />
                        <div className="crop-shade left" style={{ top: cropScreenRect.top, height: cropScreenRect.height, width: cropScreenRect.left }} />
                        <div className="crop-shade right" style={{ top: cropScreenRect.top, height: cropScreenRect.height, left: cropScreenRect.left + cropScreenRect.width }} />

                        {/* Crop border + handles */}
                        <div
                            className="crop-box"
                            style={{
                                left: cropScreenRect.left,
                                top: cropScreenRect.top,
                                width: cropScreenRect.width,
                                height: cropScreenRect.height,
                            }}
                            onMouseDown={e => handleStartCropHandle(e, 'body')}
                        >
                            {/* Rule-of-thirds grid lines */}
                            <div className="crop-grid-h" style={{ top: '33.33%' }} />
                            <div className="crop-grid-h" style={{ top: '66.66%' }} />
                            <div className="crop-grid-v" style={{ left: '33.33%' }} />
                            <div className="crop-grid-v" style={{ left: '66.66%' }} />

                            <div className="crop-handle tl" onMouseDown={e => handleStartCropHandle(e, 'tl')} />
                            <div className="crop-handle tr" onMouseDown={e => handleStartCropHandle(e, 'tr')} />
                            <div className="crop-handle bl" onMouseDown={e => handleStartCropHandle(e, 'bl')} />
                            <div className="crop-handle br" onMouseDown={e => handleStartCropHandle(e, 'br')} />
                            {/* Edge mid-handles */}
                            <div className="crop-handle tm" onMouseDown={e => handleStartCropHandle(e, 'tl')} />
                            <div className="crop-handle bm" onMouseDown={e => handleStartCropHandle(e, 'bl')} />
                            <div className="crop-handle lm" onMouseDown={e => handleStartCropHandle(e, 'tl')} />
                            <div className="crop-handle rm" onMouseDown={e => handleStartCropHandle(e, 'tr')} />
                        </div>
                    </div>
                )}

                {/* ── MAGNIFIER LOUPE ──────────────────────────────────────── */}
                {showLoupe && bgCanvasRef.current && mainCanvasRef.current && (
                    <MagnifierLoupe
                        bgCanvas={bgCanvasRef.current}
                        mainCanvas={mainCanvasRef.current}
                        pos={{ x: offset.x + mousePos.x * scale, y: offset.y + mousePos.y * scale }}
                        imagePos={mousePos}
                        accentColor={accentColor || '#6366f1'}
                    />
                )}

                {/* ── INLINE TEXT INPUT ─────────────────────────────────────── */}
                {editingText && (
                    <div
                        className="inline-text-editor"
                        style={{ left: offset.x + editingText.x * scale, top: offset.y + editingText.y * scale, transform: `scale(${scale})`, transformOrigin: '0 0' }}
                    >
                        <input
                            ref={textInputRef}
                            value={editingText.text}
                            onChange={e => setEditingText({ ...editingText, text: e.target.value })}
                            onBlur={finishText}
                            placeholder="Type here…"
                            style={{ color: currentColor, fontSize: `${lineWidth * 4 + 16}px` }}
                        />
                    </div>
                )}
            </div>

            {/* ── BOTTOM STATUS BAR ─────────────────────────────────────────── */}
            <div className="status-pill-island">
                <div className="pill-metric">
                    <Icons.ZoomIn />
                    <span className="metric-value">{Math.round(scale * 100)}%</span>
                </div>
                <div className="pill-separator" />
                {selectedActionId && (
                    <>
                        <button className="status-action-btn" onClick={() => { setActions(p => p.filter(a => a.id !== selectedActionId)); setSelectedActionId(null); }}>
                            <Icons.Trash /> Delete selected
                        </button>
                        <div className="pill-separator" />
                    </>
                )}
                <div className="pill-shortcuts">
                    <span><kbd>Space</kbd> Pan</span>
                    <span className="pill-dot-sep">·</span>
                    <span><kbd>⌃ Scroll</kbd> Zoom</span>
                    <span className="pill-dot-sep">·</span>
                    <span><kbd>⌃Z</kbd> Undo</span>
                    <span className="pill-dot-sep">·</span>
                    <span><kbd>Del</kbd> Remove</span>
                </div>
            </div>
        </div>
    );
}

// ════════════════════════════════════════════════════════════════════════════
//  MAGNIFIER LOUPE
// ════════════════════════════════════════════════════════════════════════════

function MagnifierLoupe({ bgCanvas, mainCanvas, pos, imagePos, accentColor }: {
    bgCanvas: HTMLCanvasElement;
    mainCanvas: HTMLCanvasElement;
    pos: Point;
    imagePos: Point;
    accentColor: string;
}) {
    const loupeRef = useRef<HTMLCanvasElement>(null);
    const SIZE = 160;
    const ZOOM = 3.5;

    useEffect(() => {
        const canvas = loupeRef.current;
        const ctx = canvas?.getContext('2d');
        if (!ctx || !canvas) return;

        const dpr = window.devicePixelRatio || 1;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, SIZE, SIZE);

        ctx.save();
        ctx.beginPath();
        ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2, 0, Math.PI * 2);
        ctx.clip();

        const sw = SIZE / ZOOM;
        const sh = SIZE / ZOOM;

        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(bgCanvas, (imagePos.x - sw / 2) * dpr, (imagePos.y - sh / 2) * dpr, sw * dpr, sh * dpr, 0, 0, SIZE, SIZE);
        ctx.drawImage(mainCanvas, (imagePos.x - sw / 2) * dpr, (imagePos.y - sh / 2) * dpr, sw * dpr, sh * dpr, 0, 0, SIZE, SIZE);
        ctx.restore();

        // Cross-hair
        ctx.strokeStyle = accentColor;
        ctx.lineWidth = 1.5;
        const c = SIZE / 2;
        ctx.beginPath();
        ctx.moveTo(c, c - 14); ctx.lineTo(c, c + 14);
        ctx.moveTo(c - 14, c); ctx.lineTo(c + 14, c);
        ctx.stroke();

        // Pixel grid at high zoom
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 0.5;
        const pixW = SIZE / sw;
        for (let i = 0; i <= sw; i++) {
            ctx.beginPath(); ctx.moveTo(i * pixW, 0); ctx.lineTo(i * pixW, SIZE); ctx.stroke();
        }
        for (let j = 0; j <= sh; j++) {
            ctx.beginPath(); ctx.moveTo(0, j * pixW); ctx.lineTo(SIZE, j * pixW); ctx.stroke();
        }
    }, [bgCanvas, mainCanvas, imagePos, accentColor]);

    const dpr = window.devicePixelRatio || 1;
    return (
        <canvas
            ref={loupeRef}
            width={SIZE * dpr}
            height={SIZE * dpr}
            className="magnifier-loupe"
            style={{ left: pos.x - SIZE / 2, top: pos.y - SIZE - 20, width: SIZE, height: SIZE }}
        />
    );
}

// ════════════════════════════════════════════════════════════════════════════
//  TOOL BUTTON
// ════════════════════════════════════════════════════════════════════════════

function ToolBtn({ tool, current, icon, label, onClick }: {
    tool: Tool; current: Tool; icon: React.ReactNode; label: string; onClick: (t: Tool) => void;
}) {
    return (
        <button
            className={`side-icon-btn ${current === tool ? 'active' : ''}`}
            onClick={() => onClick(tool)}
            title={label}
        >
            <div className="btn-icon-wrapper">{icon}</div>
            <div className={`indicator ${current === tool ? 'visible' : ''}`} />
        </button>
    );
}