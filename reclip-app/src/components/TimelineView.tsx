import { useState, useMemo } from 'react';
import { Clip } from '../types';

interface TimelineViewProps {
    clips: Clip[];
    onSelectTime: (date: Date) => void;
    visible: boolean;
}

interface TimelineMarker {
    date: Date;
    count: number;
    label: string;
    position: number;
}

export function TimelineView({ clips, onSelectTime, visible }: TimelineViewProps) {
    const [sliderValue, setSliderValue] = useState(100);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);

    // Group clips by time periods
    const timelineData = useMemo(() => {
        if (!clips.length) return { markers: [], range: { start: new Date(), end: new Date() } };

        const now = new Date();
        const sortedClips = [...clips].sort((a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        const oldest = new Date(sortedClips[sortedClips.length - 1]?.created_at || now);
        const newest = new Date(sortedClips[0]?.created_at || now);
        const range = newest.getTime() - oldest.getTime();

        // Create time buckets
        const buckets = new Map<string, { date: Date; count: number }>();

        clips.forEach(clip => {
            const date = new Date(clip.created_at);
            const hourKey = `${date.toDateString()}-${date.getHours()}`;
            if (!buckets.has(hourKey)) {
                buckets.set(hourKey, { date, count: 0 });
            }
            buckets.get(hourKey)!.count++;
        });

        // Convert buckets to markers with positions
        const markers: TimelineMarker[] = [];
        buckets.forEach(({ date, count }) => {
            const hoursAgo = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
            let label = '';
            if (hoursAgo === 0) label = 'Now';
            else if (hoursAgo < 24) label = `${hoursAgo}h ago`;
            else if (hoursAgo < 48) label = 'Yesterday';
            else label = date.toLocaleDateString();

            const position = range === 0 ? 50 : ((date.getTime() - oldest.getTime()) / range) * 100;
            markers.push({ date, count, label, position });
        });

        markers.sort((a, b) => a.position - b.position);

        return { markers, range: { start: oldest, end: newest } };
    }, [clips]);

    const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseFloat(e.target.value);
        setSliderValue(value);

        const { start, end } = timelineData.range;
        const timestamp = start.getTime() + (value / 100) * (end.getTime() - start.getTime());
        const date = new Date(timestamp);
        setSelectedDate(date);
        onSelectTime(date);
    };

    const handleMarkerClick = (marker: TimelineMarker) => {
        setSliderValue(marker.position);
        setSelectedDate(marker.date);
        onSelectTime(marker.date);
    };

    if (!visible) return null;

    return (
        <div className="timeline-container" style={{
            padding: '12px 16px',
            background: 'var(--bg-card)',
            borderRadius: '12px',
            marginBottom: '12px',
            boxShadow: 'var(--shadow-sm)',
        }}>
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '12px'
            }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, opacity: 0.8 }}>
                    📅 Timeline
                </span>
                <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>
                    {clips.length} clips • {timelineData.markers.length} time periods
                </span>
            </div>

            {/* Timeline Track with Markers */}
            <div style={{ position: 'relative', height: '32px', marginBottom: '4px' }}>
                {/* Track Background */}
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: 0,
                    right: 0,
                    height: '6px',
                    background: 'var(--accent-color)',
                    opacity: 0.15,
                    borderRadius: '3px',
                    transform: 'translateY(-50%)',
                }} />

                {/* Filled Track */}
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: 0,
                    width: `${sliderValue}%`,
                    height: '6px',
                    background: 'var(--accent-color)',
                    opacity: 0.5,
                    borderRadius: '3px',
                    transform: 'translateY(-50%)',
                    transition: 'width 0.1s',
                }} />

                {/* Markers */}
                {timelineData.markers.slice(0, 30).map((marker, i) => {
                    const size = Math.min(14, 8 + Math.min(marker.count, 6));
                    const isActive = sliderValue >= marker.position;
                    return (
                        <div
                            key={i}
                            onClick={() => handleMarkerClick(marker)}
                            style={{
                                position: 'absolute',
                                left: `${marker.position}%`,
                                top: '50%',
                                transform: 'translate(-50%, -50%)',
                                width: `${size}px`,
                                height: `${size}px`,
                                borderRadius: '50%',
                                background: isActive ? 'var(--accent-color)' : 'rgba(128,128,128,0.5)',
                                border: '2px solid var(--bg-card)',
                                cursor: 'pointer',
                                transition: 'all 0.15s',
                                zIndex: 3,
                            }}
                            title={`${marker.label}: ${marker.count} clips`}
                        />
                    );
                })}

                {/* Slider Thumb Indicator */}
                <div style={{
                    position: 'absolute',
                    left: `${sliderValue}%`,
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    background: 'var(--accent-color)',
                    border: '3px solid var(--bg-app)',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                    zIndex: 5,
                    pointerEvents: 'none',
                }} />

                {/* Invisible Range Input */}
                <input
                    type="range"
                    min="0"
                    max="100"
                    step="0.5"
                    value={sliderValue}
                    onChange={handleSliderChange}
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        opacity: 0,
                        cursor: 'grab',
                        zIndex: 10,
                        margin: 0,
                    }}
                />
            </div>

            {/* Time Labels */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '0.7rem',
                opacity: 0.5,
                paddingTop: '4px',
            }}>
                <span>Oldest</span>
                <span style={{
                    color: selectedDate ? 'var(--accent-color)' : 'inherit',
                    fontWeight: selectedDate ? 600 : 400
                }}>
                    {selectedDate ? selectedDate.toLocaleString() : 'Drag to select time'}
                </span>
                <span>Now</span>
            </div>
        </div>
    );
}

export default TimelineView;
