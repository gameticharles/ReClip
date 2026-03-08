import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { save } from "@tauri-apps/plugin-dialog";
import { Clip } from "../types";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { DragDropContext, Droppable, DropResult } from "@hello-pangea/dnd";
import { QRModal } from "./QRModal";
import TimelineView from "./TimelineView";
import ClipEditDialog from "./ClipEditDialog";
import ImageZoomModal from "./ImageZoomModal";
import ImageEditorModal from "./ImageEditorModal";
import { ToastContainer, useToasts } from "./Toast";
import { useSettingsStore } from "../store/useSettingsStore";
import { useClipStore } from "../store/useClipStore";
import { ClipCard } from "./ClipCard";
import { SearchBar } from "./SearchBar";
import { FilterChips } from "./FilterChips";
import { BulkActionsBar } from "./BulkActionsBar";
import { MergeDialog } from "./MergeDialog";
import { EmptyFeedState, EmptySearchState, EmptyFavoritesState } from "./EmptyStates";
import "./MainView.css";

const isUrl = (text: string) => {
    try {
        const url = new URL(text);
        return ['http:', 'https:'].includes(url.protocol);
    } catch {
        return false;
    }
};

const isColorCode = (text: string) => {
    return /^(#[0-9A-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\))$/i.test(text.trim());
};

export default function MainView() {
    const {
        compactMode, queueMode, showTimeline,
        dateFormat, autoHideDuration, theme
    } = useSettingsStore();

    const {
        clips, loadClips, searchTerm, setSearchTerm,
        activeFilter, setActiveFilter, selectedIndex, setSelectedIndex,
        selectedClipIds, setSelectedClipIds, lastSelectedId, setLastSelectedId,
        pasteQueue, setPasteQueue, hasMore, isLoading,
        allClips, timelineFilter, setTimelineFilter, totalClipCount
    } = useClipStore();

    const [focusOnDelete, setFocusOnDelete] = useState(false);
    const { toasts, addToast, dismissToast } = useToasts();
    const [showMergeDialog, setShowMergeDialog] = useState(false);
    const [mergeSeparator, setMergeSeparator] = useState('\n');

    const searchInputRef = useRef<HTMLInputElement>(null);
    const clipListRef = useRef<HTMLDivElement>(null);

    // Menu & QR
    const [activeMenuId, setActiveMenuId] = useState<number | null>(null);
    const [qrContent, setQrContent] = useState<string | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const [shortcuts, setShortcuts] = useState<Record<string, string>>({});

    const [rawViewClipIds, setRawViewClipIds] = useState<Set<number>>(new Set());
    const [systemDark, setSystemDark] = useState(window.matchMedia('(prefers-color-scheme: dark)').matches);
    const [editingClip, setEditingClip] = useState<Clip | null>(null);
    const [extractingOcrClipId, setExtractingOcrClipId] = useState<number | null>(null);
    const [zoomedImageSrc, setZoomedImageSrc] = useState<string | null>(null);
    const [editingImageSrc, setEditingImageSrc] = useState<{ src: string, clipId: number } | null>(null);
    const isDark = theme === 'dark' || (theme === 'system' && systemDark);

    const loaderRef = useRef<HTMLDivElement>(null);
    const LIMIT = 30;

    const [showTooltipPreview, setShowTooltipPreview] = useState(() =>
        localStorage.getItem('showTooltipPreview') === 'true'
    );

    // Listen for tooltip setting changes
    useEffect(() => {
        const handler = () => setShowTooltipPreview(localStorage.getItem('showTooltipPreview') === 'true');
        window.addEventListener('storage', handler);
        return () => window.removeEventListener('storage', handler);
    }, []);

    // Clip stats and shortcuts are still fetched locally if needed, 
    // but loadClips handles totalClipCount now.

    const fetchShortcuts = async () => {
        try {
            const map = await invoke<Record<string, string>>("get_shortcuts");
            setShortcuts(map);
        } catch (e) {
            console.error("Failed to fetch shortcuts", e);
        }
    };

    useEffect(() => {
        fetchShortcuts();
        // Listen for system theme changes
        const media = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
        media.addEventListener('change', handler);
        return () => media.removeEventListener('change', handler);
    }, []);

    // Persistence Effects
    // Persistence Effects - Remvoed (Lifted to App.tsx)

    // Helper for time ago
    const formatTime = (dateStr: string) => {
        if (dateFormat === 'absolute') return dateStr;
        const date = new Date(dateStr + "Z"); // Ensure UTC if DB stores UTC without Z, but standard is UTC ISO
        const now = new Date();
        const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (isNaN(diffSeconds)) return dateStr; // Fallback

        if (diffSeconds < 60) return `${diffSeconds}s ago`;
        if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
        if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
        if (diffSeconds < 2592000) return `${Math.floor(diffSeconds / 86400)}d ago`; // ~30 days
        if (diffSeconds < 31536000) return `${Math.floor(diffSeconds / 2592000)}mo ago`; // ~365 days
        return `${Math.floor(diffSeconds / 31536000)}y ago`;
    };

    // Auto-hide Effect
    useEffect(() => {
        if (autoHideDuration > 0) {
            let timer: number;
            const resetTimer = () => {
                window.clearTimeout(timer);
                timer = window.setTimeout(() => {
                    getCurrentWindow().hide();
                }, autoHideDuration * 1000);
            };

            window.addEventListener('mousemove', resetTimer);
            window.addEventListener('keydown', resetTimer);
            resetTimer();

            return () => {
                window.clearTimeout(timer);
                window.removeEventListener('mousemove', resetTimer);
                window.removeEventListener('keydown', resetTimer);
            };
        }
    }, [autoHideDuration]);

    useEffect(() => {
        // Settings are now handled by Zustand persist
    }, []);

    const addToQueue = (clip: Clip) => {
        setPasteQueue(prev => {
            if (!prev.find(c => c.id === clip.id)) {
                return [...prev, clip];
            }
            return prev;
        });
    };



    const pasteNextInQueue = async () => {
        if (pasteQueue.length === 0) return;
        const next = pasteQueue[0];
        await pasteClip(next.content, next.type);
        setPasteQueue(pasteQueue.slice(1));
    };

    // Handle click on clip card
    const handleClipClick = (e: React.MouseEvent, clip: Clip) => {
        if (e.ctrlKey || e.shiftKey) {
            e.preventDefault();
            const newSelected = new Set(selectedClipIds);

            if (e.shiftKey && lastSelectedId !== null) {
                // Range selection
                const startIdx = clips.findIndex(c => c.id === lastSelectedId);
                const endIdx = clips.findIndex(c => c.id === clip.id);
                if (startIdx !== -1 && endIdx !== -1) {
                    const min = Math.min(startIdx, endIdx);
                    const max = Math.max(startIdx, endIdx);
                    for (let i = min; i <= max; i++) {
                        newSelected.add(clips[i].id);
                    }
                }
            } else if (e.ctrlKey) {
                // Toggle selection
                if (newSelected.has(clip.id)) {
                    newSelected.delete(clip.id);
                } else {
                    newSelected.add(clip.id);
                    setLastSelectedId(clip.id);
                }
            }

            // If nothing was selected before, and we just selected one, make sure lastSelected is updated
            if (selectedClipIds.size === 0 && e.shiftKey) {
                newSelected.add(clip.id);
                setLastSelectedId(clip.id);
            }

            setSelectedClipIds(newSelected);
            setSelectedClipIds(newSelected);
        } else {
            if (queueMode) {
                addToQueue(clip);
                // Visual feedback? relying on UI to show queue
            } else {
                setSelectedClipIds(new Set());
                setLastSelectedId(null);
                pasteClip(clip.content, clip.type);
            }
        }
    };

    // Keyboard navigation handler
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const isInputFocused = document.activeElement?.tagName === 'INPUT';

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (isInputFocused) searchInputRef.current?.blur();
                setSelectedIndex(prev => Math.min(prev + 1, clips.length - 1));
                setFocusOnDelete(false);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (selectedIndex <= 0 && searchInputRef.current) {
                    setSelectedIndex(-1);
                    searchInputRef.current.focus();
                } else {
                    setSelectedIndex(prev => Math.max(prev - 1, 0));
                }
                setFocusOnDelete(false);
            } else if (e.key === 'ArrowRight' && selectedIndex >= 0) {
                e.preventDefault();
                setFocusOnDelete(true);
            } else if (e.key === 'ArrowLeft' && selectedIndex >= 0) {
                e.preventDefault();
                setFocusOnDelete(false);
            } else if ((e.key === 'Enter' || e.key === ' ') && selectedIndex >= 0 && !isInputFocused) {
                e.preventDefault();
                const selectedClip = clips[selectedIndex];
                if (selectedClip) {
                    if (focusOnDelete) {
                        invoke("delete_clip", { id: selectedClip.id }).then(() => {
                            useClipStore.getState().setClips(clips.filter(c => c.id !== selectedClip.id));
                            setSelectedIndex(prev => Math.min(prev, clips.length - 2));
                            setFocusOnDelete(false);
                        });
                    } else {
                        pasteClip(selectedClip.content, selectedClip.type);
                    }
                }
            } else if (e.ctrlKey && e.key >= '1' && e.key <= '9') {
                const index = parseInt(e.key) - 1;
                const targetClip = clips[index];
                if (targetClip) {
                    setSelectedIndex(index);
                    setTimeout(() => pasteClip(targetClip.content, targetClip.type), 50);
                }
            } else if (e.key === 'Escape') {
                setSelectedIndex(-1);
                setFocusOnDelete(false);
                searchInputRef.current?.blur();
            } else if (!isInputFocused && !e.ctrlKey && !e.altKey && !e.metaKey && e.key.length === 1) {
                searchInputRef.current?.focus();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [clips, selectedIndex, focusOnDelete]);

    // Close menu on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setActiveMenuId(null);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Scroll selected clip into view
    useEffect(() => {
        if (selectedIndex >= 0 && clipListRef.current) {
            const clipCards = clipListRef.current.querySelectorAll('.clip-card');
            clipCards[selectedIndex]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, [selectedIndex]);

    const handleExtractText = async (e: React.MouseEvent, clip: Clip) => {
        e.stopPropagation();
        setExtractingOcrClipId(clip.id);
        try {
            const text = await invoke<string>('run_ocr', { path: clip.content });
            if (text) {
                await invoke('copy_to_system', { content: text });
            }
        } catch (error) {
            console.error("OCR Failed", error);
        } finally {
            setExtractingOcrClipId(null);
        }
        setActiveMenuId(null);
    };

    // Loading logic is now handled by useClipStore.loadClips

    useEffect(() => {
        const timer = setTimeout(() => {
            loadClips(0, LIMIT, activeFilter, searchTerm, true);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm, activeFilter, timelineFilter, loadClips]);

    // Infinite Scroll Observer removed - using loadClips

    // Infinite Scroll Observer
    useEffect(() => {
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && hasMore && !isLoading) {
                // Determine current page from clips length (or store page)
                const currentPage = Math.floor(clips.length / LIMIT);
                loadClips(currentPage, LIMIT, activeFilter, searchTerm, false);
            }
        }, { threshold: 0.1 });

        if (loaderRef.current) observer.observe(loaderRef.current);
        return () => observer.disconnect();
    }, [hasMore, isLoading, searchTerm, clips.length, activeFilter, loadClips]);

    const clipsRef = useRef(clips);
    useEffect(() => { clipsRef.current = clips; }, [clips]);

    useEffect(() => {
        let unlistenCreate: (() => void) | null = null;
        let unlistenPasteNext: (() => void) | null = null;
        let unlistenPasteIndex: (() => void) | null = null;

        const setup = async () => {
            // Initial fetch handled by searchTerm effect or manual call?
            // searchTerm defaults to "", so the effect above runs on mount.
            // But we can call it here to be safe.
            // fetchClips(); // <-- Removing this to avoid double fetch on mount


            unlistenCreate = await listen("clip-created", (_event) => {
                loadClips(0, LIMIT, activeFilter, searchTerm, true);
                // Refresh tray clips
                invoke('refresh_tray_clips').catch(e => console.warn('Tray refresh failed:', e));
            });


            unlistenPasteNext = await listen("paste-next-trigger", (_event) => {
                document.getElementById('hidden-paste-next-btn')?.click();
            });

            unlistenPasteIndex = await listen("paste-index-trigger", (event) => {
                const index = (event.payload as number) - 1; // 1-based to 0-based
                const currentClips = clipsRef.current;
                if (index >= 0 && index < currentClips.length) {
                    const item = currentClips[index];
                    invoke("paste_clip_to_system", { content: item.content, clipType: item.type }).then(() => {
                        // Optional: move window to back / hide?
                    });
                }
            });
        };

        setup();

        return () => {
            if (unlistenCreate) unlistenCreate();
            if (unlistenPasteNext) unlistenPasteNext();
            if (unlistenPasteIndex) unlistenPasteIndex();
        };
    }, []);

    async function pasteClip(content: string, clipType: string = 'text') {
        let finalContent = content;
        if (clipType === 'text' && content.includes('{{')) {
            const date = new Date();
            finalContent = finalContent
                .replace(/{{date}}/g, date.toISOString().split('T')[0])
                .replace(/{{time}}/g, date.toTimeString().split(' ')[0].substring(0, 5))
                .replace(/{{datetime}}/g, date.toLocaleString());

            const regex = /{{(.*?)}}/g;
            let match;
            const placeholders = new Set<string>();
            while ((match = regex.exec(content)) !== null) {
                if (!['date', 'time', 'datetime'].includes(match[1])) {
                    placeholders.add(match[1]);
                }
            }

            for (const ph of placeholders) {
                const value = prompt(`Enter value for ${ph}:`, "");
                if (value === null) return;
                const phRegex = new RegExp(`{{${ph}}}`, 'g');
                finalContent = finalContent.replace(phRegex, value);
            }
        }

        try {
            await invoke("paste_clip_to_system", { content: finalContent, clipType });
        } catch (error) {
            console.error("Failed to paste:", error);
        }
    }

    async function deleteClip(e: React.MouseEvent, id: number) {
        e.stopPropagation();
        const clipToDelete = clips.find(c => c.id === id);
        if (!clipToDelete) return;
        const clipIndex = clips.findIndex(c => c.id === id);

        // Optimistic UI update: Remove from store local view
        useClipStore.getState().setClips(clips.filter(c => c.id !== id));

        // Show undo toast
        const timeoutId = setTimeout(async () => {
            try {
                await invoke("delete_clip", { id });
                // If search is active, we might need a refresh to keep stats in sync,
                // but for simple cases this is fine.
            } catch (error) {
                console.error("Failed to delete clip:", error);
            }
        }, 5000);

        addToast(`Clip deleted`, {
            duration: 5000,
            action: {
                label: 'Undo',
                onClick: () => {
                    clearTimeout(timeoutId);
                    // Restore clip to original position in store
                    useClipStore.getState().setClips(prev => {
                        const restored = [...prev];
                        // Ensure it goes back to the exact same index
                        const insertAt = Math.min(clipIndex, restored.length);
                        restored.splice(insertAt, 0, clipToDelete);
                        return restored;
                    });
                }
            }
        });
    }

    async function addTagToClip(e: React.MouseEvent, id: number, currentTags: string | null) {
        e.stopPropagation();
        const tagInput = prompt("Enter tag (without #):", "");
        if (tagInput && tagInput.trim()) {
            const newTag = `#${tagInput.trim().replace(/^#/, '')}`;
            const existingTags: string[] = currentTags ? JSON.parse(currentTags) : [];
            if (!existingTags.includes(newTag)) {
                existingTags.push(newTag);
                const updatedTags = JSON.stringify(existingTags);
                try {
                    await invoke("update_clip_tags", { id, tags: updatedTags });
                    useClipStore.getState().setClips(clips.map(c => c.id === id ? { ...c, tags: updatedTags } : c));
                } catch (error) {
                    console.error("Failed to add tag:", error);
                }
            }
        }
    }

    async function togglePin(e: React.MouseEvent, id: number) {
        e.stopPropagation();
        try {
            const newPinned = await invoke<boolean>("toggle_clip_pin", { id });
            useClipStore.getState().setClips(clips.map(c => c.id === id ? { ...c, pinned: newPinned } : c));
        } catch (error) {
            console.error("Failed to toggle pin:", error);
        }
    }

    const handleUpdateContent = async (newContent: string) => {
        if (!editingClip) return;
        try {
            await invoke('update_clip_content', { id: editingClip.id, content: newContent });

            // Update local state
            const updatedClips = clips.map(c => c.id === editingClip.id ? { ...c, content: newContent } : c);
            useClipStore.getState().setClips(updatedClips);
            useClipStore.getState().setAllClips(allClips.map(c => c.id === editingClip.id ? { ...c, content: newContent } : c));

        } catch (error) {
            console.error('Failed to update clip content:', error);
            throw error;
        }
    };

    function filterByTag(tag: string) {
        setSearchTerm(tag);
    }

    async function bulkPaste() {
        const selected = clips.filter(c => selectedClipIds.has(c.id));
        if (selected.length === 0) return;
        const content = selected.map(c => c.content).join('\n');
        await pasteClip(content, 'text');
        setSelectedClipIds(new Set());
        setLastSelectedId(null);
    }

    async function bulkDelete() {
        if (!confirm(`Delete ${selectedClipIds.size} clips?`)) return;
        const idsToDelete = Array.from(selectedClipIds);
        useClipStore.getState().setClips(clips.filter(c => !selectedClipIds.has(c.id)));
        setSelectedClipIds(new Set());
        setLastSelectedId(null);
        for (const id of idsToDelete) {
            try {
                await invoke("delete_clip", { id });
            } catch (e) {
                console.error(`Failed to delete clip ${id}:`, e);
            }
        }
    }

    async function mergeSelectedClips() {
        const selected = clips.filter(c => selectedClipIds.has(c.id));
        if (selected.length < 2) return;
        const merged = selected.map(c => c.content).join(mergeSeparator);
        try {
            await invoke('copy_to_system', { content: merged });
            addToast(`Merged ${selected.length} clips to clipboard`);
        } catch (e) {
            console.error('Failed to merge clips:', e);
        }
        setShowMergeDialog(false);
        setSelectedClipIds(new Set());
        setLastSelectedId(null);
    }

    async function bulkTransformText(type: 'upper' | 'lower' | 'title' | 'trim') {
        const selected = clips.filter(c => selectedClipIds.has(c.id) && c.type === 'text');
        if (selected.length === 0) return;

        let updatedCount = 0;
        const newClips = [...clips];

        for (const clip of selected) {
            let newContent = clip.content;
            switch (type) {
                case 'upper': newContent = newContent.toUpperCase(); break;
                case 'lower': newContent = newContent.toLowerCase(); break;
                case 'title': newContent = newContent.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()); break;
                case 'trim': newContent = newContent.trim(); break;
            }

            if (newContent !== clip.content) {
                try {
                    await invoke("update_clip_content", { id: clip.id, content: newContent });
                    const index = newClips.findIndex(c => c.id === clip.id);
                    if (index !== -1) {
                        newClips[index] = { ...newClips[index], content: newContent };
                    }
                    updatedCount++;
                } catch (error) {
                    console.error(`Failed to transform text for clip ${clip.id}:`, error);
                }
            }
        }

        if (updatedCount > 0) {
            useClipStore.getState().setClips(newClips);
            addToast(`Transformed ${updatedCount} clips`);
        }
    }


    // toggleIncognito removed (lifted)

    async function moveToTop(e: React.MouseEvent, id: number) {
        e.stopPropagation();
        try {
            // Set position to current timestamp to make it highest priority
            const position = Date.now();
            await invoke("reorder_clip", { id, position });
            // Refresh clips
            loadClips(0, LIMIT, activeFilter, searchTerm, true);
        } catch (error) {
            console.error("Failed to reorder clip:", error);
        }
    }

    async function transformText(e: React.MouseEvent, id: number, type: 'upper' | 'lower' | 'title' | 'trim') {
        e.stopPropagation();
        const clip = clips.find(c => c.id === id);
        if (!clip || clip.type !== 'text') return;

        let newContent = clip.content;
        switch (type) {
            case 'upper': newContent = newContent.toUpperCase(); break;
            case 'lower': newContent = newContent.toLowerCase(); break;
            case 'title': newContent = newContent.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()); break;
            case 'trim': newContent = newContent.trim(); break;
        }

        if (newContent !== clip.content) {
            try {
                await invoke("update_clip_content", { id, content: newContent });
                useClipStore.getState().setClips(clips.map(c => c.id === id ? { ...c, content: newContent } : c));
            } catch (error) {
                console.error("Failed to transform text:", error);
            }
        }
    }

    async function toggleFavorite(e: React.MouseEvent, id: number) {
        e.stopPropagation();
        try {
            const newStatus = await invoke<boolean>("toggle_clip_favorite", { id });
            useClipStore.getState().setClips(clips.map(c => c.id === id ? { ...c, favorite: newStatus } : c));
        } catch (error) {
            console.error("Failed to toggle favorite:", error);
        }
    }

    const onDragEnd = async (result: DropResult) => {
        if (!result.destination) return;
        const sourceIndex = result.source.index;
        const destIndex = result.destination.index;

        if (sourceIndex === destIndex) return;

        // Optimistic reorder
        const newClips = Array.from(clips);
        const [movedClip] = newClips.splice(sourceIndex, 1);
        newClips.splice(destIndex, 0, movedClip);
        useClipStore.getState().setClips(newClips);

        // Calculate new position
        // Logic: position = (prev.pos + next.pos) / 2
        // If undefined, we need defaults.
        // Backend sorts: favorite > pinned > position > created_at
        // We assume we are reordering within the same 'group' (e.g. unpinned items).

        let newPosition = 0;
        const prevClip = newClips[destIndex - 1];
        const nextClip = newClips[destIndex + 1];


        // Wait, default sort is Position DESC? If items have position=NULL (0), they are at bottom?
        // Let's assume default "high" is Date.now() (which is ~1.7e12).

        // Strategy:
        // Top of list: (next.position ?? 0) + 1000000;
        // Bottom of list: (prev.position ?? Date.now()) - 1000000;
        // Middle: (prev.pos + next.pos) / 2

        // Wait, if next.position is NULL (0), and we drag to top.
        // We want > 0. 1000000.

        const getPos = (c?: Clip) => c?.position ?? 0;

        if (!prevClip) {
            // Moved to top
            newPosition = getPos(nextClip) + 1000000;
            // If nextClip also 0/null? 
            if (newPosition === 1000000 && getPos(nextClip) === 0) newPosition = Date.now();
        } else if (!nextClip) {
            // Moved to bottom
            newPosition = getPos(prevClip) - 1000000;
        } else {
            // Between two
            newPosition = Math.floor((getPos(prevClip) + getPos(nextClip)) / 2);
        }

        try {
            await invoke("reorder_clip", { id: movedClip.id, position: Math.floor(newPosition) });
        } catch (e) {
            console.error("Failed to persist drag order", e);
        }
    };

    // Load incognito state on mount
    // Load incognito state on mount - removed (handled in App.tsx)

    return (
        <>

            <main className="container">
                {/* Search and Stats Bar */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    marginTop: '8px',
                    marginBottom: '12px',
                    padding: '10px 14px',
                    marginRight: '16px',
                    background: 'var(--bg-card)',
                    borderRadius: '12px',
                    boxShadow: 'var(--shadow-sm)',
                    flexDirection: 'column',
                    gap: '8px',
                }}>
                    <SearchBar
                        searchTerm={searchTerm}
                        setSearchTerm={setSearchTerm}
                        totalClipCount={totalClipCount}
                        foundCount={clips.length}
                        pinnedCount={clips.filter(c => c.pinned).length}
                        favoriteCount={clips.filter(c => c.favorite).length}
                        inputRef={searchInputRef}
                    />
                    <FilterChips
                        activeFilter={activeFilter}
                        setActiveFilter={setActiveFilter}
                    />
                </div>

                {/* Timeline View */}
                <TimelineView
                    clips={allClips}
                    totalCount={totalClipCount}
                    visible={showTimeline}
                    onSelectTimeRange={(start, end) => {
                        if (start && end) {
                            setTimelineFilter({ start: start.getTime(), end: end.getTime() });
                        } else {
                            setTimelineFilter(null);
                        }
                    }}
                    onSelectDate={(date) => {
                        // Set timeline filter for the selected day
                        const startOfDay = new Date(date);
                        startOfDay.setHours(0, 0, 0, 0);
                        const endOfDay = new Date(date);
                        endOfDay.setHours(23, 59, 59, 999);
                        setTimelineFilter({ start: startOfDay.getTime(), end: endOfDay.getTime() });
                        // Also fetch clips for that day with reset
                        setSearchTerm(''); // Clear any search
                        loadClips(0, LIMIT, activeFilter, '', true);
                    }}
                    onExportRange={(rangeClips) => {
                        // Trigger export of selected clips
                        if (rangeClips.length > 0) {
                            const content = rangeClips.map(c => c.content).join('\n---\n');
                            navigator.clipboard.writeText(content);
                            console.log(`Exported ${rangeClips.length} clips to clipboard`);
                        }
                    }}
                />
                <DragDropContext onDragEnd={onDragEnd}>
                    <Droppable droppableId="clip-list">
                        {(provided) => (
                            <div
                                ref={(el) => { provided.innerRef(el); clipListRef.current = el; }}
                                {...provided.droppableProps}
                                className={`clip-list ${compactMode ? 'compact' : ''}`}
                            >
                                {clips.map((clip, index) => (
                                    <ClipCard
                                        key={clip.id}
                                        clip={clip}
                                        index={index}
                                        selectedIndex={selectedIndex}
                                        selectedClipIds={selectedClipIds}
                                        compactMode={compactMode}
                                        shortcuts={shortcuts}
                                        isDark={isDark}
                                        extractingOcrClipId={extractingOcrClipId}
                                        activeMenuId={activeMenuId}
                                        rawViewClipIds={rawViewClipIds}
                                        showTooltipPreview={showTooltipPreview}
                                        formatTime={formatTime}
                                        onClipClick={handleClipClick}
                                        onMouseEnter={() => setSelectedIndex(index)}
                                        toggleFavorite={toggleFavorite}
                                        togglePin={togglePin}
                                        moveToTop={moveToTop}
                                        setActiveMenuId={setActiveMenuId}
                                        handleExtractText={handleExtractText}
                                        onEditContent={setEditingClip}
                                        onDelete={deleteClip}
                                        onTagClick={filterByTag}
                                        onAddTag={addTagToClip}
                                        onTransform={transformText}
                                        onZoom={(src) => setZoomedImageSrc(src)}
                                        isUrl={isUrl}
                                        isColorCode={isColorCode}
                                        menuRef={menuRef}
                                        onSaveImage={async (clip) => {
                                            try {
                                                const path = await save({
                                                    defaultPath: 'image.png',
                                                    filters: [
                                                        { name: 'PNG Image', extensions: ['png'] },
                                                        { name: 'JPEG Image', extensions: ['jpg', 'jpeg'] },
                                                        { name: 'WebP Image', extensions: ['webp'] }
                                                    ]
                                                });
                                                if (path) {
                                                    await invoke('export_image', { sourcePath: clip.content, targetPath: path });
                                                    setActiveMenuId(null);
                                                }
                                            } catch (e) {
                                                console.error("Failed to save image", e);
                                            }
                                        }}
                                        onCopyAsText={async (clip) => {
                                            try {
                                                const parser = new DOMParser();
                                                const doc = parser.parseFromString(clip.content, 'text/html');
                                                const text = doc.body.textContent || "";
                                                await invoke('copy_to_system', { content: text });
                                                setActiveMenuId(null);
                                            } catch (error) {
                                                console.error("Failed to copy as text", error);
                                            }
                                        }}
                                        onShowQRCode={(content) => { setQrContent(content); setActiveMenuId(null); }}
                                        onEditImage={(src, clipId) => { if (clipId !== undefined) setEditingImageSrc({ src, clipId }); }}
                                        setRawViewClipIds={setRawViewClipIds}
                                    />
                                ))}
                                {clips.length === 0 && !isLoading && (
                                    <div style={{ marginTop: '20px' }}>
                                        {activeFilter === 'favorites' ? (
                                            <EmptyFavoritesState />
                                        ) : searchTerm ? (
                                            <EmptySearchState />
                                        ) : (
                                            <EmptyFeedState />
                                        )}
                                    </div>
                                )}
                                {provided.placeholder}
                                {hasMore && (
                                    <div ref={loaderRef} style={{ height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.6, fontSize: '0.8rem' }}>
                                        {isLoading ? 'Loading more clips...' : 'Scroll for more'}
                                    </div>
                                )}
                            </div>
                        )}
                    </Droppable>
                </DragDropContext>
            </main >

            <BulkActionsBar
                selectedCount={selectedClipIds.size}
                queuePendingCount={pasteQueue.length}
                queueMode={queueMode}
                onBulkPaste={bulkPaste}
                onShowMergeDialog={() => setShowMergeDialog(true)}
                onBulkDelete={bulkDelete}
                onCancelSelection={() => { setSelectedClipIds(new Set()); setLastSelectedId(null); }}
                onPasteNextInQueue={pasteNextInQueue}
                onClearQueue={() => setPasteQueue([])}
                onBulkTransform={bulkTransformText}
            />

            <MergeDialog
                isOpen={showMergeDialog}
                onClose={() => setShowMergeDialog(false)}
                onMerge={mergeSelectedClips}
                selectedCount={selectedClipIds.size}
                mergeSeparator={mergeSeparator}
                setMergeSeparator={setMergeSeparator}
            />

            {/* QR Code Modal */}
            {qrContent && (
                <QRModal
                    title="Clipboard Content"
                    content={qrContent}
                    onClose={() => setQrContent(null)}
                />
            )}

            <ClipEditDialog
                isOpen={!!editingClip}
                onClose={() => setEditingClip(null)}
                onSave={handleUpdateContent}
                initialContent={editingClip?.content || ''}
                isDark={systemDark}
            />

            {/* Image Zoom Modal */}
            {zoomedImageSrc && (
                <ImageZoomModal
                    src={zoomedImageSrc}
                    onClose={() => setZoomedImageSrc(null)}
                />
            )}

            {/* Image Editor Modal */}
            {editingImageSrc && (
                <ImageEditorModal
                    src={editingImageSrc.src}
                    onClose={() => setEditingImageSrc(null)}
                    onSaveToFeed={async (base64Data) => {
                        try {
                            // Extract just the base64 part if it has a data URI prefix
                            const base64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
                            await invoke('copy_image_to_system', { base64Data: base64 });
                            setEditingImageSrc(null);
                            setActiveMenuId(null);
                            addToast("Image saved to clipboard!");
                            // Wait a moment for clipboard to update, then ReClip will auto-detect it
                            // Or we could trigger a manual refresh here.
                        } catch (err) {
                            console.error("Failed to save edited image", err);
                            addToast("Failed to save image");
                        }
                    }}
                />
            )}

            {/* Toast Notifications */}
            <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        </>
    );
}
