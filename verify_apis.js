const fs = require('fs');
const path = require('path');

// 1. Load env vars
const envPath = path.join(__dirname, '.env.local');
const env = {};
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach(line => {
    const match = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)\s*$/);
    if (match) {
      env[match[1]] = match[2].trim().replace(/^["']|["']$/g, '');
    }
  });
}

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function logHeader(title) {
  console.log(`\n${colors.bold}${colors.cyan}=== ${title} ===${colors.reset}`);
}

async function testSupabase() {
  logHeader('Testing Supabase Connection & CRUD Operations');
  const url = env.EXPO_PUBLIC_SUPABASE_URL;
  const key = env.EXPO_PUBLIC_SUPABASE_KEY;
  if (!url || !key) {
    console.log(`${colors.red}✗ Missing Supabase credentials in .env.local${colors.reset}`);
    return;
  }

  let templateItem = null;

  // 1. Test GET (Fetch existing record to get valid trip_id / created_by UUIDs)
  try {
    const res = await fetch(`${url}/rest/v1/trip_itinerary_items?limit=1`, {
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`
      }
    });
    if (res.ok) {
      const items = await res.json();
      console.log(`${colors.green}✓ GET Requests Tested successfully${colors.reset}`);
      if (items.length > 0) {
        templateItem = items[0];
      }
    } else {
      console.log(`${colors.red}✗ GET Request failed: HTTP ${res.status}${colors.reset}`);
      return;
    }
  } catch (e) {
    console.log(`${colors.red}✗ Error testing GET request: ${e.message}${colors.reset}`);
    return;
  }

  // If no itinerary items exist, try to get a trip to use its ID
  if (!templateItem) {
    try {
      const res = await fetch(`${url}/rest/v1/trips?limit=1`, {
        headers: {
          'apikey': key,
          'Authorization': `Bearer ${key}`
        }
      });
      if (res.ok) {
        const trips = await res.json();
        if (trips.length > 0) {
          templateItem = {
            trip_id: trips[0].id,
            created_by: trips[0].host_id || trips[0].created_by || trips[0].owner_id || trips[0].user_id
          };
        }
      }
    } catch (e) {
      console.log(`${colors.yellow}! Could not fetch fallback trip info: ${e.message}${colors.reset}`);
    }
  }

  if (!templateItem || !templateItem.trip_id || !templateItem.created_by) {
    console.log(`${colors.yellow}! Skipping POST/PATCH/DELETE tests: No existing trip_id/created_by UUIDs found in database to satisfy foreign keys.${colors.reset}`);
    return;
  }

  const { trip_id, created_by } = templateItem;
  let testItemId = null;

  // 2. Test POST (Create)
  try {
    const res = await fetch(`${url}/rest/v1/trip_itinerary_items`, {
      method: 'POST',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        trip_id,
        created_by,
        title: '__TEST_CONNECTION_ITEM__',
        day_number: 1,
        tag: 'ACTIVITY'
      })
    });
    if (res.ok) {
      const inserted = await res.json();
      testItemId = inserted[0]?.id;
      console.log(`${colors.green}✓ POST Requests Tested successfully (Created test item ID: ${testItemId})${colors.reset}`);
    } else {
      const err = await res.text();
      console.log(`${colors.red}✗ POST Request failed: HTTP ${res.status} - ${err}${colors.reset}`);
    }
  } catch (e) {
    console.log(`${colors.red}✗ Error testing POST request: ${e.message}${colors.reset}`);
  }

  if (!testItemId) return;

  // 3. Test PATCH/PUT (Update)
  try {
    const res = await fetch(`${url}/rest/v1/trip_itinerary_items?id=eq.${testItemId}`, {
      method: 'PATCH',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: '__TEST_CONNECTION_ITEM_UPDATED__'
      })
    });
    if (res.ok) {
      console.log(`${colors.green}✓ PUT/PATCH Requests Tested successfully${colors.reset}`);
    } else {
      const err = await res.text();
      console.log(`${colors.red}✗ PUT/PATCH Request failed: HTTP ${res.status} - ${err}${colors.reset}`);
    }
  } catch (e) {
    console.log(`${colors.red}✗ Error testing PUT/PATCH request: ${e.message}${colors.reset}`);
  }

  // 4. Test DELETE (Delete)
  try {
    const res = await fetch(`${url}/rest/v1/trip_itinerary_items?id=eq.${testItemId}`, {
      method: 'DELETE',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`
      }
    });
    if (res.ok) {
      console.log(`${colors.green}✓ DELETE Requests Tested successfully${colors.reset}`);
    } else {
      const err = await res.text();
      console.log(`${colors.red}✗ DELETE Request failed: HTTP ${res.status} - ${err}${colors.reset}`);
    }
  } catch (e) {
    console.log(`${colors.red}✗ Error testing DELETE request: ${e.message}${colors.reset}`);
  }
}

async function testFlightApi(name, key) {
  logHeader(`Testing FlightAPI.io (${name})`);
  if (!key) {
    console.log(`${colors.yellow}! Key is not configured${colors.reset}`);
    return;
  }
  try {
    const url = `https://api.flightapi.io/iata/${key}?name=manila&type=airport`;
    const res = await fetch(url);
    const bodyText = await res.text();
    if (res.ok) {
      console.log(`${colors.green}✓ Connection Successfully Established (HTTP ${res.status})${colors.reset}`);
      console.log(`${colors.green}✓ Suggestions list successfully fetched.${colors.reset}`);
    } else {
      console.log(`${colors.yellow}! Returned HTTP ${res.status} (Body: ${bodyText.slice(0, 100)})${colors.reset}`);
      console.log(`${colors.yellow}! Key is likely limited/unauthorized on free tier for airport search.${colors.reset}`);
    }
  } catch (e) {
    console.log(`${colors.red}✗ Error connecting to FlightAPI: ${e.message}${colors.reset}`);
  }
}

async function testDuffel() {
  logHeader('Testing Duffel API (Primary Fallback)');
  const key = env.EXPO_PUBLIC_DUFFEL_API_KEY;
  if (!key) {
    console.log(`${colors.red}✗ Missing Duffel Key in .env.local${colors.reset}`);
    return;
  }
  try {
    // Test suggestions (GET)
    const sugRes = await fetch('https://api.duffel.com/places/suggestions?query=manila', {
      headers: {
        'Authorization': `Bearer ${key}`,
        'Duffel-Version': 'v2'
      }
    });
    if (sugRes.ok) {
      console.log(`${colors.green}✓ GET Suggestions tested successfully (HTTP ${sugRes.status})${colors.reset}`);
    } else {
      console.log(`${colors.red}✗ GET Suggestions failed (HTTP ${sugRes.status})${colors.reset}`);
    }

    // Test offers POST creation
    const bodyPayload = {
      data: {
        slices: [
          { origin: 'MNL', destination: 'CEB', departure_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0] }
        ],
        passengers: [{ type: 'adult' }],
        cabin_class: 'economy'
      }
    };
    const offRes = await fetch('https://api.duffel.com/air/offer_requests?return_offers=true', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Duffel-Version': 'v2',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(bodyPayload)
    });
    if (offRes.ok) {
      console.log(`${colors.green}✓ POST Flight Search/Offers tested successfully (HTTP ${offRes.status})${colors.reset}`);
    } else {
      const errText = await offRes.text();
      console.log(`${colors.red}✗ POST Flight Search/Offers failed (HTTP ${offRes.status})${colors.reset}`);
      console.log(`${colors.yellow}  Error details: ${errText.slice(0, 200)}${colors.reset}`);
    }
  } catch (e) {
    console.log(`${colors.red}✗ Error connecting to Duffel: ${e.message}${colors.reset}`);
  }
}

async function testGooglePlaces() {
  logHeader('Testing Google Places API');
  const key = env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
  if (!key) {
    console.log(`${colors.red}✗ Missing Google Places Key in .env.local${colors.reset}`);
    return;
  }
  try {
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=cafe+in+manila&key=${key}`;
    const res = await fetch(url);
    const json = await res.json();
    if (res.ok && json.status === 'OK') {
      console.log(`${colors.green}✓ Connection Successfully Established (HTTP ${res.status})${colors.reset}`);
      console.log(`${colors.green}✓ GET Search Places returns ${json.results.length} spots${colors.reset}`);
    } else {
      console.log(`${colors.red}✗ Failed: HTTP ${res.status} (Status: ${json.status || 'Unknown'})${colors.reset}`);
    }
  } catch (e) {
    console.log(`${colors.red}✗ Error connecting to Google Places: ${e.message}${colors.reset}`);
  }
}

async function testOpenWeather() {
  logHeader('Testing OpenWeather API');
  const key = env.EXPO_PUBLIC_OPENWEATHER_API_KEY;
  if (!key) {
    console.log(`${colors.red}✗ Missing OpenWeather Key in .env.local${colors.reset}`);
    return;
  }
  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?q=manila&appid=${key}`;
    const res = await fetch(url);
    const json = await res.json();
    if (res.ok) {
      console.log(`${colors.green}✓ Weather details fetched successfully (HTTP ${res.status})${colors.reset}`);
      console.log(`${colors.green}✓ Temp: ${Math.round(json.main.temp - 273.15)}°C, Condition: ${json.weather[0].main}${colors.reset}`);
    } else {
      console.log(`${colors.red}✗ Failed: HTTP ${res.status} (Message: ${json.message || 'Unknown'})${colors.reset}`);
    }
  } catch (e) {
    console.log(`${colors.red}✗ Error connecting to OpenWeather: ${e.message}${colors.reset}`);
  }
}

async function testGemini(name, keyEnvVar) {
  logHeader(`Testing Gemini AI API (${name})`);
  const key = env[keyEnvVar];
  const model = env.EXPO_PUBLIC_GEMINI_MODEL || 'gemini-3.6-flash';
  if (!key) {
    console.log(`${colors.red}✗ Missing Gemini Key (${keyEnvVar}) in .env.local${colors.reset}`);
    return;
  }
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: "Say 'Hello from Gemini'" }] }] })
    });
    const json = await res.json();
    if (res.ok && json.candidates) {
      console.log(`${colors.green}✓ Gemini AI response verified successfully (HTTP ${res.status})${colors.reset}`);
      console.log(`${colors.green}✓ Model: ${model}${colors.reset}`);
    } else {
      console.log(`${colors.red}✗ Gemini AI request failed: ${JSON.stringify(json.error || json)}${colors.reset}`);
    }
  } catch (e) {
    console.log(`${colors.red}✗ Error connecting to Gemini API: ${e.message}${colors.reset}`);
  }
}

async function testGroq() {
  logHeader('Testing Groq AI API (Fallback Chat Brain)');
  const key = env.EXPO_PUBLIC_GROQ_API_KEY;
  const model = env.EXPO_PUBLIC_GROQ_MODEL || 'groq/compound';
  if (!key) {
    console.log(`${colors.red}✗ Missing Groq Key in .env.local${colors.reset}`);
    return;
  }
  try {
    const url = 'https://api.groq.com/openai/v1/chat/completions';
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: 'Say Hello' }]
      })
    });
    const json = await res.json();
    if (res.ok) {
      console.log(`${colors.green}✓ Groq AI response verified successfully (HTTP ${res.status})${colors.reset}`);
      console.log(`${colors.green}✓ Model: ${model}${colors.reset}`);
    } else {
      console.log(`${colors.red}✗ Groq AI request failed (HTTP ${res.status}): ${JSON.stringify(json.error || json)}${colors.reset}`);
    }
  } catch (e) {
    console.log(`${colors.red}✗ Error connecting to Groq API: ${e.message}${colors.reset}`);
  }
}

async function main() {
  console.log(`${colors.bold}${colors.cyan}=====================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}    BARKADASH API CONNECTION TESTER   ${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}=====================================${colors.reset}`);
  
  await testSupabase();
  await testFlightApi('Primary Key', env.EXPO_PUBLIC_FLIGHTAPI_KEY);
  await testFlightApi('Backup Key', env.EXPO_PUBLIC_FLIGHTAPI_KEY_BACKUP);
  await testDuffel();
  await testGooglePlaces();
  await testOpenWeather();
  await testGemini('Primary Chat Brain', 'EXPO_PUBLIC_GEMINI_API_KEY');
  await testGemini('Backup Chat Brain', 'EXPO_PUBLIC_GEMINI_API_KEY_BACKUP');
  await testGroq();
  
  console.log(`\n${colors.bold}${colors.cyan}=====================================${colors.reset}\n`);
}

main();
