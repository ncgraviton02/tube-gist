import type { APIRoute } from 'astro';
import Anthropic from '@anthropic-ai/sdk';

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const { url } = await request.json();
    
    if (!url || (!url.includes('youtube.com/watch') && !url.includes('youtu.be/'))) {
      return new Response(JSON.stringify({
        error: 'Please provide a valid YouTube URL'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
      return new Response(JSON.stringify({
        error: 'Could not extract video ID from URL'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Fetch the YouTube page to get title + caption tracks
    const pageHtml = await fetchYouTubePage(videoId);
    const videoTitle = extractTitle(pageHtml);
    
    // Extract transcript using innertube captions
    let transcript: string;
    try {
      transcript = await fetchTranscript(pageHtml, videoId);
    } catch (error: any) {
      return new Response(JSON.stringify({
        error: `Could not fetch transcript: ${error.message}`
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!transcript || transcript.length < 50) {
      return new Response(JSON.stringify({
        error: 'Transcript too short or unavailable for this video'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check for API key
    const apiKey = locals.runtime?.env?.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({
        error: 'Claude API key not configured'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Summarize with Claude
    const anthropic = new Anthropic({ apiKey });

    const truncatedTranscript = transcript.substring(0, 12000);
    const prompt = `Please analyze this YouTube video transcript and provide a newspaper-style summary with the following format:

1. A compelling, engaging headline that captures the main topic
2. Key takeaways (3-5 bullet points)
3. A detailed summary (2-3 paragraphs)
4. Notable quotes if any are particularly striking

Video Title: ${videoTitle}

Transcript:
${truncatedTranscript}${transcript.length > 12000 ? '\n[transcript truncated]' : ''}

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
        const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
        await locals.runtime.env.DB.prepare(
          'INSERT OR REPLACE INTO summaries (youtube_url, video_title, thumbnail_url, summary, created_at) VALUES (?, ?, ?, ?, ?)'
        ).bind(url, videoTitle, thumbnailUrl, summary, new Date().toISOString()).run();
      }
    } catch (dbError) {
      console.error('Database error:', dbError);
    }

    return new Response(JSON.stringify({
      title: videoTitle,
      summary,
      url
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Summarize error:', error);
    return new Response(JSON.stringify({
      error: error.message || 'Internal server error'
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

async function fetchYouTubePage(videoId: string): Promise<string> {
  const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    }
  });
  if (!response.ok) throw new Error('Failed to fetch YouTube page');
  return response.text();
}

function extractTitle(html: string): string {
  const match = html.match(/<title>(.+?)(?:\s*-\s*YouTube)?<\/title>/);
  return match ? decodeHtmlEntities(match[1]) : 'YouTube Video';
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/');
}

async function fetchTranscript(html: string, videoId: string): Promise<string> {
  // Method 1: Extract captions URL from ytInitialPlayerResponse
  const playerMatch = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\});(?:var|const|let|<\/script>)/s);
  if (!playerMatch) {
    throw new Error('Could not find player response. Video may be private or unavailable.');
  }

  let playerResponse: any;
  try {
    playerResponse = JSON.parse(playerMatch[1]);
  } catch {
    throw new Error('Failed to parse player response');
  }

  const captions = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
  if (!captions || captions.length === 0) {
    throw new Error('No captions available for this video');
  }

  // Prefer English, fall back to first available, prefer non-auto-generated
  let track = captions.find((t: any) => t.languageCode === 'en' && t.kind !== 'asr')
    || captions.find((t: any) => t.languageCode === 'en')
    || captions.find((t: any) => t.kind !== 'asr')
    || captions[0];

  const captionUrl = track.baseUrl;
  if (!captionUrl) throw new Error('Caption URL not found');

  // Fetch the XML transcript
  const captionResponse = await fetch(captionUrl);
  if (!captionResponse.ok) throw new Error('Failed to fetch captions');
  const xml = await captionResponse.text();

  // Parse XML transcript — extract text from <text> elements
  const textSegments: string[] = [];
  const regex = /<text[^>]*>(.*?)<\/text>/gs;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    const text = decodeHtmlEntities(match[1].replace(/<[^>]+>/g, '').trim());
    if (text) textSegments.push(text);
  }

  if (textSegments.length === 0) {
    throw new Error('Transcript is empty');
  }

  return textSegments.join(' ');
}
