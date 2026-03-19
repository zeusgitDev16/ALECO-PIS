import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Grid } from 'react-window';
import '../../CSS/TicketDashboard.css';
import TicketGridCard from './TicketGridCard';

const ROW_HEIGHT = 85;
const VIRTUALIZATION_THRESHOLD = 100;

const getColumnCount = (width) => {
    if (!width || width < 768) return 2;
    if (width < 1200) return 4;
    return 5;
};

/**
 * TicketGridVirtualized - Virtualized 2D grid for large ticket lists.
 * Uses react-window Grid to render only visible cells.
 */
const TicketGridVirtualized = ({
    tickets,
    selectedTicket,
    onSelectTicket,
    selectedIds,
    onToggleSelect
}) => {
    const containerRef = useRef(null);
    const [size, setSize] = useState({ width: 0, height: 500 });

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const updateSize = () => {
            if (el) {
                const width = el.clientWidth;
                const height = Math.max(400, el.clientHeight || 500);
                setSize((prev) => (prev.width !== width || prev.height !== height ? { width, height } : prev));
            }
        };

        updateSize();
        const ro = new ResizeObserver(updateSize);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const columnCount = getColumnCount(size.width);
    const rowCount = Math.ceil(tickets.length / columnCount);
    const columnWidth = size.width > 0 ? Math.floor(size.width / columnCount) : 200;

    const Cell = useCallback(
        ({ columnIndex, rowIndex, style, ariaAttributes }) => {
            const index = rowIndex * columnCount + columnIndex;
            if (index >= tickets.length) return null;

            const ticket = tickets[index];
            return (
                <div {...(ariaAttributes || {})} style={style}>
                    <div style={{ padding: '4px', height: '100%', boxSizing: 'border-box' }}>
                        <TicketGridCard
                            ticket={ticket}
                            isSelected={selectedTicket?.ticket_id === ticket.ticket_id}
                            isChecked={selectedIds?.includes(ticket.ticket_id)}
                            onSelectTicket={onSelectTicket}
                            onToggleSelect={onToggleSelect}
                        />
                    </div>
                </div>
            );
        },
        [tickets, columnCount, selectedTicket, selectedIds, onSelectTicket, onToggleSelect]
    );

    if (size.width <= 0) {
        return (
            <div ref={containerRef} className="ticket-grid-virtualized-container" style={{ width: '100%', height: 500, minHeight: 400 }}>
                <div className="ticket-list-status">Loading grid...</div>
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            className="ticket-grid-virtualized-container"
            style={{ width: '100%', height: 500, minHeight: 400 }}
        >
            <Grid
                columnCount={columnCount}
                columnWidth={columnWidth}
                rowCount={rowCount}
                rowHeight={ROW_HEIGHT}
                width={size.width}
                height={size.height}
                cellComponent={Cell}
                cellProps={{}}
                overscanCount={2}
            />
        </div>
    );
};

export default TicketGridVirtualized;
export { VIRTUALIZATION_THRESHOLD };
