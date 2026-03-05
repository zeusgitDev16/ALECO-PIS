import { useState, useEffect, useCallback } from 'react';

const useDraggable = () => {
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [startPos, setStartPos] = useState({ x: 0, y: 0 });

    useEffect(() => {
        if (!isDragging) return;

        const handleMove = (e) => {
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;

            // Using requestAnimationFrame ensures ultra-smooth 60fps dragging
            requestAnimationFrame(() => {
                setOffset({
                    x: clientX - startPos.x,
                    y: clientY - startPos.y
                });
            });
        };

        const handleEnd = () => setIsDragging(false);

        document.addEventListener('mousemove', handleMove);
        document.addEventListener('mouseup', handleEnd);
        document.addEventListener('touchmove', handleMove, { passive: false });
        document.addEventListener('touchend', handleEnd);

        return () => {
            document.removeEventListener('mousemove', handleMove);
            document.removeEventListener('mouseup', handleEnd);
            document.removeEventListener('touchmove', handleMove);
            document.removeEventListener('touchend', handleEnd);
        };
    }, [isDragging, startPos]);

    const onStart = useCallback((e) => {
        // THE FIX: If the user clicks a button, input, or anything with the .no-drag class, 
        // completely ignore the drag. This allows buttons to be clicked normally!
        if (e.target.closest('button, input, textarea, select, .no-drag')) {
            return; 
        }

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        setIsDragging(true);
        setStartPos({
            x: clientX - offset.x,
            y: clientY - offset.y
        });
    }, [offset]);

    return { x: offset.x, y: offset.y, onStart, isDragging };
};

export default useDraggable;