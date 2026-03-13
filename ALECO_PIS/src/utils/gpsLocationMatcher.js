import { ALECO_SCOPE } from '../../alecoScope';

/**
 * 🎯 GPS LOCATION MATCHER - GOOGLE GEOCODING ONLY
 * Matches Google Geocoding results to ALECO district structure
 * 
 * @param {string} googleMunicipality - Raw municipality name from Google API
 * @param {string} googleProvince - Province name (e.g., "Albay")
 * @returns {object|null} - { district, municipality } or null if outside coverage
 */
export const matchGPSToAlecoScope = (googleMunicipality, googleProvince = '') => {
    console.log('🔍 [MATCHER START] Input:', { googleMunicipality, googleProvince });
    
    if (!googleMunicipality || typeof googleMunicipality !== 'string') {
        console.warn('⚠️ [MATCHER] Invalid municipality input:', googleMunicipality);
        return null;
    }

    const cleanInput = googleMunicipality.toLowerCase().trim();
    const cleanProvince = googleProvince.toLowerCase().trim();
    
    console.log('🔍 [MATCHER] Cleaned Input:', { 
        municipality: cleanInput, 
        province: cleanProvince 
    });

    // --- PROVINCE VALIDATION ---
    if (cleanProvince && !cleanProvince.includes('albay')) {
        console.warn('❌ [MATCHER] PROVINCE MISMATCH: Not in Albay Province');
        return null;
    }

    console.log('🔍 [MATCHER] Searching through ALECO_SCOPE...');
    console.log('   Total Districts:', ALECO_SCOPE.length);

    // --- MATCH AGAINST BOTH ALECO NAME AND GOOGLE NAME ---
    for (const districtObj of ALECO_SCOPE) {
        console.log(`   Checking District: ${districtObj.district} (${districtObj.municipalities.length} municipalities)`);
        
        for (const muniObj of districtObj.municipalities) {
            const cleanAlecoName = muniObj.name.toLowerCase();
            const cleanGoogleName = muniObj.googleName?.toLowerCase() || '';

            // MATCH TYPE 1: EXACT MATCH (ALECO Name)
            if (cleanInput === cleanAlecoName) {
                console.log(`✅ [MATCHER] EXACT MATCH (ALECO): "${muniObj.name}" → ${districtObj.district}`);
                return {
                    district: districtObj.district,
                    municipality: muniObj.name,
                    matchType: 'exact-aleco'
                };
            }

            // MATCH TYPE 2: EXACT MATCH (Google Name)
            if (cleanGoogleName && cleanInput === cleanGoogleName) {
                console.log(`✅ [MATCHER] EXACT MATCH (GOOGLE): "${muniObj.googleName}" → ${districtObj.district}`);
                return {
                    district: districtObj.district,
                    municipality: muniObj.name,
                    matchType: 'exact-google'
                };
            }

            // MATCH TYPE 3: PARTIAL MATCH
            if (cleanInput.includes(cleanAlecoName) || cleanAlecoName.includes(cleanInput) ||
                (cleanGoogleName && (cleanInput.includes(cleanGoogleName) || cleanGoogleName.includes(cleanInput)))) {
                console.log(`✅ [MATCHER] PARTIAL MATCH: "${muniObj.name}" → ${districtObj.district}`);
                return {
                    district: districtObj.district,
                    municipality: muniObj.name,
                    matchType: 'partial'
                };
            }

            // MATCH TYPE 4: CITY SUFFIX HANDLING
            const inputWithoutCity = cleanInput.replace(/\s*city\s*/g, '').trim();
            const alecoWithoutCity = cleanAlecoName.replace(/\s*city\s*/g, '').trim();
            
            if (inputWithoutCity === alecoWithoutCity) {
                console.log(`✅ [MATCHER] CITY SUFFIX MATCH: "${muniObj.name}" → ${districtObj.district}`);
                return {
                    district: districtObj.district,
                    municipality: muniObj.name,
                    matchType: 'suffix'
                };
            }
        }
    }

    console.warn('❌ [MATCHER] NO MUNICIPALITY MATCH FOUND for:', googleMunicipality);
    console.warn('   Tried matching against:', ALECO_SCOPE.flatMap(d => d.municipalities.map(m => `${m.name} (Google: ${m.googleName})`)));
    return null;
};

/**
 * 🔍 DISTRICT VALIDATOR
 * Verifies municipality belongs to the correct district
 */
export const validateDistrictMunicipality = (municipality, district) => {
    console.log('🔍 [VALIDATOR START] Input:', { municipality, district });
    
    for (const districtObj of ALECO_SCOPE) {
        if (districtObj.district === district) {
            console.log(`   Found district: ${district}`);
            const muniExists = districtObj.municipalities.some(
                m => m.name === municipality
            );
            
            if (muniExists) {
                console.log(`✅ [VALIDATOR] VALIDATION PASSED: ${municipality} belongs to ${district}`);
                return true;
            } else {
                console.error(`❌ [VALIDATOR] VALIDATION FAILED: ${municipality} does NOT belong to ${district}`);
                console.error('   Available municipalities in this district:', districtObj.municipalities.map(m => m.name));
                return false;
            }
        }
    }
    
    console.error(`❌ [VALIDATOR] VALIDATION FAILED: District "${district}" not found in ALECO_SCOPE`);
    console.error('   Available districts:', ALECO_SCOPE.map(d => d.district));
    return false;
};



