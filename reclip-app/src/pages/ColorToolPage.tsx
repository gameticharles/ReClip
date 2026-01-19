import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pipette, Palette, Eye, Layers, Save, RefreshCw, X, Check, Copy, ArrowLeft, GitMerge, ArrowDown, Image as ImageIcon } from 'lucide-react';
import * as Utils from './ColorPageUtils';

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

const ColorToolPage = ({ initialColor = '#3b82f6', onClose, onBack }: ColorToolPageProps) => {
    const [hex, setHex] = useState(initialColor);
    const [colorInput, setColorInput] = useState(initialColor);
    const [activeTab, setActiveTab] = useState<'analyze' | 'mixer' | 'harmonies' | 'a11y' | 'gradient' | 'saved'>('analyze');

    // Analyze Tab (Drag & Drop)
    const [dragActive, setDragActive] = useState(false);
    const [extractedPalette, setExtractedPalette] = useState<string[]>([]);

    // Mixer Tab
    const [mixColor1, setMixColor1] = useState('#ff0000');
    const [mixColor2, setMixColor2] = useState('#0000ff');
    const [mixRatio, setMixRatio] = useState(0.5);
    const [mixSteps, setMixSteps] = useState(5);

    // A11y Tab
    const [contrastColor, setContrastColor] = useState('#ffffff');

    // Gradient Tab
    const [gradientType, setGradientType] = useState<'linear' | 'radial'>('linear');
    const [gradientAngle, setGradientAngle] = useState(90);

    // Saved Palettes
    const [savedPalettes, setSavedPalettes] = useState<Utils.SavedPalette[]>([]);

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

    const handleDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const file = e.dataTransfer.files[0];
            if (!file.type.startsWith('image/')) return;

            const reader = new FileReader();
            reader.onload = async (event) => {
                if (event.target?.result) {
                    const img = new Image();
                    img.src = event.target.result as string;
                    img.onload = async () => {
                        try {
                            const ColorThief = (await import('colorthief')).default;
                            const thief = new ColorThief();
                            const palette = thief.getPalette(img, 10);
                            if (palette) {
                                setExtractedPalette(palette.map((c: number[]) => Utils.rgbToHex(c[0], c[1], c[2])));
                            }
                        } catch (err) {
                            console.error("ColorThief failed", err);
                        }
                    };
                }
            };
            reader.readAsDataURL(file);
        }
    }, []);

    const rgb = Utils.hexToRgb(hex) || { r: 0, g: 0, b: 0 };
    const hsl = Utils.rgbToHsl(rgb.r, rgb.g, rgb.b);
    const hsv = Utils.rgbToHsv(rgb.r, rgb.g, rgb.b);
    const cmyk = Utils.rgbToCmyk(rgb.r, rgb.g, rgb.b);
    const colorName = Utils.findNearestColorName(hex);
    const tailwindMatch = Utils.findNearestTailwind(hex);

    return (
        <div className="color-tool-page" style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
            <style>{`
                .custom-range {
                    -webkit-appearance: none;
                    width: 100%;
                    height: 6px;
                    background: rgba(128, 128, 128, 0.25);
                    border-radius: 3px;
                    outline: none;
                }
                .custom-range::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    appearance: none;
                    width: 16px;
                    height: 16px;
                    border-radius: 50%;
                    background: var(--accent-color);
                    cursor: pointer;
                    border: 2px solid var(--bg-secondary);
                    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                }
                .custom-select {
                    padding: 8px;
                    border-radius: 6px;
                    border: 1px solid var(--border-color);
                    background: var(--bg-input);
                    color: var(--text-primary);
                    outline: none;
                    cursor: pointer;
                    font-size: 0.9rem;
                }
                .custom-select:focus {
                    border-color: var(--accent-color);
                }
            `}</style>

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
                <div className="title-right" style={{ display: 'flex', gap: 6 }}>
                    <select
                        className="custom-select"
                        style={{ height: 26, fontSize: '0.8rem', padding: '0 8px', width: 120 }}
                        onChange={(e) => {
                            if (e.target.value) {
                                navigator.clipboard.writeText(Utils.formatCode(hex, e.target.value));
                            }
                        }}
                        defaultValue=""
                    >
                        <option value="" disabled>Copy as...</option>
                        <option value="css-hex">CSS Hex</option>
                        <option value="css-rgb">CSS RGB</option>
                        <option value="css-hsl">CSS HSL</option>
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
                                <div style={{ marginBottom: 24, padding: '12px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: 8, border: '1px solid rgba(59, 130, 246, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6' }} />
                                        <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-primary)' }}>Matches Tailwind <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{tailwindMatch}</span></span>
                                    </div>
                                    <Copy size={14} style={{ cursor: 'pointer', opacity: 0.7 }} onClick={() => navigator.clipboard.writeText(tailwindMatch)} />
                                </div>
                            )}

                            {/* Color Info Grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
                                <div className="info-card" style={{ background: 'var(--bg-card)', padding: 12, borderRadius: 8, border: '1px solid var(--border-color)' }}>
                                    <div style={{ fontSize: '0.75rem', opacity: 0.6, marginBottom: 4 }}>RGB</div>
                                    <div style={{ fontFamily: 'monospace', fontWeight: 600 }}>{rgb.r}, {rgb.g}, {rgb.b}</div>
                                </div>
                                <div className="info-card" style={{ background: 'var(--bg-card)', padding: 12, borderRadius: 8, border: '1px solid var(--border-color)' }}>
                                    <div style={{ fontSize: '0.75rem', opacity: 0.6, marginBottom: 4 }}>HSL</div>
                                    <div style={{ fontFamily: 'monospace', fontWeight: 600 }}>{hsl.h}°, {hsl.s}%, {hsl.l}%</div>
                                </div>
                                <div className="info-card" style={{ background: 'var(--bg-card)', padding: 12, borderRadius: 8, border: '1px solid var(--border-color)' }}>
                                    <div style={{ fontSize: '0.75rem', opacity: 0.6, marginBottom: 4 }}>HSV</div>
                                    <div style={{ fontFamily: 'monospace', fontWeight: 600 }}>{hsv.h}°, {hsv.s}%, {hsv.v}%</div>
                                </div>
                                <div className="info-card" style={{ background: 'var(--bg-card)', padding: 12, borderRadius: 8, border: '1px solid var(--border-color)' }}>
                                    <div style={{ fontSize: '0.75rem', opacity: 0.6, marginBottom: 4 }}>CMYK</div>
                                    <div style={{ fontFamily: 'monospace', fontWeight: 600 }}>{cmyk.c}, {cmyk.m}, {cmyk.y}, {cmyk.k}</div>
                                </div>
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
                            <div
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
                                    gap: 8
                                }}
                            >
                                <ImageIcon size={24} style={{ opacity: 0.5 }} />
                                {extractedPalette.length > 0 ? (
                                    <div style={{ width: '100%' }}>
                                        <div style={{ fontSize: '0.8rem', marginBottom: 12, opacity: 0.7 }}>Extracted Palette (Click to set)</div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                                            {extractedPalette.map(c => (
                                                <div
                                                    key={c}
                                                    onClick={() => setHex(c)}
                                                    title={c}
                                                    style={{ width: 36, height: 36, background: c, borderRadius: 6, cursor: 'pointer', border: '1px solid rgba(128,128,128,0.2)', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ pointerEvents: 'none' }}>
                                        <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>Drop an image here</div>
                                        <div style={{ fontSize: '0.75rem', opacity: 0.5 }}>to extract its dominant colors</div>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}

                    {/* --- Mixer Tab --- */}
                    {activeTab === 'mixer' && (
                        <motion.div key="mixer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                                {/* Inputs */}
                                <div style={{ background: 'var(--bg-card)', padding: 16, borderRadius: 12, border: '1px solid var(--border-color)' }}>
                                    <h3 style={{ fontSize: '0.9rem', marginBottom: 16, opacity: 0.7 }}>Color Mixer</h3>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                        <div style={{ position: 'relative' }}>
                                            <div style={{ width: 48, height: 48, background: mixColor1, borderRadius: 8, border: '1px solid var(--border-color)' }} />
                                            <input type="color" value={mixColor1} onChange={e => setMixColor1(e.target.value)} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} />
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
                                            />
                                        </div>

                                        <div style={{ position: 'relative' }}>
                                            <div style={{ width: 48, height: 48, background: mixColor2, borderRadius: 8, border: '1px solid var(--border-color)' }} />
                                            <input type="color" value={mixColor2} onChange={e => setMixColor2(e.target.value)} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} />
                                        </div>
                                    </div>
                                </div>

                                {/* Result */}
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                                    <ArrowDown size={20} style={{ opacity: 0.3 }} />
                                    {(() => {
                                        const mixed = Utils.mixColors(mixColor1, mixColor2, mixRatio);
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
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span style={{ fontSize: '0.8rem', fontFamily: 'monospace' }}>{mixSteps} Steps</span>
                                            <input
                                                type="range"
                                                min="3"
                                                max="30"
                                                value={mixSteps}
                                                onChange={e => setMixSteps(parseInt(e.target.value))}
                                                className="custom-range"
                                                style={{ width: 80 }}
                                            />
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', height: 60, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                                        {Utils.generateScale(mixColor1, mixColor2, mixSteps).map(c => (
                                            <div key={c} title={c} onClick={() => setHex(c)} style={{ flex: 1, background: c, cursor: 'pointer' }} />
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
                                {Object.entries(Utils.generateHarmonies(hex)).map(([name, colors]) => (
                                    <div key={name}>
                                        <h3 style={{ fontSize: '0.9rem', marginBottom: 8, textTransform: 'capitalize', opacity: 0.8 }}>{name}</h3>
                                        <div style={{ display: 'flex', height: 48, borderRadius: 8, overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                                            {colors.map((c, i) => (
                                                <div
                                                    key={i}
                                                    onClick={() => setHex(c)}
                                                    title={c}
                                                    style={{ flex: 1, background: c, cursor: 'pointer', transition: 'flex 0.2s' }}
                                                />
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
                                    <h3 style={{ fontSize: '1rem', marginBottom: 16 }}>Contrast Checker</h3>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 20 }}>
                                        {/* Preview Card */}
                                        <div style={{ width: 200, height: 120, background: hex, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: 8, border: '1px solid rgba(128,128,128,0.2)', color: contrastColor, gap: 4 }}>
                                            <span style={{ fontSize: '1.5rem', fontWeight: 700 }}>Aa</span>
                                            <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>Large Text</span>
                                            <span style={{ fontSize: '0.9rem', fontWeight: 400 }}>Small Text</span>
                                        </div>
                                        {/* Controls + Score */}
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: 8 }}>Compare with (Text Color)</label>
                                            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20 }}>
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
                                                    className="custom-select"
                                                    style={{ width: 100, cursor: 'text' }}
                                                />
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                                <div style={{ fontSize: '2.5rem', fontWeight: 800, lineHeight: 1 }}>
                                                    {Utils.getContrastRatio(hex, contrastColor).toFixed(2)}
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                    <div style={{ fontSize: '0.9rem', opacity: 0.7 }}>Contrast Ratio</div>
                                                    <div style={{ display: 'flex', gap: 12 }}>
                                                        {(() => {
                                                            const ratio = Utils.getContrastRatio(hex, contrastColor);
                                                            return (
                                                                <>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: ratio >= 4.5 ? '#22c55e' : '#ef4444' }}>
                                                                        {ratio >= 4.5 ? <Check size={14} /> : <X size={14} />}
                                                                        <span style={{ fontWeight: 600, fontSize: '0.8rem' }}>AA Normal</span>
                                                                    </div>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: ratio >= 3.0 ? '#22c55e' : '#ef4444' }}>
                                                                        {ratio >= 3.0 ? <Check size={14} /> : <X size={14} />}
                                                                        <span style={{ fontWeight: 600, fontSize: '0.8rem' }}>AA Large</span>
                                                                    </div>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: ratio >= 7.0 ? '#22c55e' : '#ef4444' }}>
                                                                        {ratio >= 7.0 ? <Check size={14} /> : <X size={14} />}
                                                                        <span style={{ fontWeight: 600, fontSize: '0.8rem' }}>AAA</span>
                                                                    </div>
                                                                </>
                                                            );
                                                        })()}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Contrast Grid */}
                                    <div style={{ marginTop: 24 }}>
                                        <h3 style={{ fontSize: '1rem', marginBottom: 12 }}>Contrast Grid</h3>
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
                                </div>

                                {/* Color Blindness */}
                                <div>
                                    <h3 style={{ fontSize: '1rem', marginBottom: 12 }}>Color Blindness Simulation</h3>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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
                            <div style={{ height: 200, background: `${gradientType}-gradient(${gradientType === 'linear' ? gradientAngle + 'deg' : 'circle'}, ${hex}, ${Utils.generateHarmonies(hex).complementary[1]})`, borderRadius: 12, marginBottom: 24, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />

                            <div style={{ display: 'flex', gap: 20 }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: 8 }}>Gradient Type</label>
                                    <select
                                        value={gradientType}
                                        onChange={e => setGradientType(e.target.value as any)}
                                        className="custom-select"
                                        style={{ width: '100%' }}
                                    >
                                        <option value="linear">Linear</option>
                                        <option value="radial">Radial</option>
                                    </select>
                                </div>
                                {gradientType === 'linear' && (
                                    <div style={{ flex: 1 }}>
                                        <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: 8 }}>Angle ({gradientAngle}°)</label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <input
                                                type="range"
                                                min="0"
                                                max="360"
                                                value={gradientAngle}
                                                onChange={e => setGradientAngle(parseInt(e.target.value))}
                                                className="custom-range"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div style={{ marginTop: 24, padding: 16, background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                                <div style={{ fontSize: '0.8rem', opacity: 0.6, marginBottom: 8 }}>CSS Code</div>
                                <code style={{ fontSize: '0.85rem', fontFamily: 'monospace', display: 'block', wordBreak: 'break-all' }}>
                                    background: {gradientType}-gradient({gradientType === 'linear' ? gradientAngle + 'deg' : 'circle'}, {hex}, {Utils.generateHarmonies(hex).complementary[1]});
                                </code>
                            </div>
                        </motion.div>
                    )}

                    {/* --- Saved Palettes Tab --- */}
                    {activeTab === 'saved' && (
                        <motion.div key="saved" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                            <button
                                onClick={savePalette}
                                style={{ width: '100%', padding: '12px', background: 'var(--accent-color)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 24 }}
                            >
                                <Save size={18} /> Save Current Palette
                            </button>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {savedPalettes.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: 40, opacity: 0.5 }}>
                                        <Save size={32} style={{ marginBottom: 8 }} />
                                        <div>No saved palettes yet</div>
                                    </div>
                                ) : (
                                    savedPalettes.map(p => (
                                        <div key={p.id} style={{ background: 'var(--bg-card)', padding: 12, borderRadius: 8, border: '1px solid var(--border-color)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{p.name}</div>
                                                <button onClick={() => deletePalette(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.5, padding: 4 }}><X size={14} /></button>
                                            </div>
                                            <div style={{ display: 'flex', height: 32, borderRadius: 6, overflow: 'hidden' }}>
                                                {p.colors.map((c, i) => (
                                                    <div key={i} onClick={() => setHex(c)} title={c} style={{ flex: 1, background: c, cursor: 'pointer' }} />
                                                ))}
                                            </div>
                                            <div style={{ fontSize: '0.7rem', opacity: 0.4, marginTop: 8 }}>
                                                {new Date(p.createdAt).toLocaleDateString()}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default ColorToolPage;
