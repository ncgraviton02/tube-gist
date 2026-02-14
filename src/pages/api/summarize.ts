import type { APIRoute } from 'astro';
import Anthropic from '@anthropic-ai/sdk';

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const { url, transcript, videoTitle } = await request.json();

    if (!url) {
      return new Response(JSON.stringify({ error: 'Please provide a YouTube URL' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!transcript || transcript.length < 50) {
      return new Response(JSON.stringify({ error: 'Transcript too short or unavailable' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    const videoId = extractVideoId(url);

    const apiKey = locals.runtime?.env?.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Claude API key not configured' }), {
        status: 500, headers: { 'Content-Type': 'application/json' }
      });
    }

    const anthropic = new Anthropic({ apiKey });

    const truncated = transcript.substring(0, 12000);
    const prompt = `Please analyze this YouTube video transcript and provide a newspaper-style summary with the following format:

1. A compelling, engaging headline that captures the main topic
2. Key takeaways (3-5 bullet points)
3. A detailed summary (2-3 paragraphs)
4. Notable quotes if any are particularly striking

Video Title: ${videoTitle || 'Unknown'}

Transcript:
${truncated}${transcript.length > 12000 ? '\n[transcript truncated]' : ''}

Please format your response as HTML that will fit well in a newspaper article layout. Use h3 tags for section headers, p tags for paragraphs, ul/li for bullet points, and blockquote for quotes. Do not include any markdown formatting.`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    });

    const summary = response.content[0].type === 'text' ? response.content[0].text : '';

    // Store in D1
    try {
      if (locals.runtime?.env?.DB) {
        const thumbnailUrl = videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : '';
        await locals.runtime.env.DB.prepare(
          'INSERT OR REPLACE INTO summaries (youtube_url, video_title, thumbnail_url, summary, created_at) VALUES (?, ?, ?, ?, ?)'
        ).bind(url, videoTitle || 'YouTube Video', thumbnailUrl, summary, new Date().toISOString()).run();
      }
    } catch (dbError) {
      console.error('Database error:', dbError);
    }

    return new Response(JSON.stringify({ title: videoTitle || 'YouTube Video', summary, url }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Summarize error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
};

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([^&\n?#]+)/,
    /(?:youtu\.be\/)([^&\n?#]+)/,
    /(?:youtube\.com\/embed\/)([^&\n?#]+)/
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}
