import https from "https";

const serverGeocodeCache: { [key: string]: { lat: number; lon: number } } = {};

function fetchCoordinatesFromOSM(searchQuery: string): Promise<{ lat: number; lon: number } | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`;
  
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        "User-Agent": "TripMateAI/1.0 (contact: support@tripmate.ai)"
      }
    };

    https.get(url, options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        try {
          if (res.statusCode === 200) {
            const parsed = JSON.parse(data);
            if (parsed && parsed.length > 0) {
              resolve({
                lat: parseFloat(parsed[0].lat),
                lon: parseFloat(parsed[0].lon)
              });
              return;
            }
          }
          resolve(null);
        } catch (e) {
          resolve(null);
        }
      });
    }).on("error", (err) => {
      reject(err);
    });
  });
}

export const handler = async (event: any) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
  };

  // CORS Preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: "",
    };
  }

  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }

  const queryParams = event.queryStringParameters || {};
  const { query, city } = queryParams;

  if (!query) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "query parameter is required" }),
    };
  }

  const dest = city || "";
  const searchKey = `${dest}_${query}`;

  if (serverGeocodeCache[searchKey]) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(serverGeocodeCache[searchKey]),
    };
  }

  try {
    const searchQuery = query.includes(dest) ? query : `${dest} ${query}`;
    const coord = await fetchCoordinatesFromOSM(searchQuery);
    
    if (coord) {
      serverGeocodeCache[searchKey] = coord;
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(coord),
      };
    }

    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: "No location found" }),
    };
  } catch (err: any) {
    console.error("Geocoding error inside Function:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message || "Internal Server Error" }),
    };
  }
};
