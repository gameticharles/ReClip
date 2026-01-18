import {
    oneLight,
    vs,
    ghcolors
} from 'react-syntax-highlighter/dist/esm/styles/prism';
import {
    atomDark,
    vscDarkPlus,
    dracula
} from 'react-syntax-highlighter/dist/esm/styles/prism';

export const THEMES = {
    light: [
        { id: 'oneLight', name: 'Atom One Light', style: oneLight },
        { id: 'vs', name: 'Visual Studio', style: vs },
        { id: 'ghcolors', name: 'GitHub', style: ghcolors },
    ],
    dark: [
        { id: 'atomDark', name: 'Atom Dark', style: atomDark },
        { id: 'vscDarkPlus', name: 'VSC Dark+', style: vscDarkPlus },
        { id: 'dracula', name: 'Dracula', style: dracula },
    ]
};

export const getAllThemes = () => {
    return [...THEMES.light, ...THEMES.dark];
};

export const getThemeById = (id: string, mode: 'light' | 'dark') => {
    const theme = getAllThemes().find(t => t.id === id);
    if (!theme) {
        // Fallback defaults
        return mode === 'dark' ? THEMES.dark[0] : THEMES.light[0];
    }
    return theme;
};
