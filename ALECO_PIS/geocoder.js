import fs from 'fs';
import 'dotenv/config';

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

if (!GOOGLE_API_KEY) {
    console.error("❌ ERROR: No API Key found! Make sure you have a .env file with GOOGLE_API_KEY=your_key");
    process.exit(1);
}

// --- ALECO DISTRICT STRUCTURE (Source of Truth) ---
const ALECO_DISTRICTS = [
  {
    district: "First District (North Albay)",
    municipalities: [
      "Bacacay", "Malilipot", "Malinao", "Santo Domingo", "Tabaco City", "Tiwi"
    ]
  },
  {
    district: "Second District (Central Albay)",
    municipalities: [
      "Camalig", "Daraga", "Legazpi City", "Manito", "Rapu-Rapu"
    ]
  },
  {
    district: "Third District (South Albay)",
    municipalities: [
      "Guinobatan", "Jovellar", "Libon", "Ligao City", "Oas", "Pio Duran", "Polangui"
    ]
  }
];

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function geocodeMunicipalities() {
    console.log("🚀 Starting Google Geocoding for ALECO Municipalities...");
    console.log("📋 This will verify Google's municipality names match ALECO's structure\n");
    
    let updatedScope = [];
    let successCount = 0;
    let failCount = 0;
    let mismatchWarnings = [];

    for (let district of ALECO_DISTRICTS) {
        console.log(`\n📍 Processing: ${district.district}`);
        console.log("─".repeat(60));
        
        let districtObj = {
            district: district.district,
            municipalities: []
        };

        for (let muniName of district.municipalities) {
            // Construct the exact search string for Google
            let addressQuery = `${muniName}, Albay, Philippines`;
            let url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(addressQuery)}&key=${GOOGLE_API_KEY}`;

            try {
                let response = await fetch(url);
                let data = await response.json();

                if (data.status === 'OK' && data.results.length > 0) {
                    let result = data.results[0];
                    let components = result.address_components;
                    
                    // Extract what Google actually calls this place
                    let googleMuniName = null;
                    let googleProvince = null;
                    
                    components.forEach(comp => {
                        if (comp.types.includes('locality') || comp.types.includes('administrative_area_level_2')) {
                            googleMuniName = comp.long_name;
                        }
                        if (comp.types.includes('administrative_area_level_2')) {
                            googleProvince = comp.long_name;
                        }
                    });

                    // Verify Google's name matches our expected name
                    const nameMatch = googleMuniName?.toLowerCase() === muniName.toLowerCase() ||
                                     googleMuniName?.toLowerCase().includes(muniName.toLowerCase()) ||
                                     muniName.toLowerCase().includes(googleMuniName?.toLowerCase());

                    if (!nameMatch) {
                        mismatchWarnings.push({
                            expected: muniName,
                            google: googleMuniName,
                            district: district.district
                        });
                    }

                    let muniObj = {
                        name: muniName, // Keep ALECO's official name
                        googleName: googleMuniName, // Store what Google calls it
                        lat: result.geometry.location.lat,
                        lng: result.geometry.location.lng,
                        verified: nameMatch
                    };
                    
                    districtObj.municipalities.push(muniObj);
                    successCount++;
                    
                    const statusIcon = nameMatch ? "✅" : "⚠️";
                    console.log(`${statusIcon} [${successCount}] ${muniName}`);
                    console.log(`   Google: "${googleMuniName}"`);
                    console.log(`   Coords: ${muniObj.lat}, ${muniObj.lng}`);
                    
                } else {
                    console.log(`❌ Failed: ${addressQuery}`);
                    console.log(`   Reason: ${data.status}`);
                    if (data.error_message) {
                        console.log(`   Message: ${data.error_message}`);
                    }
                    
                    districtObj.municipalities.push({
                        name: muniName,
                        googleName: null,
                        lat: null,
                        lng: null,
                        verified: false
                    });
                    failCount++;
                }
            } catch (error) {
                console.log(`⚠️ Error on ${addressQuery}:`, error.message);
                districtObj.municipalities.push({
                    name: muniName,
                    googleName: null,
                    lat: null,
                    lng: null,
                    verified: false
                });
                failCount++;
            }

            // Pause for 200ms to respect Google API rate limits
            await delay(200);
        }

        updatedScope.push(districtObj);
    }

    // Generate the updated alecoScope.js file
    const fileContent = `export const ALECO_SCOPE = ${JSON.stringify(updatedScope, null, 2)};`;
    fs.writeFileSync('alecoScope.js', fileContent, 'utf8');
    
    console.log("\n" + "=".repeat(60));
    console.log(`🎉 FINISHED! Successfully mapped: ${successCount} | Failed: ${failCount}`);
    console.log("=".repeat(60));
    
    // Report any name mismatches
    if (mismatchWarnings.length > 0) {
        console.log("\n⚠️ NAME MISMATCH WARNINGS:");
        console.log("─".repeat(60));
        mismatchWarnings.forEach(warn => {
            console.log(`District: ${warn.district}`);
            console.log(`  ALECO Name: "${warn.expected}"`);
            console.log(`  Google Name: "${warn.google}"`);
            console.log(`  → You may need to add an alias in gpsLocationMatcher.js\n`);
        });
    }
    
    console.log(`\n📁 Updated data saved to: alecoScope.js`);
    console.log(`⚠️ BACKUP: Make sure you backed up your old file before running this!`);
    
    // Generate a mapping report
    console.log("\n📊 DISTRICT SUMMARY:");
    console.log("─".repeat(60));
    updatedScope.forEach(dist => {
        const verified = dist.municipalities.filter(m => m.verified).length;
        const total = dist.municipalities.length;
        console.log(`${dist.district}: ${verified}/${total} verified`);
    });
}

geocodeMunicipalities();