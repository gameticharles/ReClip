
// Color conversion utilities

export const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
};

export const rgbToHex = (r: number, g: number, b: number): string => {
    return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
};

export const rgbToHsl = (r: number, g: number, b: number): { h: number; s: number; l: number } => {
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

export const hslToRgb = (h: number, s: number, l: number): { r: number; g: number; b: number } => {
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

export const rgbToHsv = (r: number, g: number, b: number): { h: number; s: number; v: number } => {
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

export const rgbToCmyk = (r: number, g: number, b: number): { c: number; m: number; y: number; k: number } => {
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
export const generateTints = (hex: string, count: number = 10): string[] => {
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
export const generateShades = (hex: string, count: number = 10): string[] => {
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
export const generateHarmonies = (hex: string): Record<string, string[]> => {
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

// Parse color input and normalize to hex
export const parseColor = (input: string): string | null => {
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


// --- Advanced Utilities ---

// 1. Accessibility & Contrast
export const getLuminance = (r: number, g: number, b: number) => {
    const a = [r, g, b].map(v => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
};

export const getContrastRatio = (hex1: string, hex2: string) => {
    const rgb1 = hexToRgb(hex1);
    const rgb2 = hexToRgb(hex2);
    if (!rgb1 || !rgb2) return 0;
    const l1 = getLuminance(rgb1.r, rgb1.g, rgb1.b);
    const l2 = getLuminance(rgb2.r, rgb2.g, rgb2.b);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
};

// 2. Color Blindness Simulation (Matrices)
export const simulateColorBlindness = (r: number, g: number, b: number, type: 'protanopia' | 'deuteranopia' | 'tritanopia' | 'achromatopsia') => {
    // Matrices for simulation
    const matrices = {
        protanopia: [ // Red-blind
            0.567, 0.433, 0,
            0.558, 0.442, 0,
            0, 0.242, 0.758
        ],
        deuteranopia: [ // Green-blind
            0.625, 0.375, 0,
            0.7, 0.3, 0,
            0, 0.3, 0.7
        ],
        tritanopia: [ // Blue-blind
            0.95, 0.05, 0,
            0, 0.433, 0.567,
            0, 0.475, 0.525
        ],
        achromatopsia: [ // Monochromacy
            0.299, 0.587, 0.114,
            0.299, 0.587, 0.114,
            0.299, 0.587, 0.114
        ]
    };

    const m = matrices[type];
    const R = r * m[0] + g * m[1] + b * m[2];
    const G = r * m[3] + g * m[4] + b * m[5];
    const B = r * m[6] + g * m[7] + b * m[8];

    return {
        r: Math.min(255, Math.max(0, R)),
        g: Math.min(255, Math.max(0, G)),
        b: Math.min(255, Math.max(0, B))
    };
};

// 3. Names & Tailwind
export const COLOR_NAMES: Record<string, string> = {
    '#000000': 'Black', '#ffffff': 'White', '#ff0000': 'Red', '#00ff00': 'Lime', '#0000ff': 'Blue',
    '#ffff00': 'Yellow', '#00ffff': 'Cyan', '#ff00ff': 'Magenta', '#c0c0c0': 'Silver',
    '#808080': 'Gray', '#800000': 'Maroon', '#808000': 'Olive', '#008000': 'Green',
    '#800080': 'Purple', '#008080': 'Teal', '#000080': 'Navy', '#6366f1': 'Indigo',
    '#ef4444': 'Tailwind Red', '#3b82f6': 'Tailwind Blue', '#10b981': 'Emerald',
    '#f59e0b': 'Amber', '#ec4899': 'Pink', '#8b5cf6': 'Violet'
};

export const findNearestColorName = (hex: string) => {
    const rgb = hexToRgb(hex);
    if (!rgb) return 'Unknown';

    let minDist = Infinity;
    let name = 'Unknown';

    Object.entries(COLOR_NAMES).forEach(([cHex, cName]) => {
        const cRgb = hexToRgb(cHex);
        if (cRgb) {
            const dist = Math.sqrt(
                Math.pow(rgb.r - cRgb.r, 2) +
                Math.pow(rgb.g - cRgb.g, 2) +
                Math.pow(rgb.b - cRgb.b, 2)
            );
            if (dist < minDist) {
                minDist = dist;
                name = cName;
            }
        }
    });

    return name;
};

// Tailwind Palette (Subset)
export const TAILWIND_COLORS: Record<string, string> = {
    'slate-50': '#f8fafc', 'slate-500': '#64748b', 'slate-900': '#0f172a',
    'red-500': '#ef4444', 'orange-500': '#f97316', 'amber-500': '#f59e0b',
    'yellow-500': '#eab308', 'lime-500': '#84cc16', 'green-500': '#22c55e',
    'emerald-500': '#10b981', 'teal-500': '#14b8a6', 'cyan-500': '#06b6d4',
    'sky-500': '#0ea5e9', 'blue-500': '#3b82f6', 'indigo-500': '#6366f1',
    'violet-500': '#8b5cf6', 'purple-500': '#a855f7', 'fuchsia-500': '#d946ef',
    'pink-500': '#ec4899', 'rose-500': '#f43f5e'
};

export const findNearestTailwind = (hex: string) => {
    const rgb = hexToRgb(hex);
    if (!rgb) return null;

    let minDist = Infinity;
    let match = '';

    Object.entries(TAILWIND_COLORS).forEach(([tName, tHex]) => {
        const cRgb = hexToRgb(tHex);
        if (cRgb) {
            const dist = Math.sqrt(
                Math.pow(rgb.r - cRgb.r, 2) +
                Math.pow(rgb.g - cRgb.g, 2) +
                Math.pow(rgb.b - cRgb.b, 2)
            );
            if (dist < minDist) {
                minDist = dist;
                match = tName;
            }
        }
    });
    return match;
}

export interface SavedPalette {
    id: string;
    name: string;
    colors: string[];
    createdAt: number;
}
