import https from "https";

// Google Place Photo는 실제 이미지 CDN으로 302 리다이렉트를 반환하므로 한 번 더 따라간다.
function fetchBinary(url: string): Promise<{ data: Buffer; contentType: string }> {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode === 302 && res.headers.location) {
          https
            .get(res.headers.location, (imgRes) => {
              const chunks: Buffer[] = [];
              imgRes.on("data", (chunk) => chunks.push(chunk));
              imgRes.on("end", () =>
                resolve({
                  data: Buffer.concat(chunks),
                  contentType: (imgRes.headers["content-type"] as string) || "image/jpeg",
                })
              );
              imgRes.on("error", reject);
            })
            .on("error", reject);
          return;
        }

        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () =>
          resolve({
            data: Buffer.concat(chunks),
            contentType: (res.headers["content-type"] as string) || "image/jpeg",
          })
        );
        res.on("error", reject);
      })
      .on("error", reject);
  });
}

// Google Places API 키를 클라이언트에 절대 노출하지 않기 위한 서버 프록시.
// 프론트엔드는 이 엔드포인트의 URL만 <img src>로 사용하고, 실제 키는 여기서만 사용된다.
export const handler = async (event: any) => {
  const ref = event.queryStringParameters?.ref;
  const maxwidth = event.queryStringParameters?.maxwidth || "400";

  if (!ref) {
    return { statusCode: 400, body: "ref query parameter is required" };
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY || "";
  if (!apiKey) {
    return { statusCode: 503, body: "Google Places API key is not configured" };
  }

  try {
    const googleUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${encodeURIComponent(
      maxwidth
    )}&photo_reference=${encodeURIComponent(ref)}&key=${apiKey}`;
    const { data, contentType } = await fetchBinary(googleUrl);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
      },
      body: data.toString("base64"),
      isBase64Encoded: true,
    };
  } catch (err: any) {
    console.error("Place photo fetch failed:", err);
    return { statusCode: 502, body: "Failed to fetch photo" };
  }
};
