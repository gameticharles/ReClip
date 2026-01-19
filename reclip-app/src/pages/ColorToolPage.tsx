import React, { useState, useEffect } from 'react';
import { ArrowLeft, Copy, Check, Palette, Pipette, Sun, Moon, RefreshCw } from 'lucide-react';

interface ColorToolPageProps {
    onBack: () => void;
    theme: string;
}

// Color conversion utilities
const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
};

const rgbToHex = (r: number, g: number, b: number): string => {
    return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
};

const rgbToHsl = (r: number, g: number, b: number): { h: number; s: number; l: number } => {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
        }
    }
    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
};

const hslToRgb = (h: number, s: number, l: number): { r: number; g: number; b: number } => {
    h /= 360; s /= 100; l /= 100;
    let r, g, b;
    if (s === 0) {
        r = g = b = l;
    } else {
        const hue2rgb = (p: number, q: number, t: number) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }
    return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
};

const rgbToHsv = (r: number, g: number, b: number): { h: number; s: number; v: number } => {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0;
    const v = max;
    const d = max - min;
    const s = max === 0 ? 0 : d / max;
    if (max !== min) {
        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
        }
    }
    return { h: Math.round(h * 360), s: Math.round(s * 100), v: Math.round(v * 100) };
};

const rgbToCmyk = (r: number, g: number, b: number): { c: number; m: number; y: number; k: number } => {
    r /= 255; g /= 255; b /= 255;
    const k = 1 - Math.max(r, g, b);
    if (k === 1) return { c: 0, m: 0, y: 0, k: 100 };
    return {
        c: Math.round((1 - r - k) / (1 - k) * 100),
        m: Math.round((1 - g - k) / (1 - k) * 100),
        y: Math.round((1 - b - k) / (1 - k) * 100),
        k: Math.round(k * 100)
    };
};

// Generate tints (lighter versions)
const generateTints = (hex: string, count: number = 5): string[] => {
    const rgb = hexToRgb(hex);
    if (!rgb) return [];
    const tints: string[] = [];
    for (let i = 1; i <= count; i++) {
        const factor = i / (count + 1);
        tints.push(rgbToHex(
            Math.round(rgb.r + (255 - rgb.r) * factor),
            Math.round(rgb.g + (255 - rgb.g) * factor),
            Math.round(rgb.b + (255 - rgb.b) * factor)
        ));
    }
    return tints;
};

// Generate shades (darker versions)
const generateShades = (hex: string, count: number = 5): string[] => {
    const rgb = hexToRgb(hex);
    if (!rgb) return [];
    const shades: string[] = [];
    for (let i = 1; i <= count; i++) {
        const factor = 1 - i / (count + 1);
        shades.push(rgbToHex(
            Math.round(rgb.r * factor),
            Math.round(rgb.g * factor),
            Math.round(rgb.b * factor)
        ));
    }
    return shades;
};

// Generate color harmonies
const generateHarmonies = (hex: string): Record<string, string[]> => {
    const rgb = hexToRgb(hex);
    if (!rgb) return {};
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

    const harmonies: Record<string, string[]> = {
        complementary: [hex],
        analogous: [hex],
        triadic: [hex],
        split: [hex],
        tetradic: [hex],
    };

    // Complementary: +180°
    const comp = hslToRgb((hsl.h + 180) % 360, hsl.s, hsl.l);
    harmonies.complementary.push(rgbToHex(comp.r, comp.g, comp.b));

    // Analogous: ±30°
    const ana1 = hslToRgb((hsl.h + 30) % 360, hsl.s, hsl.l);
    const ana2 = hslToRgb((hsl.h + 330) % 360, hsl.s, hsl.l);
    harmonies.analogous.push(rgbToHex(ana1.r, ana1.g, ana1.b), rgbToHex(ana2.r, ana2.g, ana2.b));

    // Triadic: +120°, +240°
    const tri1 = hslToRgb((hsl.h + 120) % 360, hsl.s, hsl.l);
    const tri2 = hslToRgb((hsl.h + 240) % 360, hsl.s, hsl.l);
    harmonies.triadic.push(rgbToHex(tri1.r, tri1.g, tri1.b), rgbToHex(tri2.r, tri2.g, tri2.b));

    // Split-complementary: +150°, +210°
    const sp1 = hslToRgb((hsl.h + 150) % 360, hsl.s, hsl.l);
    const sp2 = hslToRgb((hsl.h + 210) % 360, hsl.s, hsl.l);
    harmonies.split.push(rgbToHex(sp1.r, sp1.g, sp1.b), rgbToHex(sp2.r, sp2.g, sp2.b));

    // Tetradic: +90°, +180°, +270°
    const tet1 = hslToRgb((hsl.h + 90) % 360, hsl.s, hsl.l);
    const tet2 = hslToRgb((hsl.h + 180) % 360, hsl.s, hsl.l);
    const tet3 = hslToRgb((hsl.h + 270) % 360, hsl.s, hsl.l);
    harmonies.tetradic.push(rgbToHex(tet1.r, tet1.g, tet1.b), rgbToHex(tet2.r, tet2.g, tet2.b), rgbToHex(tet3.r, tet3.g, tet3.b));

    return harmonies;
};

const ColorToolPage: React.FC<ColorToolPageProps> = ({ onBack, theme }) => {
    const [colorInput, setColorInput] = useState('#6366f1');
    const [copiedValue, setCopiedValue] = useState<string | null>(null);
    const [systemDark, setSystemDark] = useState(window.matchMedia('(prefers-color-scheme: dark)').matches);

    const isDark = theme === 'dark' || (theme === 'system' && systemDark);

    useEffect(() => {
        const media = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
        media.addEventListener('change', handler);
        return () => media.removeEventListener('change', handler);
    }, []);

    // Parse color input and normalize to hex
    const parseColor = (input: string): string | null => {
        let hex = input.trim();

        // Already hex
        if (/^#?[a-f0-9]{6}$/i.test(hex)) {
            return hex.startsWith('#') ? hex : '#' + hex;
        }

        // RGB format: rgb(r, g, b)
        const rgbMatch = input.match(/rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
        if (rgbMatch) {
            return rgbToHex(parseInt(rgbMatch[1]), parseInt(rgbMatch[2]), parseInt(rgbMatch[3]));
        }

        // HSL format: hsl(h, s%, l%)
        const hslMatch = input.match(/hsl\s*\(\s*(\d+)\s*,\s*(\d+)%?\s*,\s*(\d+)%?\s*\)/i);
        if (hslMatch) {
            const rgb = hslToRgb(parseInt(hslMatch[1]), parseInt(hslMatch[2]), parseInt(hslMatch[3]));
            return rgbToHex(rgb.r, rgb.g, rgb.b);
        }

        return null;
    };

    const hex = parseColor(colorInput) || '#6366f1';
    const rgb = hexToRgb(hex) || { r: 99, g: 102, b: 241 };
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
    const cmyk = rgbToCmyk(rgb.r, rgb.g, rgb.b);
    const tints = generateTints(hex, 5);
    const shades = generateShades(hex, 5);
    const harmonies = generateHarmonies(hex);

    const copyToClipboard = async (value: string) => {
        await navigator.clipboard.writeText(value);
        setCopiedValue(value);
        setTimeout(() => setCopiedValue(null), 1500);
    };

    const randomColor = () => {
        setColorInput('#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0'));
    };

    const formats = [
        { label: 'HEX', value: hex.toUpperCase() },
        { label: 'RGB', value: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})` },
        { label: 'HSL', value: `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)` },
        { label: 'HSV', value: `hsv(${hsv.h}, ${hsv.s}%, ${hsv.v}%)` },
        { label: 'CMYK', value: `cmyk(${cmyk.c}%, ${cmyk.m}%, ${cmyk.y}%, ${cmyk.k}%)` },
    ];

    const ColorSwatch = ({ color, size = 40, label }: { color: string; size?: number; label?: string }) => (
        <div
            onClick={() => copyToClipboard(color)}
            style={{
                width: size,
                height: size,
                background: color,
                borderRadius: 6,
                cursor: 'pointer',
                border: '1px solid rgba(128,128,128,0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                transition: 'transform 0.1s',
            }}
            title={`${label || color} - Click to copy`}
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
        >
            {copiedValue === color && <Check size={16} color="white" style={{ filter: 'drop-shadow(0 0 2px black)' }} />}
        </div>
    );

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Header */}
            <div className="titlebar" data-tauri-drag-region style={{ background: 'transparent' }}>
                <div className="title-left" data-tauri-drag-region>
                    <button onClick={onBack} className="title-btn" title="Back"><ArrowLeft size={18} /></button>
                    <Palette size={16} style={{ color: 'var(--accent-color)', pointerEvents: 'none' }} />
                    <span style={{ fontWeight: 600, pointerEvents: 'none' }}>Color Tool</span>
                </div>
                <div className="title-right" style={{ display: 'flex', gap: 6 }}>
                    <button onClick={randomColor} style={{ background: 'rgba(128,128,128,0.2)', border: 'none', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: 'inherit' }}>
                        <RefreshCw size={14} /> Random
                    </button>
                </div>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
                {/* Color Input */}
                <div style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'center' }}>
                    <div style={{ width: 80, height: 80, background: hex, borderRadius: 12, border: '2px solid rgba(128,128,128,0.3)', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }} />
                    <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '0.75rem', opacity: 0.7, marginBottom: 4 }}>Enter Color (HEX, RGB, or HSL)</label>
                        <input
                            type="text"
                            value={colorInput}
                            onChange={e => setColorInput(e.target.value)}
                            placeholder="#6366f1 or rgb(99, 102, 241)"
                            style={{
                                width: '100%',
                                boxSizing: 'border-box',
                                padding: '10px 12px',
                                borderRadius: 8,
                                border: '1px solid var(--border-color)',
                                background: 'var(--bg-input)',
                                color: 'inherit',
                                fontSize: '1rem',
                                fontFamily: 'monospace',
                                outline: 'none'
                            }}
                        />
                    </div>
                    <input
                        type="color"
                        value={hex}
                        onChange={e => setColorInput(e.target.value)}
                        style={{ width: 50, height: 50, border: 'none', borderRadius: 8, cursor: 'pointer' }}
                        title="Pick color"
                    />
                </div>

                {/* Color Formats */}
                <div style={{ marginBottom: 24 }}>
                    <h3 style={{ fontSize: '0.85rem', marginBottom: 12, opacity: 0.8, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Pipette size={14} /> Color Formats
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {formats.map(f => (
                            <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', background: 'rgba(128,128,128,0.08)', borderRadius: 8 }}>
                                <span style={{ width: 50, fontSize: '0.75rem', fontWeight: 600, opacity: 0.6 }}>{f.label}</span>
                                <code style={{ flex: 1, fontFamily: 'monospace', fontSize: '0.85rem' }}>{f.value}</code>
                                <button
                                    onClick={() => copyToClipboard(f.value)}
                                    style={{ background: copiedValue === f.value ? '#22c55e' : 'rgba(128,128,128,0.2)', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.7rem', color: copiedValue === f.value ? 'white' : 'inherit' }}
                                >
                                    {copiedValue === f.value ? <Check size={12} /> : <Copy size={12} />}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Tints & Shades */}
                <div style={{ marginBottom: 24 }}>
                    <h3 style={{ fontSize: '0.85rem', marginBottom: 12, opacity: 0.8, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Sun size={14} /> Tints (Lighter)
                    </h3>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {tints.map((c, i) => <ColorSwatch key={i} color={c} />)}
                    </div>
                </div>

                <div style={{ marginBottom: 24 }}>
                    <h3 style={{ fontSize: '0.85rem', marginBottom: 12, opacity: 0.8, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Moon size={14} /> Shades (Darker)
                    </h3>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {shades.map((c, i) => <ColorSwatch key={i} color={c} />)}
                    </div>
                </div>

                {/* Color Harmonies */}
                <div>
                    <h3 style={{ fontSize: '0.85rem', marginBottom: 12, opacity: 0.8, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Palette size={14} /> Color Harmonies
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {Object.entries(harmonies).map(([name, colors]) => (
                            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', background: 'rgba(128,128,128,0.08)', borderRadius: 8 }}>
                                <span style={{ width: 100, fontSize: '0.75rem', fontWeight: 600, textTransform: 'capitalize', opacity: 0.7 }}>{name}</span>
                                <div style={{ display: 'flex', gap: 6 }}>
                                    {colors.map((c, i) => <ColorSwatch key={i} color={c} size={32} />)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ColorToolPage;
