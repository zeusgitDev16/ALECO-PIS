import fs from 'fs';
import 'dotenv/config';

// 1. Pull the key securely from your .env file
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

if (!GOOGLE_API_KEY) {
    console.error("❌ ERROR: No API Key found! Make sure you have a .env file with GOOGLE_API_KEY=your_key");
    process.exit(1);
}

// 2. SIMPLIFIED ALECO SCOPE - District + Municipality Names Only
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
    let updatedScope = [];
    let successCount = 0;
    let failCount = 0;

    for (let district of ALECO_DISTRICTS) {
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
                    let muniObj = {
                        name: muniName,
                        lat: data.results[0].geometry.location.lat,
                        lng: data.results[0].geometry.location.lng
                    };
                    districtObj.municipalities.push(muniObj);
                    successCount++;
                    console.log(`✅ [${successCount}] Mapped: ${muniName}`);
                } else {
                    console.log(`❌ Failed: ${addressQuery}`);
                    console.log(`   Reason: ${data.status}`);
                    if (data.error_message) {
                        console.log(`   Message: ${data.error_message}`);
                    }
                    
                    // Still add the municipality but with null coordinates
                    districtObj.municipalities.push({
                        name: muniName,
                        lat: null,
                        lng: null
                    });
                    failCount++;
                }
            } catch (error) {
                console.log(`⚠️ Error on ${addressQuery}:`, error.message);
                districtObj.municipalities.push({
                    name: muniName,
                    lat: null,
                    lng: null
                });
                failCount++;
            }

            // Pause for 200ms to respect Google API rate limits
            await delay(200);
        }

        updatedScope.push(districtObj);
    }

    // Write the new simplified structure
    const fileContent = `export const ALECO_SCOPE = ${JSON.stringify(updatedScope, null, 2)};`;
    fs.writeFileSync('alecoScope.js', fileContent, 'utf8');
    
    console.log(`\n🎉 FINISHED! Successfully mapped: ${successCount} | Failed: ${failCount}`);
    console.log(`📁 Your new simplified data is saved in 'alecoScope.js'`);
    console.log(`⚠️ BACKUP: Your old file should be backed up before running this!`);
}

geocodeMunicipalities();