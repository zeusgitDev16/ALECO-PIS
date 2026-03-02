import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ALECO_SCOPE } from '../../data/alecoScope';
import '../../CSS/AlecoScopeDropdown.css';

const AlecoScopeDropdown = ({ label, onLocationSelect, isFilter = false, layoutMode = 'form' }) => {
    const [sel, setSel] = useState({ dist: "", muni: "", brgy: "", purok: "" });
    const [searchTerm, setSearchTerm] = useState("");
    const [isSearching, setIsSearching] = useState(false);
    const lastEmittedKey = useRef("");

    // Identify if we are in Dashboard Inline mode
    const isInline = layoutMode === 'inline';

    // 1. CASCADING RESET LOGIC: Specifically for Inline/Filter mode
    const handleSelectChange = (level, value) => {
        setSel(prev => {
            if (level === 'dist') {
                return { dist: value, muni: "", brgy: "", purok: "" };
            }
            if (level === 'muni') {
                return { ...prev, muni: value, brgy: "", purok: "" };
            }
            if (level === 'brgy') {
                return { ...prev, brgy: value, purok: "" };
            }
            return { ...prev, [level]: value };
        });
        
        // Reset search states when selections change
        setSearchTerm("");
        setIsSearching(false);
    };

    // 2. Memoized Data Selectors
    const districtData = useMemo(() => ALECO_SCOPE.find(d => d.district === sel.dist), [sel.dist]);
    const availableMunis = useMemo(() => districtData?.municipalities || [], [districtData]);
    const muniData = useMemo(() => availableMunis.find(m => m.name === sel.muni), [availableMunis, sel.muni]);
    const availableBrgys = useMemo(() => muniData?.barangays || [], [muniData]);
    const brgyData = useMemo(() => availableBrgys.find(b => b.name === sel.brgy), [availableBrgys, sel.brgy]);
    const availablePuroks = useMemo(() => 
        brgyData?.puroks || ["Purok 1", "Purok 2", "Purok 3", "Purok 4", "Purok 5", "Purok 6", "Purok 7"],
        [brgyData]
    );

    const filteredBrgys = useMemo(() => 
        availableBrgys.filter(b => b.name.toLowerCase().includes(searchTerm.toLowerCase())),
        [availableBrgys, searchTerm]
    );

    // 3. Sync with Parent
    useEffect(() => {
        const currentKey = `${sel.dist}|${sel.muni}|${sel.brgy}|${sel.purok}`;
        if (currentKey !== lastEmittedKey.current) {
            lastEmittedKey.current = currentKey; 

            if (isFilter) {
                onLocationSelect({
                    district: sel.dist || null,
                    municipality: sel.muni || null,
                    barangay: sel.brgy || null,
                    purok: sel.purok || null
                });
            } else if (sel.dist && sel.muni && sel.brgy && sel.purok) {
                onLocationSelect({ ...sel });
            } else {
                onLocationSelect(null);
            }
        }
    }, [sel, onLocationSelect, isFilter]);

    return (
        <div className={`aleco-mini-scope layout-${layoutMode}`}>
            {label && <label className="aleco-mini-scope-label">{label}</label>}

            <div className="mini-row">
                {/* 1. DISTRICT */}
                <select 
                    value={sel.dist} 
                    className="scope-select"
                    onChange={(e) => handleSelectChange('dist', e.target.value)}
                >
                    <option value="">{isFilter ? "All Districts" : "District..."}</option>
                    {ALECO_SCOPE.map(d => <option key={d.district} value={d.district}>{d.district}</option>)}
                </select>

                {/* 2. MUNICIPALITY: Fixed visibility for Inline, Dynamic for Form */}
                {(isInline || sel.dist) && (
                    <select 
                        value={sel.muni} 
                        className="scope-select"
                        onChange={(e) => handleSelectChange('muni', e.target.value)}
                    >
                        <option value="">{isFilter ? "All Municipalities" : "Town/City..."}</option>
                        {availableMunis.map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
                    </select>
                )}

                {/* 3. BARANGAY: Swap between Dropdown (Inline) and Search (Form) */}
                {(isInline || sel.muni) && (
                    isInline ? (
                        <select 
                            className="scope-select"
                            value={sel.brgy}
                            onChange={(e) => handleSelectChange('brgy', e.target.value)}
                        >
                            <option value="">All Barangays</option>
                            {availableBrgys.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                        </select>
                    ) : (
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
                                            <div key={b.name} className="result-item" 
                                                onClick={() => handleSelectChange('brgy', b.name)}>
                                                {b.name}
                                            </div>
                                        ))
                                    ) : (
                                        <div className="result-item no-match">No matches found</div>
                                    )}
                                </div>
                            )}
                        </div>
                    )
                )}

                {/* 4. PUROK: Fixed visibility for Inline, Dynamic for Form */}
                {(isInline || (sel.brgy && !isSearching)) && (
                    <select 
                        className="purok-select" 
                        value={sel.purok} 
                        onChange={(e) => handleSelectChange('purok', e.target.value)}
                    >
                        <option value="">{isFilter ? "All Puroks" : "Select Purok..."}</option>
                        {availablePuroks.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                )}
            </div>
        </div>
    );
};

export default AlecoScopeDropdown;