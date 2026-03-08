import { create } from 'zustand';
import { Note, Reminder } from '../types';
import { invoke } from '@tauri-apps/api/core';

type ItemType = 'all' | 'note' | 'reminder' | 'alarm';

interface Alarm {
    id: number;
    time: string;
    label: string;
    active: boolean;
}

interface OrganizerState {
    notes: Note[];
    reminders: Reminder[];
    alarms: Alarm[];
    filter: ItemType | 'archived';
    searchQuery: string;
    sortMode: 'date' | 'manual';

    // Actions
    setNotes: (notes: Note[]) => void;
    setReminders: (reminders: Reminder[]) => void;
    setAlarms: (alarms: Alarm[]) => void;
    setFilter: (filter: ItemType | 'archived') => void;
    setSearchQuery: (query: string) => void;
    setSortMode: (mode: 'date' | 'manual') => void;

    // Async Actions
    loadData: () => Promise<void>;
    togglePin: (id: number) => Promise<void>;
    archiveNote: (id: number) => Promise<void>;
    deleteItem: (type: 'note' | 'reminder' | 'alarm', id: number) => Promise<void>;
}

export const useOrganizerStore = create<OrganizerState>((set, get) => ({
    notes: [],
    reminders: [],
    alarms: [],
    filter: 'all',
    searchQuery: '',
    sortMode: 'date',

    setNotes: (notes) => set({ notes }),
    setReminders: (reminders) => set({ reminders }),
    setAlarms: (alarms) => set({ alarms }),
    setFilter: (filter) => set({ filter }),
    setSearchQuery: (searchQuery) => set({ searchQuery }),
    setSortMode: (sortMode) => set({ sortMode }),

    loadData: async () => {
        try {
            const notes = await invoke<Note[]>('get_notes');
            const reminders = await invoke<Reminder[]>('get_reminders');
            const alarms = await invoke<Alarm[]>('get_alarms');
            set({ notes, reminders, alarms });
        } catch (e) {
            console.error('Failed to load organizer data:', e);
        }
    },

    togglePin: async (id) => {
        try {
            await invoke('toggle_note_pin', { id });
            set((state) => ({
                notes: state.notes.map(n => n.id === id ? { ...n, is_pinned: !n.is_pinned } : n)
            }));
        } catch (e) {
            console.error('Failed to toggle pin:', e);
        }
    },

    archiveNote: async (id) => {
        try {
            await invoke('toggle_note_archive', { id });
            set((state) => ({
                notes: state.notes.map(n => n.id === id ? { ...n, is_archived: !n.is_archived } : n)
            }));
        } catch (e) {
            console.error('Failed to archive note:', e);
        }
    },

    deleteItem: async (type, id) => {
        try {
            const command = type === 'note' ? 'delete_note' : type === 'reminder' ? 'delete_reminder' : 'delete_alarm';
            await invoke(command, { id });
            set((state) => ({
                notes: type === 'note' ? state.notes.filter(n => n.id !== id) : state.notes,
                reminders: type === 'reminder' ? state.reminders.filter(r => r.id !== id) : state.reminders,
                alarms: type === 'alarm' ? state.alarms.filter(a => a.id !== id) : state.alarms,
            }));
        } catch (e) {
            console.error(`Failed to delete ${type}:`, e);
        }
    }
}));
