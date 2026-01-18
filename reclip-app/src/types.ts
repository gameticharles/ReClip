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
    created_at: string;
    updated_at: string;
}
