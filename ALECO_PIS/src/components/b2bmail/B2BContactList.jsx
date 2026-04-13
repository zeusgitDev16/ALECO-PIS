import React, { useMemo } from 'react';

/**
 * Status badge component for contact verification state
 */
const VerificationBadge = ({ verified, active }) => {
  if (!active) {
    return <span className="b2b-status-badge b2b-status-inactive">Inactive</span>;
  }
  if (verified) {
    return <span className="b2b-status-badge b2b-status-verified">Verified</span>;
  }
  return <span className="b2b-status-badge b2b-status-unverified">Unverified</span>;
};

/**
 * @param {object} props
 * @param {Array} props.contacts - List of contact objects
 * @param {Array} props.selectedIds - Array of selected contact IDs
 * @param {(ids: number[]) => void} props.onSelectionChange - Callback with new selected IDs
 * @param {(contact: object) => void} props.onEdit - Edit contact callback
 * @param {(id: number) => void} props.onSendVerification - Send verification callback
 * @param {(id: number, active: boolean) => void} props.onToggleActive - Toggle active status
 * @param {boolean} props.loading - Loading state
 */
export default function B2BContactList({
  contacts,
  selectedIds,
  onSelectionChange,
  onEdit,
  onSendVerification,
  onToggleActive,
  loading,
}) {
  const visibleIds = useMemo(() => {
    return (contacts || []).map((c) => Number(c.id));
  }, [contacts]);

  const allVisibleSelected = useMemo(() => {
    if (!visibleIds.length) return false;
    return visibleIds.every((id) => selectedIds.includes(id));
  }, [visibleIds, selectedIds]);

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      // Deselect all visible
      const newSelected = selectedIds.filter((id) => !visibleIds.includes(id));
      onSelectionChange(newSelected);
    } else {
      // Select all visible
      const newSelected = [...new Set([...selectedIds, ...visibleIds])];
      onSelectionChange(newSelected);
    }
  };

  const toggleSelectOne = (id) => {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((sid) => sid !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  if (loading) {
    return (
      <div className="b2b-contact-list-loading">
        <div className="b2b-spinner" />
        <p>Loading contacts...</p>
      </div>
    );
  }

  if (!contacts || contacts.length === 0) {
    return (
      <div className="b2b-contact-list-empty">
        <p>No contacts found.</p>
        <p className="b2b-hint">Add a contact to get started with B2B messaging.</p>
      </div>
    );
  }

  return (
    <div className="b2b-contact-list">
      {/* Select-all bar above the table */}
      <div className="b2b-contact-table-header">
        <label className="b2b-select-all">
          <input
            type="checkbox"
            checked={allVisibleSelected}
            onChange={toggleSelectAll}
            aria-label="Select all contacts"
          />
          <span>Select All ({contacts.length})</span>
        </label>
      </div>

      {/* Real <table> — same pattern as TicketTableView for guaranteed column alignment */}
      <div className="b2b-contact-table-wrap">
        <table className="b2b-contact-table">
          <thead className="b2b-contact-thead">
            <tr className="b2b-contact-header-row">
              <th className="b2b-th b2b-th-checkbox" />
              <th className="b2b-th b2b-th-name">Contact</th>
              <th className="b2b-th b2b-th-email">Email</th>
              <th className="b2b-th b2b-th-company">Company</th>
              <th className="b2b-th b2b-th-feeder">Feeder</th>
              <th className="b2b-th b2b-th-status">Status</th>
              <th className="b2b-th b2b-th-actions">Actions</th>
            </tr>
          </thead>
          <tbody className="b2b-contact-tbody">
            {contacts.map((contact) => {
              const isSelected = selectedIds.includes(Number(contact.id));
              const isVerified = contact.email_verified === 1 || contact.email_verified === true;
              const isActive = contact.is_active === 1 || contact.is_active === true;

              return (
                <tr
                  key={contact.id}
                  className={`b2b-contact-tr${isSelected ? ' is-selected' : ''}`}
                >
                  <td className="b2b-td b2b-td-checkbox">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelectOne(Number(contact.id))}
                      aria-label={`Select ${contact.contact_name || contact.email}`}
                    />
                  </td>
                  <td className="b2b-td b2b-td-name">
                    <span className="b2b-contact-name">{contact.contact_name || '-'}</span>
                    {contact.phone && (
                      <span className="b2b-contact-phone">{contact.phone}</span>
                    )}
                  </td>
                  <td className="b2b-td b2b-td-email">{contact.email}</td>
                  <td className="b2b-td b2b-td-company">{contact.company_name || '-'}</td>
                  <td className="b2b-td b2b-td-feeder">{contact.feeder_label || '-'}</td>
                  <td className="b2b-td b2b-td-status">
                    <VerificationBadge verified={isVerified} active={isActive} />
                  </td>
                  <td className="b2b-td b2b-td-actions">
                    <button
                      type="button"
                      className="b2b-action-btn b2b-btn-edit"
                      onClick={() => onEdit(contact)}
                      title="Edit contact"
                    >
                      Edit
                    </button>
                    {!isVerified && isActive && (
                      <button
                        type="button"
                        className="b2b-action-btn b2b-btn-verify"
                        onClick={() => onSendVerification(Number(contact.id))}
                        title="Send verification email"
                      >
                        Verify
                      </button>
                    )}
                    <button
                      type="button"
                      className={`b2b-action-btn ${isActive ? 'b2b-btn-disable' : 'b2b-btn-enable'}`}
                      onClick={() => onToggleActive(Number(contact.id), !isActive)}
                      title={isActive ? 'Deactivate contact' : 'Activate contact'}
                    >
                      {isActive ? 'Disable' : 'Enable'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
