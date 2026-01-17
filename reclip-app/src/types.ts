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
}
