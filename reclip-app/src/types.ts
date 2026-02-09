export interface Clip {
    id: number;
    content: string;
    type: string;
    hash: string;
    created_at: string;
    pinned: boolean;
    favorite: boolean;
    tags?: string; // JSON string
    sender_app?: string;
    sensitive: boolean;
    position?: number | null;
}

export interface Snippet {
    id: number;
    title: string;
    content: string;
    language: string;
    tags: string;
    favorite: boolean;
    folder: string;
    description: string;
    version_history: string;  // JSON array of {content, timestamp}
    created_at: string;
    updated_at: string;
}

export interface Note {
    id: number;
    content: string;
    created_at: string;
    updated_at: string;
}

export interface Reminder {
    id: number;
    content: string;
    due_date?: string;
    completed: boolean;
    created_at: string;
}
