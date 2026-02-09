import { useState, useEffect, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Note, Reminder } from '../types';
import { Trash2, Plus, Check, Bell, Calendar, StickyNote, Search, X, AlertCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type ItemType = 'all' | 'note' | 'reminder' | 'alarm';

interface Alarm {
    id: string; // generated uuid for local state
    time: string;
    label: string;
    active: boolean;
}

export default function OrganizerPage() {
    // Data State
    const [notes, setNotes] = useState<Note[]>([]);
    const [reminders, setReminders] = useState<Reminder[]>([]);
    const [alarms, setAlarms] = useState<Alarm[]>([]);

    // UI State
    const [filter, setFilter] = useState<ItemType>('all');
    const [newItemContent, setNewItemContent] = useState('');
    const [selectedType, setSelectedType] = useState<Exclude<ItemType, 'all'>>('note');
    const [searchQuery, setSearchQuery] = useState('');
    const [editingNoteId, setEditingNoteId] = useState<number | null>(null);

    // Auxiliary Input State
    const [reminderDate, setReminderDate] = useState('');
    const [alarmTime, setAlarmTime] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setNotes(await invoke('get_notes'));
            setReminders(await invoke('get_reminders'));
        } catch (e) {
            console.error("Failed to load organizer data", e);
        }
    };

    // --- Actions ---

    const handleAddItem = async () => {
        if (selectedType === 'note') {
            if (!newItemContent.trim()) return;
            await invoke('add_note', { content: newItemContent });
            setNewItemContent('');
        } else if (selectedType === 'reminder') {
            if (!newItemContent.trim()) return;
            await invoke('add_reminder', {
                content: newItemContent,
                dueDate: reminderDate ? new Date(reminderDate).toISOString() : null
            });
            setNewItemContent('');
            setReminderDate('');
        } else if (selectedType === 'alarm') {
            if (!alarmTime) return;
            const newAlarm: Alarm = {
                id: crypto.randomUUID(),
                time: alarmTime,
                label: newItemContent || 'Alarm',
                active: true
            };
            setAlarms(prev => [...prev, newAlarm]);
            setNewItemContent('');
            setAlarmTime('');
        }
        loadData();
    };

    const handleDelete = async (type: 'note' | 'reminder' | 'alarm', id: number | string) => {
        if (confirm('Are you sure you want to delete this item?')) {
            if (type === 'note') await invoke('delete_note', { id });
            if (type === 'reminder') await invoke('delete_reminder', { id });
            if (type === 'alarm') setAlarms(prev => prev.filter(a => a.id !== id));
            loadData();
        }
    };

    const handleToggleReminder = async (id: number) => {
        await invoke('toggle_reminder', { id });
        loadData();
    };

    const handleUpdateNote = async (id: number, content: string) => {
        await invoke('update_note', { id, content });
        setEditingNoteId(null);
        loadData();
    };

    const handleToggleAlarm = (id: string) => {
        setAlarms(prev => prev.map(a => a.id === id ? { ...a, active: !a.active } : a));
    };


    // --- Derived Data ---

    const combinedItems = useMemo(() => {
        const items = [];

        // Filter helper
        const matchesSearch = (text: string) => text.toLowerCase().includes(searchQuery.toLowerCase());

        if (filter === 'all' || filter === 'note') {
            items.push(...notes.filter(n => matchesSearch(n.content)).map(n => ({ type: 'note' as const, data: n, date: new Date(n.updated_at) })));
        }
        if (filter === 'all' || filter === 'reminder') {
            items.push(...reminders.filter(r => matchesSearch(r.content)).map(r => ({ type: 'reminder' as const, data: r, date: r.due_date ? new Date(r.due_date) : new Date(r.created_at) })));
        }
        if (filter === 'all' || filter === 'alarm') {
            items.push(...alarms.filter(a => matchesSearch(a.label) || matchesSearch(a.time)).map(a => ({ type: 'alarm' as const, data: a, date: new Date() })));
        }

        return items.sort((a, b) => b.date.getTime() - a.date.getTime());
    }, [notes, reminders, alarms, filter, searchQuery]);

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
            <div className="titlebar" style={{ background: 'transparent', borderBottom: '1px solid var(--border-color)', height: '54px', padding: '0 20px' }}>
                <div className="title-left" style={{ fontSize: '1.1rem', gap: '16px' }}>
                    <span>Organizer</span>

                    {/* Search Field */}
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <Search size={14} style={{ position: 'absolute', left: 10, opacity: 0.5 }} />
                        <input
                            type="text"
                            placeholder="Search..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{
                                background: 'var(--bg-input)',
                                border: '1px solid var(--border-color)',
                                padding: '4px 10px 4px 30px',
                                borderRadius: '16px',
                                fontSize: '0.85rem',
                                color: 'var(--text-primary)',
                                outline: 'none',
                                width: '180px',
                                transition: 'width 0.2s'
                            }}
                            onFocus={(e) => e.target.style.width = '240px'}
                            onBlur={(e) => e.target.style.width = '180px'}
                        />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery('')} style={{ position: 'absolute', right: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
                                <X size={12} style={{ opacity: 0.5 }} />
                            </button>
                        )}
                    </div>
                </div>

                <div className="title-right" style={{ gap: '4px' }}>
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
                </div>
            </div>

            {/* Stats Bar */}
            {(reminderStats.overdue > 0 || reminderStats.total > 0) && (
                <div style={{ padding: '8px 20px 0', display: 'flex', gap: '12px' }}>
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

            {/* Input Area */}
            <div style={{ padding: '16px 20px 10px', flexShrink: 0 }}>
                <div style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    padding: '12px 16px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
                }}>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        {/* Type Dropdown / Select */}
                        <div style={{ display: 'flex', background: 'var(--bg-input)', borderRadius: '6px', padding: '2px', border: '1px solid var(--border-color)' }}>
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

                        <div style={{ flex: 1, display: 'flex', gap: '8px' }}>
                            <input
                                type="text"
                                value={newItemContent}
                                onChange={(e) => setNewItemContent(e.target.value)}
                                placeholder={selectedType === 'note' ? "Take a note..." : selectedType === 'reminder' ? "Remind me to..." : "Alarm label"}
                                style={inputStyle}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && selectedType !== 'reminder' && selectedType !== 'alarm') handleAddItem();
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
                        </div>

                        <button
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
                                cursor: 'pointer'
                            }}
                        >
                            <Plus size={18} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Content List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 20px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {combinedItems.length === 0 && (
                        <div className="empty-state">
                            <Check size={40} style={{ marginBottom: 16 }} />
                            <div>{searchQuery ? 'No matching items' : 'All caught up!'}</div>
                        </div>
                    )}

                    {combinedItems.map((item) => {
                        // RENDER NOTE: Markdown Support
                        if (item.type === 'note') {
                            const note = item.data as Note;
                            const isEditing = editingNoteId === note.id;

                            return (
                                <div key={`note-${note.id}`} className="snippet-card" style={{ padding: '16px', display: 'flex', gap: '12px' }}>
                                    <div style={{ color: '#f59e0b', marginTop: '2px', flexShrink: 0 }}><StickyNote size={18} /></div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        {isEditing ? (
                                            <textarea
                                                autoFocus
                                                defaultValue={note.content}
                                                onBlur={(e) => handleUpdateNote(note.id, e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' && e.ctrlKey) {
                                                        handleUpdateNote(note.id, e.currentTarget.value);
                                                    }
                                                }}
                                                style={{
                                                    width: '100%',
                                                    background: 'var(--bg-input)',
                                                    border: '1px solid var(--accent-color)',
                                                    borderRadius: '4px',
                                                    color: 'var(--text-primary)',
                                                    fontSize: '0.95rem',
                                                    resize: 'vertical',
                                                    fontFamily: 'inherit',
                                                    outline: 'none',
                                                    minHeight: '60px',
                                                    padding: '8px'
                                                }}
                                            />
                                        ) : (
                                            <div
                                                onClick={() => setEditingNoteId(note.id)}
                                                className="clip-markdown"
                                                style={{
                                                    cursor: 'text',
                                                    fontSize: '0.95rem',
                                                    color: 'var(--text-primary)'
                                                }}
                                            >
                                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                    {note.content}
                                                </ReactMarkdown>
                                            </div>
                                        )}
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '8px', opacity: 0.8 }}>
                                            {new Date(note.updated_at).toLocaleString()}
                                        </div>
                                    </div>
                                    <button onClick={() => handleDelete('note', note.id)} className="icon-btn" style={{ height: 'fit-content', opacity: 0.5 }}>
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            );
                        }

                        // RENDER REMINDER: Overdue Check
                        if (item.type === 'reminder') {
                            const reminder = item.data as Reminder;
                            const isOverdue = !reminder.completed && reminder.due_date && new Date(reminder.due_date) < new Date();

                            return (
                                <div key={`reminder-${reminder.id}`} className="snippet-card" style={{
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
                                <div key={`alarm-${alarm.id}`} className="snippet-card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '16px' }}>
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
                    })}
                </div>
            </div>
        </div>
    );
}
