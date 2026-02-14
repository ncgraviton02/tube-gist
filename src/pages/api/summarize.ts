import type { APIRoute } from 'astro';
import { YoutubeTranscript } from 'youtube-transcript';
import Anthropic from '@anthropic-ai/sdk';

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const { url } = await request.json();
    
    if (!url || !url.includes('youtube.com/watch') && !url.includes('youtu.be/')) {
      return new Response(JSON.stringify({
        error: 'Please provide a valid YouTube URL'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Extract video ID from URL
    const videoId = extractVideoId(url);
    if (!videoId) {
      return new Response(JSON.stringify({
        error: 'Could not extract video ID from URL'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get transcript
    let transcript;
    try {
      const transcriptData = await YoutubeTranscript.fetchTranscript(videoId);
      transcript = transcriptData.map(item => item.text).join(' ');
    } catch (error) {
      return new Response(JSON.stringify({
        error: 'Could not fetch transcript. Video may not have captions available.'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!transcript || transcript.length < 100) {
      return new Response(JSON.stringify({
        error: 'Transcript too short or unavailable'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get video title from YouTube (simple approach)
    const videoTitle = await getVideoTitle(videoId);

    // Check for API key
    if (!locals.runtime?.env?.ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({
        error: 'Claude API key not configured'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Summarize with Claude
    const anthropic = new Anthropic({
      apiKey: locals.runtime.env.ANTHROPIC_API_KEY,
    });

    const prompt = `Please analyze this YouTube video transcript and provide a newspaper-style summary with the following format:

1. A compelling, engaging headline that captures the main topic
2. Key takeaways (3-5 bullet points)
3. A detailed summary (2-3 paragraphs)
4. Notable quotes if any are particularly striking

Video Title: ${videoTitle}
Transcript: ${transcript.substring(0, 8000)} ${transcript.length > 8000 ? '...' : ''}

Please format your response as HTML that will fit well in a newspaper article layout. Use h3 tags for section headers, p tags for paragraphs, ul/li for bullet points, and blockquote for quotes. Do not include any markdown formatting.`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    const summary = response.content[0].type === 'text' ? response.content[0].text : '';

    // Store in D1 database (if available)
    try {
      if (locals.runtime?.env?.DB) {
        const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
        
        await locals.runtime.env.DB.prepare(
          'INSERT INTO summaries (youtube_url, video_title, thumbnail_url, summary, created_at) VALUES (?, ?, ?, ?, ?)'
        ).bind(
          url,
          videoTitle,
          thumbnailUrl,
          summary,
          new Date().toISOString()
        ).run();
      }
    } catch (dbError) {
      console.error('Database error:', dbError);
      // Continue even if DB save fails
    }

    return new Response(JSON.stringify({
      title: videoTitle,
      summary: summary,
      url: url
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Summarize error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
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

async function getVideoTitle(videoId: string): Promise<string> {
  try {
    // Simple way to get title - scrape the page
    const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    const html = await response.text();
    const titleMatch = html.match(/<title>(.+?) - YouTube<\/title>/);
    return titleMatch ? titleMatch[1] : 'YouTube Video';
  } catch {
    return 'YouTube Video';
  }
}