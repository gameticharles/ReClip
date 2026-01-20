
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
    return '#' + [r, g, b].map(x => Math.round(x).toString(16).padStart(2, '0')).join('');
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

// Mix two colors
export const mixColors = (color1: string, color2: string, ratio: number = 0.5): string => {
    const rgb1 = hexToRgb(color1);
    const rgb2 = hexToRgb(color2);
    if (!rgb1 || !rgb2) return color1;

    const r = Math.round(rgb1.r * (1 - ratio) + rgb2.r * ratio);
    const g = Math.round(rgb1.g * (1 - ratio) + rgb2.g * ratio);
    const b = Math.round(rgb1.b * (1 - ratio) + rgb2.b * ratio);

    return rgbToHex(r, g, b);
};

// Generate scale between two colors
export const generateScale = (color1: string, color2: string, steps: number = 5): string[] => {
    const scale = [];
    for (let i = 0; i < steps; i++) {
        scale.push(mixColors(color1, color2, i / (steps - 1)));
    }
    return scale;
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
        r: Math.round(Math.min(255, Math.max(0, R))),
        g: Math.round(Math.min(255, Math.max(0, G))),
        b: Math.round(Math.min(255, Math.max(0, B)))
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
    tags?: string[];
}

// Standard Backgrounds for Contrast Grid
export const STANDARD_BACKGROUNDS = [
    { name: 'White', hex: '#ffffff' },
    { name: 'Slate-50', hex: '#f8fafc' },
    { name: 'Slate-100', hex: '#f1f5f9' },
    { name: 'Gray-200', hex: '#e5e7eb' },
    { name: 'Gray-300', hex: '#d1d5db' },
    { name: 'Gray-400', hex: '#9ca3af' },
    { name: 'Gray-500', hex: '#6b7280' },
    { name: 'Gray-600', hex: '#4b5563' },
    { name: 'Gray-700', hex: '#374151' },
    { name: 'Gray-800', hex: '#1f2937' },
    { name: 'Slate-900', hex: '#0f172a' },
    { name: 'Black', hex: '#000000' }
];

// Advanced Code Formats
export const formatCode = (hex: string, format: string): string => {
    const rgb = hexToRgb(hex);
    if (!rgb) return hex;

    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    const hwb = rgbToHwb(rgb.r, rgb.g, rgb.b);
    const lab = rgbToLab(rgb.r, rgb.g, rgb.b);
    const lch = rgbToLch(rgb.r, rgb.g, rgb.b);
    const oklch = rgbToOklch(rgb.r, rgb.g, rgb.b);

    switch (format) {
        case 'swift':
            return `UIColor(red: ${(rgb.r / 255).toFixed(3)}, green: ${(rgb.g / 255).toFixed(3)}, blue: ${(rgb.b / 255).toFixed(3)}, alpha: 1.0)`;
        case 'swiftui':
            return `Color(red: ${(rgb.r / 255).toFixed(3)}, green: ${(rgb.g / 255).toFixed(3)}, blue: ${(rgb.b / 255).toFixed(3)})`;
        case 'flutter':
            return `Color(0xFF${hex.substring(1).toUpperCase()})`;
        case 'kotlin':
            return `Color(0xFF${hex.substring(1).toUpperCase()})`;
        case 'css-rgb':
            return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
        case 'css-rgba':
            return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 1.0)`;
        case 'css-hsl':
            return `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
        case 'css-hsla':
            return `hsla(${hsl.h}, ${hsl.s}%, ${hsl.l}%, 1.0)`;
        case 'css-hwb':
            return `hwb(${hwb.h} ${hwb.w}% ${hwb.b}%)`;
        case 'css-lab':
            return `lab(${lab.l.toFixed(1)}% ${lab.a.toFixed(1)} ${lab.b.toFixed(1)})`;
        case 'css-lch':
            return `lch(${lch.l.toFixed(1)}% ${lch.c.toFixed(1)} ${lch.h.toFixed(1)})`;
        case 'css-oklch':
            return `oklch(${oklch.l.toFixed(3)} ${oklch.c.toFixed(3)} ${oklch.h.toFixed(1)})`;
        case 'argb-hex':
            return `#FF${hex.substring(1).toUpperCase()}`;
        case 'android-xml':
            return `<color name="color_${hex.substring(1).toLowerCase()}">#FF${hex.substring(1).toUpperCase()}</color>`;
        case 'csharp':
            return `Color.FromArgb(255, ${rgb.r}, ${rgb.g}, ${rgb.b})`;
        case 'java-awt':
            return `new Color(${rgb.r}, ${rgb.g}, ${rgb.b})`;
        case 'objective-c':
            return `[UIColor colorWithRed:${(rgb.r / 255).toFixed(3)} green:${(rgb.g / 255).toFixed(3)} blue:${(rgb.b / 255).toFixed(3)} alpha:1.0]`;
        case 'sass-variable':
            return `$color-primary: ${hex};`;
        case 'css-variable':
            return `--color-primary: ${hex};`;
        case 'integer':
            return `${parseInt(hex.substring(1), 16)}`;
        case 'hex-integer':
            return `0x${hex.substring(1).toUpperCase()}`;
        case 'tailwind':
            return findNearestTailwind(hex) || hex;
        case 'css-hex':
        default:
            return hex;
    }
};

// ============================================
// HWB (Hue, Whiteness, Blackness) Conversion
// ============================================
export const rgbToHwb = (r: number, g: number, b: number): { h: number; w: number; b: number } => {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const hsl = rgbToHsl(Math.round(r * 255), Math.round(g * 255), Math.round(b * 255));

    return {
        h: hsl.h,
        w: Math.round(min * 100),
        b: Math.round((1 - max) * 100)
    };
};

export const hwbToRgb = (h: number, w: number, b: number): { r: number; g: number; b: number } => {
    w /= 100; b /= 100;
    if (w + b >= 1) {
        const gray = Math.round(w / (w + b) * 255);
        return { r: gray, g: gray, b: gray };
    }
    const rgb = hslToRgb(h, 100, 50);
    const factor = 1 - w - b;
    return {
        r: Math.round((rgb.r / 255 * factor + w) * 255),
        g: Math.round((rgb.g / 255 * factor + w) * 255),
        b: Math.round((rgb.b / 255 * factor + w) * 255)
    };
};

// ============================================
// LAB (CIE L*a*b*) Conversion
// ============================================
export const rgbToXyz = (r: number, g: number, b: number): { x: number; y: number; z: number } => {
    // Convert to 0-1 range and apply gamma correction
    let rLinear = r / 255;
    let gLinear = g / 255;
    let bLinear = b / 255;

    rLinear = rLinear > 0.04045 ? Math.pow((rLinear + 0.055) / 1.055, 2.4) : rLinear / 12.92;
    gLinear = gLinear > 0.04045 ? Math.pow((gLinear + 0.055) / 1.055, 2.4) : gLinear / 12.92;
    bLinear = bLinear > 0.04045 ? Math.pow((bLinear + 0.055) / 1.055, 2.4) : bLinear / 12.92;

    // sRGB to XYZ (D65 illuminant)
    return {
        x: rLinear * 0.4124564 + gLinear * 0.3575761 + bLinear * 0.1804375,
        y: rLinear * 0.2126729 + gLinear * 0.7151522 + bLinear * 0.0721750,
        z: rLinear * 0.0193339 + gLinear * 0.1191920 + bLinear * 0.9503041
    };
};

export const xyzToRgb = (x: number, y: number, z: number): { r: number; g: number; b: number } => {
    // XYZ to linear RGB
    let r = x * 3.2404542 + y * -1.5371385 + z * -0.4985314;
    let g = x * -0.9692660 + y * 1.8760108 + z * 0.0415560;
    let b = x * 0.0556434 + y * -0.2040259 + z * 1.0572252;

    // Apply gamma correction
    r = r > 0.0031308 ? 1.055 * Math.pow(r, 1 / 2.4) - 0.055 : 12.92 * r;
    g = g > 0.0031308 ? 1.055 * Math.pow(g, 1 / 2.4) - 0.055 : 12.92 * g;
    b = b > 0.0031308 ? 1.055 * Math.pow(b, 1 / 2.4) - 0.055 : 12.92 * b;

    return {
        r: Math.round(Math.max(0, Math.min(255, r * 255))),
        g: Math.round(Math.max(0, Math.min(255, g * 255))),
        b: Math.round(Math.max(0, Math.min(255, b * 255)))
    };
};

export const rgbToLab = (r: number, g: number, b: number): { l: number; a: number; b: number } => {
    const xyz = rgbToXyz(r, g, b);

    // D65 reference white
    const refX = 0.95047;
    const refY = 1.0;
    const refZ = 1.08883;

    let x = xyz.x / refX;
    let y = xyz.y / refY;
    let z = xyz.z / refZ;

    const epsilon = 0.008856;
    const kappa = 903.3;

    x = x > epsilon ? Math.pow(x, 1 / 3) : (kappa * x + 16) / 116;
    y = y > epsilon ? Math.pow(y, 1 / 3) : (kappa * y + 16) / 116;
    z = z > epsilon ? Math.pow(z, 1 / 3) : (kappa * z + 16) / 116;

    return {
        l: 116 * y - 16,
        a: 500 * (x - y),
        b: 200 * (y - z)
    };
};

export const labToRgb = (l: number, a: number, labB: number): { r: number; g: number; b: number } => {
    const refX = 0.95047;
    const refY = 1.0;
    const refZ = 1.08883;

    let y = (l + 16) / 116;
    let x = a / 500 + y;
    let z = y - labB / 200;

    const epsilon = 0.008856;
    const kappa = 903.3;

    const x3 = Math.pow(x, 3);
    const y3 = Math.pow(y, 3);
    const z3 = Math.pow(z, 3);

    x = x3 > epsilon ? x3 : (116 * x - 16) / kappa;
    y = l > kappa * epsilon ? y3 : l / kappa;
    z = z3 > epsilon ? z3 : (116 * z - 16) / kappa;

    return xyzToRgb(x * refX, y * refY, z * refZ);
};

// ============================================
// LCH (CIE LCH) Conversion
// ============================================
export const rgbToLch = (r: number, g: number, b: number): { l: number; c: number; h: number } => {
    const lab = rgbToLab(r, g, b);
    const c = Math.sqrt(lab.a * lab.a + lab.b * lab.b);
    let h = Math.atan2(lab.b, lab.a) * 180 / Math.PI;
    if (h < 0) h += 360;

    return { l: lab.l, c, h };
};

export const lchToRgb = (l: number, c: number, h: number): { r: number; g: number; b: number } => {
    const hRad = h * Math.PI / 180;
    const a = c * Math.cos(hRad);
    const b = c * Math.sin(hRad);
    return labToRgb(l, a, b);
};

// ============================================
// OKLCH (Oklab LCH) Conversion
// ============================================
export const rgbToOklab = (r: number, g: number, b: number): { l: number; a: number; b: number } => {
    // Linearize sRGB
    let lr = r / 255;
    let lg = g / 255;
    let lb = b / 255;

    lr = lr <= 0.04045 ? lr / 12.92 : Math.pow((lr + 0.055) / 1.055, 2.4);
    lg = lg <= 0.04045 ? lg / 12.92 : Math.pow((lg + 0.055) / 1.055, 2.4);
    lb = lb <= 0.04045 ? lb / 12.92 : Math.pow((lb + 0.055) / 1.055, 2.4);

    const l_ = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
    const m_ = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
    const s_ = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);

    return {
        l: 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
        a: 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
        b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_
    };
};

export const oklabToRgb = (l: number, a: number, b: number): { r: number; g: number; b: number } => {
    const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
    const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
    const s_ = l - 0.0894841775 * a - 1.2914855480 * b;

    const lr = Math.pow(l_, 3);
    const mr = Math.pow(m_, 3);
    const sr = Math.pow(s_, 3);

    let r = 4.0767416621 * lr - 3.3077115913 * mr + 0.2309699292 * sr;
    let g = -1.2684380046 * lr + 2.6097574011 * mr - 0.3413193965 * sr;
    let bVal = -0.0041960863 * lr - 0.7034186147 * mr + 1.7076147010 * sr;

    // Gamma correction
    r = r <= 0.0031308 ? 12.92 * r : 1.055 * Math.pow(r, 1 / 2.4) - 0.055;
    g = g <= 0.0031308 ? 12.92 * g : 1.055 * Math.pow(g, 1 / 2.4) - 0.055;
    bVal = bVal <= 0.0031308 ? 12.92 * bVal : 1.055 * Math.pow(bVal, 1 / 2.4) - 0.055;

    return {
        r: Math.round(Math.max(0, Math.min(255, r * 255))),
        g: Math.round(Math.max(0, Math.min(255, g * 255))),
        b: Math.round(Math.max(0, Math.min(255, bVal * 255)))
    };
};

export const rgbToOklch = (r: number, g: number, b: number): { l: number; c: number; h: number } => {
    const oklab = rgbToOklab(r, g, b);
    const c = Math.sqrt(oklab.a * oklab.a + oklab.b * oklab.b);
    let h = Math.atan2(oklab.b, oklab.a) * 180 / Math.PI;
    if (h < 0) h += 360;

    return { l: oklab.l, c, h };
};

export const oklchToRgb = (l: number, c: number, h: number): { r: number; g: number; b: number } => {
    const hRad = h * Math.PI / 180;
    const a = c * Math.cos(hRad);
    const b = c * Math.sin(hRad);
    return oklabToRgb(l, a, b);
};

// ============================================
// Industry Color Matching (Pantone, RAL, NCS)
// ============================================
export const PANTONE_COLORS: Record<string, string> = {
    'PMS 186 C': '#c8102e', 'PMS 185 C': '#e4002b', 'PMS 199 C': '#d50032',
    'PMS 032 C': '#f4364c', 'PMS 021 C': '#fe5000', 'PMS 151 C': '#ff8200',
    'PMS 123 C': '#ffc72c', 'PMS 116 C': '#ffcd00', 'PMS 109 C': '#ffd100',
    'PMS 382 C': '#c4d600', 'PMS 375 C': '#97d700', 'PMS 361 C': '#43b02a',
    'PMS 347 C': '#009a44', 'PMS 3268 C': '#00ab84', 'PMS 320 C': '#009ca6',
    'PMS 3005 C': '#0077c8', 'PMS 300 C': '#005eb8', 'PMS 286 C': '#0032a0',
    'PMS 2728 C': '#001489', 'PMS 2685 C': '#56368a', 'PMS 2607 C': '#500778',
    'PMS 254 C': '#84329b', 'PMS 232 C': '#f74d8b', 'PMS 219 C': '#e31c79',
    'PMS 485 C': '#da291c', 'PMS 711 C': '#aa8066', 'PMS 476 C': '#4e3524',
    'PMS Black C': '#2d2926', 'PMS Cool Gray 11 C': '#53565a', 'PMS Cool Gray 5 C': '#b1b3b3',
    'PMS White': '#ffffff', 'PMS 7421 C': '#612141', 'PMS 7462 C': '#00558c',
    'PMS 7741 C': '#44883e', 'PMS 7548 C': '#ffc600', 'PMS 7579 C': '#dc4405'
};

export const RAL_COLORS: Record<string, string> = {
    'RAL 1000': '#bebd7f', 'RAL 1001': '#c2b078', 'RAL 1002': '#c6a664',
    'RAL 1003': '#e5be01', 'RAL 1004': '#cda434', 'RAL 1005': '#a98307',
    'RAL 2000': '#ed760e', 'RAL 2001': '#c93c20', 'RAL 2002': '#cb2821',
    'RAL 3000': '#af2b1e', 'RAL 3001': '#a52019', 'RAL 3002': '#a2231d',
    'RAL 3003': '#9b111e', 'RAL 4001': '#6d3f5b', 'RAL 4002': '#922b3e',
    'RAL 5000': '#354d73', 'RAL 5002': '#20214f', 'RAL 5003': '#1d1e33',
    'RAL 5005': '#1e2460', 'RAL 5010': '#0e294b', 'RAL 5015': '#2271b3',
    'RAL 6000': '#316650', 'RAL 6001': '#287233', 'RAL 6002': '#2d572c',
    'RAL 7000': '#78858b', 'RAL 7001': '#8a9597', 'RAL 7035': '#d7d7d7',
    'RAL 8000': '#826c34', 'RAL 8001': '#955f20', 'RAL 9001': '#fdf4e3',
    'RAL 9002': '#e7ebda', 'RAL 9003': '#f4f4f4', 'RAL 9005': '#0a0a0a',
    'RAL 9010': '#ffffff', 'RAL 9016': '#f6f6f6', 'RAL 9017': '#1e1e1e'
};

export const NCS_COLORS: Record<string, string> = {
    'S 0500-N': '#f5f2e7', 'S 0502-Y': '#f4f1e0', 'S 0505-Y10R': '#f7efe0',
    'S 1000-N': '#e8e4d8', 'S 1002-Y': '#e5e1d0', 'S 1005-Y20R': '#e8dfd0',
    'S 1500-N': '#d8d4c8', 'S 2000-N': '#c8c4b8', 'S 2002-Y': '#cac6b5',
    'S 2005-Y30R': '#d4c8b5', 'S 2010-Y30R': '#d8c4a8', 'S 2020-Y30R': '#d8bc98',
    'S 3000-N': '#aca8a0', 'S 4000-N': '#908c85', 'S 4502-B': '#7e8890',
    'S 5000-N': '#787470', 'S 6000-N': '#605c58', 'S 7000-N': '#4a4644',
    'S 8000-N': '#353230', 'S 9000-N': '#201f1e', 'S 0520-Y10R': '#f7e8c8',
    'S 0540-Y10R': '#f7dca8', 'S 0560-Y10R': '#f7d088', 'S 1070-Y10R': '#e8b450',
    'S 2060-Y10R': '#d4a040', 'S 3060-Y10R': '#b88c30', 'S 2060-B': '#0078c8'
};

export const findNearestPantone = (hex: string): string | null => {
    return findNearestFromPalette(hex, PANTONE_COLORS);
};

export const findNearestRal = (hex: string): string | null => {
    return findNearestFromPalette(hex, RAL_COLORS);
};

export const findNearestNcs = (hex: string): string | null => {
    return findNearestFromPalette(hex, NCS_COLORS);
};

const findNearestFromPalette = (hex: string, palette: Record<string, string>): string | null => {
    const rgb = hexToRgb(hex);
    if (!rgb) return null;

    let minDist = Infinity;
    let match = '';

    Object.entries(palette).forEach(([name, colorHex]) => {
        const cRgb = hexToRgb(colorHex);
        if (cRgb) {
            const dist = Math.sqrt(
                Math.pow(rgb.r - cRgb.r, 2) +
                Math.pow(rgb.g - cRgb.g, 2) +
                Math.pow(rgb.b - cRgb.b, 2)
            );
            if (dist < minDist) {
                minDist = dist;
                match = name;
            }
        }
    });
    return minDist < 100 ? match : null; // Only return if reasonably close
};

// ============================================
// Color Temperature & Properties
// ============================================
export const getColorTemperature = (hex: string): { type: 'warm' | 'cool' | 'neutral'; kelvin: number } => {
    const rgb = hexToRgb(hex);
    if (!rgb) return { type: 'neutral', kelvin: 6500 };

    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

    // Warm colors: red, orange, yellow (0-60, 300-360)
    // Cool colors: green, blue, purple (120-270)
    const h = hsl.h;
    let type: 'warm' | 'cool' | 'neutral' = 'neutral';
    let kelvin = 6500;

    if ((h >= 0 && h <= 60) || (h >= 300 && h <= 360)) {
        type = 'warm';
        kelvin = 2700 + ((60 - Math.min(h, 60)) / 60) * 2000;
    } else if (h >= 180 && h <= 270) {
        type = 'cool';
        kelvin = 8000 + ((h - 180) / 90) * 4000;
    } else if (h > 60 && h < 180) {
        type = hsl.s < 30 ? 'neutral' : (h < 120 ? 'warm' : 'cool');
        kelvin = 5500 + ((h - 60) / 120) * 2000;
    }

    // Neutral if saturation is very low
    if (hsl.s < 10) {
        type = 'neutral';
        kelvin = 6500;
    }

    return { type, kelvin: Math.round(kelvin) };
};

export const getWebsafeColor = (hex: string): string => {
    const rgb = hexToRgb(hex);
    if (!rgb) return hex;

    const websafe = (c: number) => Math.round(c / 51) * 51;
    return rgbToHex(websafe(rgb.r), websafe(rgb.g), websafe(rgb.b));
};

export const getHexShorthand = (hex: string): string | null => {
    if (!hex.startsWith('#') || hex.length !== 7) return null;

    const r1 = hex[1], r2 = hex[2];
    const g1 = hex[3], g2 = hex[4];
    const b1 = hex[5], b2 = hex[6];

    if (r1 === r2 && g1 === g2 && b1 === b2) {
        return `#${r1}${g1}${b1}`;
    }
    return null;
};

// ============================================
// Blend Modes
// ============================================
export type BlendMode = 'normal' | 'multiply' | 'screen' | 'overlay' | 'soft-light' | 'hard-light' | 'difference' | 'exclusion';

export const blendColors = (base: string, blend: string, mode: BlendMode = 'normal'): string => {
    const baseRgb = hexToRgb(base);
    const blendRgb = hexToRgb(blend);
    if (!baseRgb || !blendRgb) return base;

    const blendChannel = (a: number, b: number, mode: BlendMode): number => {
        a /= 255; b /= 255;
        let result: number;

        switch (mode) {
            case 'multiply':
                result = a * b;
                break;
            case 'screen':
                result = 1 - (1 - a) * (1 - b);
                break;
            case 'overlay':
                result = a < 0.5 ? 2 * a * b : 1 - 2 * (1 - a) * (1 - b);
                break;
            case 'soft-light':
                result = b < 0.5
                    ? a - (1 - 2 * b) * a * (1 - a)
                    : a + (2 * b - 1) * (a < 0.25 ? ((16 * a - 12) * a + 4) * a : Math.sqrt(a) - a);
                break;
            case 'hard-light':
                result = b < 0.5 ? 2 * a * b : 1 - 2 * (1 - a) * (1 - b);
                break;
            case 'difference':
                result = Math.abs(a - b);
                break;
            case 'exclusion':
                result = a + b - 2 * a * b;
                break;
            case 'normal':
            default:
                result = b;
        }

        return Math.round(result * 255);
    };

    return rgbToHex(
        blendChannel(baseRgb.r, blendRgb.r, mode),
        blendChannel(baseRgb.g, blendRgb.g, mode),
        blendChannel(baseRgb.b, blendRgb.b, mode)
    );
};

// ============================================
// Perceptual Color Mixing (LAB-based)
// ============================================
export const mixColorsLab = (color1: string, color2: string, ratio: number = 0.5): string => {
    const rgb1 = hexToRgb(color1);
    const rgb2 = hexToRgb(color2);
    if (!rgb1 || !rgb2) return color1;

    const lab1 = rgbToLab(rgb1.r, rgb1.g, rgb1.b);
    const lab2 = rgbToLab(rgb2.r, rgb2.g, rgb2.b);

    const l = lab1.l * (1 - ratio) + lab2.l * ratio;
    const a = lab1.a * (1 - ratio) + lab2.a * ratio;
    const b = lab1.b * (1 - ratio) + lab2.b * ratio;

    const rgb = labToRgb(l, a, b);
    return rgbToHex(rgb.r, rgb.g, rgb.b);
};

export const mixColorsOklch = (color1: string, color2: string, ratio: number = 0.5): string => {
    const rgb1 = hexToRgb(color1);
    const rgb2 = hexToRgb(color2);
    if (!rgb1 || !rgb2) return color1;

    const oklch1 = rgbToOklch(rgb1.r, rgb1.g, rgb1.b);
    const oklch2 = rgbToOklch(rgb2.r, rgb2.g, rgb2.b);

    // Handle hue interpolation
    let h1 = oklch1.h, h2 = oklch2.h;
    if (Math.abs(h2 - h1) > 180) {
        if (h2 > h1) h1 += 360;
        else h2 += 360;
    }

    const l = oklch1.l * (1 - ratio) + oklch2.l * ratio;
    const c = oklch1.c * (1 - ratio) + oklch2.c * ratio;
    let h = h1 * (1 - ratio) + h2 * ratio;
    if (h >= 360) h -= 360;

    const rgb = oklchToRgb(l, c, h);
    return rgbToHex(rgb.r, rgb.g, rgb.b);
};

export const generateScaleLab = (color1: string, color2: string, steps: number = 5): string[] => {
    const scale = [];
    for (let i = 0; i < steps; i++) {
        scale.push(mixColorsLab(color1, color2, i / (steps - 1)));
    }
    return scale;
};

export const generateScaleOklch = (color1: string, color2: string, steps: number = 5): string[] => {
    const scale = [];
    for (let i = 0; i < steps; i++) {
        scale.push(mixColorsOklch(color1, color2, i / (steps - 1)));
    }
    return scale;
};

// ============================================
// APCA Contrast (Advanced Perceptual Contrast Algorithm)
// ============================================
export const getApcaContrast = (textHex: string, bgHex: string): number => {
    const text = hexToRgb(textHex);
    const bg = hexToRgb(bgHex);
    if (!text || !bg) return 0;

    // Soft clamp and linearize
    const sRGBtoY = (rgb: { r: number; g: number; b: number }): number => {
        const mainTRC = 2.4;
        const Rco = 0.2126729, Gco = 0.7151522, Bco = 0.0721750;

        const simpleExp = (c: number) => Math.pow(c / 255, mainTRC);

        return Rco * simpleExp(rgb.r) + Gco * simpleExp(rgb.g) + Bco * simpleExp(rgb.b);
    };

    const Ytext = sRGBtoY(text);
    const Ybg = sRGBtoY(bg);

    // APCA contrast calculation
    const normBG = 0.56, normTXT = 0.57;
    const revTXT = 0.62, revBG = 0.65;
    const blkThrs = 0.022, blkClmp = 1.414;
    const scaleBoW = 1.14, scaleWoB = 1.14;
    const loClip = 0.1, deltaYmin = 0.0005;

    let outputContrast = 0;
    let SAPC = 0;

    // Soft clamp black levels
    const Ytxt = Ytext > blkThrs ? Ytext : Ytext + Math.pow(blkThrs - Ytext, blkClmp);
    const Ybgc = Ybg > blkThrs ? Ybg : Ybg + Math.pow(blkThrs - Ybg, blkClmp);

    if (Math.abs(Ybgc - Ytxt) < deltaYmin) {
        return 0;
    }

    // Calculate SAPC
    if (Ybgc > Ytxt) {
        // Dark text on light background
        SAPC = (Math.pow(Ybgc, normBG) - Math.pow(Ytxt, normTXT)) * scaleBoW;
        outputContrast = SAPC < loClip ? 0 : SAPC * 100;
    } else {
        // Light text on dark background
        SAPC = (Math.pow(Ybgc, revBG) - Math.pow(Ytxt, revTXT)) * scaleWoB;
        outputContrast = SAPC > -loClip ? 0 : SAPC * 100;
    }

    return Math.round(outputContrast * 10) / 10;
};

export const getApcaLevel = (contrast: number): { level: string; minSize: number } => {
    const absContrast = Math.abs(contrast);

    if (absContrast >= 90) return { level: 'Preferred (Fluent)', minSize: 12 };
    if (absContrast >= 75) return { level: 'Preferred', minSize: 14 };
    if (absContrast >= 60) return { level: 'Minimum (Body)', minSize: 16 };
    if (absContrast >= 45) return { level: 'Minimum (Large)', minSize: 24 };
    if (absContrast >= 30) return { level: 'Non-text Only', minSize: 42 };
    if (absContrast >= 15) return { level: 'Invisible (UI Only)', minSize: 0 };
    return { level: 'Fail', minSize: 0 };
};

// Suggest accessible color alternatives (Consolidated)
export const suggestAccessibleColor = (bg: string, fg: string, preference: 'any' | 'lighter' | 'darker' = 'lighter', targetRatio: number = 4.5): string => {

    const fgRgb = hexToRgb(fg);
    if (!fgRgb) return fg;

    // Use HSL for better quality lightness adjustment
    const hsl = rgbToHsl(fgRgb.r, fgRgb.g, fgRgb.b);

    const check = (l: number): string | null => {
        const testRgb = hslToRgb(hsl.h, hsl.s, l);
        const testHex = rgbToHex(testRgb.r, testRgb.g, testRgb.b);
        return getContrastRatio(bg, testHex) >= targetRatio ? testHex : null;
    };

    if (check(hsl.l)) return fg;

    for (let i = 1; i <= 100; i++) {
        if (preference === 'any' || preference === 'lighter') {
            const lUp = Math.min(100, Math.floor(hsl.l + i));
            const res = check(lUp);
            if (res) return res;
        }
        if (preference === 'any' || preference === 'darker') {
            const lDown = Math.max(0, Math.ceil(hsl.l - i));
            const res = check(lDown);
            if (res) return res;
        }
    }

    // Fallback
    if (preference === 'lighter') return '#ffffff';
    if (preference === 'darker') return '#000000';

    const whiteContrast = getContrastRatio(bg, '#ffffff');
    const blackContrast = getContrastRatio(bg, '#000000');
    return whiteContrast >= blackContrast ? '#ffffff' : '#000000';
};



export const calculateMinFontSize = (contrast: number, isLarge: boolean = false): number => {
    if (contrast >= 7) return 12;
    if (contrast >= 4.5) return isLarge ? 14 : 18;
    if (contrast >= 3) return 24;
    return 36; // Not recommended
};


// ============================================
// Gradient Presets
// ============================================
export interface GradientPreset {
    name: string;
    colors: string[];
    angle: number;
}

export const GRADIENT_PRESETS: GradientPreset[] = [
    { name: 'Sunset', colors: ['#ff6b6b', '#ffd93d', '#ff8e3c'], angle: 135 },
    { name: 'Ocean', colors: ['#667eea', '#764ba2', '#66a6ff'], angle: 135 },
    { name: 'Forest', colors: ['#134e5e', '#71b280'], angle: 135 },
    { name: 'Aurora', colors: ['#00d2ff', '#3a7bd5', '#00d2ff'], angle: 90 },
    { name: 'Midnight', colors: ['#232526', '#414345'], angle: 180 },
    { name: 'Candy', colors: ['#d53369', '#daae51'], angle: 135 },
    { name: 'Peach', colors: ['#ed6ea0', '#ec8c69'], angle: 135 },
    { name: 'Mojito', colors: ['#1d976c', '#93f9b9'], angle: 135 },
    { name: 'Frost', colors: ['#000428', '#004e92'], angle: 180 },
    { name: 'Stripe', colors: ['#1fa2ff', '#12d8fa', '#a6ffcb'], angle: 90 },
    { name: 'Lavender', colors: ['#e0c3fc', '#8ec5fc'], angle: 135 },
    { name: 'Fire', colors: ['#f12711', '#f5af19'], angle: 135 },
    { name: 'Emerald', colors: ['#348f50', '#56b4d3'], angle: 135 },
    { name: 'Royal', colors: ['#141e30', '#243b55'], angle: 135 },
    { name: 'Rose', colors: ['#ff0844', '#ffb199'], angle: 135 },
    { name: 'Grape', colors: ['#5b247a', '#1bcedf'], angle: 135 },
    { name: 'Noir', colors: ['#000000', '#434343'], angle: 180 },
    { name: 'Sky', colors: ['#56ccf2', '#2f80ed'], angle: 180 }
];

// ============================================
// Enhanced Harmony Generation
// ============================================
export const generateHarmoniesAdvanced = (hex: string, angleOffset: number = 0): Record<string, string[]> => {
    const rgb = hexToRgb(hex);
    if (!rgb) return {};
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

    const createColor = (hueOffset: number) => {
        const h = (hsl.h + hueOffset + angleOffset + 360) % 360;
        const newRgb = hslToRgb(h, hsl.s, hsl.l);
        return rgbToHex(newRgb.r, newRgb.g, newRgb.b);
    };

    return {
        complementary: [hex, createColor(180)],
        analogous: [createColor(-30), hex, createColor(30)],
        triadic: [hex, createColor(120), createColor(240)],
        split: [hex, createColor(150), createColor(210)],
        tetradic: [hex, createColor(90), createColor(180), createColor(270)],
        monochromatic: [
            rgbToHex(...Object.values(hslToRgb(hsl.h, hsl.s, Math.max(0, hsl.l - 30))) as [number, number, number]),
            rgbToHex(...Object.values(hslToRgb(hsl.h, hsl.s, Math.max(0, hsl.l - 15))) as [number, number, number]),
            hex,
            rgbToHex(...Object.values(hslToRgb(hsl.h, hsl.s, Math.min(100, hsl.l + 15))) as [number, number, number]),
            rgbToHex(...Object.values(hslToRgb(hsl.h, hsl.s, Math.min(100, hsl.l + 30))) as [number, number, number])
        ],
        doubleSplit: [hex, createColor(60), createColor(180), createColor(240)]
    };
};

// ============================================
// Gradient Utilities
// ============================================
// (Removed duplicate GRADIENT_PRESETS)

export const generateGradient = (type: 'linear' | 'radial' | 'conic', angle: number, stops: { color: string; position: number }[]): string => {
    const sortedStops = [...stops].sort((a, b) => a.position - b.position);
    const stopsString = sortedStops.map(s => `${s.color} ${s.position}%`).join(', ');

    if (type === 'linear') {
        return `linear-gradient(${angle}deg, ${stopsString})`;
    } else if (type === 'conic') {
        return `conic-gradient(from ${angle}deg, ${stopsString})`;
    } else {
        return `radial-gradient(circle, ${stopsString})`;
    }
};

// ============================================
// Export Helpers
// ============================================
export const exportPaletteAsCSS = (colors: string[], prefix: string = 'color'): string => {
    return colors.map((c, i) => `--${prefix}-${i + 1}: ${c};`).join('\n');
};

export const exportPaletteAsSCSS = (colors: string[], prefix: string = 'color'): string => {
    return colors.map((c, i) => `$${prefix}-${i + 1}: ${c};`).join('\n');
};

export const exportPaletteAsJSON = (colors: string[]): string => {
    return JSON.stringify(colors, null, 2);
};

export const exportPaletteAsTailwind = (colors: string[], name: string = 'custom'): string => {
    const shades: Record<string, string> = {};
    colors.forEach((c, i) => {
        const shade = Math.round(((i + 1) / colors.length) * 900 / 100) * 100 || 50;
        shades[shade.toString()] = c;
    });
    return JSON.stringify({ [name]: shades }, null, 2);
};


function srgbToLinear(c: number): number {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function relativeLuminance({ r, g, b }: { r: number; g: number; b: number }): number {
    return (
        0.2126 * srgbToLinear(r) +
        0.7152 * srgbToLinear(g) +
        0.0722 * srgbToLinear(b)
    );
}

// export function getContrastRatio(bgHex: string, fgHex: string): number {
//     const bg = hexToRgb(bgHex);
//     const fg = hexToRgb(fgHex);
//     if (!bg || !fg) return 1;

//     const L1 = relativeLuminance(bg);
//     const L2 = relativeLuminance(fg);

//     const lighter = Math.max(L1, L2);
//     const darker = Math.min(L1, L2);

//     return (lighter + 0.05) / (darker + 0.05);
// }

const APCA = {
    blkThrs: 0.022,
    blkClmp: 1.414,
    scale: 1.14,
    normBG: 0.56,
    normTXT: 0.57,
    revTXT: 0.62,
    revBG: 0.65,
    loClip: 0.1,
    loBooster: 0.027,
};

function apcaLuminance({ r, g, b }: { r: number; g: number; b: number }): number {
    const R = Math.pow(r / 255, 2.4);
    const G = Math.pow(g / 255, 2.4);
    const B = Math.pow(b / 255, 2.4);

    return 0.2126729 * R + 0.7151522 * G + 0.0721750 * B;
}

// export function getApcaContrast(bgHex: string, fgHex: string): number {
//     const bg = hexToRgb(bgHex);
//     const fg = hexToRgb(fgHex);
//     if (!bg || !fg) return 0;

//     let Ybg = apcaLuminance(bg);
//     let Ytxt = apcaLuminance(fg);

//     // Black clamp
//     if (Ybg < APCA.blkThrs) Ybg += Math.pow(APCA.blkThrs - Ybg, APCA.blkClmp);
//     if (Ytxt < APCA.blkThrs) Ytxt += Math.pow(APCA.blkThrs - Ytxt, APCA.blkClmp);

//     const polarity = Ybg > Ytxt ? 'darkText' : 'lightText';

//     let contrast: number;

//     if (polarity === 'darkText') {
//         contrast =
//             (Math.pow(Ybg, APCA.normBG) - Math.pow(Ytxt, APCA.normTXT)) *
//             APCA.scale * 100;
//     } else {
//         contrast =
//             (Math.pow(Ybg, APCA.revBG) - Math.pow(Ytxt, APCA.revTXT)) *
//             APCA.scale * 100;
//     }

//     // Low contrast smoothing
//     if (Math.abs(contrast) < APCA.loClip) {
//         contrast *= Math.abs(contrast) / APCA.loClip;
//     }

//     return contrast;
// }

export const APCA_THRESHOLDS = {
    bodyText: 60,      // 16px–20px
    largeText: 45,     // ≥24px or ≥18px bold
    uiText: 75,        // buttons, inputs, labels
    decorative: 30,    // icons, disabled
};

export function apcaPass(
    contrast: number,
    usage: keyof typeof APCA_THRESHOLDS
): boolean {
    return Math.abs(contrast) >= APCA_THRESHOLDS[usage];
}

export function calculateMinFontSizeFromApca(Lc: number): number {
    const absLc = Math.abs(Lc);

    if (absLc >= 90) return 12;
    if (absLc >= 75) return 14;
    if (absLc >= 60) return 16;
    if (absLc >= 45) return 24;
    if (absLc >= 30) return 32;

    return Infinity; // Not readable text
}

function adjustLightness(hex: string, delta: number): string {
    const { h, s, l } = hexToHsl(hex);
    const nextL = Math.max(0, Math.min(100, l + delta));
    return hslToHex(h, s, nextL);
}

export function suggestAccessibleVariants(
    bgHex: string,
    fgHex: string
): { hex: string; reason: string }[] {
    const results = new Set<string>();
    const suggestions = [];

    for (let step = 5; step <= 60; step += 5) {
        for (const delta of [step, -step]) {
            const candidate = adjustLightness(fgHex, delta);

            if (results.has(candidate)) continue;

            const wcag = getContrastRatio(bgHex, candidate);
            const apca = getApcaContrast(bgHex, candidate);

            if (wcag >= 4.5 && Math.abs(apca) >= 60) {
                results.add(candidate);
                suggestions.push({
                    hex: candidate,
                    reason: 'WCAG AA + APCA Body Text',
                });
            }

            if (suggestions.length >= 6) return suggestions;
        }
    }

    return suggestions;
}

export function compareForegrounds(
    bgHex: string,
    foregrounds: string[]
) {
    return foregrounds.slice(0, 4).map(fg => ({
        fg,
        wcag: getContrastRatio(bgHex, fg),
        apca: getApcaContrast(bgHex, fg),
    }));
}
function hexToHsl(hex: string): { h: number; s: number; l: number; } {
    const rgb = hexToRgb(hex);
    if (!rgb) return { h: 0, s: 0, l: 0 };
    return rgbToHsl(rgb.r, rgb.g, rgb.b);
}

function hslToHex(h: number, s: number, l: number): string {
    const rgb = hslToRgb(h, s, l);
    return rgbToHex(rgb.r, rgb.g, rgb.b);
}

