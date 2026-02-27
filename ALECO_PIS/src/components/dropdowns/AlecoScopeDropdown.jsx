import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ALECO_SCOPE } from '../../data/alecoScope';
import '../../CSS/AlecoScopeDropdown.css';

const AlecoScopeDropdown = ({ label, onLocationSelect }) => {
    const [sel, setSel] = useState({ dist: "", muni: "", brgy: "", purok: "" });
    const [searchTerm, setSearchTerm] = useState("");
    const [isSearching, setIsSearching] = useState(false);
    
    // TRACKER: Prevents objects from triggering loops by using a string key
    const lastEmittedKey = useRef("");

    // 1. Memoized Filter Logic: Prevents recalculation on every minor render
    const districtData = useMemo(() => ALECO_SCOPE.find(d => d.district === sel.dist), [sel.dist]);
    const availableMunis = useMemo(() => districtData?.municipalities || [], [districtData]);
    const muniData = useMemo(() => availableMunis.find(m => m.name === sel.muni), [availableMunis, sel.muni]);
    const availableBrgys = useMemo(() => muniData?.barangays || [], [muniData]);
    
    // 2. Search Logic
    const filteredBrgys = useMemo(() => 
        availableBrgys.filter(b => b.name.toLowerCase().includes(searchTerm.toLowerCase())),
        [availableBrgys, searchTerm]
    );

    const brgyData = useMemo(() => availableBrgys.find(b => b.name === sel.brgy), [availableBrgys, sel.brgy]);
    const availablePuroks = useMemo(() => 
        brgyData?.puroks || ["Purok 1", "Purok 2", "Purok 3", "Purok 4", "Purok 5", "Purok 6", "Purok 7"],
        [brgyData]
    );

    // 3. NUCLEAR LOOP PREVENTION: Syncing with Parent
    useEffect(() => {
        // Create a unique key for the current selection state
        const currentKey = `${sel.dist}|${sel.muni}|${sel.brgy}|${sel.purok}`;
        
        // ONLY fire if the values have changed (Semantic check)
        if (currentKey !== lastEmittedKey.current) {
            lastEmittedKey.current = currentKey; 

            if (sel.dist && sel.muni && sel.brgy && sel.purok) {
                onLocationSelect({
                    district: sel.dist,
                    municipality: sel.muni,
                    barangay: sel.brgy,
                    purok: sel.purok
                });
            } else {
                // Important: Backwards compatibility if user clears a field
                onLocationSelect(null);
            }
        }
    }, [sel, onLocationSelect]);

    return (
        <div className="aleco-mini-scope">
            {label && <label className="aleco-mini-scope-label">{label}</label>}

            {/* District & Municipality Row */}
            <div className="mini-row">
                <select 
                    value={sel.dist} 
                    onChange={(e) => {
                        setSel({dist: e.target.value, muni: "", brgy: "", purok: ""});
                        setSearchTerm("");
                        setIsSearching(false);
                    }}
                >
                    <option value="">District...</option>
                    {ALECO_SCOPE.map(d => <option key={d.district} value={d.district}>{d.district}</option>)}
                </select>

                {sel.dist && (
                    <select 
                        value={sel.muni} 
                        onChange={(e) => {
                            setSel(prev => ({...prev, muni: e.target.value, brgy: "", purok: ""}));
                            setSearchTerm("");
                            setIsSearching(false);
                        }}
                    >
                        <option value="">Town/City...</option>
                        {availableMunis.map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
                    </select>
                )}
            </div>

            {/* Searchable Barangay */}
            {sel.muni && (
                <div className="search-box-container">
                    {!sel.brgy || isSearching ? (
                        <input 
                            type="text" 
                            placeholder="Type to search Barangay..." 
                            className="mini-search"
                            value={searchTerm}
                            onFocus={() => setIsSearching(true)}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    ) : (
                        <div className="selected-tag" onClick={() => setIsSearching(true)}>
                            {sel.brgy} <span>(Change)</span>
                        </div>
                    )}

                    {isSearching && searchTerm && (
                        <div className="search-results">
                            {filteredBrgys.length > 0 ? (
                                filteredBrgys.slice(0, 5).map(b => (
                                    <div 
                                        key={b.name} 
                                        className="result-item" 
                                        onClick={() => {
                                            setSel(prev => ({...prev, brgy: b.name, purok: ""}));
                                            setIsSearching(false);
                                            setSearchTerm("");
                                        }}
                                    >
                                        {b.name}
                                    </div>
                                ))
                            ) : (
                                <div className="result-item no-match">No matches found</div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Purok Selection */}
            {sel.brgy && !isSearching && (
                <select 
                    className="purok-select" 
                    value={sel.purok} 
                    onChange={(e) => setSel(prev => ({...prev, purok: e.target.value}))}
                >
                    <option value="">Select Purok...</option>
                    {availablePuroks.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
            )}
        </div>
    );
};

export default AlecoScopeDropdown;