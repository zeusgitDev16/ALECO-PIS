import React from 'react';
import { DATA_MANAGEMENT_ENTITIES } from '../../constants/dataManagementEntities';

const ComingSoonPlaceholder = ({ entityId }) => {
    const entity = DATA_MANAGEMENT_ENTITIES.find(e => e.id === entityId);
    const label = entity?.label || entityId;

    return (
        <div className="backup-content coming-soon-placeholder">
            <p className="coming-soon-message">
                Export, import, and archive for <strong>{label}</strong> is coming soon.
            </p>
        </div>
    );
};

export default ComingSoonPlaceholder;
