import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { invoke } from '@tauri-apps/api/core';

interface SettingsState {
    view: 'main' | 'settings' | 'snippets' | 'colors' | 'organizer';
    compactMode: boolean;
    theme: string;
    useSystemAccent: boolean;
    accentColor: string;
    incognitoMode: boolean;
    queueMode: boolean;
    showTimeline: boolean;
    showScreenshot: boolean;
    showOnboarding: boolean;
    isLocked: boolean;
    multiWindow: boolean;
    dateFormat: 'absolute' | 'relative';
    autoHideDuration: number;
    listenToSelf: boolean;

    // Actions
    setView: (view: 'main' | 'settings' | 'snippets' | 'colors' | 'organizer') => void;
    setCompactMode: (enabled: boolean) => void;
    setTheme: (theme: string) => void;
    setUseSystemAccent: (enabled: boolean) => void;
    setAccentColor: (color: string) => void;
    setIncognitoMode: (enabled: boolean) => Promise<void>;
    toggleIncognito: () => Promise<void>;
    setQueueMode: (enabled: boolean) => void;
    setShowTimeline: (enabled: boolean) => void;
    setShowScreenshot: (enabled: boolean) => void;
    setShowOnboarding: (enabled: boolean) => void;
    setIsLocked: (enabled: boolean) => void;
    setMultiWindow: (enabled: boolean) => void;
    setDateFormat: (format: 'absolute' | 'relative') => void;
    setAutoHideDuration: (duration: number) => void;
    setListenToSelf: (enabled: boolean) => Promise<void>;

    // Initialization
    loadIncognito: () => Promise<void>;
    loadListenToSelf: () => Promise<void>;
    applyTheme: () => void;
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set, get) => ({
            view: 'main',
            compactMode: false,
            theme: 'system',
            useSystemAccent: true,
            accentColor: '#4f46e5',
            incognitoMode: false,
            queueMode: false,
            showTimeline: false,
            showScreenshot: false,
            showOnboarding: true,
            isLocked: false,
            multiWindow: false,
            dateFormat: 'relative',
            autoHideDuration: 0,
            listenToSelf: true,

            setView: (view) => set({ view }),
            setCompactMode: (compactMode) => set({ compactMode }),
            setTheme: (theme) => {
                set({ theme });
                get().applyTheme();
            },
            setUseSystemAccent: (useSystemAccent) => set({ useSystemAccent }),
            setAccentColor: (accentColor) => set({ accentColor }),

            setIncognitoMode: async (enabled) => {
                set({ incognitoMode: enabled });
                try {
                    await invoke('set_incognito_mode', { enabled });
                    await invoke('update_tray_item_state', { id: 'toggle_incognito', checked: enabled });
                } catch (e) {
                    console.error('Failed to sync incognito mode:', e);
                }
            },

            toggleIncognito: async () => {
                const newState = !get().incognitoMode;
                await get().setIncognitoMode(newState);
            },

            setQueueMode: (queueMode) => set({ queueMode }),
            setShowTimeline: (showTimeline) => set({ showTimeline }),
            setShowScreenshot: (showScreenshot) => set({ showScreenshot }),
            setShowOnboarding: (showOnboarding) => set({ showOnboarding }),
            setIsLocked: (isLocked) => set({ isLocked }),
            setMultiWindow: (multiWindow) => set({ multiWindow }),
            setDateFormat: (dateFormat) => set({ dateFormat }),
            setAutoHideDuration: (autoHideDuration) => set({ autoHideDuration }),

            setListenToSelf: async (enabled) => {
                set({ listenToSelf: enabled });
                try {
                    await invoke('set_listen_to_self', { enabled });
                } catch (e) {
                    console.error('Failed to sync listen to self setting:', e);
                }
            },

            loadIncognito: async () => {
                try {
                    const enabled = await invoke<boolean>('get_incognito_mode');
                    set({ incognitoMode: enabled });
                } catch (e) {
                    console.error('Failed to load incognito mode:', e);
                }
            },

            loadListenToSelf: async () => {
                try {
                    const enabled = await invoke<boolean>('get_listen_to_self');
                    set({ listenToSelf: enabled });
                } catch (e) {
                    console.error('Failed to load listen to self setting:', e);
                }
            },

            applyTheme: () => {
                const { theme } = get();
                const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                const isDark = theme === 'dark' || (theme === 'system' && systemDark);
                document.body.classList.toggle('dark', isDark);
            },
        }),
        {
            name: 'reclip-settings',
            partialize: (state) => ({
                compactMode: state.compactMode,
                theme: state.theme,
                useSystemAccent: state.useSystemAccent,
                accentColor: state.accentColor,
                queueMode: state.queueMode,
                showTimeline: state.showTimeline,
                showOnboarding: state.showOnboarding,
                multiWindow: state.multiWindow,
                dateFormat: state.dateFormat,
                autoHideDuration: state.autoHideDuration,
                listenToSelf: state.listenToSelf,
            }),
        }
    )
);
