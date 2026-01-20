import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pipette, Palette, Eye, Layers, Save, RefreshCw, X, Check, Copy, ArrowLeft, GitMerge, ArrowDown, Upload, Plus, Minus, Download, Thermometer, Lock, Unlock, Edit2 } from 'lucide-react';
import * as Utils from './ColorPageUtils';
import ColorThief from 'colorthief';

interface ColorToolPageProps {
    initialColor?: string;
    onClose: () => void;
    onBack: () => void;
}

const TabButton = ({ id, icon: Icon, label, active, onClick }: any) => (
    <button
        onClick={() => onClick(id)}
        style={{
            flex: 1,
            padding: '12px 8px',
            background: active ? 'var(--bg-secondary)' : 'transparent',
            border: 'none',
            borderBottom: active ? '2px solid var(--accent-color)' : '1px solid transparent',
            color: active ? 'var(--accent-color)' : 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 6,
            fontSize: '0.75rem',
            transition: 'all 0.2s',
            fontWeight: active ? 600 : 400
        }}
    >
        <Icon size={18} strokeWidth={active ? 2.5 : 2} />
        {label}
    </button>
);

// Reusable color card component
const ColorCodeCard = ({ label, value, onClick }: { label: string; value: string; onClick: () => void }) => (
    <div
        className="info-card"
        onClick={onClick}
        title={`Click to copy ${label}`}
        style={{ background: 'var(--bg-card)', padding: 12, borderRadius: 8, border: '1px solid var(--border-color)', cursor: 'pointer', transition: 'background 0.2s' }}
    >
        <div style={{ fontSize: '0.75rem', opacity: 0.6, marginBottom: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>{label} <Copy size={12} style={{ opacity: 0.5 }} /></div>
        <div style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '0.85rem', wordBreak: 'break-all' }}>{value}</div>
    </div>
);

const ColorToolPage = ({ initialColor = '#3b82f6', onClose, onBack }: ColorToolPageProps) => {
    const [hex, setHex] = useState(initialColor);
    const [colorInput, setColorInput] = useState(initialColor);
    const [activeTab, setActiveTab] = useState<'analyze' | 'mixer' | 'harmonies' | 'a11y' | 'gradient' | 'saved'>('analyze');

    // Analyze Tab
    const [dragActive, setDragActive] = useState(false);
    const [extractedPalette, setExtractedPalette] = useState<string[]>([]);
    //const [colorHistory, setColorHistory] = useState<string[]>([]);
    const [showDevFormats, setShowDevFormats] = useState(false);

    // Mixer Tab
    const [mixColor1, setMixColor1] = useState('#ff0000');
    const [mixColor2, setMixColor2] = useState('#0000ff');
    const [mixRatio, setMixRatio] = useState(0.5);
    const [mixSteps, setMixSteps] = useState(5);
    const [mixMode, setMixMode] = useState<'rgb' | 'lab' | 'oklch'>('rgb');
    const [blendMode, setBlendMode] = useState<Utils.BlendMode>('normal');
    //const [mixColors, setMixColors] = useState<string[]>(['#ff0000', '#0000ff']);

    // A11y Tab
    const [contrastColor, setContrastColor] = useState('#ffffff');

    // Gradient Tab
    const [gradientType, setGradientType] = useState<'linear' | 'radial' | 'conic'>('linear');
    const [gradientAngle, setGradientAngle] = useState(90);
    const [gradientStops, setGradientStops] = useState<{ color: string; position: number }[]>([
        { color: '#3b82f6', position: 0 },
        { color: '#6366f1', position: 100 }
    ]);


    // Harmonies Tab
    const [harmonyAngleOffset, setHarmonyAngleOffset] = useState(0);
    const [lockedHarmonyColor, setLockedHarmonyColor] = useState(false);

    // Saved Palettes
    const [savedPalettes, setSavedPalettes] = useState<Utils.SavedPalette[]>([]);
    const [editingPaletteId, setEditingPaletteId] = useState<string | null>(null);
    const [importText, setImportText] = useState('');

    // File input ref for click-to-upload
    const fileInputRef = useRef<HTMLInputElement>(null);


    useEffect(() => {
        const parsed = Utils.parseColor(colorInput);
        if (parsed) {
            setHex(parsed);
        }
    }, [colorInput]);

    useEffect(() => {
        setColorInput(hex);
    }, [hex]);

    useEffect(() => {
        const saved = localStorage.getItem('reclip_saved_palettes');
        if (saved) {
            try {
                setSavedPalettes(JSON.parse(saved));
            } catch (e) {
                console.error("Failed to parse saved palettes", e);
            }
        }
    }, []);

    const savePalette = () => {
        const newPalette: Utils.SavedPalette = {
            id: crypto.randomUUID(),
            name: `Palette ${savedPalettes.length + 1}`,
            colors: [hex, ...Utils.generateHarmonies(hex).complementary.slice(1)], // Example: Main + Compl
            createdAt: Date.now()
        };
        const updated = [newPalette, ...savedPalettes];
        setSavedPalettes(updated);
        localStorage.setItem('reclip_saved_palettes', JSON.stringify(updated));
    };

    const deletePalette = (id: string) => {
        const updated = savedPalettes.filter(p => p.id !== id);
        setSavedPalettes(updated);
        localStorage.setItem('reclip_saved_palettes', JSON.stringify(updated));
    };

    const randomColor = () => {
        const r = Math.floor(Math.random() * 256);
        const g = Math.floor(Math.random() * 256);
        const b = Math.floor(Math.random() * 256);
        setHex(Utils.rgbToHex(r, g, b));
    };

    // Process image file (shared between drag-and-drop and file input)
    const processImageFile = useCallback((file: File) => {
        console.log("Processing file:", file.name, file.type);

        if (!file.type.startsWith('image/')) {
            console.warn("File is not an image");
            return;
        }

        const reader = new FileReader();
        reader.onload = async (event) => {
            if (event.target?.result) {
                const img = new Image();
                img.crossOrigin = 'Anonymous';
                img.src = event.target.result as string;
                img.onload = () => {
                    console.log("Image loaded for analysis", img.width, img.height);
                    try {
                        const thief = new ColorThief();
                        const palette = thief.getPalette(img, 10);
                        console.log("Palette extracted:", palette);
                        if (palette) {
                            setExtractedPalette(palette.map((c: number[]) => Utils.rgbToHex(c[0], c[1], c[2])));
                        }
                    } catch (err) {
                        console.error("ColorThief failed", err);
                    }
                };
                img.onerror = (err) => {
                    console.error("Failed to load image", err);
                }
            }
        };
        reader.readAsDataURL(file);
    }, []);

    const handleDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        console.log("Drop event detected");

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            processImageFile(e.dataTransfer.files[0]);
        }
    }, [processImageFile]);

    const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            processImageFile(e.target.files[0]);
        }
        // Reset input so the same file can be selected again
        e.target.value = '';
    }, [processImageFile]);

    const handleDropZoneClick = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    const rgb = Utils.hexToRgb(hex) || { r: 0, g: 0, b: 0 };
    const hsl = Utils.rgbToHsl(rgb.r, rgb.g, rgb.b);
    const hsv = Utils.rgbToHsv(rgb.r, rgb.g, rgb.b);
    const cmyk = Utils.rgbToCmyk(rgb.r, rgb.g, rgb.b);
    const hwb = Utils.rgbToHwb(rgb.r, rgb.g, rgb.b);
    const lab = Utils.rgbToLab(rgb.r, rgb.g, rgb.b);
    const lch = Utils.rgbToLch(rgb.r, rgb.g, rgb.b);
    const oklch = Utils.rgbToOklch(rgb.r, rgb.g, rgb.b);
    const colorName = Utils.findNearestColorName(hex);
    const tailwindMatch = Utils.findNearestTailwind(hex);
    const pantoneMatch = Utils.findNearestPantone(hex);
    const ralMatch = Utils.findNearestRal(hex);
    const ncsMatch = Utils.findNearestNcs(hex);
    const colorTemp = Utils.getColorTemperature(hex);
    const websafeColor = Utils.getWebsafeColor(hex);
    const hexShorthand = Utils.getHexShorthand(hex);
    const luminance = Utils.getLuminance(rgb.r, rgb.g, rgb.b);


    return (
        <div className="color-tool-page" style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>

            {/* Header */}
            <div className="titlebar" data-tauri-drag-region style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', padding: '0 12px', height: 40, display: 'flex', alignItems: 'center' }}>
                <div className="title-left" data-tauri-drag-region style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button onClick={onBack} className="title-btn" title="Back"><ArrowLeft size={18} /></button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 14, height: 14, background: hex, borderRadius: 4, border: '1px solid rgba(128,128,128,0.3)' }} />
                        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Color Tool</span>
                        <span style={{ fontSize: '0.8rem', opacity: 0.5, marginLeft: 8 }}>{colorName}</span>
                    </div>
                </div>
                <div className="title-right" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <select
                        className="settings-select"
                        style={{ height: 26, fontSize: '0.8rem', padding: '0 8px', width: 120 }}
                        onChange={(e) => {
                            if (e.target.value) {
                                navigator.clipboard.writeText(Utils.formatCode(hex, e.target.value));
                                e.target.value = '';
                            }
                        }}
                        defaultValue=""
                    >
                        <option value="" disabled>Copy as...</option>
                        <option value="tailwind">Tailwind Name</option>
                        <option value="swift">Swift UIColor</option>
                        <option value="flutter">Flutter Color</option>
                        <option value="kotlin">Kotlin Color</option>
                    </select>
                    <button onClick={randomColor} style={{ background: 'rgba(128,128,128,0.1)', border: 'none', borderRadius: 4, padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: 'var(--text-primary)' }}>
                        <RefreshCw size={12} /> Random
                    </button>
                    <button onClick={onClose} className="title-btn"><X size={18} /></button>
                </div>
            </div>

            {/* Input Section */}
            <div style={{ padding: '16px 20px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div style={{ position: 'relative' }}>
                        <div style={{ width: 64, height: 64, background: hex, borderRadius: 12, border: '1px solid rgba(128,128,128,0.2)', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
                        <input
                            type="color"
                            value={hex}
                            onChange={e => setColorInput(e.target.value)}
                            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                        />
                    </div>
                    <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '0.7rem', opacity: 0.6, marginBottom: 4, fontWeight: 500, textTransform: 'uppercase' }}>Current Color</label>
                        <input
                            type="text"
                            value={colorInput}
                            onChange={e => setColorInput(e.target.value)}
                            placeholder="#HEX, rgb(), hsl()"
                            style={{
                                width: '100%',
                                boxSizing: 'border-box',
                                padding: '8px 12px',
                                borderRadius: 8,
                                border: '1px solid var(--border-color)',
                                background: 'var(--bg-input)',
                                color: 'var(--text-primary)',
                                fontSize: '1.1rem',
                                fontFamily: 'monospace',
                                outline: 'none',
                                fontWeight: 600
                            }}
                        />
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div style={{ display: 'flex', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                <TabButton id="analyze" icon={Pipette} label="Analyze" active={activeTab === 'analyze'} onClick={setActiveTab} />
                <TabButton id="mixer" icon={GitMerge} label="Mixer" active={activeTab === 'mixer'} onClick={setActiveTab} />
                <TabButton id="harmonies" icon={Palette} label="Harmonies" active={activeTab === 'harmonies'} onClick={setActiveTab} />
                <TabButton id="a11y" icon={Eye} label="Accessibility" active={activeTab === 'a11y'} onClick={setActiveTab} />
                <TabButton id="gradient" icon={Layers} label="Gradient" active={activeTab === 'gradient'} onClick={setActiveTab} />
                <TabButton id="saved" icon={Save} label="Library" active={activeTab === 'saved'} onClick={setActiveTab} />
            </div>

            {/* Content Area */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', position: 'relative' }}>
                <AnimatePresence mode="wait">

                    {/* --- Analyze Tab --- */}
                    {activeTab === 'analyze' && (
                        <motion.div key="analyze" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                            {/* Tailwind Match */}
                            {tailwindMatch && (
                                <div style={{ marginBottom: 24, padding: '12px', background: 'color-mix(in srgb, var(--accent-color) 10%, transparent)', borderRadius: 8, border: '1px solid color-mix(in srgb, var(--accent-color) 20%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-color)' }} />
                                        <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-primary)' }}>Matches Tailwind <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{tailwindMatch}</span></span>
                                    </div>
                                    <Copy size={14} style={{ cursor: 'pointer', opacity: 0.7 }} onClick={() => navigator.clipboard.writeText(tailwindMatch)} />
                                </div>
                            )}

                            {/* Color Info Grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
                                {/* Essential CSS Formats */}
                                <ColorCodeCard label="CSS Hex" value={hex} onClick={() => navigator.clipboard.writeText(hex)} />
                                {hexShorthand && <ColorCodeCard label="Hex Short" value={hexShorthand} onClick={() => navigator.clipboard.writeText(hexShorthand)} />}
                                <ColorCodeCard label="CSS RGB" value={`rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`} onClick={() => navigator.clipboard.writeText(`rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`)} />
                                <ColorCodeCard label="CSS RGBA" value={`rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 1)`} onClick={() => navigator.clipboard.writeText(`rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 1)`)} />
                                <ColorCodeCard label="CSS HSL" value={`hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`} onClick={() => navigator.clipboard.writeText(`hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`)} />
                                <ColorCodeCard label="CSS HSLA" value={`hsla(${hsl.h}, ${hsl.s}%, ${hsl.l}%, 1)`} onClick={() => navigator.clipboard.writeText(`hsla(${hsl.h}, ${hsl.s}%, ${hsl.l}%, 1)`)} />
                                <ColorCodeCard label="CSS HWB" value={`hwb(${hwb.h} ${hwb.w}% ${hwb.b}%)`} onClick={() => navigator.clipboard.writeText(`hwb(${hwb.h} ${hwb.w}% ${hwb.b}%)`)} />

                                {/* Advanced Color Spaces */}
                                <ColorCodeCard label="LAB" value={`lab(${lab.l.toFixed(1)}% ${lab.a.toFixed(1)} ${lab.b.toFixed(1)})`} onClick={() => navigator.clipboard.writeText(`lab(${lab.l.toFixed(1)}% ${lab.a.toFixed(1)} ${lab.b.toFixed(1)})`)} />
                                <ColorCodeCard label="LCH" value={`lch(${lch.l.toFixed(1)}% ${lch.c.toFixed(1)} ${lch.h.toFixed(1)})`} onClick={() => navigator.clipboard.writeText(`lch(${lch.l.toFixed(1)}% ${lch.c.toFixed(1)} ${lch.h.toFixed(1)})`)} />
                                <ColorCodeCard label="OKLCH" value={`oklch(${oklch.l.toFixed(3)} ${oklch.c.toFixed(3)} ${oklch.h.toFixed(1)})`} onClick={() => navigator.clipboard.writeText(`oklch(${oklch.l.toFixed(3)} ${oklch.c.toFixed(3)} ${oklch.h.toFixed(1)})`)} />

                                {/* Traditional Formats */}
                                <ColorCodeCard label="HSV" value={`${hsv.h}°, ${hsv.s}%, ${hsv.v}%`} onClick={() => navigator.clipboard.writeText(`hsv(${hsv.h}, ${hsv.s}%, ${hsv.v}%)`)} />
                                <ColorCodeCard label="CMYK" value={`${cmyk.c}, ${cmyk.m}, ${cmyk.y}, ${cmyk.k}`} onClick={() => navigator.clipboard.writeText(`cmyk(${cmyk.c}%, ${cmyk.m}%, ${cmyk.y}%, ${cmyk.k}%)`)} />
                                <ColorCodeCard label="ARGB Hex" value={`#FF${hex.substring(1).toUpperCase()}`} onClick={() => navigator.clipboard.writeText(`#FF${hex.substring(1).toUpperCase()}`)} />

                                {/* Integer Formats */}
                                <ColorCodeCard label="Integer" value={parseInt(hex.substring(1), 16).toString()} onClick={() => navigator.clipboard.writeText(parseInt(hex.substring(1), 16).toString())} />
                                <ColorCodeCard label="Hex Int" value={`0x${hex.substring(1).toUpperCase()}`} onClick={() => navigator.clipboard.writeText(`0x${hex.substring(1).toUpperCase()}`)} />
                            </div>

                            {/* Color Properties */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
                                <div style={{ background: 'var(--bg-card)', padding: 12, borderRadius: 8, border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <Thermometer size={20} style={{ opacity: 0.6, color: colorTemp.type === 'warm' ? '#f59e0b' : colorTemp.type === 'cool' ? '#3b82f6' : '#6b7280' }} />
                                    <div>
                                        <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>Temperature</div>
                                        <div style={{ fontWeight: 600, textTransform: 'capitalize' }}>{colorTemp.type} (~{colorTemp.kelvin}K)</div>
                                    </div>
                                </div>
                                <div style={{ background: 'var(--bg-card)', padding: 12, borderRadius: 8, border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{ width: 20, height: 20, borderRadius: 4, background: `linear-gradient(135deg, #000 ${(1 - luminance) * 100}%, #fff ${(1 - luminance) * 100}%)` }} />
                                    <div>
                                        <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>Luminance</div>
                                        <div style={{ fontWeight: 600 }}>{(luminance * 100).toFixed(1)}%</div>
                                    </div>
                                </div>
                                <div
                                    style={{ background: 'var(--bg-card)', padding: 12, borderRadius: 8, border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                                    onClick={() => { setHex(websafeColor); navigator.clipboard.writeText(websafeColor); }}
                                    title="Click to set as current color"
                                >
                                    <div style={{ width: 20, height: 20, borderRadius: 4, background: websafeColor, border: '1px solid var(--border-color)' }} />
                                    <div>
                                        <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>Web-safe</div>
                                        <div style={{ fontWeight: 600, fontFamily: 'monospace' }}>{websafeColor}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Industry Color Matches */}
                            {(pantoneMatch || ralMatch || ncsMatch) && (
                                <div style={{ marginBottom: 24 }}>
                                    <h3 style={{ fontSize: '0.9rem', marginBottom: 12, opacity: 0.7 }}>Industry Color Matches</h3>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                        {pantoneMatch && (
                                            <div
                                                onClick={() => navigator.clipboard.writeText(pantoneMatch)}
                                                style={{ background: 'var(--bg-card)', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border-color)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                                                title="Click to copy"
                                            >
                                                <div style={{ width: 12, height: 12, borderRadius: 2, background: hex }} />
                                                <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{pantoneMatch}</span>
                                                <Copy size={10} style={{ opacity: 0.5 }} />
                                            </div>
                                        )}
                                        {ralMatch && (
                                            <div
                                                onClick={() => navigator.clipboard.writeText(ralMatch)}
                                                style={{ background: 'var(--bg-card)', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border-color)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                                                title="Click to copy"
                                            >
                                                <div style={{ width: 12, height: 12, borderRadius: 2, background: hex }} />
                                                <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{ralMatch}</span>
                                                <Copy size={10} style={{ opacity: 0.5 }} />
                                            </div>
                                        )}
                                        {ncsMatch && (
                                            <div
                                                onClick={() => navigator.clipboard.writeText(ncsMatch)}
                                                style={{ background: 'var(--bg-card)', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border-color)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                                                title="Click to copy"
                                            >
                                                <div style={{ width: 12, height: 12, borderRadius: 2, background: hex }} />
                                                <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{ncsMatch}</span>
                                                <Copy size={10} style={{ opacity: 0.5 }} />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Developer Format Cards - Toggle Section */}
                            <div style={{ marginBottom: 24 }}>
                                <button
                                    onClick={() => setShowDevFormats(!showDevFormats)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent-color)', fontSize: '0.9rem', fontWeight: 500, marginBottom: 12, padding: 0 }}
                                >
                                    {showDevFormats ? <Minus size={16} /> : <Plus size={16} />}
                                    Developer Formats
                                </button>
                                {showDevFormats && (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                                        <ColorCodeCard label="Swift UIColor" value={Utils.formatCode(hex, 'swift')} onClick={() => navigator.clipboard.writeText(Utils.formatCode(hex, 'swift'))} />
                                        <ColorCodeCard label="SwiftUI Color" value={Utils.formatCode(hex, 'swiftui')} onClick={() => navigator.clipboard.writeText(Utils.formatCode(hex, 'swiftui'))} />
                                        <ColorCodeCard label="Flutter" value={Utils.formatCode(hex, 'flutter')} onClick={() => navigator.clipboard.writeText(Utils.formatCode(hex, 'flutter'))} />
                                        <ColorCodeCard label="Kotlin" value={Utils.formatCode(hex, 'kotlin')} onClick={() => navigator.clipboard.writeText(Utils.formatCode(hex, 'kotlin'))} />
                                        <ColorCodeCard label="Android XML" value={Utils.formatCode(hex, 'android-xml')} onClick={() => navigator.clipboard.writeText(Utils.formatCode(hex, 'android-xml'))} />
                                        <ColorCodeCard label="C# .NET" value={Utils.formatCode(hex, 'csharp')} onClick={() => navigator.clipboard.writeText(Utils.formatCode(hex, 'csharp'))} />
                                        <ColorCodeCard label="Java AWT" value={Utils.formatCode(hex, 'java-awt')} onClick={() => navigator.clipboard.writeText(Utils.formatCode(hex, 'java-awt'))} />
                                        <ColorCodeCard label="Objective-C" value={Utils.formatCode(hex, 'objective-c')} onClick={() => navigator.clipboard.writeText(Utils.formatCode(hex, 'objective-c'))} />
                                        <ColorCodeCard label="CSS Variable" value={Utils.formatCode(hex, 'css-variable')} onClick={() => navigator.clipboard.writeText(Utils.formatCode(hex, 'css-variable'))} />
                                        <ColorCodeCard label="SASS Variable" value={Utils.formatCode(hex, 'sass-variable')} onClick={() => navigator.clipboard.writeText(Utils.formatCode(hex, 'sass-variable'))} />
                                    </div>
                                )}
                            </div>


                            {/* Tints & Shades */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                <div>
                                    <h3 style={{ fontSize: '0.9rem', marginBottom: 8, opacity: 0.7 }}>Tints</h3>
                                    <div style={{ display: 'flex', height: 40, borderRadius: 6, overflow: 'hidden' }}>
                                        {Utils.generateTints(hex, 10).map((c) => (
                                            <div key={c} onClick={() => setHex(c)} title={c} style={{ flex: 1, background: c, cursor: 'pointer' }} />
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <h3 style={{ fontSize: '0.9rem', marginBottom: 8, opacity: 0.7 }}>Shades</h3>
                                    <div style={{ display: 'flex', height: 40, borderRadius: 6, overflow: 'hidden' }}>
                                        {Utils.generateShades(hex, 10).map((c) => (
                                            <div key={c} onClick={() => setHex(c)} title={c} style={{ flex: 1, background: c, cursor: 'pointer' }} />
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Drag & Drop Zone */}
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileInputChange}
                                accept="image/*"
                                style={{ display: 'none' }}
                            />
                            <div
                                onClick={handleDropZoneClick}
                                onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
                                onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={handleDrop}
                                style={{
                                    marginTop: 24,
                                    border: `2px dashed ${dragActive ? 'var(--accent-color)' : 'var(--border-color)'}`,
                                    borderRadius: 12,
                                    padding: '24px 12px',
                                    textAlign: 'center',
                                    background: dragActive ? 'rgba(59, 130, 246, 0.1)' : 'rgba(128,128,128,0.05)',
                                    transition: 'all 0.2s',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: 8,
                                    cursor: 'pointer'
                                }}
                            >
                                <div style={{ pointerEvents: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                                    <Upload size={24} style={{ opacity: 0.5 }} />
                                    {extractedPalette.length > 0 ? (
                                        <div style={{ width: '100%' }}>
                                            <div style={{ fontSize: '0.8rem', marginBottom: 12, opacity: 0.7 }}>Extracted Palette (Click to set)</div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', pointerEvents: 'auto' }}>
                                                {extractedPalette.map(c => (
                                                    <div
                                                        key={c}
                                                        onClick={(e) => { e.stopPropagation(); setHex(c); }}
                                                        title={c}
                                                        style={{ width: 36, height: 36, background: c, borderRadius: 6, cursor: 'pointer', border: '1px solid rgba(128,128,128,0.2)', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div>
                                            <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>Drop an image here or click to select</div>
                                            <div style={{ fontSize: '0.75rem', opacity: 0.5 }}>to extract its dominant colors</div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* --- Mixer Tab --- */}
                    {activeTab === 'mixer' && (
                        <motion.div key="mixer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                                {/* Mixing Mode Selector */}
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                    <button
                                        onClick={() => setMixMode('rgb')}
                                        style={{ padding: '6px 12px', borderRadius: 6, border: `1px solid ${mixMode === 'rgb' ? 'var(--accent-color)' : 'var(--border-color)'}`, background: mixMode === 'rgb' ? 'var(--accent-color)' : 'transparent', color: mixMode === 'rgb' ? 'white' : 'var(--text-primary)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500 }}
                                    >RGB (Standard)</button>
                                    <button
                                        onClick={() => setMixMode('lab')}
                                        style={{ padding: '6px 12px', borderRadius: 6, border: `1px solid ${mixMode === 'lab' ? 'var(--accent-color)' : 'var(--border-color)'}`, background: mixMode === 'lab' ? 'var(--accent-color)' : 'transparent', color: mixMode === 'lab' ? 'white' : 'var(--text-primary)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500 }}
                                    >LAB (Perceptual)</button>
                                    <button
                                        onClick={() => setMixMode('oklch')}
                                        style={{ padding: '6px 12px', borderRadius: 6, border: `1px solid ${mixMode === 'oklch' ? 'var(--accent-color)' : 'var(--border-color)'}`, background: mixMode === 'oklch' ? 'var(--accent-color)' : 'transparent', color: mixMode === 'oklch' ? 'white' : 'var(--text-primary)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500 }}
                                    >OKLCH (Modern)</button>
                                </div>

                                {/* Inputs */}
                                <div style={{ background: 'var(--bg-card)', padding: 16, borderRadius: 12, border: '1px solid var(--border-color)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                        <h3 style={{ fontSize: '0.9rem', opacity: 0.7 }}>Color Mixer</h3>
                                        <select
                                            value={blendMode}
                                            onChange={e => setBlendMode(e.target.value as Utils.BlendMode)}
                                            className="settings-select"
                                        // style={{ height: 28, fontSize: '0.8rem', padding: '0 8px' }}
                                        >
                                            <option value="normal">Normal</option>
                                            <option value="multiply">Multiply</option>
                                            <option value="screen">Screen</option>
                                            <option value="overlay">Overlay</option>
                                            <option value="soft-light">Soft Light</option>
                                            <option value="hard-light">Hard Light</option>
                                            <option value="difference">Difference</option>
                                            <option value="exclusion">Exclusion</option>
                                        </select>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                            <div style={{ position: 'relative' }}>
                                                <div style={{ width: 48, height: 48, background: mixColor1, borderRadius: 8, border: '1px solid var(--border-color)' }} />
                                                <input type="color" value={mixColor1} onChange={e => setMixColor1(e.target.value)} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} />
                                            </div>
                                            <button onClick={() => setMixColor1(hex)} style={{ fontSize: '0.65rem', padding: '4px 6px', background: 'rgba(128,128,128,0.2)', border: 'none', borderRadius: 4, cursor: 'pointer', color: 'var(--text-color)' }}>Use Current</button>
                                        </div>

                                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', opacity: 0.6 }}>
                                                <span>{Math.round((1 - mixRatio) * 100)}%</span>
                                                <span>{Math.round(mixRatio * 100)}%</span>
                                            </div>
                                            <input
                                                type="range"
                                                min="0"
                                                max="1"
                                                step="0.01"
                                                value={mixRatio}
                                                onChange={e => setMixRatio(parseFloat(e.target.value))}
                                                className="custom-range"
                                                style={{
                                                    '--range-value': `${mixRatio * 100}%`,
                                                    '--range-fill': mixColor1,
                                                    '--range-track': mixColor2
                                                } as React.CSSProperties}
                                            />
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                            <div style={{ position: 'relative' }}>
                                                <div style={{ width: 48, height: 48, background: mixColor2, borderRadius: 8, border: '1px solid var(--border-color)' }} />
                                                <input type="color" value={mixColor2} onChange={e => setMixColor2(e.target.value)} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} />
                                            </div>
                                            <button onClick={() => setMixColor2(hex)} style={{ fontSize: '0.65rem', padding: '4px 6px', background: 'rgba(128,128,128,0.1)', border: 'none', borderRadius: 4, cursor: 'pointer', color: 'var(--text-color)' }}>Use Current</button>
                                        </div>
                                    </div>
                                </div>

                                {/* Result */}
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                                    <ArrowDown size={20} style={{ opacity: 0.3 }} />
                                    {(() => {
                                        let mixed: string;
                                        if (blendMode !== 'normal') {
                                            mixed = Utils.blendWithStrength(
                                                mixColor1,
                                                mixColor2,
                                                blendMode,
                                                mixRatio
                                            );
                                        } else if (mixMode === 'lab') {
                                            mixed = Utils.mixColorsLab(mixColor1, mixColor2, mixRatio);
                                        } else if (mixMode === 'oklch') {
                                            mixed = Utils.mixColorsOklch(mixColor1, mixColor2, mixRatio);
                                        } else {
                                            mixed = Utils.mixColors(mixColor1, mixColor2, mixRatio);
                                        }
                                        return (
                                            <div style={{ textAlign: 'center', width: '100%' }}>
                                                <div style={{ width: '100%', height: 80, background: mixed, borderRadius: 12, border: '1px solid var(--border-color)', marginBottom: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                                                <div style={{ fontFamily: 'monospace', fontSize: '1.4rem', fontWeight: 800 }}>{mixed}</div>
                                                <button
                                                    onClick={() => setHex(mixed)}
                                                    style={{ marginTop: 8, fontSize: '0.8rem', color: 'var(--accent-color)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                                                >
                                                    Set as Current Color
                                                </button>
                                            </div>
                                        );
                                    })()}
                                </div>

                                {/* Scale Generator */}
                                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 24 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                        <h3 style={{ fontSize: '0.9rem', opacity: 0.7 }}>Step Scale</h3>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <span style={{ fontSize: '0.8rem', fontFamily: 'monospace' }}>{mixSteps} Steps</span>
                                            <input
                                                type="range"
                                                min="3"
                                                max="30"
                                                value={mixSteps}
                                                onChange={e => setMixSteps(parseInt(e.target.value))}
                                                className="custom-range"
                                                style={{
                                                    width: 80,
                                                    '--range-value': `${((mixSteps - 3) / 27) * 100}%`,
                                                    '--range-fill': 'var(--accent-color)',
                                                    '--range-track': 'rgba(128,128,128,0.25)'
                                                } as React.CSSProperties}
                                            />
                                        </div>
                                    </div>
                                    {(() => {
                                        const scale = mixMode === 'lab'
                                            ? Utils.generateScaleLab(mixColor1, mixColor2, mixSteps)
                                            : mixMode === 'oklch'
                                                ? Utils.generateScaleOklch(mixColor1, mixColor2, mixSteps)
                                                : Utils.generateScale(mixColor1, mixColor2, mixSteps);
                                        return (
                                            <>
                                                <div style={{ display: 'flex', height: 60, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                                                    {scale.map((c, i) => (
                                                        <div key={`${c}-${i}`} title={c} onClick={() => setHex(c)} style={{ flex: 1, background: c, cursor: 'pointer' }} />
                                                    ))}
                                                </div>
                                                <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                                                    <button
                                                        onClick={() => navigator.clipboard.writeText(Utils.exportPaletteAsCSS(scale))}
                                                        style={{ padding: '6px 12px', fontSize: '0.75rem', background: 'rgba(128,128,128,0.1)', border: 'none', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-primary)' }}
                                                    >
                                                        <Copy size={12} /> CSS Variables
                                                    </button>
                                                    <button
                                                        onClick={() => navigator.clipboard.writeText(Utils.exportPaletteAsJSON(scale))}
                                                        style={{ padding: '6px 12px', fontSize: '0.75rem', background: 'rgba(128,128,128,0.1)', border: 'none', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-primary)' }}
                                                    >
                                                        <Copy size={12} /> JSON Array
                                                    </button>
                                                </div>
                                            </>
                                        );
                                    })()}
                                </div>

                                {/* Gradient Presets */}
                                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 24 }}>
                                    <h3 style={{ fontSize: '0.9rem', opacity: 0.7, marginBottom: 12 }}>Gradient Presets</h3>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8 }}>
                                        {Utils.GRADIENT_PRESETS.slice(0, 12).map(preset => (
                                            <div
                                                key={preset.name}
                                                onClick={() => {
                                                    setMixColor1(preset.colors[0]);
                                                    setMixColor2(preset.colors[preset.colors.length - 1]);
                                                }}
                                                style={{
                                                    height: 40,
                                                    borderRadius: 6,
                                                    background: `linear-gradient(${preset.angle}deg, ${preset.colors.join(', ')})`,
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'flex-end',
                                                    justifyContent: 'center',
                                                    padding: 4,
                                                    border: '1px solid var(--border-color)'
                                                }}
                                                title={preset.name}
                                            >
                                                <span style={{ fontSize: '0.65rem', color: 'white', textShadow: '0 1px 2px rgba(0,0,0,0.5)', fontWeight: 500 }}>{preset.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}


                    {/* --- Harmonies Tab --- */}
                    {activeTab === 'harmonies' && (
                        <motion.div key="harmonies" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                                {/* Controls */}
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', padding: 12, background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>Angle Offset:</span>

                                        <input
                                            type="range"
                                            min="-30"
                                            max="30"
                                            value={harmonyAngleOffset}
                                            onChange={e => setHarmonyAngleOffset(parseInt(e.target.value))}
                                            className="custom-range"
                                            style={{
                                                '--fill-start': `${harmonyAngleOffset >= 0
                                                    ? 50
                                                    : ((harmonyAngleOffset + 30) / 60) * 100
                                                    }%`,
                                                '--fill-end': `${harmonyAngleOffset >= 0
                                                    ? ((harmonyAngleOffset + 30) / 60) * 100
                                                    : 50
                                                    }%`,
                                                '--fill-color': 'var(--accent-color)',
                                                '--track-color': 'rgba(128,128,128,0.25)',
                                            } as React.CSSProperties}
                                        />
                                        <span style={{ fontSize: '0.8rem', fontFamily: 'monospace', minWidth: 40 }}>{harmonyAngleOffset > 0 ? '+' : ''}{harmonyAngleOffset}°</span>
                                    </div>
                                    <button
                                        onClick={() => setLockedHarmonyColor(!lockedHarmonyColor)}
                                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border-color)', background: lockedHarmonyColor ? 'var(--accent-color)' : 'transparent', color: lockedHarmonyColor ? 'white' : 'var(--text-primary)', cursor: 'pointer', fontSize: '0.8rem' }}
                                    >
                                        {lockedHarmonyColor ? <Lock size={14} /> : <Unlock size={14} />}
                                        Lock Primary
                                    </button>
                                </div>

                                {/* Harmonies */}
                                {Object.entries(Utils.generateHarmoniesAdvanced(hex, harmonyAngleOffset)).map(([name, colors]) => (
                                    <div key={name}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                            <h3 style={{ fontSize: '0.9rem', textTransform: 'capitalize', opacity: 0.8 }}>{name.replace(/([A-Z])/g, ' $1').trim()}</h3>
                                            <div style={{ display: 'flex', gap: 4 }}>
                                                <button
                                                    onClick={() => navigator.clipboard.writeText(Utils.exportPaletteAsCSS(colors))}
                                                    style={{ padding: '4px 8px', fontSize: '0.7rem', background: 'rgba(128,128,128,0.1)', border: 'none', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-secondary)' }}
                                                    title="Copy as CSS Variables"
                                                >
                                                    <Copy size={10} /> CSS
                                                </button>
                                                <button
                                                    onClick={() => navigator.clipboard.writeText(Utils.exportPaletteAsJSON(colors))}
                                                    style={{ padding: '4px 8px', fontSize: '0.7rem', background: 'rgba(128,128,128,0.1)', border: 'none', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-secondary)' }}
                                                    title="Copy as JSON"
                                                >
                                                    <Copy size={10} /> JSON
                                                </button>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', height: 48, borderRadius: 8, overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                                            {colors.map((c, i) => (
                                                <div
                                                    key={`${name}-${i}`}
                                                    onClick={() => !lockedHarmonyColor && setHex(c)}
                                                    title={c.toUpperCase()}
                                                    style={{
                                                        flex: 1,
                                                        background: c,
                                                        cursor: lockedHarmonyColor ? 'default' : 'pointer',
                                                        transition: 'flex 0.2s',
                                                        display: 'flex',
                                                        alignItems: 'flex-end',
                                                        justifyContent: 'center',
                                                        paddingBottom: 4
                                                    }}
                                                >
                                                    <span style={{ fontSize: '0.85rem', color: 'white', textShadow: '2px 2px 2px rgba(0,0,0,1)', fontWeight: 600 }}>{c.toUpperCase()}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    )}


                    {/* --- Accessibility Tab --- */}
                    {activeTab === 'a11y' && (
                        <motion.div key="a11y" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                                {/* Contrast Checker */}
                                <div style={{ background: 'var(--bg-card)', padding: 16, borderRadius: 12, border: '1px solid var(--border-color)' }}>
                                    <h3 style={{ fontSize: '1rem', marginBottom: 16 }}>Advanced Contrast Checker</h3>

                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
                                        {/* Controls */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: 8, opacity: 0.7 }}>Background Color</label>
                                                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                                    <div style={{ position: 'relative' }}>
                                                        <div style={{ width: 40, height: 40, background: hex, borderRadius: 6, border: '1px solid var(--border-color)' }} />
                                                        <button
                                                            onClick={onClose}
                                                            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'default' }}
                                                        />
                                                    </div>
                                                    <div style={{ fontFamily: 'monospace', fontWeight: 600 }}>{hex}</div>
                                                </div>
                                            </div>

                                            <div>
                                                <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: 8, opacity: 0.7 }}>Foreground/Text Color</label>
                                                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                                    <div style={{ position: 'relative' }}>
                                                        <div style={{ width: 40, height: 40, background: contrastColor, borderRadius: 6, border: '1px solid var(--border-color)' }} />
                                                        <input
                                                            type="color"
                                                            value={contrastColor}
                                                            onChange={e => setContrastColor(e.target.value)}
                                                            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                                                        />
                                                    </div>
                                                    <input
                                                        type="text"
                                                        value={contrastColor}
                                                        onChange={e => setContrastColor(e.target.value)}
                                                        className="settings-select"
                                                        style={{ width: 100, cursor: 'text' }}
                                                    />
                                                </div>
                                            </div>

                                            {/* Auto-suggest accessible alternatives */}
                                            {(() => {
                                                const wcagRatio = Utils.getContrastRatio(hex, contrastColor);
                                                //const apcaScore = Math.abs(Utils.getApcaContrast(hex, contrastColor));

                                                if (wcagRatio < 4.5) {
                                                    const lighterSuggestion = Utils.suggestAccessibleColor(hex, contrastColor);
                                                    const darkerSuggestion = Utils.suggestAccessibleColor(hex, contrastColor, 'darker');

                                                    return (
                                                        <div style={{ padding: 12, borderRadius: 8, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                                                            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#ef4444', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                                <X size={14} /> Contrast Issue
                                                            </div>
                                                            <div style={{ fontSize: '0.75rem', opacity: 0.8, marginBottom: 12 }}>
                                                                Current ratio: {wcagRatio.toFixed(2)}:1 (Need 4.5:1 for AA)
                                                            </div>
                                                            <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: 8 }}>Suggested Alternatives:</div>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                                {lighterSuggestion && (
                                                                    <button
                                                                        onClick={() => setContrastColor(lighterSuggestion)}
                                                                        style={{
                                                                            fontSize: '0.75rem',
                                                                            padding: '6px 10px',
                                                                            borderRadius: 4,
                                                                            background: lighterSuggestion,
                                                                            color: Utils.getContrastRatio(lighterSuggestion, '#000000') > 4.5 ? '#000' : '#fff',
                                                                            border: '1px solid rgba(0,0,0,0.1)',
                                                                            cursor: 'pointer',
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            gap: 6,
                                                                            justifyContent: 'space-between'
                                                                        }}
                                                                    >
                                                                        <span>Lighter: {lighterSuggestion}</span>
                                                                        <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>
                                                                            {Utils.getContrastRatio(hex, lighterSuggestion).toFixed(2)}:1
                                                                        </span>
                                                                    </button>
                                                                )}
                                                                {darkerSuggestion && (
                                                                    <button
                                                                        onClick={() => setContrastColor(darkerSuggestion)}
                                                                        style={{
                                                                            fontSize: '0.75rem',
                                                                            padding: '6px 10px',
                                                                            borderRadius: 4,
                                                                            background: darkerSuggestion,
                                                                            color: Utils.getContrastRatio(darkerSuggestion, '#000000') > 4.5 ? '#000' : '#fff',
                                                                            border: '1px solid rgba(0,0,0,0.1)',
                                                                            cursor: 'pointer',
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            gap: 6,
                                                                            justifyContent: 'space-between'
                                                                        }}
                                                                    >
                                                                        <span>Darker: {darkerSuggestion}</span>
                                                                        <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>
                                                                            {Utils.getContrastRatio(hex, darkerSuggestion).toFixed(2)}:1
                                                                        </span>
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            })()}

                                        </div>


                                        {/* Results */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                            {/* Results */}
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                                {/* Real UI Preview */}
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                    {/* Button Preview */}
                                                    <div style={{
                                                        padding: 12,
                                                        background: hex,
                                                        color: contrastColor,
                                                        borderRadius: 8,
                                                        border: '1px solid var(--border-color)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontWeight: 600,
                                                        fontSize: '0.9rem'
                                                    }}>
                                                        Button Example
                                                    </div>

                                                    {/* Card Preview */}
                                                    <div style={{
                                                        padding: 12,
                                                        background: hex,
                                                        borderRadius: 8,
                                                        border: '1px solid var(--border-color)'
                                                    }}>
                                                        <div style={{ color: contrastColor, fontWeight: 700, marginBottom: 4, fontSize: '0.9rem' }}>Card Title</div>
                                                        <div style={{ color: contrastColor, fontSize: '0.8rem', opacity: 0.9 }}>This is body text in a card component.</div>
                                                    </div>

                                                    {/* Input Preview */}
                                                    <div style={{
                                                        padding: '8px 12px',
                                                        background: hex,
                                                        color: contrastColor,
                                                        borderRadius: 6,
                                                        border: '1px solid var(--border-color)',
                                                        fontSize: '0.85rem'
                                                    }}>
                                                        Input placeholder text
                                                    </div>
                                                </div>


                                            </div>

                                            {/* Scores */}
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                                {/* WCAG 2.1 */}
                                                <div style={{ background: 'var(--bg-secondary)', padding: 12, borderRadius: 8 }}>
                                                    <div style={{ fontSize: '0.75rem', opacity: 0.6, marginBottom: 4 }}>WCAG 2.1 Ratio</div>
                                                    <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{Utils.getContrastRatio(hex, contrastColor).toFixed(2)}:1</div>
                                                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                                                        {Utils.getContrastRatio(hex, contrastColor) >= 4.5 ?
                                                            <span style={{ fontSize: '0.7rem', color: '#22c55e', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 2 }}><Check size={10} /> AA Pass</span> :
                                                            <span style={{ fontSize: '0.7rem', color: '#ef4444', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 2 }}><X size={10} /> AA Fail</span>
                                                        }
                                                        {Utils.getContrastRatio(hex, contrastColor) >= 7 ?
                                                            <span style={{ fontSize: '0.7rem', color: '#22c55e', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 2 }}><Check size={10} /> AAA Pass</span> :
                                                            <span style={{ fontSize: '0.7rem', color: '#ef4444', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 2 }}><X size={10} /> AAA Fail</span>
                                                        }
                                                    </div>
                                                </div>

                                                {/* APCA */}
                                                <div style={{ background: 'var(--bg-secondary)', padding: 12, borderRadius: 8 }}>
                                                    <div style={{ fontSize: '0.75rem', opacity: 0.6, marginBottom: 4 }}>APCA Lc (Beta)</div>
                                                    <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{Math.abs(Utils.getApcaContrast(hex, contrastColor)).toFixed(1)}</div>
                                                    <div style={{ fontSize: '0.7rem', opacity: 0.7, marginTop: 4 }}>
                                                        Min Font: <span style={{ fontWeight: 600 }}>{Utils.calculateMinFontSize(Utils.getContrastRatio(hex, contrastColor))}px</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Contrast Grid */}
                                <div style={{ marginTop: 0 }}>
                                    <h3 style={{ fontSize: '0.9rem', marginBottom: 12, opacity: 0.7 }}>Check Against Standard Backgrounds</h3>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8 }}>
                                        {Utils.STANDARD_BACKGROUNDS.map(bg => {
                                            const ratio = Utils.getContrastRatio(hex, bg.hex);
                                            const passAA = ratio >= 4.5;
                                            return (
                                                <div key={bg.name} style={{ background: bg.hex, color: hex, padding: 10, borderRadius: 6, border: '1px solid var(--border-color)', textAlign: 'center' }}>
                                                    <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 4 }}>{bg.name}</div>
                                                    <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>{ratio.toFixed(2)}</div>
                                                    <div style={{ fontSize: '0.7rem', marginTop: 4, display: 'flex', justifyContent: 'center', gap: 4 }}>
                                                        {passAA ? <Check size={12} /> : null}
                                                        <span>{passAA ? 'Pass' : 'Fail'}</span>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>

                                {/* Color Blindness Simulation */}
                                <div>
                                    <h3 style={{ fontSize: '1rem', marginBottom: 12 }}>Color Blindness Simulation</h3>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
                                        {['protanopia', 'deuteranopia', 'tritanopia', 'achromatopsia'].map((type) => {
                                            const rgbVal = Utils.hexToRgb(hex) || { r: 0, g: 0, b: 0 };
                                            const sim = Utils.simulateColorBlindness(rgbVal.r, rgbVal.g, rgbVal.b, type as any);
                                            const simHex = Utils.rgbToHex(sim.r, sim.g, sim.b);
                                            return (
                                                <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-card)', padding: 8, borderRadius: 8, border: '1px solid var(--border-color)' }}>
                                                    <div style={{ width: 40, height: 40, background: simHex, borderRadius: 6 }} />
                                                    <div>
                                                        <div style={{ fontSize: '0.85rem', textTransform: 'capitalize', fontWeight: 600 }}>{type}</div>
                                                        <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', opacity: 0.7 }}>{simHex}</div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* --- Gradient Tab --- */}
                    {activeTab === 'gradient' && (
                        <motion.div key="gradient" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                            {/* Preview */}
                            <div
                                style={{
                                    height: 200,
                                    background: Utils.generateGradient(gradientType, gradientAngle, gradientStops),
                                    borderRadius: 12,
                                    marginBottom: 24,
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                    position: 'relative'
                                }}
                            >
                                <button
                                    onClick={() => {
                                        // Simple canvas download implementation
                                        const canvas = document.createElement('canvas');
                                        canvas.width = 800;
                                        canvas.height = 400;
                                        const ctx = canvas.getContext('2d');
                                        if (ctx) {
                                            let grd;
                                            if (gradientType === 'linear') {
                                                const rad = (gradientAngle * Math.PI) / 180;
                                                const x2 = 800 * Math.cos(rad);
                                                const y2 = 400 * Math.sin(rad);
                                                grd = ctx.createLinearGradient(0, 0, x2 || 800, y2 || 0); // Simplified linear
                                            } else {
                                                grd = ctx.createRadialGradient(400, 200, 0, 400, 200, 400);
                                            }
                                            // Conic is hard to draw on canvas without polyfill, skipping for simple download

                                            if (gradientType !== 'conic') {
                                                gradientStops.forEach(stop => grd.addColorStop(stop.position / 100, stop.color));
                                                ctx.fillStyle = grd;
                                                ctx.fillRect(0, 0, 800, 400);
                                                const link = document.createElement('a');
                                                link.download = 'gradient.png';
                                                link.href = canvas.toDataURL();
                                                link.click();
                                            } else {
                                                alert('Image download not supported for Conic gradients yet.');
                                            }
                                        }
                                    }}
                                    style={{ position: 'absolute', bottom: 12, right: 12, padding: '8px 12px', background: 'white', color: 'black', border: 'none', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 600, boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}
                                >
                                    <Download size={14} /> PNG
                                </button>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                                {/* Controls */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20 }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: 8 }}>Gradient Type</label>
                                        <select
                                            value={gradientType}
                                            onChange={e => setGradientType(e.target.value as any)}
                                            className="settings-select"
                                        >
                                            <option value="linear">Linear</option>
                                            <option value="radial">Radial</option>
                                            <option value="conic">Conic</option>
                                        </select>
                                    </div>
                                    {gradientType === 'linear' && (
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: 8 }}>Angle ({gradientAngle}°)</label>
                                            <input
                                                type="range"
                                                min="0"
                                                max="360"
                                                value={gradientAngle}
                                                onChange={e => setGradientAngle(parseInt(e.target.value))}
                                                className="custom-range"
                                                style={{
                                                    '--range-value': `${(gradientAngle / 360) * 100}%`,
                                                    '--range-fill': 'var(--accent-color)',               // filled side
                                                    '--range-track': 'rgba(128,128,128,0.25)' // non-fill side
                                                } as React.CSSProperties}
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Stops Editor */}
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                        <label style={{ display: 'block', fontSize: '0.8rem' }}>Gradient Stops</label>
                                        <button
                                            onClick={() => setGradientStops([...gradientStops, { color: '#ffffff', position: 50 }])}
                                            style={{ fontSize: '0.75rem', padding: '4px 8px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                                        >
                                            <Plus size={12} /> Add Stop
                                        </button>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                        {gradientStops.map((stop, index) => (
                                            <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                <div style={{ position: 'relative' }}>
                                                    <div style={{ width: 36, height: 36, background: stop.color, borderRadius: 6, border: '1px solid var(--border-color)' }} />
                                                    <input
                                                        type="color"
                                                        value={stop.color}
                                                        onChange={e => {
                                                            const newStops = [...gradientStops];
                                                            newStops[index].color = e.target.value;
                                                            setGradientStops(newStops);
                                                        }}
                                                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                                                    />
                                                </div>
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max="100"
                                                    value={stop.position}
                                                    onChange={e => {
                                                        const newStops = [...gradientStops];
                                                        newStops[index].position = parseInt(e.target.value);
                                                        newStops.sort((a, b) => a.position - b.position); // Keep sorted
                                                        setGradientStops(newStops);
                                                    }}
                                                    className="custom-range"
                                                    style={{
                                                        '--range-value': `${stop.position}%`,
                                                        '--range-fill': 'var(--accent-color)',               // filled side
                                                        '--range-track': 'rgba(128,128,128,0.25)' // non-fill side
                                                    } as React.CSSProperties}
                                                />
                                                <span style={{ fontSize: '0.85rem', fontFamily: 'monospace', width: 30 }}>{stop.position}%</span>
                                                <button
                                                    onClick={() => {
                                                        const newStops = gradientStops.filter((_, i) => i !== index);
                                                        if (newStops.length >= 2) setGradientStops(newStops);
                                                    }}
                                                    disabled={gradientStops.length <= 2}
                                                    style={{ background: 'none', color: 'var(--text-primary)', border: 'none', cursor: gradientStops.length <= 2 ? 'not-allowed' : 'pointer', opacity: gradientStops.length <= 2 ? 0.3 : 1 }}
                                                >
                                                    <Minus size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Presets */}
                                <div>
                                    <h3 style={{ fontSize: '0.9rem', marginBottom: 12, opacity: 0.7 }}>Presets</h3>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 8 }}>
                                        {Utils.GRADIENT_PRESETS.map(preset => (
                                            <div
                                                key={preset.name}
                                                onClick={() => {
                                                    setGradientStops(preset.colors.map((c, i) => ({
                                                        color: c,
                                                        position: Math.round((i / (preset.colors.length - 1)) * 100)
                                                    })));
                                                    setGradientAngle(preset.angle);
                                                    setGradientType('linear');
                                                }}
                                                style={{
                                                    height: 40,
                                                    borderRadius: 6,
                                                    background: `linear-gradient(${preset.angle}deg, ${preset.colors.join(', ')})`,
                                                    cursor: 'pointer',
                                                    border: '1px solid var(--border-color)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}
                                                title={preset.name}
                                            />
                                        ))}
                                    </div>
                                </div>

                                {/* CSS Output */}
                                <div style={{ marginTop: 0, padding: 16, background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                        <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>CSS Code</div>
                                        <button
                                            onClick={() => navigator.clipboard.writeText(`background: ${Utils.generateGradient(gradientType, gradientAngle, gradientStops)};`)}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', opacity: 0.7 }}
                                        >
                                            <Copy size={12} /> Copy
                                        </button>
                                    </div>
                                    <code style={{ fontSize: '0.8rem', fontFamily: 'monospace', display: 'block', wordBreak: 'break-all', color: 'var(--accent-color)' }}>
                                        background: {Utils.generateGradient(gradientType, gradientAngle, gradientStops)};
                                    </code>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* --- Saved Palettes Tab --- */}
                    {activeTab === 'saved' && (
                        <motion.div key="saved" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                            {/* Import Section */}
                            <div style={{ marginBottom: 24, padding: 16, background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-color)' }}>
                                <h3 style={{ fontSize: '0.9rem', marginBottom: 12, opacity: 0.7 }}>Import Palette</h3>
                                <div style={{ display: 'flex', gap: 12 }}>
                                    <input
                                        type="text"
                                        value={importText}
                                        onChange={e => setImportText(e.target.value)}
                                        placeholder="Paste JSON or Hex codes..."
                                        className="custom-select"
                                        style={{ flex: 1, cursor: 'text' }}
                                    />
                                    <button
                                        onClick={() => {
                                            if (!importText.trim()) return;
                                            try {
                                                // Try JSON first
                                                let colors: string[] = [];
                                                if (importText.trim().startsWith('[')) {
                                                    const parsed = JSON.parse(importText);
                                                    if (Array.isArray(parsed)) {
                                                        colors = parsed.filter(c => typeof c === 'string' && (c.startsWith('#') || c.startsWith('rgb')));
                                                    }
                                                } else {
                                                    // Try finding hex codes
                                                    const matches = importText.match(/#[0-9A-Fa-f]{6}/g);
                                                    if (matches) colors = matches;
                                                }

                                                if (colors.length > 0) {
                                                    const newPalette: Utils.SavedPalette = {
                                                        id: Date.now().toString(),
                                                        name: 'Imported Palette',
                                                        colors: colors,
                                                        createdAt: Date.now(),
                                                        tags: []
                                                    };
                                                    setSavedPalettes([newPalette, ...savedPalettes]);
                                                    setImportText('');
                                                } else {
                                                    alert('No valid colors found in text.');
                                                }
                                            } catch (e) {
                                                alert('Invalid format.');
                                            }
                                        }}
                                        style={{ padding: '8px 16px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}
                                    >
                                        Import
                                    </button>
                                </div>
                            </div>

                            <button
                                onClick={savePalette}
                                style={{ width: '100%', padding: '12px', background: 'var(--accent-color)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 24 }}
                            >
                                <Save size={18} /> Save Current Palette
                            </button>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                {savedPalettes.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: 40, opacity: 0.5 }}>
                                        <Save size={32} style={{ marginBottom: 8 }} />
                                        <div>No saved palettes yet</div>
                                    </div>
                                ) : (
                                    savedPalettes.map(p => (
                                        <div key={p.id} style={{ background: 'var(--bg-card)', padding: 16, borderRadius: 12, border: '1px solid var(--border-color)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                                                <div style={{ flex: 1 }}>
                                                    {editingPaletteId === p.id ? (
                                                        <input
                                                            autoFocus
                                                            type="text"
                                                            defaultValue={p.name}
                                                            onBlur={(e) => {
                                                                const newPalettes = savedPalettes.map(pal => pal.id === p.id ? { ...pal, name: e.target.value } : pal);
                                                                setSavedPalettes(newPalettes);
                                                                setEditingPaletteId(null);
                                                            }}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    const newPalettes = savedPalettes.map(pal => pal.id === p.id ? { ...pal, name: e.currentTarget.value } : pal);
                                                                    setSavedPalettes(newPalettes);
                                                                    setEditingPaletteId(null);
                                                                }
                                                            }}
                                                            style={{ fontSize: '0.9rem', fontWeight: 600, background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 4, padding: '4px 8px', width: '100%', color: 'var(--text-primary)' }}
                                                        />
                                                    ) : (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{p.name}</div>
                                                            <button onClick={() => setEditingPaletteId(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.3, padding: 4 }} title="Rename">
                                                                <Edit2 size={12} />
                                                            </button>
                                                        </div>
                                                    )}
                                                    <div style={{ fontSize: '0.7rem', opacity: 0.4, marginTop: 2 }}>
                                                        {new Date(p.createdAt).toLocaleDateString()} • {p.colors.length} colors
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', gap: 4 }}>
                                                    <button onClick={() => navigator.clipboard.writeText(Utils.exportPaletteAsJSON(p.colors))} style={{ padding: 6, background: 'none', border: 'none', cursor: 'pointer', opacity: 0.5 }} title="Copy JSON"><Copy size={16} /></button>
                                                    <button onClick={() => deletePalette(p.id)} style={{ padding: 6, background: 'none', border: 'none', cursor: 'pointer', opacity: 0.5, color: '#ef4444' }} title="Delete"><X size={16} /></button>
                                                </div>
                                            </div>

                                            {/* Tags */}
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                                                {p.tags?.map(tag => (
                                                    <span key={tag} style={{ fontSize: '0.7rem', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                        {tag}
                                                        <span
                                                            onClick={() => {
                                                                const newPalettes = savedPalettes.map(pal => pal.id === p.id ? { ...pal, tags: pal.tags?.filter(t => t !== tag) } : pal);
                                                                setSavedPalettes(newPalettes);
                                                            }}
                                                            style={{ cursor: 'pointer', fontWeight: 700 }}
                                                        >×</span>
                                                    </span>
                                                ))}
                                                <input
                                                    type="text"
                                                    placeholder="+ Tag"
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            const tag = e.currentTarget.value.trim();
                                                            if (tag && !p.tags?.includes(tag)) {
                                                                const newPalettes = savedPalettes.map(pal => pal.id === p.id ? { ...pal, tags: [...(pal.tags || []), tag] } : pal);
                                                                setSavedPalettes(newPalettes);
                                                                e.currentTarget.value = '';
                                                            }
                                                        }
                                                    }}
                                                    style={{ fontSize: '0.7rem', background: 'transparent', border: 'none', width: 50, color: 'var(--text-secondary)', outline: 'none' }}
                                                />
                                            </div>

                                            <div style={{ display: 'flex', height: 48, borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(128,128,128,0.1)' }}>
                                                {p.colors.map((c, i) => (
                                                    <div key={i} onClick={() => setHex(c)} title={c} style={{ flex: 1, background: c, cursor: 'pointer' }} />
                                                ))}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence >
            </div >
        </div >
    );
};

export default ColorToolPage;
