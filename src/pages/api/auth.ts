import type { APIRoute } from 'astro';

const PASSWORD = 'yoyoballusingh';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { password } = await request.json();
    
    if (password === PASSWORD) {
      return new Response(JSON.stringify({
        success: true
      }), {
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          'Set-Cookie': 'tube-gist-auth=authenticated; Path=/; HttpOnly; Max-Age=86400'
        }
      });
    } else {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid password'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Internal server error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const GET: APIRoute = async ({ request }) => {
  const cookies = request.headers.get('cookie') || '';
  const isAuthenticated = cookies.includes('tube-gist-auth=authenticated');
  
  return new Response(JSON.stringify({
    authenticated: isAuthenticated
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};