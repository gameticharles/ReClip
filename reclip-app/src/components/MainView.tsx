import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Clip } from "../types";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { motion, AnimatePresence } from "framer-motion";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { QRCodeSVG } from "qrcode.react";
import ClipContent from "./ClipContent";
import UrlPreview from "./UrlPreview";

interface MainViewProps {
    compactMode: boolean;
    onOpenSettings: () => void;
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

export default function MainView({ compactMode, onOpenSettings }: MainViewProps) {
    const [clips, setClips] = useState<Clip[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedIndex, setSelectedIndex] = useState(-1); // -1 = none selected
    const [focusOnDelete, setFocusOnDelete] = useState(false); // Left/Right toggle
    const [incognitoMode, setIncognitoMode] = useState(false);
    const [selectedClipIds, setSelectedClipIds] = useState<Set<number>>(new Set());
    const [lastSelectedId, setLastSelectedId] = useState<number | null>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const clipListRef = useRef<HTMLDivElement>(null);

    // Paste Queue
    const [queueMode, setQueueMode] = useState(false);
    const [pasteQueue, setPasteQueue] = useState<Clip[]>([]);

    // Menu & QR
    const [activeMenuId, setActiveMenuId] = useState<number | null>(null);
    const [qrContent, setQrContent] = useState<string | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    // Advanced Settings States
    const [dateFormat, setDateFormat] = useState<'absolute' | 'relative'>('relative');
    const [autoHideDuration, setAutoHideDuration] = useState(0); // 0 = disabled
    const [shortcuts, setShortcuts] = useState<Record<string, string>>({});

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
        // Also listen for shortcut updates if possible? 
        // Or just refetch when window focuses? 
        // For now, fetch once.
    }, []);

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

    async function fetchClips(search = "") {
        try {
            const recentClips = await invoke<Clip[]>("get_recent_clips", { limit: 50, offset: 0, search: search || null });
            setClips(recentClips);
        } catch (error) {
            console.error("Failed to fetch clips:", error);
        }
    }

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchClips(searchTerm);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const clipsRef = useRef(clips);
    useEffect(() => { clipsRef.current = clips; }, [clips]);

    useEffect(() => {
        let unlistenCreate: (() => void) | null = null;
        let unlistenPasteNext: (() => void) | null = null;
        let unlistenPasteIndex: (() => void) | null = null;

        const setup = async () => {
            fetchClips();

            unlistenCreate = await listen("clip-created", (_event) => {
                fetchClips(searchTerm);
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
                    <span className="app-title">ReClip</span>
                </div>

                {/* Search Bar */}
                <div className="search-container" style={{ flex: 1, margin: '0 12px', display: 'flex', justifyContent: 'center' }}>
                    <input
                        ref={searchInputRef}
                        type="text"
                        placeholder="Search clips..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="search-input"
                        style={{
                            width: '90%',
                            maxWidth: '400px',
                            padding: '6px 10px',
                            borderRadius: '8px',
                            border: '1px solid rgba(0,0,0,0.05)',
                            background: 'rgba(255,255,255,0.4)',
                            fontSize: '0.9rem',
                            outline: 'none',
                            transition: 'all 0.2s',
                            backdropFilter: 'blur(5px)'
                        }}
                    />
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


                    <button onClick={onOpenSettings} className="title-btn" title="Settings">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.74v-.47a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                    </button>
                    <button onClick={() => getCurrentWindow().hide()} className="title-btn" title="Hide">✕</button>
                </div>
            </div>

            <main className="container">
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
                                                                    title="Sensitive - Auto-deletes in 60 seconds"
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
                                                                        fontSize: '0.7rem',
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
                                                                    fontSize: '0.65rem',
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
                                                            <>
                                                                <ClipContent content={clip.content} type={clip.type} isCompact={compactMode} />
                                                                {clip.type === 'text' && isUrl(clip.content) && <UrlPreview url={clip.content} />}
                                                            </>
                                                        )}
                                                    </div>
                                                </motion.div>
                                            </div>
                                        )}
                                    </Draggable>
                                ))}
                                {provided.placeholder}
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


            {/* QR Code Modal */}
            <AnimatePresence>
                {qrContent && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        style={{
                            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
                        }}
                        onClick={() => setQrContent(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
                            style={{
                                background: 'white', padding: '32px', borderRadius: '16px',
                                boxShadow: '0 10px 30px rgba(0,0,0,0.5)', maxWidth: '90%', textAlign: 'center'
                            }}
                            onClick={e => e.stopPropagation()}
                        >
                            <h3 style={{ marginTop: 0, marginBottom: '20px', color: 'black' }}>Scan QR Code</h3>
                            <div style={{ background: 'white', padding: '10px', borderRadius: '8px' }}>
                                <QRCodeSVG value={qrContent} size={256} />
                            </div>
                            <p style={{ marginTop: '20px', marginBottom: 0, fontSize: '0.9rem', color: '#666', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {qrContent}
                            </p>
                            <button
                                onClick={() => setQrContent(null)}
                                style={{ marginTop: '24px', padding: '10px 24px', background: 'var(--accent-color)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
                            >
                                Close
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
