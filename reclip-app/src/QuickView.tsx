import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Clip } from "./types";
import { listen } from "@tauri-apps/api/event";

const QuickView = () => {
    const [clips, setClips] = useState<Clip[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);

    useEffect(() => {
        fetchClips();

        // Focus window when shown
        const unlisten = listen("tauri://focus", () => {
            fetchClips();
            setSelectedIndex(0);
        });

        return () => { unlisten.then(f => f()); };
    }, []);

    const fetchClips = async () => {
        try {
            const recent = await invoke<Clip[]>("get_recent_clips", { limit: 10, offset: 0, search: null });
            setClips(recent);
        } catch (e) {
            console.error(e);
        }
    };

    const handleKeyDown = async (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => Math.min(prev + 1, clips.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const clip = clips[selectedIndex];
            if (clip) {
                await invoke("paste_clip_to_system", { content: clip.content, clipType: clip.type });
                await getCurrentWindow().hide();
            }
        } else if (e.key === 'Escape') {
            e.preventDefault();
            await getCurrentWindow().hide();
        }
    };

    // Close on blur
    useEffect(() => {
        // We can't easily detect blur of the window itself in pure React without Tauri events
        // But we can listen to window events if needed.
        // For now, rely on Esc.

        // Actually, auto-hide on blur is good UX for quick menu.
        // Let's leave it manual for now to avoid frustration during dev.
    }, []);

    return (
        <div
            className="h-screen w-screen overflow-hidden bg-[#1e1e1e]/90 backdrop-blur-xl text-white border border-white/10 rounded-xl flex flex-col shadow-2xl"
            onKeyDown={handleKeyDown}
            tabIndex={0} // Make focusable
            ref={(el) => el?.focus()} // Auto focus
        >
            <div className="p-3 border-b border-white/10 flex items-center justify-between bg-white/5">
                <span className="font-bold text-xs uppercase tracking-wider opacity-50">Quick Paste</span>
                <span className="text-[10px] opacity-30">Esc to close</span>
            </div>

            <div className="flex-1 overflow-y-auto p-1">
                {clips.map((clip, index) => (
                    <div
                        key={clip.id}
                        className={`p-2 rounded cursor-pointer flex items-center gap-2 text-sm transition-colors ${index === selectedIndex ? 'bg-indigo-600 text-white' : 'hover:bg-white/5 opacity-80'
                            }`}
                        onClick={() => {
                            invoke("paste_clip_to_system", { content: clip.content, clipType: clip.type });
                            getCurrentWindow().hide();
                        }}
                        onMouseEnter={() => setSelectedIndex(index)}
                    >
                        <div className={`w-1 h-8 rounded-full shrink-0 ${index === selectedIndex ? 'bg-white' : 'bg-white/20'}`} />
                        <div className="flex-1 min-w-0">
                            <div className="truncate font-medium">
                                {clip.type === 'text' ? clip.content.substring(0, 100).replace(/\n/g, ' ') : `[${clip.type}]`}
                            </div>
                            <div className="text-[10px] opacity-50 flex gap-2">
                                <span>{new Date(clip.created_at).toLocaleTimeString()}</span>
                                {clip.pinned && <span>📌</span>}
                            </div>
                        </div>
                        {index < 9 && <span className="opacity-30 text-xs font-mono">Ctrl+{index + 1}</span>}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default QuickView;
