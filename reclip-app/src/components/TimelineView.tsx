import { useState, useMemo } from 'react';
import { Clip } from '../types';

type ZoomLevel = 'hour' | 'day' | 'week' | 'month' | 'year';

interface TimelineViewProps {
    clips: Clip[];
    onSelectTimeRange: (startDate: Date | null, endDate: Date | null) => void;
    onExportRange: (clips: Clip[]) => void;
    visible: boolean;
}

interface TimelineMarker {
    date: Date;
    endDate: Date;
    count: number;
    label: string;
    position: number;
    intensity: number; // 0-1 for heatmap
}

export function TimelineView({ clips, onSelectTimeRange, onExportRange, visible }: TimelineViewProps) {
    const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('hour');
    const [selectedRange, setSelectedRange] = useState<{ start: number; end: number }>({ start: 0, end: 100 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState<number | null>(null);

    // Group clips by time periods based on zoom level
    const timelineData = useMemo(() => {
        if (!clips.length) return { markers: [], range: { start: new Date(), end: new Date() }, maxCount: 1 };

        const now = new Date();
        const sortedClips = [...clips].sort((a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        const oldest = new Date(sortedClips[sortedClips.length - 1]?.created_at || now);
        const newest = new Date(sortedClips[0]?.created_at || now);
        const range = newest.getTime() - oldest.getTime();

        // Get bucket key based on zoom level
        const getBucketKey = (date: Date): string => {
            switch (zoomLevel) {
                case 'hour':
                    return `${date.toDateString()}-${date.getHours()}`;
                case 'day':
                    return date.toDateString();
                case 'week':
                    const weekStart = new Date(date);
                    weekStart.setDate(date.getDate() - date.getDay());
                    return weekStart.toDateString();
                case 'month':
                    return `${date.getFullYear()}-${date.getMonth()}`;
                case 'year':
                    return `${date.getFullYear()}`;
            }
        };

        // Get bucket date range
        const getBucketRange = (date: Date): { start: Date; end: Date } => {
            const start = new Date(date);
            const end = new Date(date);
            switch (zoomLevel) {
                case 'hour':
                    start.setMinutes(0, 0, 0);
                    end.setMinutes(59, 59, 999);
                    break;
                case 'day':
                    start.setHours(0, 0, 0, 0);
                    end.setHours(23, 59, 59, 999);
                    break;
                case 'week':
                    start.setDate(date.getDate() - date.getDay());
                    start.setHours(0, 0, 0, 0);
                    end.setDate(start.getDate() + 6);
                    end.setHours(23, 59, 59, 999);
                    break;
                case 'month':
                    start.setDate(1);
                    start.setHours(0, 0, 0, 0);
                    end.setMonth(date.getMonth() + 1, 0);
                    end.setHours(23, 59, 59, 999);
                    break;
                case 'year':
                    start.setMonth(0, 1);
                    start.setHours(0, 0, 0, 0);
                    end.setMonth(11, 31);
                    end.setHours(23, 59, 59, 999);
                    break;
            }
            return { start, end };
        };

        // Create buckets
        const buckets = new Map<string, { date: Date; endDate: Date; count: number }>();
        clips.forEach(clip => {
            const date = new Date(clip.created_at);
            const key = getBucketKey(date);
            if (!buckets.has(key)) {
                const { start, end } = getBucketRange(date);
                buckets.set(key, { date: start, endDate: end, count: 0 });
            }
            buckets.get(key)!.count++;
        });

        // Find max count for intensity
        let maxCount = 1;
        buckets.forEach(b => { if (b.count > maxCount) maxCount = b.count; });

        // Convert buckets to markers
        const markers: TimelineMarker[] = [];
        buckets.forEach(({ date, endDate, count }) => {
            const hoursAgo = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
            let label = '';
            if (zoomLevel === 'hour') {
                if (hoursAgo === 0) label = 'Now';
                else if (hoursAgo < 24) label = `${hoursAgo}h ago`;
                else label = date.toLocaleDateString();
            } else if (zoomLevel === 'day') {
                if (hoursAgo < 24) label = 'Today';
                else if (hoursAgo < 48) label = 'Yesterday';
                else label = date.toLocaleDateString();
            } else if (zoomLevel === 'week') {
                label = `Week of ${date.toLocaleDateString()}`;
            } else {
                label = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
            }

            const position = range === 0 ? 50 : ((date.getTime() - oldest.getTime()) / range) * 100;
            const intensity = count / maxCount;
            markers.push({ date, endDate, count, label, position, intensity });
        });

        markers.sort((a, b) => a.position - b.position);

        return { markers, range: { start: oldest, end: newest }, maxCount };
    }, [clips, zoomLevel]);

    // Get clips in selected range
    const clipsInRange = useMemo(() => {
        if (selectedRange.start === 0 && selectedRange.end === 100) return clips;

        const { start, end } = timelineData.range;
        const rangeMs = end.getTime() - start.getTime();
        const filterStart = new Date(start.getTime() + (selectedRange.start / 100) * rangeMs);
        const filterEnd = new Date(start.getTime() + (selectedRange.end / 100) * rangeMs);

        return clips.filter(clip => {
            const clipDate = new Date(clip.created_at);
            return clipDate >= filterStart && clipDate <= filterEnd;
        });
    }, [clips, selectedRange, timelineData.range]);

    // Handle mouse events for range selection
    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const pos = ((e.clientX - rect.left) / rect.width) * 100;
        setDragStart(pos);
        setIsDragging(true);
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isDragging || dragStart === null) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const pos = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
        const start = Math.min(dragStart, pos);
        const end = Math.max(dragStart, pos);
        setSelectedRange({ start, end });
    };

    const handleMouseUp = () => {
        if (isDragging && selectedRange.start !== selectedRange.end) {
            const { start, end } = timelineData.range;
            const rangeMs = end.getTime() - start.getTime();
            const filterStart = new Date(start.getTime() + (selectedRange.start / 100) * rangeMs);
            const filterEnd = new Date(start.getTime() + (selectedRange.end / 100) * rangeMs);
            onSelectTimeRange(filterStart, filterEnd);
        }
        setIsDragging(false);
        setDragStart(null);
    };

    const clearSelection = () => {
        setSelectedRange({ start: 0, end: 100 });
        onSelectTimeRange(null, null);
    };


    if (!visible) return null;

    const hasSelection = selectedRange.start !== 0 || selectedRange.end !== 100;

    return (
        <div className="timeline-container" style={{
            padding: '12px 16px',
            background: 'var(--bg-card)',
            borderRadius: '12px',
            marginBottom: '12px',
            boxShadow: 'var(--shadow-sm)',
        }}>
            {/* Header with Zoom Controls */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '12px',
                flexWrap: 'wrap',
                gap: '8px',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, opacity: 0.8 }}>
                        📅 Timeline
                    </span>
                    <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>
                        {clips.length} clips
                    </span>
                </div>

                {/* Zoom Level Buttons */}
                <div style={{ display: 'flex', gap: '4px', fontSize: '0.7rem' }}>
                    {(['hour', 'day', 'week', 'month', 'year'] as ZoomLevel[]).map(level => (
                        <button
                            key={level}
                            onClick={() => setZoomLevel(level)}
                            style={{
                                padding: '3px 8px',
                                borderRadius: '4px',
                                border: 'none',
                                background: zoomLevel === level ? 'var(--accent-color)' : 'rgba(128,128,128,0.2)',
                                color: zoomLevel === level ? 'white' : 'inherit',
                                cursor: 'pointer',
                                fontWeight: zoomLevel === level ? 600 : 400,
                                textTransform: 'capitalize',
                            }}
                        >
                            {level}
                        </button>
                    ))}
                </div>
            </div>

            {/* Timeline Track with Heatmap */}
            <div
                style={{
                    position: 'relative',
                    height: '40px',
                    marginBottom: '4px',
                    cursor: 'crosshair',
                }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
            >
                {/* Track Background */}
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: 0,
                    right: 0,
                    height: '16px',
                    background: 'rgba(128,128,128,0.1)',
                    borderRadius: '8px',
                    transform: 'translateY(-50%)',
                    overflow: 'hidden',
                }}>
                    {/* Heatmap Markers */}
                    {timelineData.markers.map((marker, i) => {
                        const width = Math.max(2, 100 / Math.max(timelineData.markers.length, 1));
                        return (
                            <div
                                key={i}
                                style={{
                                    position: 'absolute',
                                    left: `${marker.position}%`,
                                    top: 0,
                                    bottom: 0,
                                    width: `${width}%`,
                                    background: `linear-gradient(180deg, 
                                        rgba(var(--accent-rgb, 99, 102, 241), ${marker.intensity * 0.8}) 0%, 
                                        rgba(var(--accent-rgb, 99, 102, 241), ${marker.intensity * 0.3}) 100%)`,
                                    transform: 'translateX(-50%)',
                                }}
                                title={`${marker.label}: ${marker.count} clips`}
                            />
                        );
                    })}
                </div>

                {/* Selection Overlay */}
                {hasSelection && (
                    <div style={{
                        position: 'absolute',
                        top: '50%',
                        left: `${selectedRange.start}%`,
                        width: `${selectedRange.end - selectedRange.start}%`,
                        height: '20px',
                        background: 'rgba(var(--accent-rgb, 99, 102, 241), 0.3)',
                        border: '2px solid var(--accent-color)',
                        borderRadius: '4px',
                        transform: 'translateY(-50%)',
                        pointerEvents: 'none',
                    }} />
                )}
            </div>

            {/* Time Labels and Stats */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '0.7rem',
                opacity: 0.6,
                paddingTop: '4px',
            }}>
                <span>{timelineData.range.start.toLocaleDateString()}</span>

                {hasSelection ? (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ color: 'var(--accent-color)', fontWeight: 600 }}>
                            {clipsInRange.length} clips selected
                        </span>
                        <button
                            onClick={() => onExportRange(clipsInRange)}
                            style={{
                                padding: '2px 6px',
                                borderRadius: '4px',
                                border: 'none',
                                background: 'var(--accent-color)',
                                color: 'white',
                                cursor: 'pointer',
                                fontSize: '0.65rem',
                            }}
                        >
                            Export
                        </button>
                        <button
                            onClick={clearSelection}
                            style={{
                                padding: '2px 6px',
                                borderRadius: '4px',
                                border: '1px solid rgba(239, 68, 68, 0.5)',
                                background: 'rgba(239, 68, 68, 0.1)',
                                color: '#ef4444',
                                cursor: 'pointer',
                                fontSize: '0.65rem',
                            }}
                        >
                            Clear
                        </button>
                    </div>
                ) : (
                    <span style={{ opacity: 0.5 }}>
                        Drag to select range
                    </span>
                )}

                <span>{timelineData.range.end.toLocaleDateString()}</span>
            </div>
        </div>
    );
}

export default TimelineView;
