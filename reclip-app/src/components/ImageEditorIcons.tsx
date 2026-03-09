const s = (children: React.ReactNode, size = 17) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {children}
    </svg>
);
const sm = (children: React.ReactNode) => s(children, 14);

import React from 'react';

export const Icons = {
    Pen: () => s(<><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></>),
    Highlighter: () => s(<><path d="m9 11 6-6" /><path d="m4.5 15.5 11-11a2.12 2.12 0 1 1 3 3l-11 11Z" /><path d="m8 10 3 3" /></>),
    Blur: () => s(<><circle cx="12" cy="12" r="3" /><circle cx="12" cy="12" r="7" strokeDasharray="2 2" /><circle cx="12" cy="12" r="10" strokeOpacity=".4" /></>),
    Eraser: () => s(<><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21Z" /><path d="m22 21H7" /><path d="m5 11 9 9" /></>),
    Rect: () => s(<rect width="18" height="18" x="3" y="3" rx="2" />),
    Circle: () => s(<circle cx="12" cy="12" r="10" />),
    Arrow: () => s(<><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></>),
    Line: () => s(<path d="M5 19 19 5" />),
    Text: () => s(<><path d="M4 7V4h16v3" /><path d="M9 20h6" /><path d="M12 4v16" /></>),
    Stamp: () => s(<><path d="M15 3h4a2 2 0 0 1 2 2v4" /><path d="M3 9V5a2 2 0 0 1 2-2h4" /><path d="M21 15v4a2 2 0 0 1-2 2h-4" /><path d="M9 21H5a2 2 0 0 1-2-2v-4" /><rect width="10" height="10" x="7" y="7" rx="1" /></>),
    Undo: () => s(<><path d="M3 7v6h6" /><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" /></>),
    Redo: () => s(<><path d="M21 7v6h-6" /><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" /></>),
    Trash: () => s(<><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></>),
    Save: () => s(<><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></>, 17),
    Clipboard: () => s(<><rect width="8" height="4" x="8" y="2" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /></>, 17),
    Close: () => s(<><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>),
    Select: () => s(<><polyline points="3 3 10 20 13 13 20 10 3 3" /><line x1="13" x2="21" y1="13" y2="21" /></>),
    Crop: () => s(<><path d="M6 2v14a2 2 0 0 0 2 2h14" /><path d="M18 22V8a2 2 0 0 0-2-2H2" /></>),
    Magnifier: () => s(<><circle cx="11" cy="11" r="8" /><line x1="21" x2="16.65" y1="21" y2="16.65" /></>),
    Check: () => s(<polyline points="20 6 9 17 4 12" />, 17),
    ZoomIn: () => sm(<><circle cx="11" cy="11" r="8" /><line x1="21" x2="16.65" y1="21" y2="16.65" /><line x1="11" x2="11" y1="8" y2="14" /><line x1="8" x2="14" y1="11" y2="11" /></>),
    Plus: () => sm(<><line x1="12" x2="12" y1="5" y2="19" /><line x1="5" x2="19" y1="12" y2="12" /></>),
    Minus: () => sm(<line x1="5" x2="19" y1="12" y2="12" />),
    FitScreen: () => sm(<><path d="M15 3h6v6" /><path d="M9 21H3v-6" /><path d="M21 3l-7 7" /><path d="M3 21l7-7" /></>),
    Duplicate: () => sm(<><rect width="14" height="14" x="8" y="8" rx="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></>),
    // Style panel icons
    Sliders: () => s(<><line x1="4" x2="4" y1="21" y2="14" /><line x1="4" x2="4" y1="10" y2="3" /><line x1="12" x2="12" y1="21" y2="12" /><line x1="12" x2="12" y1="8" y2="3" /><line x1="20" x2="20" y1="21" y2="16" /><line x1="20" x2="20" y1="12" y2="3" /><line x1="1" x2="7" y1="14" y2="14" /><line x1="9" x2="15" y1="8" y2="8" /><line x1="17" x2="23" y1="16" y2="16" /></>, 16),
    Opacity: () => s(<><path d="M12 22a8 8 0 0 1-8-8c0-4.4 8-12 8-12s8 7.6 8 12a8 8 0 0 1-8 8Z" /></>, 16),
    Shadow: () => s(<><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v16m0 0h10a2 2 0 0 0 2-2v-4M9 19H5a2 2 0 0 1-2-2v-4m0 0h18" /></>, 16),
    Fill: () => s(<><path d="M16 8l-8.5 8.5c-.83.83-.83 2.17 0 3s2.17.83 3 0L19 11l-3-3Z" /><path d="m2.5 13.5 2 2" /><path d="M12 2l3 3" /><path d="m22 22-5-5" /></>, 16),
    Dash: () => s(<><line x1="3" x2="7" y1="12" y2="12" strokeWidth="2.5" /><line x1="10" x2="14" y1="12" y2="12" strokeWidth="2.5" /><line x1="17" x2="21" y1="12" y2="12" strokeWidth="2.5" /></>, 16),
    ColorDot: () => s(<circle cx="12" cy="12" r="6" fill="currentColor" />, 16),
    ShadowBlur: () => s(<><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="8" strokeOpacity=".3" strokeWidth="4" /></>, 16),
    OffsetX: () => s(<><line x1="5" x2="19" y1="12" y2="12" /><polyline points="12 5 19 12 12 19" /></>, 16),
    OffsetY: () => s(<><line x1="12" x2="12" y1="5" y2="19" /><polyline points="19 12 12 19 5 12" /></>, 16),
};