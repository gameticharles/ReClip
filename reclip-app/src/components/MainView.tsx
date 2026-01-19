import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { save } from "@tauri-apps/plugin-dialog";
import { Clip } from "../types";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getVersion } from '@tauri-apps/api/app';
import { motion } from "framer-motion";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { QRModal } from "./QRModal";
import ClipContent, { ImageColorPalette, ImageMetadata } from "./ClipContent";
import { convertFileSrc } from "@tauri-apps/api/core";
import UrlPreview from "./UrlPreview";
import TimelineView from "./TimelineView";
import ClipEditDialog from "./ClipEditDialog";
import ImageZoomModal from "./ImageZoomModal";


interface MainViewProps {
    compactMode: boolean;
    onOpenSettings: () => void;
    onOpenSnippets: () => void;
    onOpenColors: () => void;
}

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

export default function MainView({ compactMode, onOpenSettings, onOpenSnippets, onOpenColors }: MainViewProps) {
    const [clips, setClips] = useState<Clip[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedIndex, setSelectedIndex] = useState(-1); // -1 = none selected
    const [focusOnDelete, setFocusOnDelete] = useState(false); // Left/Right toggle
    const [incognitoMode, setIncognitoMode] = useState(() => localStorage.getItem('incognitoMode') === 'true');
    const [selectedClipIds, setSelectedClipIds] = useState<Set<number>>(new Set());
    const [lastSelectedId, setLastSelectedId] = useState<number | null>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const clipListRef = useRef<HTMLDivElement>(null);

    // Paste Queue
    const [queueMode, setQueueMode] = useState(() => localStorage.getItem('queueMode') === 'true');
    const [pasteQueue, setPasteQueue] = useState<Clip[]>([]);

    // Menu & QR
    const [activeMenuId, setActiveMenuId] = useState<number | null>(null);
    const [qrContent, setQrContent] = useState<string | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    // Timeline View State
    const [showTimeline, setShowTimeline] = useState(() => localStorage.getItem('showTimeline') === 'true');
    const [timelineFilter, setTimelineFilter] = useState<{ start: number, end: number } | null>(null);
    const [version, setVersion] = useState("...");
    const [allClips, setAllClips] = useState<Clip[]>([]);

    // Advanced Settings States
    const [dateFormat, setDateFormat] = useState<'absolute' | 'relative'>('relative');
    const [autoHideDuration, setAutoHideDuration] = useState(0); // 0 = disabled
    const [shortcuts, setShortcuts] = useState<Record<string, string>>({});

    // Rich Content View Toggle - per-clip basis
    const [rawViewClipIds, setRawViewClipIds] = useState<Set<number>>(new Set());

    // Theme detection for ClipContent
    const [systemDark, setSystemDark] = useState(window.matchMedia('(prefers-color-scheme: dark)').matches);
    const [editingClip, setEditingClip] = useState<Clip | null>(null);
    const [extractingOcrClipId, setExtractingOcrClipId] = useState<number | null>(null);
    const [zoomedImageSrc, setZoomedImageSrc] = useState<string | null>(null);
    const theme = localStorage.getItem('theme') || 'dark';
    const isDark = theme === 'dark' || (theme === 'system' && systemDark);

    // Pagination State
    const [page, setPage] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const loaderRef = useRef<HTMLDivElement>(null);
    const LIMIT = 30;

    // Database Stats
    const [totalClipCount, setTotalClipCount] = useState(0);

    // Tooltip setting
    const [showTooltipPreview, setShowTooltipPreview] = useState(() =>
        localStorage.getItem('showTooltipPreview') === 'true'
    );

    // Listen for tooltip setting changes
    useEffect(() => {
        const handler = () => setShowTooltipPreview(localStorage.getItem('showTooltipPreview') === 'true');
        window.addEventListener('storage', handler);
        return () => window.removeEventListener('storage', handler);
    }, []);

    const fetchClipStats = async (search?: string) => {
        try {
            const stats = await invoke<{ total_count: number, oldest_date: string | null, newest_date: string | null }>(
                "get_clip_stats", { search: search || null }
            );
            setTotalClipCount(stats.total_count);
        } catch (e) {
            console.error("Failed to fetch clip stats", e);
        }
    };

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
    useEffect(() => {
        localStorage.setItem('incognitoMode', incognitoMode.toString());
        invoke('set_incognito_mode', { enabled: incognitoMode }).catch(() => { });
    }, [incognitoMode]);

    useEffect(() => {
        localStorage.setItem('showTimeline', showTimeline.toString());
    }, [showTimeline]);

    useEffect(() => {
        localStorage.setItem('queueMode', queueMode.toString());
    }, [queueMode]);

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
        // Load settings from localStorage for now
        const savedFormat = localStorage.getItem('dateFormat');
        if (savedFormat) setDateFormat(savedFormat as any);

        const savedAutoHide = localStorage.getItem('autoHideDuration');
        if (savedAutoHide) setAutoHideDuration(parseInt(savedAutoHide));
    }, []);

    const addToQueue = (clip: Clip) => {
        setPasteQueue(prev => {
            if (!prev.find(c => c.id === clip.id)) {
                return [...prev, clip];
            }
            return prev;
        });
    };

    // ...

    <button
        onClick={() => setQueueMode(!queueMode)}
        className={`title-btn ${queueMode ? 'active' : ''}`}
        title="Toggle Paste Queue Mode"
        style={{ color: queueMode ? '#10b981' : undefined, fontWeight: 'bold', position: 'relative' }}
    >
        Q
        {queueMode && pasteQueue.length > 0 && (
            <span style={{
                position: 'absolute',
                top: '0px',
                right: '0px',
                fontSize: '0.6rem',
                background: '#10b981',
                color: 'white',
                padding: '1px 4px',
                borderRadius: '10px',
                lineHeight: 1
            }}>
                {pasteQueue.length}
            </span>
        )}
    </button>

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
                            setClips(clips.filter(c => c.id !== selectedClip.id));
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

    async function fetchClips(search = "", reset = false) {
        if (isLoading && !reset) return; // Allow reset even if loading
        setIsLoading(true);

        try {
            const currentOffset = reset ? 0 : page * LIMIT;

            // If searching, we might want to fetch more? No, consistency.
            const newClips = await invoke<Clip[]>("get_recent_clips", {
                limit: LIMIT,
                offset: currentOffset,
                search: search || null
            });

            if (newClips.length < LIMIT) {
                setHasMore(false);
            } else {
                setHasMore(true);
            }

            if (reset) {
                setAllClips(newClips);
                setClips(newClips);
                setPage(1); // Prepare for next page

                // If timeline active, we only show filtered.
                if (timelineFilter) {
                    const filtered = newClips.filter(clip => {
                        const clipDate = new Date(clip.created_at).getTime();
                        return clipDate >= timelineFilter.start && clipDate <= timelineFilter.end;
                    });
                    setClips(filtered);
                }
            } else {
                setAllClips(prev => {
                    const combined = [...prev, ...newClips];
                    // Remove duplicates just in case
                    return Array.from(new Map(combined.map(c => [c.id, c])).values());
                });
                setClips(prev => {
                    const combined = [...prev, ...newClips];
                    // Apply filter if needed
                    let result = Array.from(new Map(combined.map(c => [c.id, c])).values());
                    if (timelineFilter) {
                        result = result.filter(clip => {
                            const clipDate = new Date(clip.created_at).getTime();
                            return clipDate >= timelineFilter.start && clipDate <= timelineFilter.end;
                        });
                    }
                    return result;
                });
                setPage(prev => prev + 1);
            }

        } catch (error) {
            console.error("Failed to fetch clips:", error);
        } finally {
            setIsLoading(false);
        }
    }

    // Re-fetch when timeline filter changes
    useEffect(() => {
        if (allClips.length > 0) {
            if (timelineFilter) {
                const filtered = allClips.filter(clip => {
                    const clipDate = new Date(clip.created_at).getTime();
                    return clipDate >= timelineFilter.start && clipDate <= timelineFilter.end;
                });
                setClips(filtered);
            } else {
                setClips(allClips);
            }
        }
    }, [timelineFilter]);

    useEffect(() => {
        const timer = setTimeout(() => {
            setPage(0); // Reset page logic
            fetchClips(searchTerm, true); // Trigger absolute reset
            fetchClipStats(searchTerm); // Refresh DB stats
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Infinite Scroll Observer
    useEffect(() => {
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && hasMore && !isLoading) {
                // If user scrolled to bottom, load next page
                // Note: We don't pass 'reset=true' here.
                // We assume fetchClips uses current page state or we need to pass it?
                // fetchClips uses 'page' state.
                fetchClips(searchTerm, false);
            }
        }, { threshold: 0.1 });

        if (loaderRef.current) observer.observe(loaderRef.current);
        return () => observer.disconnect();
    }, [hasMore, isLoading, searchTerm, page]);

    const clipsRef = useRef(clips);
    useEffect(() => { clipsRef.current = clips; }, [clips]);

    useEffect(() => {
        let unlistenCreate: (() => void) | null = null;
        let unlistenPasteNext: (() => void) | null = null;
        let unlistenPasteIndex: (() => void) | null = null;

        const setup = async () => {
            // Initial fetch handled by searchTerm effect or manual call?
            // searchTerm defaults to "", so the effect above runs on mount.
            // But we can call it here to be safe or if we removed initial call.
            // Actually, useEffect [searchTerm] runs on mount. 
            // Double calling is bad. Let's rely on searchTerm effect or check if called.
            // If we remove the call here, we trust the effect.
            // fetchClips(); // <-- Removing this to avoid double fetch on mount


            unlistenCreate = await listen("clip-created", (_event) => {
                fetchClips(searchTerm, true); // Reset on new clip
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
        try {
            await invoke("delete_clip", { id });
            setClips(clips.filter(c => c.id !== id));
        } catch (error) {
            console.error("Failed to delete clip:", error);
        }
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
                    setClips(clips.map(c => c.id === id ? { ...c, tags: updatedTags } : c));
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
            setClips(clips.map(c => c.id === id ? { ...c, pinned: newPinned } : c));
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
            setClips(updatedClips);
            setAllClips(allClips.map(c => c.id === editingClip.id ? { ...c, content: newContent } : c));

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
        setClips(clips.filter(c => !selectedClipIds.has(c.id)));
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

    async function toggleIncognito() {
        const newState = !incognitoMode;
        setIncognitoMode(newState);
        await invoke("set_incognito_mode", { enabled: newState });
    }

    async function moveToTop(e: React.MouseEvent, id: number) {
        e.stopPropagation();
        try {
            // Set position to current timestamp to make it highest priority
            const position = Date.now();
            await invoke("reorder_clip", { id, position });
            // Refresh clips
            const data = await invoke<Clip[]>("get_recent_clips", { limit: 100, offset: 0, search: searchTerm || null });
            setClips(data);
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
                setClips(clips.map(c => c.id === id ? { ...c, content: newContent } : c));
            } catch (error) {
                console.error("Failed to transform text:", error);
            }
        }
    }

    async function toggleFavorite(e: React.MouseEvent, id: number) {
        e.stopPropagation();
        try {
            const newStatus = await invoke<boolean>("toggle_clip_favorite", { id });
            setClips(clips.map(c => c.id === id ? { ...c, favorite: newStatus } : c));
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
        setClips(newClips);

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
    useEffect(() => {
        invoke<boolean>("get_incognito_mode").then(setIncognitoMode);
        getVersion().then(setVersion);
    }, []);

    return (
        <>
            {/* Title Bar - Uses programmatic dragging */}
            <div
                className="titlebar"
                onMouseDown={(e) => {
                    const target = e.target as HTMLElement;
                    if (!target.closest('input') && !target.closest('button')) {
                        getCurrentWindow().startDragging();
                    }
                }}
            >
                <div className="title-left">
                    <img
                        src="/icon.png"
                        alt="ReClip"
                        style={{ width: '40px', height: '40px', marginRight: '6px' }}
                    />
                    <span className="app-title">ReClip</span>
                    <span style={{
                        fontSize: '0.7rem',
                        opacity: 0.5,
                        marginLeft: '6px',
                        fontFamily: 'monospace'
                    }}>v{version}</span>
                </div>

                <div className="title-right">
                    <button
                        onClick={toggleIncognito}
                        className={`title-btn ${incognitoMode ? 'active' : ''}`}
                        title={incognitoMode ? "Resume Capture" : "Pause Capture (Incognito)"}
                        style={{ color: incognitoMode ? '#f59e0b' : undefined }}
                    >
                        {incognitoMode ? (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                        ) : (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                        )}
                    </button>

                    <button
                        onClick={() => setQueueMode(!queueMode)}
                        className={`title-btn ${queueMode ? 'active' : ''}`}
                        title="Toggle Paste Queue Mode"
                        style={{ color: queueMode ? '#10b981' : undefined, fontWeight: 'bold' }}
                    >
                        Q
                    </button>

                    <button onClick={() => setShowTimeline(!showTimeline)}
                        className={`title-btn ${showTimeline ? 'active' : ''}`}
                        title="Toggle Timeline View"
                        style={{ color: showTimeline ? 'var(--accent-color)' : undefined }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="16" y1="2" x2="16" y2="6"></line>
                            <line x1="8" y1="2" x2="8" y2="6"></line>
                            <line x1="3" y1="10" x2="21" y2="10"></line>
                        </svg>
                    </button>

                    <button onClick={onOpenSnippets} className="title-btn" title="Code Snippets">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="16 18 22 12 16 6"></polyline>
                            <polyline points="8 6 2 12 8 18"></polyline>
                        </svg>
                    </button>

                    <button onClick={onOpenSettings} className="title-btn" title="Settings">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.74v-.47a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                    </button>
                    <button onClick={() => getCurrentWindow().hide()} className="title-btn" title="Hide">✕</button>
                </div>
            </div>

            <main className="container">
                {/* Search and Stats Bar */}
                <div style={{
                    display: 'flex',
                    gap: '12px',
                    alignItems: 'center',
                    marginTop: '8px',
                    marginBottom: '12px',
                    padding: '10px 14px',
                    background: 'var(--bg-card)',
                    borderRadius: '12px',
                    boxShadow: 'var(--shadow-sm)',
                }}>
                    {/* Search Input */}
                    <div style={{ flex: 1, position: 'relative' }}>
                        <span style={{
                            position: 'absolute',
                            left: '10px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            opacity: 0.4,
                            pointerEvents: 'none',
                        }}>🔍</span>
                        <input
                            ref={searchInputRef}
                            type="text"
                            placeholder="Search clips, tags, content..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="search-input"
                            style={{
                                width: '100%',
                                padding: '8px 12px 8px 32px',
                                borderRadius: '8px',
                                border: '1px solid var(--border-color, rgba(128,128,128,0.2))',
                                background: 'var(--bg-input, var(--bg-card))',
                                color: 'var(--text-primary, inherit)',
                                fontSize: '0.9rem',
                                outline: 'none',
                                transition: 'all 0.2s',
                            }}
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                style={{
                                    position: 'absolute',
                                    right: '8px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    opacity: 0.5,
                                    fontSize: '0.9rem',
                                }}
                            >✕</button>
                        )}
                    </div>

                    {/* Clip Stats */}
                    <div style={{
                        display: 'flex',
                        gap: '8px',
                        fontSize: '0.75rem',
                        opacity: 0.7,
                        whiteSpace: 'nowrap',
                    }}>
                        {searchTerm ? (
                            <span style={{
                                background: 'var(--accent-color)',
                                color: 'white',
                                padding: '4px 8px',
                                borderRadius: '12px',
                                fontWeight: 600,
                            }}>
                                {clips.length} found
                            </span>
                        ) : (
                            <>
                                <span title="Total clips in database">📋 {totalClipCount}</span>
                                <span title="Pinned clips (loaded)">📌 {clips.filter(c => c.pinned).length}</span>
                                <span title="Favorites (loaded)">⭐ {clips.filter(c => c.favorite).length}</span>
                            </>
                        )}
                    </div>
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
                        setPage(0);
                        fetchClips('', true);
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
                                    <Draggable key={clip.id} draggableId={clip.id.toString()} index={index}>
                                        {(provided, snapshot) => (
                                            <div
                                                ref={provided.innerRef}
                                                {...provided.draggableProps}
                                                {...provided.dragHandleProps}
                                                style={{ ...provided.draggableProps.style }}
                                            >
                                                <motion.div
                                                    // layout={!snapshot.isDragging} // Disable layout anim to prevent conflict
                                                    className={`clip-card ${selectedIndex === index ? 'selected' : ''} ${selectedClipIds.has(clip.id) ? 'multi-selected' : ''} ${clip.pinned ? 'pinned' : ''}`}
                                                    onClick={(e) => handleClipClick(e, clip)}
                                                    onMouseEnter={() => setSelectedIndex(index)}
                                                    style={{
                                                        boxShadow: snapshot.isDragging ? "0 10px 30px rgba(0,0,0,0.3)" : undefined,
                                                        background: snapshot.isDragging ? "var(--bg-card)" : undefined
                                                    }}
                                                >
                                                    <div className="clip-header">
                                                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                                                            {index < 9 && (
                                                                <span
                                                                    title={`Shortcut: ${shortcuts[`paste_${index + 1}`] || `Ctrl+${index + 1}`}`}
                                                                    style={{
                                                                        fontSize: '0.7rem',
                                                                        fontWeight: 'bold',
                                                                        color: compactMode ? '#888' : '#aaa',
                                                                        background: 'rgba(0,0,0,0.05)',
                                                                        border: '1px solid rgba(0,0,0,0.1)',
                                                                        borderRadius: '4px',
                                                                        padding: '0 4px',
                                                                        minWidth: '1.2em',
                                                                        textAlign: 'center',
                                                                        cursor: 'help'
                                                                    }}>
                                                                    {index + 1}
                                                                </span>
                                                            )}
                                                            <span className="clip-type">{clip.type}</span>
                                                            {clip.sensitive && (
                                                                <span
                                                                    title="Sensitive - Auto-deletes in 30 seconds"
                                                                    style={{
                                                                        fontSize: '0.65rem',
                                                                        background: 'rgba(239, 68, 68, 0.15)',
                                                                        color: '#dc2626',
                                                                        padding: '2px 6px',
                                                                        borderRadius: '10px',
                                                                        fontWeight: 600,
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: '3px'
                                                                    }}
                                                                >
                                                                    🔐 Sensitive
                                                                </span>
                                                            )}
                                                            {clip.tags && JSON.parse(clip.tags).map((tag: string) => (
                                                                <span
                                                                    key={tag}
                                                                    className="clip-tag"
                                                                    style={{
                                                                        fontSize: '0.85rem',
                                                                        background: 'rgba(67, 56, 202, 0.1)',
                                                                        color: '#4338ca',
                                                                        padding: '2px 8px',
                                                                        borderRadius: '12px',
                                                                        fontWeight: 600,
                                                                        cursor: 'pointer'
                                                                    }}
                                                                    onClick={(e) => { e.stopPropagation(); filterByTag(tag); }}
                                                                    title={`Filter by ${tag}`}
                                                                >
                                                                    {tag}
                                                                </span>
                                                            ))}
                                                            <button
                                                                className="add-tag-btn"
                                                                onClick={(e) => addTagToClip(e, clip.id, clip.tags || null)}
                                                                title="Add tag"
                                                                style={{
                                                                    fontSize: '0.85rem',
                                                                    padding: '2px 6px',
                                                                    borderRadius: '12px',
                                                                    border: '1px dashed #aaa',
                                                                    background: 'transparent',
                                                                    cursor: 'pointer',
                                                                    color: '#888'
                                                                }}
                                                            >
                                                                + tag
                                                            </button>
                                                            {clip.type === 'image' && (
                                                                <ImageMetadata filePath={clip.content} isCompact={compactMode} />
                                                            )}
                                                            {clip.type === 'text' && (
                                                                <div className="transform-actions" style={{ display: 'flex', gap: '2px', opacity: selectedIndex === index ? 1 : 0, transition: 'opacity 0.2s', marginLeft: 'auto' }}>
                                                                    <button onClick={(e) => transformText(e, clip.id, 'upper')} title="UPPERCASE" className="icon-btn">TT</button>
                                                                    <button onClick={(e) => transformText(e, clip.id, 'lower')} title="lowercase" className="icon-btn">tt</button>
                                                                    <button onClick={(e) => transformText(e, clip.id, 'title')} title="Title Case" className="icon-btn">Tt</button>
                                                                    <button onClick={(e) => transformText(e, clip.id, 'trim')} title="Trim Whitespace" className="icon-btn">Tr</button>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="header-right">
                                                            <button
                                                                className={`fav-btn ${clip.favorite ? 'active' : ''}`}
                                                                onClick={(e) => toggleFavorite(e, clip.id)}
                                                                title={clip.favorite ? "Unfavorite" : "Favorite"}
                                                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px' }}
                                                            >
                                                                {clip.favorite ? (
                                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                                                                ) : (
                                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                                                                )}
                                                            </button>
                                                            <button
                                                                className={`pin-btn ${clip.pinned ? 'active' : ''}`}
                                                                onClick={(e) => togglePin(e, clip.id)}
                                                                title={clip.pinned ? "Unpin" : "Pin"}
                                                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px' }}
                                                            >
                                                                <svg width="14" height="14" viewBox="0 0 24 24" fill={clip.pinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'rotate(45deg)' }}>
                                                                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle>
                                                                </svg>
                                                            </button>
                                                            {(clip.pinned || clip.favorite) && (
                                                                <button
                                                                    className="icon-btn"
                                                                    onClick={(e) => moveToTop(e, clip.id)}
                                                                    title="Move to Top"
                                                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', opacity: 0.6 }}
                                                                >
                                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                        <polyline points="18 15 12 9 6 15"></polyline>
                                                                        <line x1="12" y1="9" x2="12" y2="21"></line>
                                                                        <line x1="4" y1="3" x2="20" y2="3"></line>
                                                                    </svg>
                                                                </button>
                                                            )}

                                                            <span className="clip-date" title={clip.created_at}>{formatTime(clip.created_at)}</span>

                                                            <div style={{ position: 'relative' }}>
                                                                <button
                                                                    className={`icon-btn menu-btn ${activeMenuId === clip.id ? 'active' : ''}`}
                                                                    onClick={(e) => { e.stopPropagation(); setActiveMenuId(activeMenuId === clip.id ? null : clip.id); }}
                                                                    title="More Options"
                                                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px' }}
                                                                >
                                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="2"></circle><circle cx="12" cy="5" r="2"></circle><circle cx="12" cy="19" r="2"></circle></svg>
                                                                </button>

                                                                {activeMenuId === clip.id && (
                                                                    <div
                                                                        ref={menuRef}
                                                                        className="clip-menu-dropdown"
                                                                        style={{
                                                                            position: 'absolute', top: '100%', right: 0,
                                                                            background: 'var(--bg-card)',
                                                                            border: '1px solid rgba(128,128,128,0.2)',
                                                                            borderRadius: '8px',
                                                                            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                                                                            zIndex: 100, overflow: 'hidden', minWidth: '140px',
                                                                            backdropFilter: 'blur(10px)'
                                                                        }}
                                                                        onClick={e => e.stopPropagation()}
                                                                    >
                                                                        {clip.type === 'image' && (
                                                                            <>
                                                                                <button
                                                                                    onClick={(e) => handleExtractText(e, clip)}
                                                                                    style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 12px', border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', color: 'inherit', fontSize: '0.9rem' }}
                                                                                >
                                                                                    👁️ Extract Text
                                                                                </button>
                                                                                <button
                                                                                    onClick={async () => {
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
                                                                                    style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 12px', border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', color: 'inherit', fontSize: '0.9rem' }}
                                                                                >
                                                                                    💾 Save As...
                                                                                </button>
                                                                            </>
                                                                        )}
                                                                        {clip.type === 'text' && (
                                                                            <>
                                                                                <button
                                                                                    onClick={() => {
                                                                                        setRawViewClipIds(prev => {
                                                                                            const next = new Set(prev);
                                                                                            if (next.has(clip.id)) {
                                                                                                next.delete(clip.id);
                                                                                            } else {
                                                                                                next.add(clip.id);
                                                                                            }
                                                                                            return next;
                                                                                        });
                                                                                        setActiveMenuId(null);
                                                                                    }}
                                                                                    style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 12px', border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', color: 'inherit', fontSize: '0.9rem' }}
                                                                                >
                                                                                    {rawViewClipIds.has(clip.id) ? '✨ Formatted View' : '📝 Raw View'}
                                                                                </button>
                                                                                <button
                                                                                    onClick={() => {
                                                                                        setEditingClip(clip);
                                                                                        setActiveMenuId(null);
                                                                                    }}
                                                                                    style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 12px', border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', color: 'inherit', fontSize: '0.9rem' }}
                                                                                >
                                                                                    ✏️ Edit Content
                                                                                </button>
                                                                            </>
                                                                        )}
                                                                        <button
                                                                            onClick={() => { setQrContent(clip.content); setActiveMenuId(null); }}
                                                                            style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 12px', border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', color: 'inherit', fontSize: '0.9rem' }}
                                                                        >
                                                                            📱 QR Code
                                                                        </button>
                                                                        <button
                                                                            onClick={(e) => { deleteClip(e, clip.id); setActiveMenuId(null); }}
                                                                            style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 12px', border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', color: '#ef4444', fontSize: '0.9rem' }}
                                                                        >
                                                                            🗑️ Delete
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {/* Image Color Palette Row */}
                                                    {clip.type === 'image' && !compactMode && (
                                                        <div style={{ padding: '4px 12px', borderTop: '1px solid var(--border-color, rgba(128,128,128,0.1))' }}>
                                                            <ImageColorPalette src={convertFileSrc(clip.content)} isCompact={compactMode} />
                                                        </div>
                                                    )}
                                                    <div className="clip-content">
                                                        {clip.type === 'text' && isColorCode(clip.content) ? (
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                                <div style={{
                                                                    width: '32px',
                                                                    height: '32px',
                                                                    borderRadius: '6px',
                                                                    backgroundColor: clip.content,
                                                                    border: '2px solid rgba(0,0,0,0.25)',
                                                                    boxShadow: 'inset 0 0 10px rgba(0,0,0,0.05)'
                                                                }} />
                                                                <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{clip.content}</span>
                                                            </div>
                                                        ) : (
                                                            <div
                                                                className="clip-content-wrapper"
                                                                title={showTooltipPreview && clip.type !== 'image' && clip.type !== 'file' ? clip.content.slice(0, 500) + (clip.content.length > 500 ? '...' : '') : undefined}
                                                                style={{ cursor: showTooltipPreview && clip.type !== 'image' ? 'help' : 'default' }}
                                                            >
                                                                <ClipContent
                                                                    content={clip.content}
                                                                    type={clip.type}
                                                                    isCompact={compactMode}
                                                                    showRaw={rawViewClipIds.has(clip.id)}
                                                                    isDark={isDark}
                                                                    isExtracting={extractingOcrClipId === clip.id}
                                                                    onZoom={(src) => setZoomedImageSrc(src)}
                                                                />
                                                                {clip.type === 'text' && isUrl(clip.content) && <UrlPreview url={clip.content} />}
                                                            </div>
                                                        )}
                                                    </div>
                                                </motion.div>
                                            </div>
                                        )}
                                    </Draggable>
                                ))}
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

            {queueMode && pasteQueue.length > 0 && (
                <div className="bulk-actions-bar" style={{ background: 'rgba(16, 185, 129, 0.95)' }}>
                    <div className="bulk-info">Queue: {pasteQueue.length} items</div>
                    <div className="bulk-buttons">
                        <button onClick={pasteNextInQueue} title="Paste the first item and remove it">Paste Next</button>
                        <button id="hidden-paste-next-btn" style={{ display: 'none' }} onClick={pasteNextInQueue}></button>
                        <button onClick={() => setPasteQueue([])}>Clear</button>
                    </div>
                </div>
            )
            }

            {
                !queueMode && selectedClipIds.size > 0 && (
                    <div className="bulk-actions-bar">
                        <div className="bulk-info"> {selectedClipIds.size} selected </div>
                        <div className="bulk-buttons">
                            <button onClick={bulkPaste} title="Join and paste selected clips">Merge & Paste</button>
                            <button onClick={bulkDelete} title="Delete selected clips">Delete</button>
                            <button onClick={() => { setSelectedClipIds(new Set()); setLastSelectedId(null); }}>Cancel</button>
                        </div>
                    </div>
                )
            }


            {/* QR Code Modal - Using shared component */}
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
        </>
    );
}
