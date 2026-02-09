import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Note, Reminder } from '../types';
import { Trash2, Plus, Check, Bell, Calendar, StickyNote } from 'lucide-react';

export default function OrganizerPage() {
    const [notes, setNotes] = useState<Note[]>([]);
    const [reminders, setReminders] = useState<Reminder[]>([]);
    const [newNote, setNewNote] = useState('');
    const [newReminder, setNewReminder] = useState('');
    const [reminderDate, setReminderDate] = useState('');

    // Alarms state (ephemeral for now, or could be reminders with specific time)
    const [alarms, setAlarms] = useState<{ time: string, label: string, active: boolean }[]>([]);
    const [newAlarmTime, setNewAlarmTime] = useState('');
    const [newAlarmLabel, setNewAlarmLabel] = useState('');

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

    // --- Notes ---
    const handleAddNote = async () => {
        if (!newNote.trim()) return;
        try {
            await invoke('add_note', { content: newNote });
            setNewNote('');
            loadData();
        } catch (e) {
            console.error("Failed to add note", e);
        }
    };

    const handleDeleteNote = async (id: number) => {
        try {
            await invoke('delete_note', { id });
            loadData();
        } catch (e) {
            console.error("Failed to delete note", e);
        }
    };

    const handleUpdateNote = async (id: number, content: string) => {
        try {
            await invoke('update_note', { id, content });
            loadData();
        } catch (e) {
            console.error("Failed to update note", e);
        }
    };

    // --- Reminders ---
    const handleAddReminder = async () => {
        if (!newReminder.trim()) return;
        try {
            // Combine date if present
            // validation logic here?
            await invoke('add_reminder', {
                content: newReminder,
                dueDate: reminderDate ? new Date(reminderDate).toISOString() : null
            });
            setNewReminder('');
            setReminderDate('');
            loadData();
        } catch (e) {
            console.error("Failed to add reminder", e);
        }
    };

    const handleToggleReminder = async (id: number) => {
        try {
            await invoke('toggle_reminder', { id });
            loadData();
        } catch (e) {
            console.error("Failed to toggle reminder", e);
        }
    };

    const handleDeleteReminder = async (id: number) => {
        try {
            await invoke('delete_reminder', { id });
            loadData();
        } catch (e) {
            console.error("Failed to delete reminder", e);
        }
    };

    // --- Alarms (Basic Frontend Impl) ---
    const handleAddAlarm = () => {
        if (!newAlarmTime) return;
        const alarm = { time: newAlarmTime, label: newAlarmLabel || 'Alarm', active: true };
        setAlarms([...alarms, alarm]);
        setNewAlarmTime('');
        setNewAlarmLabel('');

        // In a real app, we'd schedule a system notification here
        // For now, just simulated
        setTimeout(() => {
            // check if still active/exists? 
            // This is just a UI demo for the "Alarms" widget requested
            // invoke('plugin:notification|notify', { body: alarm.label, title: 'Alarm' });
        }, calculateDelay(newAlarmTime));
    };

    const calculateDelay = (timeStr: string) => {
        const now = new Date();
        const [hours, minutes] = timeStr.split(':').map(Number);
        const target = new Date(now);
        target.setHours(hours, minutes, 0, 0);
        if (target <= now) target.setDate(target.getDate() + 1); // Next day
        return target.getTime() - now.getTime();
    };


    return (
        <div className="organizer-page" style={{
            padding: '20px',
            height: '100%',
            overflowY: 'auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '20px',
            alignContent: 'start'
        }}>
            {/* Notes Widget */}
            <div className="widget card" style={{
                background: 'var(--bg-secondary)',
                borderRadius: '12px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                border: '1px solid var(--border-color)',
                minHeight: '300px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                    <StickyNote size={18} color="var(--accent-color)" />
                    <h3 style={{ margin: 0, fontSize: '1rem' }}>Notes</h3>
                </div>

                <div className="notes-list" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {notes.map(note => (
                        <div key={note.id} className="note-item" style={{
                            background: 'var(--bg-primary)',
                            padding: '10px',
                            borderRadius: '8px',
                            position: 'relative',
                            border: '1px solid var(--border-color)'
                        }}>
                            <textarea
                                value={note.content}
                                onChange={(e) => {
                                    // Optimistic update
                                    setNotes(notes.map(n => n.id === note.id ? { ...n, content: e.target.value } : n));
                                }}
                                onBlur={(e) => handleUpdateNote(note.id, e.target.value)}
                                style={{
                                    width: '100%',
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--text-primary)',
                                    resize: 'none',
                                    outline: 'none',
                                    fontFamily: 'inherit',
                                    minHeight: '60px'
                                }}
                            />
                            <button
                                onClick={() => handleDeleteNote(note.id)}
                                style={{
                                    position: 'absolute',
                                    top: '4px',
                                    right: '4px',
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--text-tertiary)',
                                    cursor: 'pointer',
                                    padding: '4px'
                                }}
                                title="Delete Note"
                            >
                                <Trash2 size={14} />
                            </button>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', marginTop: '4px', textAlign: 'right' }}>
                                {new Date(note.updated_at).toLocaleString()}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="add-note" style={{ display: 'flex', gap: '8px' }}>
                    <input
                        type="text"
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
                        placeholder="New note..."
                        style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                    />
                    <button onClick={handleAddNote} className="icon-btn" style={{ background: 'var(--accent-color)', color: 'white', border: 'none', borderRadius: '6px', width: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                        <Plus size={18} />
                    </button>
                </div>
            </div>

            {/* Reminders Widget */}
            <div className="widget card" style={{
                background: 'var(--bg-secondary)',
                borderRadius: '12px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                border: '1px solid var(--border-color)',
                minHeight: '300px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                    <Calendar size={18} color="var(--accent-color)" />
                    <h3 style={{ margin: 0, fontSize: '1rem' }}>Reminders</h3>
                </div>

                <div className="reminders-list" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {reminders.map(reminder => (
                        <div key={reminder.id} style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            opacity: reminder.completed ? 0.6 : 1,
                            textDecoration: reminder.completed ? 'line-through' : 'none',
                            padding: '6px',
                            background: reminder.completed ? 'transparent' : 'var(--bg-primary)',
                            borderRadius: '6px'
                        }}>
                            <div
                                onClick={() => handleToggleReminder(reminder.id)}
                                style={{
                                    width: '18px',
                                    height: '18px',
                                    borderRadius: '4px',
                                    border: '1px solid var(--text-secondary)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    background: reminder.completed ? 'var(--accent-color)' : 'transparent',
                                    borderColor: reminder.completed ? 'var(--accent-color)' : 'var(--text-secondary)'
                                }}
                            >
                                {reminder.completed && <Check size={12} color="white" />}
                            </div>
                            <div style={{ flex: 1 }}>
                                <div>{reminder.content}</div>
                                {reminder.due_date && (
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                                        Due: {new Date(reminder.due_date).toLocaleString()}
                                    </div>
                                )}
                            </div>
                            <button onClick={() => handleDeleteReminder(reminder.id)} style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }}>
                                <Trash2 size={14} />
                            </button>
                        </div>
                    ))}
                </div>

                <div className="add-reminder" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                            type="text"
                            value={newReminder}
                            onChange={(e) => setNewReminder(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddReminder()}
                            placeholder="New reminder..."
                            style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                        />
                        <button onClick={handleAddReminder} className="icon-btn" style={{ background: 'var(--accent-color)', color: 'white', border: 'none', borderRadius: '6px', width: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                            <Plus size={18} />
                        </button>
                    </div>
                    <input
                        type="datetime-local"
                        value={reminderDate}
                        onChange={(e) => setReminderDate(e.target.value)}
                        style={{ padding: '6px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.8rem' }}
                    />
                </div>
            </div>

            {/* Alarms Widget */}
            <div className="widget card" style={{
                background: 'var(--bg-secondary)',
                borderRadius: '12px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                border: '1px solid var(--border-color)',
                minHeight: '200px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                    <Bell size={18} color="var(--accent-color)" />
                    <h3 style={{ margin: 0, fontSize: '1rem' }}>Alarms</h3>
                </div>

                <div className="alarms-list" style={{ flex: 1, overflowY: 'auto' }}>
                    {alarms.map((alarm, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px', borderBottom: '1px solid var(--border-color)' }}>
                            <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>{alarm.time}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{alarm.label}</div>
                            <div style={{
                                background: alarm.active ? 'var(--accent-color)' : 'gray',
                                padding: '2px 6px',
                                borderRadius: '10px',
                                fontSize: '0.7rem',
                                color: 'white'
                            }}>
                                {alarm.active ? 'ON' : 'OFF'}
                            </div>
                        </div>
                    ))}
                    {alarms.length === 0 && <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>No active alarms</div>}
                </div>

                <div className="add-alarm" style={{ display: 'flex', gap: '8px' }}>
                    <input
                        type="time"
                        value={newAlarmTime}
                        onChange={(e) => setNewAlarmTime(e.target.value)}
                        style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                    />
                    <input
                        type="text"
                        value={newAlarmLabel}
                        onChange={(e) => setNewAlarmLabel(e.target.value)}
                        placeholder="Label"
                        style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                    />
                    <button onClick={handleAddAlarm} style={{ background: 'var(--accent-color)', color: 'white', border: 'none', borderRadius: '6px', width: '32px', cursor: 'pointer' }}>
                        <Plus size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
}
