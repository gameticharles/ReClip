import { create } from 'zustand';
import { Snippet } from '../types';
import { invoke } from '@tauri-apps/api/core';

interface SnippetState {
    snippets: Snippet[];
    search: string;
    filterLanguage: string;
    filterFolder: string;
    sortBy: 'updated' | 'created' | 'title' | 'language';
    showFavoritesOnly: boolean;
    expandedId: number | null;
    templates: any[];

    // Actions
    setSnippets: (snippets: Snippet[]) => void;
    setSearch: (search: string) => void;
    setFilterLanguage: (lang: string) => void;
    setFilterFolder: (folder: string) => void;
    setSortBy: (sort: 'updated' | 'created' | 'title' | 'language') => void;
    setShowFavoritesOnly: (show: boolean) => void;
    setExpandedId: (id: number | null) => void;

    // Async Actions
    loadSnippets: () => Promise<void>;
    loadTemplates: () => Promise<void>;
    toggleFavorite: (id: number) => Promise<void>;
    deleteSnippet: (id: number) => Promise<void>;
}

export const useSnippetStore = create<SnippetState>((set, get) => ({
    snippets: [],
    search: '',
    filterLanguage: '',
    filterFolder: '',
    sortBy: 'updated',
    showFavoritesOnly: false,
    expandedId: null,
    templates: [],

    setSnippets: (snippets) => set({ snippets }),
    setSearch: (search) => set({ search }),
    setFilterLanguage: (filterLanguage) => set({ filterLanguage }),
    setFilterFolder: (filterFolder) => set({ filterFolder }),
    setSortBy: (sortBy) => set({ sortBy }),
    setShowFavoritesOnly: (showFavoritesOnly) => set({ showFavoritesOnly }),
    setExpandedId: (expandedId) => set({ expandedId }),

    loadSnippets: async () => {
        try {
            const snippets = await invoke<Snippet[]>('get_snippets');
            set({ snippets });
        } catch (e) {
            console.error('Failed to load snippets:', e);
        }
    },

    loadTemplates: async () => {
        try {
            const templates = await invoke<any[]>('get_templates');
            set({ templates });
        } catch (e) {
            console.error('Failed to load templates:', e);
        }
    },

    toggleFavorite: async (id) => {
        try {
            const success = await invoke<boolean>('toggle_snippet_favorite', { id });
            if (success) {
                set((state) => ({
                    snippets: state.snippets.map(s => s.id === id ? { ...s, favorite: !s.favorite } : s)
                }));
            }
        } catch (e) {
            console.error('Failed to toggle favorite:', e);
        }
    },

    deleteSnippet: async (id) => {
        try {
            await invoke('delete_snippet', { id });
            set((state) => ({
                snippets: state.snippets.filter(s => s.id !== id),
                expandedId: state.expandedId === id ? null : state.expandedId
            }));
        } catch (e) {
            console.error('Failed to delete snippet:', e);
        }
    }
}));
