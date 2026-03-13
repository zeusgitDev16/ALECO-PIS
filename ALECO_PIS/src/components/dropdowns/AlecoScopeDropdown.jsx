import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ALECO_SCOPE } from '../../../alecoScope';
import '../../CSS/AlecoScopeDropdown.css';

const AlecoScopeDropdown = ({ 
    onLocationSelect, 
    disabled = false, 
    isFilter = false,
    layoutMode = 'stacked',
    initialDistrict = '',
    initialMunicipality = ''
}) => {
    const [sel, setSel] = useState({ 
        dist: initialDistrict, 
        muni: initialMunicipality 
    });
    const [searchTerm, setSearchTerm] = useState("");
    const [isSearching, setIsSearching] = useState(false);
    const lastEmittedKey = useRef('');

    // Sync with external changes (GPS auto-fill)
    useEffect(() => {
        if (initialDistrict || initialMunicipality) {
            setSel({ 
                dist: initialDistrict, 
                muni: initialMunicipality 
            });
        }
    }, [initialDistrict, initialMunicipality]);

    // 1. CASCADING RESET LOGIC
    const handleSelectChange = (level, value) => {
        setSel(prev => {
            if (level === 'dist') {
                return { dist: value, muni: "" };
            }
            return { ...prev, [level]: value };
        });
        
        setSearchTerm("");
        setIsSearching(false);
    };

    // 2. Memoized Data Selectors
    const districtData = useMemo(() => ALECO_SCOPE.find(d => d.district === sel.dist), [sel.dist]);
    const availableMunis = useMemo(() => districtData?.municipalities || [], [districtData]);

    // 3. Sync with Parent
    useEffect(() => {
        const currentKey = `${sel.dist}|${sel.muni}`;
        if (currentKey !== lastEmittedKey.current) {
            lastEmittedKey.current = currentKey; 

            if (isFilter) {
                onLocationSelect({
                    district: sel.dist || null,
                    municipality: sel.muni || null,
                    barangay: null,
                    purok: null
                });
            } else if (sel.dist && sel.muni) {
                onLocationSelect({ 
                    district: sel.dist,
                    municipality: sel.muni,
                    barangay: null,
                    purok: null
                });
            } else {
                onLocationSelect(null);
            }
        }
    }, [sel.dist, sel.muni, isFilter, onLocationSelect]);

    // 4. Search Logic
    const handleSearch = (e) => {
        const term = e.target.value;
        setSearchTerm(term);
        
        if (term.length < 2) {
            setIsSearching(false);
            return;
        }
        
        setIsSearching(true);
        const lowerTerm = term.toLowerCase();
        
        for (const district of ALECO_SCOPE) {
            const matchedMuni = district.municipalities.find(m => 
                m.name.toLowerCase().includes(lowerTerm)
            );
            
            if (matchedMuni) {
                setSel({ dist: district.district, muni: matchedMuni.name });
                setIsSearching(false);
                return;
            }
        }
    };

    // 5. Clear Handler
    const handleClear = () => {
        setSel({ dist: "", muni: "" });
        setSearchTerm("");
        setIsSearching(false);
    };

    // INLINE LAYOUT (For Filters)
    if (layoutMode === "inline") {
        return (
            <div className="aleco-scope-inline">
                <select 
                    value={sel.dist} 
                    onChange={(e) => handleSelectChange('dist', e.target.value)}
                    className="filter-dropdown"
                >
                    <option value="">All Districts</option>
                    {ALECO_SCOPE.map(d => (
                        <option key={d.district} value={d.district}>{d.district}</option>
                    ))}
                </select>

                <select 
                    value={sel.muni} 
                    onChange={(e) => handleSelectChange('muni', e.target.value)}
                    disabled={!sel.dist}
                    className="filter-dropdown"
                >
                    <option value="">All Municipalities</option>
                    {availableMunis.map(m => (
                        <option key={m.name} value={m.name}>{m.name}</option>
                    ))}
                </select>
            </div>
        );
    }

    // STACKED LAYOUT (For ReportaProblem.jsx)
    return (
        <div className="aleco-scope-container">
            <div className="search-box-wrapper">
                <input 
                    type="text"
                    placeholder="🔍 Quick search municipality..."
                    value={searchTerm}
                    onChange={handleSearch}
                    className="location-search-input"
                    disabled={disabled}
                />
                {(sel.dist || sel.muni) && (
                    <button 
                        type="button"
                        onClick={handleClear}
                        className="clear-selection-btn"
                    >
                        ✖ Clear
                    </button>
                )}
            </div>

            <div className="dropdown-grid-simple">
                <select 
                    value={sel.dist} 
                    onChange={(e) => handleSelectChange('dist', e.target.value)}
                    className="location-select"
                    disabled={disabled}
                >
                    <option value="">Select District</option>
                    {ALECO_SCOPE.map(d => (
                        <option key={d.district} value={d.district}>{d.district}</option>
                    ))}
                </select>

                <select 
                    value={sel.muni} 
                    onChange={(e) => handleSelectChange('muni', e.target.value)}
                    disabled={!sel.dist || disabled}
                    className="location-select"
                >
                    <option value="">Select Municipality</option>
                    {availableMunis.map(m => (
                        <option key={m.name} value={m.name}>{m.name}</option>
                    ))}
                </select>
            </div>

            {sel.dist && sel.muni && (
                <div className="selection-preview">
                    📍 {sel.muni}, {sel.dist}
                </div>
            )}
        </div>
    );
};

export default AlecoScopeDropdown;