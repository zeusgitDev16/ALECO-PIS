-- Add OnHold as a first-class ticket status (dispatcher / SMS hold flows)
ALTER TABLE aleco_tickets
MODIFY COLUMN status ENUM(
    'Pending',
    'Ongoing',
    'OnHold',
    'Restored',
    'Unresolved',
    'NoFaultFound',
    'AccessDenied'
) DEFAULT 'Pending';
