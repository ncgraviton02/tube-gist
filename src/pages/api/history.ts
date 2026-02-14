import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ locals }) => {
  try {
    // Get recent summaries from D1 database (if available)
    if (locals.runtime?.env?.DB) {
      const result = await locals.runtime.env.DB.prepare(
        'SELECT id, youtube_url, video_title, thumbnail_url, summary, created_at FROM summaries ORDER BY created_at DESC LIMIT 20'
      ).all();

      const summaries = result.results || [];

      return new Response(JSON.stringify(summaries), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      // Return empty array if database is not set up yet
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error('History error:', error);
    // Return empty array if database is not available
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};