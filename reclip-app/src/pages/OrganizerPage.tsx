import { useState, useEffect, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { Note, Reminder } from '../types';
import { Trash2, Plus, Check, Bell, Calendar, StickyNote, Search, X, AlertCircle, Pin, Archive, GripVertical, ArrowUpDown } from 'lucide-react';
import MDEditor from '@uiw/react-md-editor';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

type ItemType = 'all' | 'note' | 'reminder' | 'alarm';

interface Alarm {
    id: number;
    time: string;
    label: string;
    active: boolean;
    days: string;
    created_at: string;
    position?: number;
}

interface Notification {
    id: string;
    title: string;
    body: string;
}

interface OrganizerPageProps {
    theme?: string;
}

export default function OrganizerPage({ theme = 'system' }: OrganizerPageProps) {
    // Data State
    const [notes, setNotes] = useState<Note[]>([]);
    const [reminders, setReminders] = useState<Reminder[]>([]);
    const [alarms, setAlarms] = useState<Alarm[]>([]);

    // UI State
    const [filter, setFilter] = useState<ItemType | 'archived'>('all');
    const [newItemContent, setNewItemContent] = useState('');
    const [newItemTitle, setNewItemTitle] = useState('');
    const [newItemColor, setNewItemColor] = useState<string | undefined>(undefined);
    const [selectedType, setSelectedType] = useState<Exclude<ItemType, 'all'>>('note');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortMode, setSortMode] = useState<'date' | 'manual'>('date');

    // Editing State
    const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
    const [editingNoteTitle, setEditingNoteTitle] = useState('');
    const [editingNoteContent, setEditingNoteContent] = useState('');
    const [editingNoteColor, setEditingNoteColor] = useState<string | undefined>(undefined);

    // Auxiliary Input State
    const [reminderDate, setReminderDate] = useState('');
    const [alarmTime, setAlarmTime] = useState('');
    const [newItemTags, setNewItemTags] = useState('');
    const [notification, setNotification] = useState<Notification | null>(null);

    // Theme Logic
    const [editorTheme, setEditorTheme] = useState<'light' | 'dark'>('light');

    const colors = [
        { name: 'None', value: undefined },
        { name: 'Red', value: 'rgba(239, 68, 68, 0.1)' },
        { name: 'Orange', value: 'rgba(249, 115, 22, 0.1)' },
        { name: 'Yellow', value: 'rgba(234, 179, 8, 0.1)' },
        { name: 'Green', value: 'rgba(34, 197, 94, 0.1)' },
        { name: 'Blue', value: 'rgba(59, 130, 246, 0.1)' },
        { name: 'Purple', value: 'rgba(168, 85, 247, 0.1)' },
        { name: 'Pink', value: 'rgba(236, 72, 153, 0.1)' },
    ];

    useEffect(() => {
        const updateTheme = () => {
            if (theme === 'dark') {
                setEditorTheme('dark');
            } else if (theme === 'light') {
                setEditorTheme('light');
            } else {
                setEditorTheme(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
            }
        };

        updateTheme();

        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = () => {
            if (theme === 'system') updateTheme();
        };
        mediaQuery.addEventListener('change', handler);
        return () => mediaQuery.removeEventListener('change', handler);
    }, [theme]);

    useEffect(() => {
        loadData();

        const setupListener = async () => {
            const unlisten = await listen<Notification>('system-notification', (event) => {
                setNotification(event.payload);
            });
            return unlisten;
        };

        let unlisten: () => void;
        setupListener().then(u => unlisten = u);

        return () => {
            if (unlisten) unlisten();
        };
    }, []);

    const loadData = async () => {
        try {
            setNotes(await invoke('get_notes'));
            setReminders(await invoke('get_reminders'));
            setAlarms(await invoke('get_alarms'));
        } catch (e) {
            console.error("Failed to load organizer data", e);
        }
    };

    // --- Actions ---

    const handleAddItem = async () => {
        if (selectedType === 'note') {
            if (!newItemContent.trim() && !newItemTitle.trim()) return;
            await invoke('add_note', { title: newItemTitle, content: newItemContent, color: newItemColor, tags: newItemTags });
            setNewItemContent('');
            setNewItemTitle('');
            setNewItemTags('');
            setNewItemColor(undefined);
        } else if (selectedType === 'reminder') {
            if (!newItemContent.trim()) return;
            await invoke('add_reminder', {
                content: newItemContent,
                due_date: reminderDate ? new Date(reminderDate).toISOString() : null
            });
            setNewItemContent('');
            setReminderDate('');
        } else if (selectedType === 'alarm') {
            if (!alarmTime) return;
            // time is HH:MM
            await invoke('add_alarm', {
                time: alarmTime,
                label: newItemContent || 'Alarm',
                days: '' // Default to every day for now
            });
            setNewItemContent('');
            setAlarmTime('');
        }
        loadData();
    };

    const handleDelete = async (type: 'note' | 'reminder' | 'alarm', id: number) => {
        if (confirm('Are you sure you want to delete this item?')) {
            if (type === 'note') await invoke('delete_note', { id });
            if (type === 'reminder') await invoke('delete_reminder', { id });
            if (type === 'alarm') await invoke('delete_alarm', { id });
            loadData();
        }
    };

    const handleToggleReminder = async (id: number) => {
        await invoke('toggle_reminder', { id });
        loadData();
    };

    const handleToggleAlarm = async (id: number) => {
        await invoke('toggle_alarm', { id });
        loadData();
    };

    const handleTogglePin = async (note: Note) => {
        await invoke('update_note', {
            id: note.id, title: note.title || '', content: note.content,
            color: note.color, is_pinned: !note.is_pinned, is_archived: note.is_archived,
            tags: note.tags
        });
        loadData();
    };

    const handleArchive = async (note: Note) => {
        await invoke('update_note', {
            id: note.id, title: note.title || '', content: note.content,
            color: note.color, is_pinned: note.is_pinned, is_archived: !note.is_archived,
            tags: note.tags
        });
        loadData();
    };

    const startEditing = (note: Note) => {
        setEditingNoteId(note.id);
        setEditingNoteTitle(note.title || '');
        setEditingNoteContent(note.content);
        setEditingNoteColor(note.color);
    };

    const saveEditing = async () => {
        if (editingNoteId !== null) {
            const currentNote = notes.find(n => n.id === editingNoteId);
            if (currentNote) {
                await invoke('update_note', {
                    id: editingNoteId, title: editingNoteTitle, content: editingNoteContent,
                    color: editingNoteColor, is_pinned: currentNote.is_pinned, is_archived: currentNote.is_archived,
                    tags: currentNote.tags // Preserve tags for now
                });
            }
            setEditingNoteId(null);
            loadData();
        }
    };

    const cancelEditing = () => {
        setEditingNoteId(null);
    };

    const onDragEnd = async (result: DropResult) => {
        if (!result.destination) return;
        if (sortMode !== 'manual') return;

        const sourceIndex = result.source.index;
        const destinationIndex = result.destination.index;

        if (sourceIndex === destinationIndex) return;

        const items = [...combinedItems];
        const [movedItem] = items.splice(sourceIndex, 1);
        items.splice(destinationIndex, 0, movedItem);

        // Find the generic invoke command `update_item_position`.
        const item = movedItem;
        let table = '';
        let id = -1;

        if (item.type === 'note') {
            table = 'notes';
            id = (item.data as Note).id;
        }
        if (item.type === 'reminder') {
            table = 'reminders';
            id = (item.data as Reminder).id;
        }
        if (item.type === 'alarm') {
            table = 'alarms';
            id = (item.data as Alarm).id;
        }

        // Calculate new position. 
        // We are sorting by position DESC. So top item (index 0) has highest position value.

        const getPos = (i: any) => (i?.data as any).position || 0;

        // items array is already reordered locally at this point (items contains the new order).
        // destinationIndex is where current item IS.
        const prevItem = items[destinationIndex - 1]; // Item above
        const nextItem = items[destinationIndex + 1]; // Item below

        // In DESC sort (High -> Low):
        // Item Above (Index - 1) should have Higher Position
        // Item Below (Index + 1) should have Lower Position
        // We want: NextItem.Pos < NewPos < PrevItem.Pos

        let newPos = 0;

        if (destinationIndex === 0) {
            // Moved to top
            const nextPos = items.length > 1 ? getPos(items[1]) : 0;
            newPos = nextPos + 1024;
        } else if (destinationIndex === items.length - 1) {
            // Moved to bottom
            const prevPos = getPos(items[destinationIndex - 1]);
            newPos = prevPos - 1024;
        } else {
            // Between two items
            const abovePos = getPos(items[destinationIndex - 1]);
            const belowPos = getPos(items[destinationIndex + 1]);
            newPos = Math.floor((abovePos + belowPos) / 2);
        }

        // Apply optimistic update to local state
        if (item.type === 'note') {
            setNotes(prev => prev.map(n => n.id === id ? { ...n, position: newPos } : n));
        } else if (item.type === 'reminder') {
            setReminders(prev => prev.map(r => r.id === id ? { ...r, position: newPos } : r));
        } else if (item.type === 'alarm') {
            setAlarms(prev => prev.map(a => a.id === id ? { ...a, position: newPos } : a));
        }

        await invoke('update_item_position', { table, id, position: newPos });
    };


    // --- Derived Data ---

    const combinedItems = useMemo(() => {
        const items = [];

        // Filter helper
        const matchesSearch = (text: string) => text.toLowerCase().includes(searchQuery.toLowerCase());

        if (filter === 'all' || filter === 'note' || filter === 'archived') {
            const noteList = notes.filter(n => {
                const isArchived = n.is_archived;
                if (filter === 'archived') return isArchived;
                return !isArchived;
            });

            items.push(...noteList.filter(n => matchesSearch(n.content) || (n.title && matchesSearch(n.title)) || (n.tags && matchesSearch(n.tags))).map(n => ({ type: 'note' as const, data: n, date: new Date(n.updated_at) })));
        }

        if (filter !== 'archived') {
            if (filter === 'all' || filter === 'reminder') {
                items.push(...reminders.filter(r => matchesSearch(r.content)).map(r => ({ type: 'reminder' as const, data: r, date: r.due_date ? new Date(r.due_date) : new Date(r.created_at) })));
            }
            if (filter === 'all' || filter === 'alarm') {
                items.push(...alarms.filter(a => matchesSearch(a.label) || matchesSearch(a.time)).map(a => ({ type: 'alarm' as const, data: a, date: new Date() })));
            }
        }

        return items.sort((a, b) => {
            if (sortMode === 'manual') {
                // Sort by position DESC
                const posA = (a.data as any).position || 0;
                const posB = (b.data as any).position || 0;
                return posB - posA;
            }

            // 1. Pinned notes first
            if (a.type === 'note' && b.type === 'note') {
                const noteA = a.data as Note;
                const noteB = b.data as Note;
                if (noteA.is_pinned && !noteB.is_pinned) return -1;
                if (!noteA.is_pinned && noteB.is_pinned) return 1;
            } else if (a.type === 'note' && (a.data as Note).is_pinned) {
                return -1;
            } else if (b.type === 'note' && (b.data as Note).is_pinned) {
                return 1;
            }

            // 2. Date Descending
            return b.date.getTime() - a.date.getTime();
        });
    }, [notes, reminders, alarms, filter, searchQuery, sortMode]);

    const reminderStats = useMemo(() => {
        const total = reminders.length;
        const completed = reminders.filter(r => r.completed).length;
        const overdue = reminders.filter(r => !r.completed && r.due_date && new Date(r.due_date) < new Date()).length;
        return { total, completed, overdue };
    }, [reminders]);


    // --- Styling Helpers ---

    const chipStyle = (active: boolean): React.CSSProperties => ({
        padding: '4px 12px',
        borderRadius: '20px',
        border: '1px solid',
        borderColor: active ? 'var(--accent-color)' : 'transparent',
        background: active ? 'var(--accent-color)' : 'transparent',
        color: active ? 'white' : 'var(--text-secondary)',
        cursor: 'pointer',
        fontSize: '0.8rem',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        transition: 'all 0.2s ease',
        fontWeight: active ? 600 : 400
    });

    const inputStyle: React.CSSProperties = {
        background: 'var(--bg-input)',
        border: '1px solid var(--border-color)',
        color: 'var(--text-primary)',
        borderRadius: '6px',
        padding: '8px 12px',
        fontSize: '0.9rem',
        outline: 'none',
        flex: 1
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            {/* Standard Toolbar / Header with Search */}
            <div className="organizer-toolbar">
                <div className="title-left" style={{ fontSize: '1.1rem', gap: '16px', flexWrap: 'nowrap', overflow: 'hidden' }}>
                    <span style={{ flexShrink: 0 }}>Organizer</span>

                    {/* Sort Toggle */}
                    <button
                        onClick={() => setSortMode(prev => prev === 'date' ? 'manual' : 'date')}
                        title={sortMode === 'date' ? "Sort by Date" : "Manual Sort (Drag & Drop)"}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', opacity: 0.7 }}
                    >
                        <ArrowUpDown size={16} color={sortMode === 'manual' ? 'var(--accent-color)' : 'currentColor'} />
                    </button>

                    {/* Search Field */}
                    <div className="organizer-search">
                        <Search size={14} style={{ position: 'absolute', left: 10, opacity: 0.5 }} />
                        <input
                            type="text"
                            placeholder="Search..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery('')} style={{ position: 'absolute', right: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
                                <X size={12} style={{ opacity: 0.5 }} />
                            </button>
                        )}
                    </div>
                </div>

                <div className="organizer-filter-group">
                    {(['all', 'note', 'reminder', 'alarm'] as ItemType[]).map(t => (
                        <button
                            key={t}
                            onClick={() => setFilter(t)}
                            style={chipStyle(filter === t)}
                            onMouseEnter={(e) => { if (filter !== t) e.currentTarget.style.background = 'var(--bg-hover, rgba(128,128,128,0.1))'; }}
                            onMouseLeave={(e) => { if (filter !== t) e.currentTarget.style.background = 'transparent'; }}
                        >
                            <span style={{ textTransform: 'capitalize' }}>{t}</span>
                        </button>
                    ))}
                    <button
                        onClick={() => setFilter('archived')}
                        style={chipStyle(filter === 'archived')}
                        onMouseEnter={(e) => { if (filter !== 'archived') e.currentTarget.style.background = 'var(--bg-hover, rgba(128,128,128,0.1))'; }}
                        onMouseLeave={(e) => { if (filter !== 'archived') e.currentTarget.style.background = 'transparent'; }}
                    >
                        <Archive size={12} />
                        <span>Archived</span>
                    </button>
                </div>
            </div>

            {/* Stats Bar */}
            {(reminderStats.overdue > 0 || reminderStats.total > 0) && (
                <div className="organizer-stats">
                    {reminderStats.overdue > 0 && (
                        <div style={{ fontSize: '0.75rem', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(239,68,68,0.1)', padding: '2px 8px', borderRadius: '12px' }}>
                            <AlertCircle size={12} />
                            {reminderStats.overdue} Overdue
                        </div>
                    )}
                    {reminderStats.total > 0 && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--bg-input)', padding: '2px 8px', borderRadius: '12px' }}>
                            <Check size={12} />
                            {reminderStats.completed} / {reminderStats.total} Completed
                        </div>
                    )}
                </div>
            )}

            {/* Notification Toast */}
            {notification && (
                <div style={{
                    position: 'absolute', top: 20, right: 20, zIndex: 1000,
                    background: 'var(--bg-card)', padding: '16px', borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.2)', border: '1px solid var(--border-color)',
                    display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '300px',
                    animation: 'slideIn 0.3s ease-out'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Bell size={16} color="var(--accent-color)" />
                            {notification.title}
                        </div>
                        <button onClick={() => setNotification(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                            <X size={16} />
                        </button>
                    </div>
                    <div>{notification.body}</div>
                </div>
            )}

            {/* Input Area */}
            <div className="organizer-input-container">
                <div className="organizer-input-card">
                    <div className="organizer-input-row" style={{ alignItems: selectedType === 'note' ? 'flex-start' : 'center' }}>
                        {/* Type Dropdown / Select */}
                        <div className="organizer-type-select">
                            {(['note', 'reminder', 'alarm'] as const).map(t => (
                                <button
                                    key={t}
                                    onClick={() => setSelectedType(t)}
                                    title={`Add ${t}`}
                                    style={{
                                        padding: '6px',
                                        borderRadius: '4px',
                                        border: 'none',
                                        background: selectedType === t ? 'var(--bg-card)' : 'transparent',
                                        color: selectedType === t ? 'var(--accent-color)' : 'var(--text-tertiary)',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        boxShadow: selectedType === t ? '0 1px 2px rgba(0,0,0,0.1)' : 'none'
                                    }}
                                >
                                    {t === 'note' && <StickyNote size={16} />}
                                    {t === 'reminder' && <Calendar size={16} />}
                                    {t === 'alarm' && <Bell size={16} />}
                                </button>
                            ))}
                        </div>

                        <div className="organizer-input-field" data-color-mode={editorTheme}>
                            {selectedType === 'note' ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        <input
                                            type="text"
                                            value={newItemTitle}
                                            onChange={(e) => setNewItemTitle(e.target.value)}
                                            placeholder="Title (optional)"
                                            style={{ ...inputStyle, fontWeight: 'bold' }}
                                        />
                                        <div className="color-picker-trigger" style={{ position: 'relative', display: 'flex', gap: 2 }}>
                                            {colors.slice(1).map(color => (
                                                <button
                                                    key={color.name}
                                                    onClick={() => setNewItemColor(color.value)}
                                                    title={color.name}
                                                    style={{
                                                        width: 16, height: 16, borderRadius: '50%', border: newItemColor === color.value ? '2px solid var(--text-primary)' : '1px solid var(--border-color)',
                                                        backgroundColor: color.value,
                                                        cursor: 'pointer'
                                                    }}
                                                />
                                            ))}
                                            <button
                                                onClick={() => setNewItemColor(undefined)}
                                                title="None"
                                                style={{
                                                    width: 16, height: 16, borderRadius: '50%', border: '1px solid var(--border-color)',
                                                    backgroundColor: 'transparent',
                                                    cursor: 'pointer',
                                                    position: 'relative'
                                                }}
                                            >
                                                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%) rotate(45deg)', width: '1px', height: '100%', background: 'var(--text-secondary)' }} />
                                            </button>
                                        </div>
                                    </div>

                                    <input
                                        type="text"
                                        value={newItemTags}
                                        onChange={(e) => setNewItemTags(e.target.value)}
                                        placeholder="Tags (comma separated)"
                                        style={{ ...inputStyle, fontSize: '0.8rem' }}
                                    />

                                    <div className="note-editor-wrapper" style={{ zIndex: 50 }}>
                                        <MDEditor
                                            value={newItemContent}
                                            onChange={(val) => setNewItemContent(val || '')}
                                            preview="edit"
                                            height={150}
                                            className="custom-md-editor"
                                            style={{ background: 'var(--bg-input)', color: 'var(--text-primary)' }}
                                            textareaProps={{
                                                placeholder: "Take a note..."
                                            }}
                                        />
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <input
                                        type="text"
                                        value={newItemContent}
                                        onChange={(e) => setNewItemContent(e.target.value)}
                                        placeholder={selectedType === 'reminder' ? "Remind me to..." : "Alarm label"}
                                        style={inputStyle}
                                        className="main-input"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleAddItem();
                                        }}
                                    />

                                    {selectedType === 'reminder' && (
                                        <input
                                            type="datetime-local"
                                            value={reminderDate}
                                            onChange={(e) => setReminderDate(e.target.value)}
                                            style={{ ...inputStyle, flex: '0 0 auto', width: 'auto' }}
                                        />
                                    )}

                                    {selectedType === 'alarm' && (
                                        <input
                                            type="time"
                                            value={alarmTime}
                                            onChange={(e) => setAlarmTime(e.target.value)}
                                            style={{ ...inputStyle, flex: '0 0 auto', width: 'auto', fontWeight: 'bold' }}
                                        />
                                    )}
                                </>
                            )}
                        </div>

                        <button
                            className="add-btn"
                            onClick={handleAddItem}
                            style={{
                                background: 'var(--accent-color)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                width: '36px',
                                height: '36px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                marginTop: selectedType === 'note' ? '0' : '0'
                            }}
                        >
                            <Plus size={18} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Content List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 20px' }} data-color-mode={editorTheme}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {combinedItems.length === 0 && (
                        <div className="empty-state">
                            <Check size={40} style={{ marginBottom: 16 }} />
                            <div>{searchQuery ? 'No matching items' : 'All caught up!'}</div>
                        </div>
                    )}

                    <DragDropContext onDragEnd={onDragEnd}>
                        <Droppable droppableId="organizer-list">
                            {(provided) => (
                                <div
                                    {...provided.droppableProps}
                                    ref={provided.innerRef}
                                    style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
                                >
                                    {combinedItems.map((item, index) => {
                                        // Define unique drag ID
                                        let draggableId = '';
                                        if (item.type === 'note') draggableId = `note-${(item.data as Note).id}`;
                                        if (item.type === 'reminder') draggableId = `reminder-${(item.data as Reminder).id}`;
                                        if (item.type === 'alarm') draggableId = `alarm-${(item.data as Alarm).id}`;

                                        return (
                                            <Draggable key={draggableId} draggableId={draggableId} index={index} isDragDisabled={sortMode !== 'manual'}>
                                                {(provided, snapshot) => (
                                                    <div
                                                        ref={provided.innerRef}
                                                        {...provided.draggableProps}
                                                        style={{
                                                            ...provided.draggableProps.style,
                                                            opacity: snapshot.isDragging ? 0.8 : 1,
                                                        }}
                                                    >
                                                        <div style={{ position: 'relative', display: 'flex', gap: 8 }}>
                                                            {sortMode === 'manual' && (
                                                                <div
                                                                    {...provided.dragHandleProps}
                                                                    style={{ display: 'flex', alignItems: 'center', color: 'var(--text-tertiary)', cursor: 'grab', flexShrink: 0 }}
                                                                >
                                                                    <GripVertical size={16} />
                                                                </div>
                                                            )}
                                                            <div style={{ flex: 1 }}>
                                                                <ItemContent
                                                                    item={item}
                                                                    theme={theme}
                                                                    editorTheme={editorTheme}
                                                                    editingNoteId={editingNoteId}
                                                                    editingNoteTitle={editingNoteTitle}
                                                                    editingNoteContent={editingNoteContent}
                                                                    editingNoteColor={editingNoteColor}
                                                                    searchQuery={searchQuery}
                                                                    colors={colors}
                                                                    inputStyle={inputStyle}
                                                                    setEditingNoteTitle={setEditingNoteTitle}
                                                                    setEditingNoteColor={setEditingNoteColor}
                                                                    setEditingNoteContent={setEditingNoteContent}
                                                                    startEditing={startEditing}
                                                                    saveEditing={saveEditing}
                                                                    cancelEditing={cancelEditing}
                                                                    handleTogglePin={handleTogglePin}
                                                                    handleArchive={handleArchive}
                                                                    handleDelete={handleDelete}
                                                                    handleToggleReminder={handleToggleReminder}
                                                                    handleToggleAlarm={handleToggleAlarm}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </Draggable>
                                        );
                                    })}
                                    {provided.placeholder}
                                </div>
                            )}
                        </Droppable>
                    </DragDropContext>
                </div>
            </div>
        </div>
    );
}

// Extracted ItemContent component to properly handle the loop + DnD structure
function ItemContent(props: any) {
    const {
        item, theme, editorTheme, editingNoteId,
        editingNoteTitle, editingNoteContent, editingNoteColor, searchQuery,
        colors, inputStyle, setEditingNoteTitle, setEditingNoteColor,
        setEditingNoteContent, startEditing, saveEditing, cancelEditing,
        handleTogglePin, handleArchive, handleDelete, handleToggleReminder, handleToggleAlarm
    } = props;

    // RENDER NOTE: Markdown Support
    if (item.type === 'note') {
        const note = item.data as Note;
        const isEditing = editingNoteId === note.id;

        // Simple highlight helper
        const getHighlightedContent = (content: string, query: string) => {
            if (!query || !query.trim()) return content;
            try {
                const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
                return content.replace(regex, '<mark style="background: rgba(255, 255, 0, 0.4); color: inherit; border-radius: 2px;">$1</mark>');
            } catch (e) {
                return content;
            }
        };

        const displayContent = isEditing ? note.content : getHighlightedContent(note.content, searchQuery);

        return (
            <div
                className="snippet-card"
                style={{
                    padding: '16px',
                    display: 'flex',
                    gap: '12px',
                    overflow: isEditing ? 'visible' : 'hidden',
                    transform: isEditing ? 'none' : undefined,
                    zIndex: isEditing ? 100 : undefined,
                    backgroundColor: isEditing
                        ? (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'rgba(50, 52, 58, 1)' : 'rgba(255, 255, 255, 1)')
                        : (note.color ? note.color : undefined)
                }}
            >
                <div style={{ color: '#f59e0b', marginTop: '2px', flexShrink: 0 }}><StickyNote size={18} /></div>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {isEditing ? (
                        <div data-color-mode={editorTheme} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <input
                                    type="text"
                                    value={editingNoteTitle}
                                    onChange={(e) => setEditingNoteTitle(e.target.value)}
                                    placeholder="Title"
                                    style={{ ...inputStyle, fontWeight: 'bold' }}
                                    autoFocus
                                />
                                <div className="color-picker-trigger" style={{ position: 'relative', display: 'flex', gap: 2 }}>
                                    {colors.slice(1).map((color: any) => (
                                        <button
                                            key={color.name}
                                            onClick={() => setEditingNoteColor(color.value)}
                                            title={color.name}
                                            style={{
                                                width: 16, height: 16, borderRadius: '50%', border: editingNoteColor === color.value ? '2px solid var(--text-primary)' : '1px solid var(--border-color)',
                                                backgroundColor: color.value,
                                                cursor: 'pointer'
                                            }}
                                        />
                                    ))}
                                    <button
                                        onClick={() => setEditingNoteColor(undefined)}
                                        title="None"
                                        style={{
                                            width: 16, height: 16, borderRadius: '50%', border: '1px solid var(--border-color)',
                                            backgroundColor: 'transparent',
                                            cursor: 'pointer',
                                            position: 'relative'
                                        }}
                                    >
                                        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%) rotate(45deg)', width: '1px', height: '100%', background: 'var(--text-secondary)' }} />
                                    </button>
                                </div>
                            </div>

                            <div style={{ zIndex: 100 }}>
                                <MDEditor
                                    value={editingNoteContent}
                                    onChange={(val) => setEditingNoteContent(val || '')}
                                    preview="edit"
                                    height={300}
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                <button onClick={cancelEditing} className="icon-btn" style={{ padding: '6px 12px', fontSize: '0.85rem' }}>Cancel</button>
                                <button onClick={saveEditing} className="primary-btn" style={{ padding: '6px 12px', fontSize: '0.85rem' }}>Save</button>
                            </div>
                        </div>
                    ) : (
                        <div
                            onClick={() => startEditing(note)}
                            style={{ cursor: 'pointer', position: 'relative' }}
                        >
                            {note.title && (
                                <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '4px' }}>
                                    {note.title}
                                </div>
                            )}
                            <div className="clip-markdown">
                                <MDEditor.Markdown source={displayContent} style={{ background: 'transparent', color: 'inherit', fontSize: '0.95rem' }} />
                            </div>
                            {note.tags && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '8px' }}>
                                    {note.tags.split(',').map((tag: string) => tag.trim()).filter(Boolean).map((tag: string, i: number) => (
                                        <span key={i} style={{ fontSize: '0.7rem', background: 'var(--bg-hover)', padding: '2px 6px', borderRadius: '4px', color: 'var(--text-secondary)' }}>
                                            #{tag}
                                        </span>
                                    ))}
                                </div>
                            )}
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '8px', opacity: 0.8 }}>
                                {new Date(note.updated_at).toLocaleString()}
                            </div>
                        </div>
                    )}
                </div>
                {!isEditing && (
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'flex-start' }}>
                        <button
                            onClick={(e) => { e.stopPropagation(); handleTogglePin(note); }}
                            className={`icon-btn`}
                            style={{ height: 'fit-content', opacity: note.is_pinned ? 1 : 0.3 }}
                            title={note.is_pinned ? "Unpin" : "Pin Note"}
                        >
                            <Pin size={14} fill={note.is_pinned ? "currentColor" : "none"} />
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); handleArchive(note); }}
                            className="icon-btn"
                            style={{ height: 'fit-content', opacity: 0.3 }}
                            title={note.is_archived ? "Unarchive" : "Archive"}
                        >
                            <Archive size={14} />
                        </button>
                        <button onClick={() => handleDelete('note', note.id)} className="icon-btn" style={{ height: 'fit-content', opacity: 0.5 }}>
                            <Trash2 size={14} />
                        </button>
                    </div>
                )}
            </div>
        );
    }

    // RENDER REMINDER: Overdue Check
    if (item.type === 'reminder') {
        const reminder = item.data as Reminder;
        const isOverdue = !reminder.completed && reminder.due_date && new Date(reminder.due_date) < new Date();

        return (
            <div className="snippet-card" style={{
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                opacity: reminder.completed ? 0.6 : 1,
                borderLeft: isOverdue ? '3px solid #ef4444' : undefined
            }}>
                <div
                    onClick={() => handleToggleReminder(reminder.id)}
                    style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '6px',
                        border: `2px solid ${reminder.completed ? 'var(--accent-color)' : 'var(--text-secondary)'}`,
                        background: reminder.completed ? 'var(--accent-color)' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        flexShrink: 0,
                        transition: 'all 0.2s'
                    }}
                >
                    {reminder.completed && <Check size={14} color="white" strokeWidth={3} />}
                </div>

                <div style={{ flex: 1 }}>
                    <div style={{
                        textDecoration: reminder.completed ? 'line-through' : 'none',
                        color: reminder.completed ? 'var(--text-secondary)' : 'var(--text-primary)',
                        fontWeight: 500
                    }}>
                        {reminder.content}
                    </div>
                    {reminder.due_date && (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem',
                            color: reminder.completed ? 'var(--text-tertiary)' : isOverdue ? '#ef4444' : 'var(--accent-color)',
                            marginTop: '4px',
                            fontWeight: isOverdue ? 600 : 400
                        }}>
                            {isOverdue ? <AlertCircle size={12} /> : <Calendar size={12} />}
                            <span>{new Date(reminder.due_date).toLocaleString()}</span>
                            {isOverdue && <span>(Overdue)</span>}
                        </div>
                    )}
                </div>

                <button onClick={() => handleDelete('reminder', reminder.id)} className="icon-btn">
                    <Trash2 size={14} />
                </button>
            </div>
        );
    }

    // RENDER ALARM
    if (item.type === 'alarm') {
        const alarm = item.data as Alarm;
        return (
            <div className="snippet-card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ color: '#ec4899', display: 'flex', alignItems: 'center' }}>
                    <Bell size={20} fill={alarm.active ? "currentColor" : "none"} />
                </div>

                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '1.4rem', fontWeight: 600, lineHeight: 1 }}>
                        {alarm.time}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        {alarm.label}
                    </div>
                </div>

                <div
                    onClick={() => handleToggleAlarm(alarm.id)}
                    style={{
                        width: '44px',
                        height: '24px',
                        background: alarm.active ? 'var(--accent-color)' : 'rgba(128,128,128,0.2)',
                        borderRadius: '20px',
                        position: 'relative',
                        cursor: 'pointer',
                        transition: 'background 0.2s',
                    }}
                >
                    <div style={{
                        width: '20px',
                        height: '20px',
                        background: 'white',
                        borderRadius: '50%',
                        position: 'absolute',
                        top: '2px',
                        left: alarm.active ? '22px' : '2px',
                        transition: 'left 0.2s',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
                    }} />
                </div>

                <button onClick={() => handleDelete('alarm', alarm.id)} className="icon-btn" style={{ marginLeft: '8px' }}>
                    <Trash2 size={14} />
                </button>
            </div>
        );
    }

    return null;
}
