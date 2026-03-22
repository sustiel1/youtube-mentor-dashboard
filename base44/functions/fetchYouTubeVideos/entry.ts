// fetchYouTubeVideos — Fetches new videos from a YouTube channel
// Uses RSS feed for discovery (no API quota) + YouTube Data API for details
//
// Expected request body:
// { channelId: string, mentorId: string, sourceId: string }
//
// Returns: { added: number, videos: Array<{ title, url, thumbnail, publishedAt }> }

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const { channelId, mentorId, sourceId } = await req.json();

    if (!channelId || !mentorId || !sourceId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: channelId, mentorId, sourceId" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Step 1: Fetch RSS feed (no API quota cost)
    const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
    const rssResponse = await fetch(rssUrl);

    if (!rssResponse.ok) {
      return new Response(
        JSON.stringify({ error: `RSS fetch failed: ${rssResponse.status}` }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    const rssText = await rssResponse.text();

    // Step 2: Parse RSS XML to extract video entries
    // Basic XML parsing — extract <entry> blocks
    const entries = [];
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    let match;

    while ((match = entryRegex.exec(rssText)) !== null) {
      const entry = match[1];
      const videoId = entry.match(/<yt:videoId>(.*?)<\/yt:videoId>/)?.[1];
      const title = entry.match(/<title>(.*?)<\/title>/)?.[1];
      const published = entry.match(/<published>(.*?)<\/published>/)?.[1];

      if (videoId && title) {
        entries.push({
          title: title.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">"),
          url: `https://www.youtube.com/watch?v=${videoId}`,
          thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          publishedAt: published || new Date().toISOString(),
          mentorId,
          sourceId,
          status: "new",
        });
      }
    }

    // Step 3: Return discovered videos
    // The caller is responsible for deduplication and saving to entities
    return new Response(
      JSON.stringify({ added: entries.length, videos: entries }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
