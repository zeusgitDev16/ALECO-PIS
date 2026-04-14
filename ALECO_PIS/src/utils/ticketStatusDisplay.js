/**
 * Human-readable ticket status for UI (matches DB enum values).
 */
export function formatTicketStatusLabel(status) {
    if (status === 'OnHold') return 'On Hold';
    return status || '';
}
