import React, { useState, useRef } from 'react';
import '../../CSS/GroupIncidentModal.css'; 
import useDraggable from '../../utils/useDraggable'; // Import our drag engine

const GroupIncidentModal = ({ isOpen, onClose, selectedTickets, onSubmit }) => {
    const [title, setTitle] = useState('');
    const [category, setCategory] = useState('');
    const [remarks, setRemarks] = useState('');

    // Re-attaching the drag logic
    const modalRef = useRef(null);
    const { x, y, onStart } = useDraggable();

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        // Pass the array of IDs along with the form data back to the parent
        const ticketIds = selectedTickets.map(t => t.ticket_id);
        onSubmit({ title, category, remarks, ticketIds });
    };

    return (
        <div className="group-modal-overlay" onClick={onClose}>
            <div 
                ref={modalRef}
                className="group-modal-content" 
                onClick={(e) => e.stopPropagation()}
                style={{ transform: `translate(${x}px, ${y}px)` }} /* Applies the drag physics */
            >
                <button className="group-modal-close-btn" onClick={onClose}>×</button>
                
                {/* THE DRAGGABLE HEADER HANDLE */}
                <div 
                    className="group-modal-header-handle"
                    onMouseDown={onStart}
                    onTouchStart={onStart}
                >
                    <div className="drag-grip-indicator" title="Drag to move">⋮⋮</div>
                    <div>
                        <h2 className="group-modal-header">
                            🔗 Group {selectedTickets?.length || 0} Tickets
                        </h2>
                        <p className="group-modal-subtitle">
                            Create a Master Incident. All selected tickets will be linked to this umbrella.
                        </p>
                    </div>
                </div>

                {/* --- THE NEW TICKET SUMMARY SCANNER --- */}
                <div className="ticket-summary-section">
                    <div className="summary-header">
                        <label>Selected Tickets for Grouping</label>
                        <span className="future-ai-badge">AI Ready</span>
                    </div>
                    <div className="ticket-summary-scroll">
                        {selectedTickets?.map(ticket => (
                            <div key={ticket.ticket_id} className="summary-mini-card">
                                <div className="mini-card-left">
                                    <span className="mini-id">{ticket.ticket_id}</span>
                                    <span className="mini-cat">{ticket.category}</span>
                                </div>
                                <div className="mini-card-right">
                                    <span className="mini-loc">📍 {ticket.barangay}, {ticket.municipality}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* --- THE FORM --- */}
                <form onSubmit={handleSubmit}>
                    <div className="group-form-group">
                        <label>Master Category</label>
                        <select 
                            className="group-form-select"
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            required
                        >
                            <option value="">-- Select Category --</option>
                            <option value="PRIMARY LINE NO POWER">Primary Line No Power</option>
                            <option value="RESIDENCE NO POWER">Residence No Power</option>
                            <option value="ROTTEN POLE">Rotten Pole</option>
                            <option value="LEANING POLE">Leaning Pole</option>
                            <option value="SAGGING WIRE">Sagging Wire</option>
                            <option value="CUTOFF LIVE WIRE">Cutoff Live Wire</option>
                        </select>
                    </div>

                    <div className="group-form-group">
                        <label>Incident Title / Location</label>
                        <input 
                            type="text" 
                            className="group-form-input"
                            placeholder="e.g., Blown 50kVA Transformer - Brgy Rawis"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            required
                        />
                    </div>

                    <div className="group-form-group">
                        <label>Initial Remarks</label>
                        <textarea 
                            className="group-form-textarea"
                            placeholder="e.g., Lineman Team Alpha dispatched to assess the hardware damage."
                            value={remarks}
                            onChange={(e) => setRemarks(e.target.value)}
                        />
                    </div>

                    <div className="group-modal-actions">
                        <button type="button" className="btn-action btn-cancel" onClick={onClose}>
                            Cancel
                        </button>
                        <button type="submit" className="btn-action btn-resolve">
                            Confirm & Group
                        </button>
                    </div>
                </form>

            </div>
        </div>
    );
};

export default GroupIncidentModal;