import React, { useState, useEffect } from 'react';
import {
    ArrowLeft, Copy, Check, Palette, Pipette, Sun, Moon, RefreshCw,
    Eye, Layers, Type, Grid, Save, Trash2, Download, Link, Info, Contrast
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import * as Utils from './ColorPageUtils';
import { SavedPalette } from './ColorPageUtils';

interface ColorToolPageProps {
    onBack: () => void;
    theme: string;
}

const ColorToolPage: React.FC<ColorToolPageProps> = ({ onBack, theme }) => {
    // --- State ---
    const [colorInput, setColorInput] = useState('#6366f1');
    const [activeTab, setActiveTab] = useState<'analyze' | 'harmonies' | 'a11y' | 'gradient' | 'saved'>('analyze');
    const [copiedValue, setCopiedValue] = useState<string | null>(null);

    // Accessibility State
    const [contrastColor, setContrastColor] = useState('#ffffff'); // Background/Comparison color

    // Gradient State
    const [gradientEndColor, setGradientEndColor] = useState('#a855f7');
    const [gradientType, setGradientType] = useState<'linear' | 'radial'>('linear');
    const [gradientAngle, setGradientAngle] = useState(135);

    // Saved Palettes
    const [savedPalettes, setSavedPalettes] = useState<SavedPalette[]>([]);

    // --- Derived Values ---
    const hex = Utils.parseColor(colorInput) || '#6366f1';
    const rgb = Utils.hexToRgb(hex) || { r: 99, g: 102, b: 241 };
    const hsl = Utils.rgbToHsl(rgb.r, rgb.g, rgb.b);
    const hsv = Utils.rgbToHsv(rgb.r, rgb.g, rgb.b);
    const cmyk = Utils.rgbToCmyk(rgb.r, rgb.g, rgb.b);

    const colorName = Utils.findNearestColorName(hex);
    const tailwindMatch = Utils.findNearestTailwind(hex);

    // --- Effects ---
    useEffect(() => {
        const saved = localStorage.getItem('reclip_saved_palettes');
        if (saved) {
            try {
                setSavedPalettes(JSON.parse(saved));
            } catch (e) {
                console.error("Failed to load palettes", e);
            }
        }
    }, []);

    const savePalette = (name: string, colors: string[]) => {
        const newPalette: SavedPalette = {
            id: Date.now().toString(),
            name: name || `Palette ${savedPalettes.length + 1}`,
            colors,
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

    const copyToClipboard = async (value: string) => {
        await navigator.clipboard.writeText(value);
        setCopiedValue(value);
        setTimeout(() => setCopiedValue(null), 1500);
    };

    const randomColor = () => {
        const randHex = '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
        setColorInput(randHex);
    };

    // --- UI Components ---
    const ColorSwatch = ({ color, size = 40, label, onClick }: { color: string; size?: number; label?: string; onClick?: () => void }) => (
        <div
            onClick={() => onClick ? onClick() : copyToClipboard(color)}
            style={{
                width: size,
                height: size,
                background: color,
                borderRadius: 8,
                cursor: 'pointer',
                border: '1px solid rgba(128,128,128,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                transition: 'transform 0.1s, box-shadow 0.1s',
                boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
            }}
            title={`${label || color} - Click to copy`}
            onMouseEnter={e => {
                e.currentTarget.style.transform = 'scale(1.05)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
            }}
            onMouseLeave={e => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
            }}
        >
            {copiedValue === color && <Check size={Math.max(12, size * 0.4)} color={Utils.getLuminance(Utils.hexToRgb(color)?.r || 0, Utils.hexToRgb(color)?.g || 0, Utils.hexToRgb(color)?.b || 0) > 0.5 ? 'black' : 'white'} />}
        </div>
    );

    const TabButton = ({ id, icon: Icon, label }: { id: typeof activeTab; icon: any; label: string }) => (
        <button
            onClick={() => setActiveTab(id)}
            style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                padding: '8px 4px',
                background: activeTab === id ? 'var(--bg-hover)' : 'transparent',
                border: 'none',
                borderBottom: activeTab === id ? '2px solid var(--accent-color)' : '2px solid transparent',
                color: activeTab === id ? 'var(--accent-color)' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '0.7rem',
                fontWeight: activeTab === id ? 600 : 500,
                transition: 'all 0.2s',
                opacity: activeTab === id ? 1 : 0.7
            }}
        >
            <Icon size={18} />
            {label}
        </button>
    );

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-primary)' }}>
            <style>{`
                .custom-range {
                    -webkit-appearance: none;
                    width: 100%;
                    height: 6px;
                    background: var(--bg-hover);
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
                    <button onClick={randomColor} style={{ background: 'rgba(128,128,128,0.1)', border: 'none', borderRadius: 4, padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: 'var(--text-primary)' }}>
                        <RefreshCw size={12} /> Random
                    </button>
                </div>
            </div>

            {/* Input Section (Always Visible) */}
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
                <TabButton id="analyze" icon={Pipette} label="Analyze" />
                <TabButton id="harmonies" icon={Palette} label="Harmonies" />
                <TabButton id="a11y" icon={Eye} label="Accessibility" />
                <TabButton id="gradient" icon={Layers} label="Gradient" />
                <TabButton id="saved" icon={Save} label="Library" />
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
                                        <div style={{ padding: '4px', background: 'white', borderRadius: 4 }}><Grid size={16} color="#3b82f6" /></div>
                                        <div>
                                            <div style={{ fontSize: '0.75rem', opacity: 0.7, color: 'var(--text-secondary)' }}>Nearest Tailwind</div>
                                            <div style={{ fontWeight: 600, color: '#3b82f6' }}>{tailwindMatch}</div>
                                        </div>
                                    </div>
                                    <button onClick={() => copyToClipboard(tailwindMatch)} style={{ background: '#3b82f6', color: 'white', border: 'none', borderRadius: 6, padding: '6px 10px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}>Copy</button>
                                </div>
                            )}

                            {/* Formats */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
                                {[
                                    { label: 'HEX', value: hex.toUpperCase() },
                                    { label: 'RGB', value: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})` },
                                    { label: 'HSL', value: `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)` },
                                    { label: 'HSV', value: `hsv(${hsv.h}, ${hsv.s}%, ${hsv.v}%)` },
                                    { label: 'CMYK', value: `cmyk(${cmyk.c}%, ${cmyk.m}%, ${cmyk.y}%, ${cmyk.k}%)` },
                                ].map(f => (
                                    <div key={f.label} onClick={() => copyToClipboard(f.value)} style={{ padding: '10px 12px', background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-color)', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 4, position: 'relative' }}>
                                        <span style={{ fontSize: '0.7rem', opacity: 0.5, fontWeight: 600 }}>{f.label}</span>
                                        <code style={{ fontSize: '0.9rem', fontFamily: 'monospace' }}>{f.value}</code>
                                        {copiedValue === f.value && <div style={{ position: 'absolute', top: 8, right: 8 }}><Check size={14} color="var(--accent-color)" /></div>}
                                    </div>
                                ))}
                            </div>

                            {/* Tints & Shades */}
                            <div style={{ marginBottom: 24 }}>
                                <h3 style={{ fontSize: '0.9rem', marginBottom: 12, opacity: 0.8, display: 'flex', alignItems: 'center', gap: 6 }}><Sun size={14} /> Tints</h3>
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                    {Utils.generateTints(hex).map((c, i) => <ColorSwatch key={i} color={c} />)}
                                </div>
                            </div>
                            <div style={{ marginBottom: 24 }}>
                                <h3 style={{ fontSize: '0.9rem', marginBottom: 12, opacity: 0.8, display: 'flex', alignItems: 'center', gap: 6 }}><Moon size={14} /> Shades</h3>
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                    {Utils.generateShades(hex).map((c, i) => <ColorSwatch key={i} color={c} />)}
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* --- Harmonies Tab --- */}
                    {activeTab === 'harmonies' && (
                        <motion.div key="harmonies" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                {Object.entries(Utils.generateHarmonies(hex)).map(([name, colors]) => (
                                    <div key={name} style={{ background: 'var(--bg-card)', padding: '16px', borderRadius: 12, border: '1px solid var(--border-color)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                            <span style={{ fontSize: '0.9rem', fontWeight: 600, textTransform: 'capitalize', color: 'var(--text-primary)' }}>{name}</span>
                                            <button
                                                onClick={() => savePalette(name.charAt(0).toUpperCase() + name.slice(1), colors)}
                                                style={{ border: 'none', background: 'var(--bg-hover)', color: 'var(--text-secondary)', borderRadius: 4, padding: '4px 8px', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', gap: 4, alignItems: 'center' }}
                                            >
                                                <Save size={12} /> Save
                                            </button>
                                        </div>
                                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                            {colors.map((c, i) => <ColorSwatch key={i} color={c} size={48} />)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {/* --- Accessibility Tab --- */}
                    {activeTab === 'a11y' && (
                        <motion.div key="a11y" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                            {/* Contrast Checker */}
                            <div style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: 12, border: '1px solid var(--border-color)', marginBottom: 24 }}>
                                <h3 style={{ fontSize: '1rem', marginTop: 0, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><Contrast size={18} /> Contrast Checker</h3>

                                <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                                    <div style={{ flex: 1, background: hex, color: contrastColor, padding: '24px', borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-color)', transition: 'all 0.3s' }}>
                                        <span style={{ fontSize: '1.5rem', fontWeight: 700 }}>Aa</span>
                                        <span style={{ fontSize: '1rem' }}>Large Text</span>
                                        <span style={{ fontSize: '0.8rem', marginTop: 8 }}>Small Text</span>
                                    </div>

                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
                                        <div>
                                            <label style={{ fontSize: '0.75rem', opacity: 0.7, display: 'block', marginBottom: 4 }}>Compare with (Background/Text)</label>
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                <input
                                                    type="text"
                                                    value={contrastColor}
                                                    onChange={e => setContrastColor(e.target.value)}
                                                    style={{ flex: 1, padding: '8px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontFamily: 'monospace' }}
                                                />
                                                <input
                                                    type="color"
                                                    value={contrastColor.length === 7 ? contrastColor : '#ffffff'}
                                                    onChange={e => setContrastColor(e.target.value)}
                                                    style={{ width: 40, height: 35, borderRadius: 6, border: 'none', padding: 0, cursor: 'pointer' }}
                                                />
                                            </div>
                                        </div>

                                        {(() => {
                                            const ratio = Utils.getContrastRatio(hex, contrastColor);
                                            return (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                                                        <span style={{ fontSize: '2rem', fontWeight: 800, lineHeight: 1 }}>{ratio.toFixed(2)}</span>
                                                        <span style={{ opacity: 0.5, marginBottom: 4 }}>Contrast Ratio</span>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: 12 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: ratio >= 4.5 ? '#10b981' : '#ef4444' }}>
                                                            {ratio >= 4.5 ? <Check size={16} /> : <div style={{ width: 16, textAlign: 'center', fontWeight: 'bold' }}>!</div>}
                                                            <span style={{ fontWeight: 600, fontSize: '0.8rem' }}>AA Normal</span>
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: ratio >= 3 ? '#10b981' : '#ef4444' }}>
                                                            {ratio >= 3 ? <Check size={16} /> : <div style={{ width: 16, textAlign: 'center', fontWeight: 'bold' }}>!</div>}
                                                            <span style={{ fontWeight: 600, fontSize: '0.8rem' }}>AA Large</span>
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: ratio >= 7 ? '#10b981' : '#ef4444' }}>
                                                            {ratio >= 7 ? <Check size={16} /> : <div style={{ width: 16, textAlign: 'center', fontWeight: 'bold' }}>!</div>}
                                                            <span style={{ fontWeight: 600, fontSize: '0.8rem' }}>AAA</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                            </div>

                            {/* Color Blindness */}
                            <div>
                                <h3 style={{ fontSize: '1rem', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><Eye size={18} /> Color Blindness Simulation</h3>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
                                    {[
                                        { type: 'protanopia', label: 'Protanopia', desc: 'Red-blind' },
                                        { type: 'deuteranopia', label: 'Deuteranopia', desc: 'Green-blind' },
                                        { type: 'tritanopia', label: 'Tritanopia', desc: 'Blue-blind' },
                                        { type: 'achromatopsia', label: 'Monochromacy', desc: 'No color' },
                                    ].map((mode: any) => {
                                        const sim = Utils.simulateColorBlindness(rgb.r, rgb.g, rgb.b, mode.type);
                                        const simHex = Utils.rgbToHex(sim.r, sim.g, sim.b);
                                        return (
                                            <div key={mode.type} style={{ background: 'var(--bg-card)', padding: '12px', borderRadius: 8, border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                                                <div style={{ width: '100%', height: 60, background: simHex, borderRadius: 6, border: '1px solid rgba(128,128,128,0.2)' }} />
                                                <div style={{ textAlign: 'center' }}>
                                                    <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>{mode.label}</div>
                                                    <div style={{ fontSize: '0.7rem', opacity: 0.5 }}>{mode.desc}</div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* --- Gradient Tab --- */}
                    {activeTab === 'gradient' && (
                        <motion.div key="gradient" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                {/* Preview */}
                                <div style={{
                                    height: 160,
                                    background: `${gradientType}-gradient(${gradientType === 'linear' ? `${gradientAngle}deg` : 'circle'}, ${hex}, ${gradientEndColor})`,
                                    borderRadius: 12,
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    border: '1px solid var(--border-color)'
                                }}>

                                </div>

                                {/* Controls */}
                                <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ fontSize: '0.75rem', opacity: 0.7, display: 'block', marginBottom: 8 }}>End Color</label>
                                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                            <div style={{ width: 40, height: 40, background: gradientEndColor, borderRadius: 8, border: '1px solid var(--border-color)' }} />
                                            <input
                                                type="text"
                                                value={gradientEndColor}
                                                onChange={e => setGradientEndColor(e.target.value)}
                                                style={{ padding: '8px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontFamily: 'monospace' }}
                                            />
                                            <input
                                                type="color"
                                                value={gradientEndColor}
                                                onChange={e => setGradientEndColor(e.target.value)}
                                                style={{ width: 40, height: 35, borderRadius: 6, border: 'none', padding: 0, cursor: 'pointer' }}
                                            />
                                        </div>
                                    </div>

                                    <div style={{ flex: 1 }}>
                                        <label style={{ fontSize: '0.75rem', opacity: 0.7, display: 'block', marginBottom: 8 }}>Parameters</label>
                                        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                            <select
                                                value={gradientType}
                                                onChange={e => setGradientType(e.target.value as any)}
                                                className="custom-select"
                                            >
                                                <option value="linear">Linear</option>
                                                <option value="radial">Radial</option>
                                            </select>

                                            {gradientType === 'linear' && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                    <input
                                                        type="range"
                                                        min="0"
                                                        max="360"
                                                        value={gradientAngle}
                                                        onChange={e => setGradientAngle(parseInt(e.target.value))}
                                                        className="custom-range"
                                                        style={{ width: 100 }}
                                                    />
                                                    <span style={{ fontSize: '0.8rem', fontFamily: 'monospace', width: 30 }}>{gradientAngle}°</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={() => copyToClipboard(`${gradientType}-gradient(${gradientType === 'linear' ? `${gradientAngle}deg` : 'circle'}, ${hex}, ${gradientEndColor})`)}
                                    style={{ padding: '12px', background: 'var(--accent-color)', color: 'white', border: 'none', borderRadius: 8, fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                                >
                                    <Copy size={16} /> Copy CSS
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {/* --- Library Tab --- */}
                    {activeTab === 'saved' && (
                        <motion.div key="saved" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                            {savedPalettes.length === 0 ? (
                                <div style={{ textAlign: 'center', opacity: 0.5, marginTop: 40 }}>
                                    <Save size={48} style={{ marginBottom: 16 }} />
                                    <p>No saved palettes yet.</p>
                                    <p style={{ fontSize: '0.8rem' }}>Go to Harmonies tab to save some!</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    {savedPalettes.map(palette => (
                                        <div key={palette.id} style={{ background: 'var(--bg-card)', padding: '16px', borderRadius: 12, border: '1px solid var(--border-color)', position: 'relative' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                                <span style={{ fontWeight: 600 }}>{palette.name}</span>
                                                <div style={{ display: 'flex', gap: 8 }}>
                                                    <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>{new Date(palette.createdAt).toLocaleDateString()}</span>
                                                    <button onClick={() => deletePalette(palette.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.5, padding: 0 }} title="Delete">
                                                        <Trash2 size={14} color="#ef4444" />
                                                    </button>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                                {palette.colors.map((c, i) => (
                                                    <ColorSwatch key={i} color={c} size={32} />
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default ColorToolPage;
