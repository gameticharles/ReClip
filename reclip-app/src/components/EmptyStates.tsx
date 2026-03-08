import React from 'react';
import { motion } from 'framer-motion';

interface EmptyStateProps {
    title: string;
    description: string;
    icon: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ title, description, icon }) => (
    <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.3 }}
        className="empty-state"
        style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '60px 20px',
            textAlign: 'center',
            color: 'var(--text-secondary)',
            opacity: 0.7
        }}
    >
        <div style={{ marginBottom: '16px', color: 'var(--accent-color)', opacity: 0.8 }}>
            {icon}
        </div>
        <h3 style={{ margin: '0 0 8px 0', fontSize: '1.2rem', color: 'var(--text-primary)' }}>{title}</h3>
        <p style={{ margin: 0, fontSize: '0.9rem', maxWidth: '300px' }}>{description}</p>
    </motion.div>
);

export const EmptySearchState = () => (
    <EmptyState
        title="No results found"
        description="We couldn't find any clips matching your search or filters."
        icon={
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                <path d="M11 8v6M8 11h6" stroke="rgba(128,128,128,0.5)" strokeWidth="1"></path>
            </svg>
        }
    />
);

export const EmptyFavoritesState = () => (
    <EmptyState
        title="No favorites yet"
        description="Star your most used clips to find them quickly here."
        icon={
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
            </svg>
        }
    />
);

export const EmptyFeedState = () => (
    <EmptyState
        title="Clipboard is empty"
        description="Copy any text, image, or file, and it will appear right here."
        icon={
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
        }
    />
);
