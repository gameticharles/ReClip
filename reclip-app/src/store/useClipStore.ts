import { create } from 'zustand';
import { Clip } from '../types';
import { invoke } from '@tauri-apps/api/core';

interface ClipState {
    clips: Clip[];
    allClips: Clip[];
    totalClipCount: number;
    searchTerm: string;
    activeFilter: string;
    selectedClipIds: Set<number>;
    lastSelectedId: number | null;
    selectedIndex: number;
    pasteQueue: Clip[];
    page: number;
    hasMore: boolean;
    isLoading: boolean;
    timelineFilter: { start: number; end: number } | null;

    // Actions
    setClips: (clips: Clip[] | ((prev: Clip[]) => Clip[])) => void;
    addClips: (clips: Clip[]) => void;
    setAllClips: (clips: Clip[] | ((prev: Clip[]) => Clip[])) => void;
    setTotalClipCount: (count: number | ((prev: number) => number)) => void;
    setSearchTerm: (term: string) => void;
    setActiveFilter: (filter: string) => void;
    setSelectedClipIds: (ids: Set<number> | ((prev: Set<number>) => Set<number>)) => void;
    setLastSelectedId: (id: number | null | ((prev: number | null) => number | null)) => void;
    setSelectedIndex: (index: number | ((prev: number) => number)) => void;
    setPasteQueue: (queue: Clip[] | ((prev: Clip[]) => Clip[])) => void;
    setPage: (page: number | ((prev: number) => number)) => void;
    setHasMore: (hasMore: boolean | ((prev: boolean) => boolean)) => void;
    setIsLoading: (isLoading: boolean | ((prev: boolean) => boolean)) => void;
    setTimelineFilter: (filter: { start: number; end: number } | null) => void;

    // Async Actions
    loadClips: (page: number, limit: number, filter: string, search: string, reset?: boolean) => Promise<void>;
    clearClips: () => Promise<void>;
    deleteClips: (ids: number[]) => Promise<void>;
}

export const useClipStore = create<ClipState>((set, get) => ({
    clips: [],
    allClips: [],
    totalClipCount: 0,
    searchTerm: '',
    activeFilter: 'all',
    selectedClipIds: new Set(),
    lastSelectedId: null,
    selectedIndex: -1,
    pasteQueue: [],
    page: 0,
    hasMore: true,
    isLoading: false,
    timelineFilter: null,

    setClips: (clips) => set((state) => ({ clips: typeof clips === 'function' ? clips(state.clips) : clips })),
    addClips: (newClips) => set((state) => ({ clips: [...state.clips, ...newClips] })),
    setAllClips: (allClips) => set((state) => ({ allClips: typeof allClips === 'function' ? allClips(state.allClips) : allClips })),
    setTotalClipCount: (totalClipCount) => set((state) => ({ totalClipCount: typeof totalClipCount === 'function' ? totalClipCount(state.totalClipCount) : totalClipCount })),
    setSearchTerm: (searchTerm) => set({ searchTerm, page: 0, clips: [] }),
    setActiveFilter: (activeFilter) => set({ activeFilter, page: 0, clips: [] }),
    setSelectedClipIds: (selectedClipIds) => set((state) => ({ selectedClipIds: typeof selectedClipIds === 'function' ? selectedClipIds(state.selectedClipIds) : selectedClipIds })),
    setLastSelectedId: (lastSelectedId) => set((state) => ({ lastSelectedId: typeof lastSelectedId === 'function' ? lastSelectedId(state.lastSelectedId) : lastSelectedId })),
    setSelectedIndex: (selectedIndex) => set((state) => ({ selectedIndex: typeof selectedIndex === 'function' ? selectedIndex(state.selectedIndex) : selectedIndex })),
    setPasteQueue: (queue) => set((state) => ({ pasteQueue: typeof queue === 'function' ? queue(state.pasteQueue) : queue })),
    setPage: (page) => set((state) => ({ page: typeof page === 'function' ? page(state.page) : page })),
    setHasMore: (hasMore) => set((state) => ({ hasMore: typeof hasMore === 'function' ? hasMore(state.hasMore) : hasMore })),
    setIsLoading: (isLoading) => set((state) => ({ isLoading: typeof isLoading === 'function' ? isLoading(state.isLoading) : isLoading })),
    setTimelineFilter: (timelineFilter) => set({ timelineFilter }),

    loadClips: async (page, limit, filter, search, reset = false) => {
        set({ isLoading: true });
        try {
            const currentOffset = page * limit;
            const typeFilter = filter === 'all' || filter === 'favorites' ? null : filter;
            const favoritesOnly = filter === 'favorites';

            const newClips = await invoke<Clip[]>("get_recent_clips", {
                limit: limit,
                offset: currentOffset,
                search: search || null,
                typeFilter: typeFilter,
                favoritesOnly: favoritesOnly,
            });

            const hasMore = newClips.length >= limit;

            if (reset || page === 0) {
                let filteredClips = newClips;
                const timeline = get().timelineFilter;
                if (timeline) {
                    filteredClips = newClips.filter(clip => {
                        const clipDate = new Date(clip.created_at).getTime();
                        return clipDate >= timeline.start && clipDate <= timeline.end;
                    });
                }

                set({
                    clips: filteredClips,
                    allClips: newClips,
                    hasMore,
                    page: 1
                });

                // Fetch total count for stats
                const stats = await invoke<{ total_count: number }>("get_clip_stats", { search: search || null });
                set({ totalClipCount: stats.total_count });
            } else {
                set((state) => {
                    const combinedAll = [...state.allClips, ...newClips];
                    const uniqueAll = Array.from(new Map(combinedAll.map(c => [c.id, c])).values());

                    let filteredClips = uniqueAll;
                    if (state.timelineFilter) {
                        filteredClips = uniqueAll.filter(clip => {
                            const clipDate = new Date(clip.created_at).getTime();
                            return clipDate >= state.timelineFilter!.start && clipDate <= state.timelineFilter!.end;
                        });
                    }

                    return {
                        allClips: uniqueAll,
                        clips: filteredClips,
                        hasMore,
                        page: state.page + 1
                    };
                });
            }
        } catch (e) {
            console.error('Failed to load clips:', e);
        } finally {
            set({ isLoading: false });
        }
    },

    clearClips: async () => {
        try {
            await invoke('clear_all_clips');
            set({ clips: [], allClips: [], totalClipCount: 0, page: 0 });
        } catch (e) {
            console.error('Failed to clear clips:', e);
        }
    },

    deleteClips: async (ids) => {
        try {
            await invoke('delete_clips', { ids });
            set((state) => ({
                clips: state.clips.filter(c => !ids.includes(c.id)),
                allClips: state.allClips.filter(c => !ids.includes(c.id)),
                totalClipCount: state.totalClipCount - ids.length
            }));
        } catch (e) {
            console.error('Failed to delete clips:', e);
        }
    }
}));
