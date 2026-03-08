import React, { useState, useEffect, useRef, useCallback } from 'react';
import './ImageEditorModal.css';
import { Icons } from './ImageEditorIcons';
import { useSettingsStore } from '../store/useSettingsStore';

interface ImageEditorModalProps {
    src: string;
    onClose: () => void;
    onSaveToFeed: (base64Data: string) => void;
}

type Tool = 'select' | 'pen' | 'highlighter' | 'blur' | 'rect' | 'circle' | 'arrow' | 'line' | 'text' | 'eraser' | 'crop' | 'magnifier';
type Point = { x: number, y: number };

interface DrawAction {
    id: string;
    tool: Tool;
    color: string;
    lineWidth: number;
    points: Point[];
    start?: Point;
    end?: Point;
    text?: string;
    isFinished: boolean;
}

const WORKSPACE_PADDING = 1200;

export default function ImageEditorModal({ src, onClose, onSaveToFeed }: ImageEditorModalProps) {
    const accentColor = useSettingsStore(state => state.accentColor);

    const [currentTool, setCurrentTool] = useState<Tool>('pen');
    const [currentColor, setCurrentColor] = useState<string>(accentColor || '#6366f1');
    const [lineWidth, setLineWidth] = useState<number>(4);

    // Transform state
    const [scale, setScale] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [lastPanPos, setLastPanPos] = useState({ x: 0, y: 0 });

    // Canvas refs
    const bgCanvasRef = useRef<HTMLCanvasElement>(null);
    const mainCanvasRef = useRef<HTMLCanvasElement>(null);
    const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
    const bgImageRef = useRef<HTMLImageElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Drawing state
    const [actions, setActions] = useState<DrawAction[]>([]);
    const [currentAction, setCurrentAction] = useState<DrawAction | null>(null);
    const [isDrawing, setIsDrawing] = useState(false);

    // Selection & Manipulation state
    const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
    const [isDraggingAction, setIsDraggingAction] = useState(false);
    const [dragStartPoint, setDragStartPoint] = useState<Point | null>(null);

    // Cropping state
    const [cropRect, setCropRect] = useState<{ x: number, y: number, w: number, h: number } | null>(null);
    const [isResizingCrop, setIsResizingCrop] = useState(false);

    // Loupe / Mouse tracking
    const [mousePos, setMousePos] = useState<Point>({ x: 0, y: 0 });
    const [showLoupe, setShowLoupe] = useState(false);

    // Text editing state
    const [editingText, setEditingText] = useState<{ id: string, x: number, y: number, text: string } | null>(null);
    const textInputRef = useRef<HTMLInputElement>(null);

    const drawBackground = useCallback(() => {
        const canvas = bgCanvasRef.current;
        const ctx = canvas?.getContext('2d');
        const img = bgImageRef.current;
        if (!canvas || !ctx || !img) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.save();
        ctx.shadowBlur = 40;
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
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
        actions.forEach(action => {
            renderAction(ctx, action);
        });
    }, [actions]);

    const drawOverlay = useCallback(() => {
        const canvas = overlayCanvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (currentAction) {
            renderAction(ctx, currentAction);
        }
    }, [currentAction]);

    // Load image and setup canvas
    useEffect(() => {
        const img = new Image();
        img.onload = () => {
            bgImageRef.current = img;
            if (bgCanvasRef.current && mainCanvasRef.current && overlayCanvasRef.current && containerRef.current) {
                const container = containerRef.current;
                const w = img.width + (WORKSPACE_PADDING * 2);
                const h = img.height + (WORKSPACE_PADDING * 2);

                [bgCanvasRef, mainCanvasRef, overlayCanvasRef].forEach(ref => {
                    if (ref.current) {
                        ref.current.width = w;
                        ref.current.height = h;
                    }
                });

                const viewPadding = 100;
                const fitScale = Math.min(1, (container.clientWidth - viewPadding) / img.width, (container.clientHeight - viewPadding) / img.height);

                setScale(fitScale);
                setOffset({
                    x: container.clientWidth / 2 - (img.width / 2 + WORKSPACE_PADDING) * fitScale,
                    y: container.clientHeight / 2 - (img.height / 2 + WORKSPACE_PADDING) * fitScale
                });

                drawBackground();
                drawMain();
            }
        };
        img.src = src;
    }, [src, drawBackground, drawMain]);

    useEffect(() => {
        drawMain();
    }, [drawMain]);

    useEffect(() => {
        drawOverlay();
    }, [drawOverlay]);

    const isPointNearAction = (point: Point, action: DrawAction): boolean => {
        const threshold = action.lineWidth + 10;

        if (action.tool === 'pen' || action.tool === 'highlighter' || action.tool === 'eraser') {
            return action.points.some(p => Math.hypot(p.x - point.x, p.y - point.y) < threshold);
        }

        if (action.start && action.end) {
            if (action.tool === 'rect' || action.tool === 'blur') {
                const x = Math.min(action.start.x, action.end.x);
                const y = Math.min(action.start.y, action.end.y);
                const w = Math.abs(action.end.x - action.start.x);
                const h = Math.abs(action.end.y - action.start.y);
                return point.x >= x - threshold && point.x <= x + w + threshold &&
                    point.y >= y - threshold && point.y <= y + h + threshold;
            }
            if (action.tool === 'circle') {
                const rx = Math.abs(action.end.x - action.start.x) / 2;
                const ry = Math.abs(action.end.y - action.start.y) / 2;
                const cx = (action.start.x + action.end.x) / 2;
                const cy = (action.start.y + action.end.y) / 2;
                // Simple ellipse hit test
                const dx = (point.x - cx) / (rx + threshold);
                const dy = (point.y - cy) / (ry + threshold);
                return (dx * dx + dy * dy) <= 1;
            }
            if (action.tool === 'arrow' || action.tool === 'line') {
                // Distance to line segment
                const { x: x1, y: y1 } = action.start;
                const { x: x2, y: y2 } = action.end;
                const A = point.x - x1;
                const B = point.y - y1;
                const C = x2 - x1;
                const D = y2 - y1;
                const dot = A * C + B * D;
                const lenSq = C * C + D * D;
                let param = -1;
                if (lenSq !== 0) param = dot / lenSq;
                let xx, yy;
                if (param < 0) {
                    xx = x1; yy = y1;
                } else if (param > 1) {
                    xx = x2; yy = y2;
                } else {
                    xx = x1 + param * C;
                    yy = y1 + param * D;
                }
                const dist = Math.hypot(point.x - xx, point.y - yy);
                return dist < threshold;
            }
        }

        if (action.tool === 'text' && action.start) {
            const fontSize = action.lineWidth * 4 + 16;
            const w = (action.text?.length || 0) * (fontSize * 0.6);
            const h = fontSize;
            return point.x >= action.start.x && point.x <= action.start.x + w &&
                point.y >= action.start.y && point.y <= action.start.y + h;
        }

        return false;
    };

    const renderAction = (ctx: CanvasRenderingContext2D, action: DrawAction) => {
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = action.lineWidth;
        ctx.strokeStyle = action.color;
        ctx.fillStyle = action.color;

        // Selection highlight
        if (action.id === selectedActionId) {
            ctx.shadowBlur = 15;
            ctx.shadowColor = accentColor || '#6366f1';
        }

        if (action.tool === 'pen' || action.tool === 'highlighter') {
            if (action.tool === 'highlighter') {
                ctx.globalAlpha = 0.4;
                ctx.globalCompositeOperation = 'multiply';
            }
            if (action.points.length > 0) {
                ctx.beginPath();
                ctx.moveTo(action.points[0].x, action.points[0].y);
                for (let i = 1; i < action.points.length; i++) {
                    ctx.lineTo(action.points[i].x, action.points[i].y);
                }
                ctx.stroke();
            }
        } else if (action.tool === 'blur') {
            renderBlur(ctx, action);
        } else if (action.tool === 'rect' && action.start && action.end) {
            ctx.strokeRect(action.start.x, action.start.y, action.end.x - action.start.x, action.end.y - action.start.y);
        } else if (action.tool === 'circle' && action.start && action.end) {
            const rx = (action.end.x - action.start.x) / 2;
            const ry = (action.end.y - action.start.y) / 2;
            const cx = action.start.x + rx;
            const cy = action.start.y + ry;
            ctx.beginPath();
            ctx.ellipse(cx, cy, Math.abs(rx), Math.abs(ry), 0, 0, Math.PI * 2);
            ctx.stroke();
        } else if ((action.tool === 'arrow' || action.tool === 'line') && action.start && action.end) {
            ctx.beginPath();
            ctx.moveTo(action.start.x, action.start.y);
            ctx.lineTo(action.end.x, action.end.y);
            ctx.stroke();
            if (action.tool === 'arrow') {
                const angle = Math.atan2(action.end.y - action.start.y, action.end.x - action.start.x);
                const headlen = action.lineWidth * 4 + 10;
                ctx.beginPath();
                ctx.moveTo(action.end.x, action.end.y);
                ctx.lineTo(action.end.x - headlen * Math.cos(angle - Math.PI / 6), action.end.y - headlen * Math.sin(angle - Math.PI / 6));
                ctx.lineTo(action.end.x - headlen * Math.cos(angle + Math.PI / 6), action.end.y - headlen * Math.sin(angle + Math.PI / 6));
                ctx.lineTo(action.end.x, action.end.y);
                ctx.stroke();
            }
        } else if (action.tool === 'text' && action.start && action.text) {
            const fontSize = action.lineWidth * 4 + 16;
            ctx.font = `bold ${fontSize}px Inter, sans-serif`;
            ctx.textBaseline = 'top';
            ctx.fillText(action.text, action.start.x, action.start.y);
        } else if (action.tool === 'eraser') {
            ctx.globalCompositeOperation = 'destination-out';
            if (action.points.length > 0) {
                ctx.beginPath();
                ctx.moveTo(action.points[0].x, action.points[0].y);
                for (let i = 1; i < action.points.length; i++) {
                    ctx.lineTo(action.points[i].x, action.points[i].y);
                }
                ctx.stroke();
            }
        }
        ctx.restore();
    };

    const renderBlur = (ctx: CanvasRenderingContext2D, action: DrawAction) => {
        if (!action.start || !action.end) return;
        const x = Math.min(action.start.x, action.end.x);
        const y = Math.min(action.start.y, action.end.y);
        const w = Math.abs(action.end.x - action.start.x);
        const h = Math.abs(action.end.y - action.start.y);
        if (w < 1 || h < 1) return;

        const pixelSize = 10;
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = w / pixelSize;
        tempCanvas.height = h / pixelSize;
        const tempCtx = tempCanvas.getContext('2d');
        if (!tempCtx) return;

        tempCtx.imageSmoothingEnabled = false;
        // Adjust for image being at (WORKSPACE_PADDING, WORKSPACE_PADDING) on the main canvas
        tempCtx.drawImage(bgImageRef.current!, x - WORKSPACE_PADDING, y - WORKSPACE_PADDING, w, h, 0, 0, tempCanvas.width, tempCanvas.height);

        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(tempCanvas, 0, 0, tempCanvas.width, tempCanvas.height, x, y, w, h);
        ctx.restore();
    };

    const screenToCanvas = (clientX: number, clientY: number): Point => ({
        x: (clientX - offset.x) / scale,
        y: (clientY - offset.y) / scale
    });

    const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

        if (isPanning || (e as React.MouseEvent).button === 1) {
            setIsPanning(true);
            setLastPanPos({ x: clientX, y: clientY });
            return;
        }

        const point = screenToCanvas(clientX, clientY);
        setMousePos(point);

        // Selection mode
        if (currentTool === 'select') {
            const hitAction = [...actions].reverse().find(a => isPointNearAction(point, a));
            if (hitAction) {
                setSelectedActionId(hitAction.id);
                setIsDraggingAction(true);
                setDragStartPoint(point);
            } else {
                setSelectedActionId(null);
            }
            return;
        }

        if (currentTool === 'crop') {
            setCropRect({ x: point.x, y: point.y, w: 0, h: 0 });
            setIsResizingCrop(true);
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

        setIsDrawing(true);
        setCurrentAction({
            id: Date.now().toString(), tool: currentTool, color: currentColor, lineWidth,
            points: [point], start: point, end: point, isFinished: false
        });
    };

    const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        const point = screenToCanvas(clientX, clientY);
        setMousePos(point);

        if (isPanning) {
            setOffset({ x: offset.x + (clientX - lastPanPos.x), y: offset.y + (clientY - lastPanPos.y) });
            setLastPanPos({ x: clientX, y: clientY });
            return;
        }

        if (isDraggingAction && selectedActionId && dragStartPoint) {
            const dx = point.x - dragStartPoint.x;
            const dy = point.y - dragStartPoint.y;

            setActions(actions.map(a => {
                if (a.id === selectedActionId) {
                    const newStart = a.start ? { x: a.start.x + dx, y: a.start.y + dy } : undefined;
                    const newEnd = a.end ? { x: a.end.x + dx, y: a.end.y + dy } : undefined;
                    const newPoints = a.points.map(p => ({ x: p.x + dx, y: p.y + dy }));
                    return { ...a, start: newStart, end: newEnd, points: newPoints };
                }
                return a;
            }));
            setDragStartPoint(point);
            return;
        }

        if (isResizingCrop && cropRect) {
            setCropRect({ ...cropRect, w: point.x - cropRect.x, h: point.y - cropRect.y });
            return;
        }

        if (!isDrawing || !currentAction) return;

        if (currentTool === 'pen' || currentTool === 'highlighter' || currentTool === 'eraser') {
            setCurrentAction({ ...currentAction, points: [...currentAction.points, point] });
        } else {
            setCurrentAction({ ...currentAction, end: point });
        }
    };

    const handlePointerUp = () => {
        if (isPanning) { setIsPanning(false); return; }
        if (isDraggingAction) { setIsDraggingAction(false); return; }
        if (isResizingCrop) { setIsResizingCrop(false); return; }
        if (showLoupe) { setShowLoupe(false); return; }

        if (isDrawing && currentAction) {
            setActions([...actions, { ...currentAction, isFinished: true }]);
            setCurrentAction(null);
            setIsDrawing(false);
        }
    };

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const onWheel = (e: WheelEvent) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                // Continuous scaling factor
                const zoomFactor = -e.deltaY * 0.005;
                const delta = 1 + zoomFactor;
                const newScale = Math.min(Math.max(0.1, scale * delta), 10);

                const mouseX = e.clientX;
                const mouseY = e.clientY;
                const canvasMouseX = (mouseX - offset.x) / scale;
                const canvasMouseY = (mouseY - offset.y) / scale;

                setScale(newScale);
                setOffset({ x: mouseX - canvasMouseX * newScale, y: mouseY - canvasMouseY * newScale });
            } else {
                setOffset(prev => ({ x: prev.x - e.deltaX, y: prev.y - e.deltaY }));
            }
        };

        container.addEventListener('wheel', onWheel, { passive: false });
        return () => container.removeEventListener('wheel', onWheel);
    }, [scale, offset]);

    const finishText = () => {
        if (editingText && editingText.text.trim()) {
            setActions(prev => [...prev, {
                id: editingText.id, tool: 'text', color: currentColor, lineWidth,
                points: [], start: { x: editingText.x, y: editingText.y }, text: editingText.text, isFinished: true
            }]);
        }
        setEditingText(null);
        // Force a redraw of the main canvas after state updates
        setTimeout(drawMain, 0);
    };

    const undo = () => {
        setActions(prev => prev.slice(0, -1));
        setTimeout(drawMain, 0);
    };

    const clear = () => {
        if (confirm("Clear all edits?")) {
            setActions([]);
            setTimeout(drawMain, 0);
        }
    };

    const applyCrop = () => {
        if (!cropRect || !bgImageRef.current || !bgCanvasRef.current || !mainCanvasRef.current) return;

        const { x, y, w, h } = cropRect;
        const absW = Math.abs(w);
        const absH = Math.abs(h);
        if (absW < 10 || absH < 10) return;

        // Coordinates from cropRect are already in the canvas coordinate space 
        // (relative to the top-left of the entire padded canvas)
        const startX = Math.min(x, x + w);
        const startY = Math.min(y, y + h);

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = absW;
        tempCanvas.height = absH;
        const tempCtx = tempCanvas.getContext('2d');
        if (!tempCtx) return;

        // Draw background + current actions into the baked crop
        tempCtx.drawImage(bgCanvasRef.current, startX, startY, absW, absH, 0, 0, absW, absH);
        tempCtx.drawImage(mainCanvasRef.current, startX, startY, absW, absH, 0, 0, absW, absH);

        const newImg = new Image();
        newImg.onload = () => {
            bgImageRef.current = newImg;
            if (bgCanvasRef.current && mainCanvasRef.current && overlayCanvasRef.current && containerRef.current) {
                const w = absW + (WORKSPACE_PADDING * 2);
                const h = absH + (WORKSPACE_PADDING * 2);

                [bgCanvasRef, mainCanvasRef, overlayCanvasRef].forEach(ref => {
                    if (ref.current) {
                        ref.current.width = w;
                        ref.current.height = h;
                    }
                });

                setActions([]); // Edits are now baked into the new background image
                setCropRect(null);

                const container = containerRef.current;
                const fitScale = Math.min(1, (container.clientWidth - 100) / absW, (container.clientHeight - 100) / absH);
                setScale(fitScale);
                setOffset({
                    x: container.clientWidth / 2 - (absW / 2 + WORKSPACE_PADDING) * fitScale,
                    y: container.clientHeight / 2 - (absH / 2 + WORKSPACE_PADDING) * fitScale
                });

                // Redraw both layers with the new image
                drawBackground();
                drawMain();
            }
        };
        newImg.src = tempCanvas.toDataURL();
    };

    const save = async () => {
        const bgCanvas = bgCanvasRef.current;
        const mainCanvas = mainCanvasRef.current;
        const img = bgImageRef.current;
        if (!bgCanvas || !mainCanvas || !img) return;

        // Start with the original image's boundaries (at WORKSPACE_PADDING)
        let minX = WORKSPACE_PADDING;
        let minY = WORKSPACE_PADDING;
        let maxX = WORKSPACE_PADDING + img.width;
        let maxY = WORKSPACE_PADDING + img.height;

        // Expand bounding box to include all annotations
        actions.forEach(a => {
            const pad = a.lineWidth + 20; // Safety margin for strokes/shadows
            if (a.start) {
                minX = Math.min(minX, a.start.x - pad);
                minY = Math.min(minY, a.start.y - pad);
                maxX = Math.max(maxX, a.start.x + pad);
                maxY = Math.max(maxY, a.start.y + pad);
            }
            if (a.end) {
                minX = Math.min(minX, a.end.x - pad);
                minY = Math.min(minY, a.end.y - pad);
                maxX = Math.max(maxX, a.end.x + pad);
                maxY = Math.max(maxY, a.end.y + pad);
            }
            if (a.points) {
                a.points.forEach(p => {
                    minX = Math.min(minX, p.x - pad);
                    minY = Math.min(minY, p.y - pad);
                    maxX = Math.max(maxX, p.x + pad);
                    maxY = Math.max(maxY, p.y + pad);
                });
            }
            if (a.tool === 'text' && a.text) {
                const fontSize = a.lineWidth * 4 + 16;
                const textWidth = a.text.length * (fontSize * 0.7);
                maxX = Math.max(maxX, (a.start?.x || 0) + textWidth);
                maxY = Math.max(maxY, (a.start?.y || 0) + fontSize + pad);
            }
        });

        const finalW = maxX - minX;
        const finalH = maxY - minY;

        if (finalW <= 0 || finalH <= 0) return;

        const offscreen = document.createElement('canvas');
        offscreen.width = finalW;
        offscreen.height = finalH;
        const oCtx = offscreen.getContext('2d');
        if (!oCtx) return;

        // Combine the layers at the calculated offset
        oCtx.drawImage(bgCanvas, minX, minY, finalW, finalH, 0, 0, finalW, finalH);
        oCtx.drawImage(mainCanvas, minX, minY, finalW, finalH, 0, 0, finalW, finalH);

        const dataUrl = offscreen.toDataURL('image/png');
        onSaveToFeed(dataUrl);
    };

    useEffect(() => {
        const handleKeys = (e: KeyboardEvent) => {
            if (editingText) {
                if (e.key === 'Enter') finishText();
                if (e.key === 'Escape') setEditingText(null);
                return;
            }
            if (e.key === 'Escape') onClose();
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (selectedActionId) {
                    setActions(actions.filter(a => a.id !== selectedActionId));
                    setSelectedActionId(null);
                }
            }
            if (e.key === ' ') setIsPanning(true);
        };
        const handleKeyUp = (e: KeyboardEvent) => { if (e.key === ' ') setIsPanning(false); };
        window.addEventListener('keydown', handleKeys);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeys);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [actions, editingText, onClose, selectedActionId]);

    useEffect(() => { if (editingText && textInputRef.current) textInputRef.current.focus(); }, [editingText]);

    return (
        <div className="image-editor-modal" ref={containerRef}>
            <div className="editor-backdrop" onClick={onClose} />

            {/* Left Primary Toolbar Pill */}
            <div className="side-tool-pill">
                <ToolIconButton active={currentTool === 'select'} icon={<Icons.Select />} label="Select (V)" onClick={() => setCurrentTool('select')} />
                <div className="side-pill-divider" />
                <ToolIconButton active={currentTool === 'pen'} icon={<Icons.Pen />} label="Pen" onClick={() => setCurrentTool('pen')} />
                <ToolIconButton active={currentTool === 'highlighter'} icon={<Icons.Highlighter />} label="Highlight" onClick={() => setCurrentTool('highlighter')} />
                <ToolIconButton active={currentTool === 'blur'} icon={<Icons.Blur />} label="Blur" onClick={() => setCurrentTool('blur')} />
                <ToolIconButton active={currentTool === 'eraser'} icon={<Icons.Eraser />} label="Eraser" onClick={() => setCurrentTool('eraser')} />
                <div className="side-pill-divider" />
                <ToolIconButton active={currentTool === 'rect'} icon={<Icons.Rect />} label="Rectangle" onClick={() => setCurrentTool('rect')} />
                <ToolIconButton active={currentTool === 'circle'} icon={<Icons.Circle />} label="Circle" onClick={() => setCurrentTool('circle')} />
                <ToolIconButton active={currentTool === 'arrow'} icon={<Icons.Arrow />} label="Arrow" onClick={() => setCurrentTool('arrow')} />
                <ToolIconButton active={currentTool === 'line'} icon={<Icons.Line />} label="Line" onClick={() => setCurrentTool('line')} />
                <ToolIconButton active={currentTool === 'text'} icon={<Icons.Text />} label="Text" onClick={() => setCurrentTool('text')} />
                <div className="side-pill-divider" />
                <ToolIconButton active={currentTool === 'crop'} icon={<Icons.Crop />} label="Crop" onClick={() => setCurrentTool('crop')} />
                <ToolIconButton active={currentTool === 'magnifier'} icon={<Icons.Magnifier />} label="Magnifier" onClick={() => setCurrentTool('magnifier')} />
            </div>

            {/* Top Island: Context & Actions */}
            <div className="top-island-bar">
                {currentTool === 'crop' && cropRect && Math.abs(cropRect.w) > 10 ? (
                    <div className="island-section">
                        <button className="btn-apply-crop" onClick={applyCrop}>
                            <Icons.Check />
                            <span>Apply Crop</span>
                        </button>
                        <button className="island-action-btn" onClick={() => setCropRect(null)}>
                            <Icons.Close />
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="island-section">
                            <div className="color-wheel-button">
                                <div className="color-preview-circle" style={{ backgroundColor: currentColor }} />
                                <input type="color" value={currentColor} onChange={e => setCurrentColor(e.target.value)} />
                            </div>
                            <div className="size-slider-wrapper">
                                <span className="size-preview-dot" style={{ width: lineWidth, height: lineWidth, backgroundColor: currentColor }} />
                                <input type="range" min="1" max="50" value={lineWidth} onChange={e => setLineWidth(Number(e.target.value))} />
                            </div>
                        </div>
                        <div className="island-divider" />
                        <div className="island-section">
                            <button className="island-action-btn" onClick={undo} disabled={actions.length === 0} title="Undo (Ctrl+Z)">
                                <Icons.Undo />
                            </button>
                            <button className="island-action-btn" onClick={clear} title="Clear All">
                                <Icons.Trash />
                            </button>
                        </div>
                        <div className="island-divider" />
                        <div className="island-section">
                            <button className="island-action-btn save-btn" onClick={save} title="Save & Copy (Enter)">
                                <Icons.Save />
                            </button>
                            <button className="island-action-btn close-btn" onClick={onClose} title="Close (Esc)">
                                <Icons.Close />
                            </button>
                        </div>
                    </>
                )}
            </div>

            <div className={`canvas-viewport ${isPanning ? 'panning' : ''}`}
                onMouseDown={handlePointerDown} onMouseMove={handlePointerMove} onMouseUp={handlePointerUp} onMouseLeave={handlePointerUp}>

                <div className="canvas-stack" style={{
                    transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                    transformOrigin: '0 0',
                    width: bgImageRef.current ? bgImageRef.current.width + WORKSPACE_PADDING * 2 : 0,
                    height: bgImageRef.current ? bgImageRef.current.height + WORKSPACE_PADDING * 2 : 0
                }}>
                    <canvas ref={bgCanvasRef} className="editor-layer bg"
                        style={{ width: '100%', height: '100%' }} />
                    <canvas ref={mainCanvasRef} className="editor-layer main"
                        style={{ width: '100%', height: '100%' }} />
                    <canvas ref={overlayCanvasRef} className="editor-layer overlay"
                        style={{ width: '100%', height: '100%' }} />
                </div>

                {cropRect && (
                    <div className="crop-overlay" style={{
                        left: offset.x + Math.min(cropRect.x, cropRect.x + cropRect.w) * scale,
                        top: offset.y + Math.min(cropRect.y, cropRect.y + cropRect.h) * scale,
                        width: Math.abs(cropRect.w) * scale,
                        height: Math.abs(cropRect.h) * scale
                    }}>
                        <div className="crop-handle tl" />
                        <div className="crop-handle tr" />
                        <div className="crop-handle bl" />
                        <div className="crop-handle br" />
                    </div>
                )}

                {showLoupe && bgCanvasRef.current && mainCanvasRef.current && (
                    <MagnifierLoupe
                        bgCanvas={bgCanvasRef.current}
                        mainCanvas={mainCanvasRef.current}
                        pos={{ x: offset.x + mousePos.x * scale, y: offset.y + mousePos.y * scale }}
                        imagePos={mousePos}
                        accentColor={accentColor || '#6366f1'}
                    />
                )}

                {editingText && (
                    <div className="inline-text-editor" style={{
                        left: offset.x + editingText.x * scale, top: offset.y + editingText.y * scale,
                        transform: `scale(${scale})`, transformOrigin: '0 0'
                    }}>
                        <input ref={textInputRef} value={editingText.text} onChange={e => setEditingText({ ...editingText, text: e.target.value })}
                            onBlur={finishText} placeholder="Type here..." style={{ color: currentColor, fontSize: `${lineWidth * 4 + 16}px` }} />
                    </div>
                )}
            </div>

            {/* Bottom Status Pill */}
            <div className="status-pill-island">
                <div className="pill-metric">
                    <Icons.ZoomIn />
                    <span className="metric-value">{Math.round(scale * 100)}%</span>
                </div>
                <div className="pill-separator" />
                <div className="pill-shortcuts">
                    <div className="shortcut-item">
                        <Icons.Move />
                        <span>Space + Drag</span>
                    </div>
                    <div className="pill-dot-sep">•</div>
                    <div className="shortcut-item">
                        <Icons.Magnifier />
                        <span>Ctrl + Scroll</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

function MagnifierLoupe({ bgCanvas, mainCanvas, pos, imagePos, accentColor }: { bgCanvas: HTMLCanvasElement, mainCanvas: HTMLCanvasElement, pos: Point, imagePos: Point, accentColor: string }) {
    const loupeRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const ctx = loupeRef.current?.getContext('2d');
        if (!ctx) return;
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, 150, 150);
        ctx.save();
        ctx.beginPath();
        ctx.arc(75, 75, 75, 0, Math.PI * 2);
        ctx.clip();

        const zoom = 3;
        const sourceW = 150 / zoom;
        const sourceH = 150 / zoom;

        // Draw background layer
        ctx.drawImage(bgCanvas, imagePos.x - sourceW / 2, imagePos.y - sourceH / 2, sourceW, sourceH, 0, 0, 150, 150);
        // Draw main actions layer
        ctx.drawImage(mainCanvas, imagePos.x - sourceW / 2, imagePos.y - sourceH / 2, sourceW, sourceH, 0, 0, 150, 150);

        ctx.restore();
        // Crosshair
        ctx.strokeStyle = accentColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(75, 65); ctx.lineTo(75, 85);
        ctx.moveTo(65, 75); ctx.lineTo(85, 75);
        ctx.stroke();
    }, [bgCanvas, mainCanvas, imagePos, accentColor]);

    return (
        <canvas
            ref={loupeRef}
            width={150} height={150}
            className="magnifier-loupe"
            style={{ left: pos.x - 75, top: pos.y - 180 }}
        />
    );
}

function ToolIconButton({ active, icon, label, onClick }: { active: boolean, icon: React.ReactNode, label: string, onClick: () => void }) {
    return (
        <button className={`side-icon-btn ${active ? 'active' : ''}`} onClick={onClick} title={label}>
            <div className="btn-icon-wrapper">{icon}</div>
            <div className={`indicator ${active ? 'visible' : ''}`} />
        </button>
    );
}
