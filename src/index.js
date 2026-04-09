const SERVER_NAME = 'plot-mcp-worker';
const SERVER_VERSION = '0.1.0';

const TOOLS = [
  {
    name: 'health',
    description: 'Check upstream Plot API health status.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'plot',
    description: 'Plot a single expression and return upstream JSON response.',
    inputSchema: {
      type: 'object',
      properties: {
        expr: { type: 'string' },
        x_min: { type: 'number', default: -10 },
        x_max: { type: 'number', default: 10 },
        points: { type: 'integer', default: 1000 },
      },
      required: ['expr'],
      additionalProperties: false,
    },
  },
  {
    name: 'plot_json',
    description: 'Plot a single expression and return JSON-friendly plot data.',
    inputSchema: {
      type: 'object',
      properties: {
        expr: { type: 'string' },
        x_min: { type: 'number', default: -10 },
        x_max: { type: 'number', default: 10 },
        points: { type: 'integer', default: 1000 },
      },
      required: ['expr'],
      additionalProperties: false,
    },
  },
  {
    name: 'plot_png_link',
    description: 'Generate a direct PNG URL for a single-expression plot.',
    inputSchema: {
      type: 'object',
      properties: {
        expr: { type: 'string' },
        x_min: { type: 'number', default: -10 },
        x_max: { type: 'number', default: 10 },
        points: { type: 'integer', default: 1000 },
      },
      required: ['expr'],
      additionalProperties: false,
    },
  },
  {
    name: 'plot_multi',
    description: 'Plot multiple expressions on one chart.',
    inputSchema: {
      type: 'object',
      properties: {
        exprs: { type: 'array', items: { type: 'string' } },
        labels: { anyOf: [{ type: 'array', items: { type: 'string' } }, { type: 'null' }] },
        x_min: { type: 'number', default: -10 },
        x_max: { type: 'number', default: 10 },
        points: { type: 'integer', default: 1000 },
        title: { type: 'string', default: 'Multi Function Plot' },
        xlabel: { type: 'string', default: 'x' },
        ylabel: { type: 'string', default: 'y' },
      },
      required: ['exprs'],
      additionalProperties: false,
    },
  },
  {
    name: 'plot_multi_json',
    description: 'Plot multiple expressions and return JSON-friendly plot data.',
    inputSchema: {
      type: 'object',
      properties: {
        exprs: { type: 'array', items: { type: 'string' } },
        labels: { anyOf: [{ type: 'array', items: { type: 'string' } }, { type: 'null' }] },
        x_min: { type: 'number', default: -10 },
        x_max: { type: 'number', default: 10 },
        points: { type: 'integer', default: 1000 },
        title: { type: 'string', default: 'Multi Function Plot' },
        xlabel: { type: 'string', default: 'x' },
        ylabel: { type: 'string', default: 'y' },
      },
      required: ['exprs'],
      additionalProperties: false,
    },
  },
  {
    name: 'plot_multi_png_link',
    description: 'Generate a direct PNG URL for a multi-expression plot.',
    inputSchema: {
      type: 'object',
      properties: {
        exprs: { type: 'array', items: { type: 'string' } },
        labels: { anyOf: [{ type: 'array', items: { type: 'string' } }, { type: 'null' }] },
        x_min: { type: 'number', default: -10 },
        x_max: { type: 'number', default: 10 },
        points: { type: 'integer', default: 1000 },
        title: { type: 'string', default: 'Multi Function Plot' },
        xlabel: { type: 'string', default: 'x' },
        ylabel: { type: 'string', default: 'y' },
      },
      required: ['exprs'],
      additionalProperties: false,
    },
  },
  {
    name: 'plot_series',
    description: 'Plot custom point series.',
    inputSchema: {
      type: 'object',
      properties: {
        series: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              type: { type: 'string', enum: ['line', 'scatter', 'line+scatter'], default: 'line' },
              points: { type: 'array', items: { type: 'array', items: { type: 'number' } } },
              color: { anyOf: [{ type: 'string' }, { type: 'null' }] },
            },
            required: ['name', 'points'],
            additionalProperties: true,
          },
        },
        title: { type: 'string', default: 'Series Plot' },
        xlabel: { type: 'string', default: 'x' },
        ylabel: { type: 'string', default: 'y' },
        grid: { type: 'boolean', default: true },
      },
      required: ['series'],
      additionalProperties: false,
    },
  },
  {
    name: 'plot_series_json',
    description: 'Plot custom point series and return JSON-friendly plot data.',
    inputSchema: {
      type: 'object',
      properties: {
        series: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              type: { type: 'string', enum: ['line', 'scatter', 'line+scatter'], default: 'line' },
              points: { type: 'array', items: { type: 'array', items: { type: 'number' } } },
              color: { anyOf: [{ type: 'string' }, { type: 'null' }] },
            },
            required: ['name', 'points'],
            additionalProperties: true,
          },
        },
        title: { type: 'string', default: 'Series Plot' },
        xlabel: { type: 'string', default: 'x' },
        ylabel: { type: 'string', default: 'y' },
        grid: { type: 'boolean', default: true },
      },
      required: ['series'],
      additionalProperties: false,
    },
  },
  {
    name: 'plot_series_png_link',
    description: 'Generate a direct PNG URL for a custom series plot.',
    inputSchema: {
      type: 'object',
      properties: {
        series: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              type: { type: 'string', enum: ['line', 'scatter', 'line+scatter'], default: 'line' },
              points: { type: 'array', items: { type: 'array', items: { type: 'number' } } },
              color: { anyOf: [{ type: 'string' }, { type: 'null' }] },
            },
            required: ['name', 'points'],
            additionalProperties: true,
          },
        },
        title: { type: 'string', default: 'Series Plot' },
        xlabel: { type: 'string', default: 'x' },
        ylabel: { type: 'string', default: 'y' },
        grid: { type: 'boolean', default: true },
      },
      required: ['series'],
      additionalProperties: false,
    },
  },
  {
    name: 'force_diagram_link',
    description: 'Generate a direct SVG link for a 2D physics free-body / force analysis diagram.',
    inputSchema: {
      type: 'object',
      properties: {
        body_label: { type: 'string', default: 'm' },
        forces: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              label: { type: 'string' },
              magnitude: { type: 'number', default: 1 },
              angle_deg: { type: 'number' },
              color: { type: 'string', default: '#d22' }
            },
            required: ['label', 'angle_deg'],
            additionalProperties: false
          }
        },
        show_components: { type: 'boolean', default: false }
      },
      required: ['forces'],
      additionalProperties: false
    }
  },
  {
    name: 'shape3d_link',
    description: 'Generate a direct HTML link for an interactive 3D geometric shape viewer.',
    inputSchema: {
      type: 'object',
      properties: {
        shape: { type: 'string', enum: ['cube', 'sphere', 'cylinder', 'cone', 'vector3d'], default: 'cube' },
        title: { type: 'string', default: '3D Shape' },
        size: { type: 'number', default: 1 },
        radius: { type: 'number', default: 1 },
        height: { type: 'number', default: 2 },
        vector: { type: 'array', items: { type: 'number' }, minItems: 3, maxItems: 3 },
        color: { type: 'string', default: '#4f46e5' }
      },
      additionalProperties: false
    }
  }
];

function jsonRpc(id, result) {
  return Response.json({ jsonrpc: '2.0', id, result }, { headers: corsHeaders() });
}

function jsonRpcError(id, code, message, data) {
  return Response.json({ jsonrpc: '2.0', id, error: { code, message, data } }, { status: 200, headers: corsHeaders() });
}

function corsHeaders(extra = {}) {
  return {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type, mcp-session-id',
    ...extra,
  };
}

function parseNumber(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parseInteger(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  const n = Number.parseInt(String(value), 10);
  return Number.isFinite(n) ? n : fallback;
}

function toBase64Url(base64) {
  return String(base64 || '').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(base64url) {
  const s = String(base64url || '').replace(/-/g, '+').replace(/_/g, '/');
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  return s + pad;
}

function esc(s = '') {
  return String(s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

function renderForceDiagramSvg(payload) {
  const bodyLabel = esc(payload.body_label || 'm');
  const forces = Array.isArray(payload.forces) ? payload.forces : [];
  const showComponents = !!payload.show_components;
  const cx = 260, cy = 220, scale = 52;
  const lines = [];
  const componentLines = [];
  for (const f of forces) {
    const ang = (Number(f.angle_deg || 0) * Math.PI) / 180;
    const mag = Math.max(0.5, Number(f.magnitude || 1));
    const color = esc(f.color || '#d22');
    const x2 = cx + Math.cos(ang) * mag * scale;
    const y2 = cy - Math.sin(ang) * mag * scale;
    lines.push(`<line x1="${cx}" y1="${cy}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="2.2" marker-end="url(#arrow)" stroke-linecap="round" />`);
    lines.push(`<text x="${x2 + 6}" y="${y2 - 6}" font-size="15" fill="${color}" font-family="Arial">${esc(f.label || 'F')}</text>`);
    if (showComponents) {
      componentLines.push(`<line x1="${cx}" y1="${cy}" x2="${x2}" y2="${cy}" stroke="${color}" stroke-width="1" stroke-dasharray="4 4" opacity="0.55" />`);
      componentLines.push(`<line x1="${x2}" y1="${cy}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="1" stroke-dasharray="4 4" opacity="0.55" />`);
    }
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="520" height="420" viewBox="0 0 520 420">
  <defs>
    <marker id="arrow" markerWidth="7" markerHeight="7" refX="6" refY="2.5" orient="auto" markerUnits="strokeWidth">
      <path d="M0,0 L0,5 L6,2.5 z" fill="#333" />
    </marker>
  </defs>
  <rect width="100%" height="100%" fill="white"/>
  <text x="24" y="32" font-size="20" font-family="Arial" fill="#111">Free-body / force diagram</text>
  <line x1="40" y1="220" x2="480" y2="220" stroke="#d1d5db" stroke-width="0.8" />
  <line x1="260" y1="40" x2="260" y2="380" stroke="#d1d5db" stroke-width="0.8" />
  <circle cx="${cx}" cy="${cy}" r="22" fill="#f8fafc" stroke="#111" stroke-width="1.6" />
  <text x="${cx}" y="${cy + 5}" text-anchor="middle" font-size="18" font-family="Arial" fill="#111">${bodyLabel}</text>
  ${componentLines.join('\n')}
  ${lines.join('\n')}
</svg>`;
}

function renderShape3DHtml(payload) {
  const shape = String(payload.shape || 'cube');
  const title = esc(payload.title || '3D Shape');
  const color = esc(payload.color || '#4f46e5');
  const size = Number(payload.size || 1);
  const radius = Number(payload.radius || 1);
  const height = Number(payload.height || 2);
  const vector = Array.isArray(payload.vector) && payload.vector.length === 3 ? payload.vector.map(Number) : [1,1,1];
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${title}</title>
<script src="https://cdn.plot.ly/plotly-2.35.2.min.js"></script>
<style>body{font-family:Arial;margin:0;padding:24px}#plot{width:100%;height:80vh}</style>
</head><body><h2>${title}</h2><div id="plot"></div>
<script>
const color='${color}';
const shape='${shape}';
let data=[];
if(shape==='cube'){
  const s=${size};
  data=[{type:'mesh3d',x:[0,s,s,0,0,s,s,0],y:[0,0,s,s,0,0,s,s],z:[0,0,0,0,s,s,s,s],i:[0,0,0,1,4,4,5,5,0,1,2,3],j:[1,2,3,2,5,6,6,7,4,5,6,7],k:[2,3,1,0,6,7,4,4,5,6,7,4],opacity:0.6,color:color}]}
else if(shape==='sphere'){
  const r=${radius}; const t=[], p=[], x=[], y=[], z=[]; for(let i=0;i<=20;i++){for(let j=0;j<=20;j++){let th=Math.PI*i/20, ph=2*Math.PI*j/20; x.push(r*Math.sin(th)*Math.cos(ph)); y.push(r*Math.sin(th)*Math.sin(ph)); z.push(r*Math.cos(th));}}
  data=[{type:'scatter3d',mode:'markers',x,y,z,marker:{size:2,color:color}}]}
else if(shape==='cylinder' || shape==='cone'){
  const r=${radius}, h=${height}; const x=[],y=[],z=[]; for(let i=0;i<=40;i++){let a=2*Math.PI*i/40; for(let j=0;j<=20;j++){let zz=h*j/20; let rr=shape==='cone'?r*(1-j/20):r; x.push(rr*Math.cos(a)); y.push(rr*Math.sin(a)); z.push(zz);}}
  data=[{type:'scatter3d',mode:'markers',x,y,z,marker:{size:2,color:color}}]}
else if(shape==='vector3d'){
  data=[{type:'scatter3d',mode:'lines+markers+text',x:[0,${vector[0]}],y:[0,${vector[1]}],z:[0,${vector[2]}],text:['O','v'],textposition:'top center',line:{width:6,color:color},marker:{size:4,color:color}}]}
Plotly.newPlot('plot', data, {margin:{l:0,r:0,b:0,t:0}, scene:{aspectmode:'data'}});
</script></body></html>`;
}

async function callUpstream(env, path, payload, method = 'POST') {
  const base = String(env.UPSTREAM_BASE || 'https://lingion.pythonanywhere.com').replace(/\/$/, '');
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: method === 'GET' ? undefined : JSON.stringify(payload || {}),
  });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  return { ok: res.ok, status: res.status, data };
}

async function handleToolCall(name, args, env, origin) {
  switch (name) {
    case 'health':
      return await callUpstream(env, '/health', null, 'GET');
    case 'plot':
      return await callUpstream(env, '/plot', args);
    case 'plot_json':
      return await callUpstream(env, '/plot_json', args);
    case 'plot_png_link': {
      const payload = {
        __path: '/plot',
        expr: String(args?.expr || ''),
        x_min: parseNumber(args?.x_min, -10),
        x_max: parseNumber(args?.x_max, 10),
        points: parseInteger(args?.points, 1000),
      };
      const q = toBase64Url(btoa(JSON.stringify(payload)));
      return {
        ok: true,
        status: 200,
        data: {
          png_url: `${origin}/png?d=${encodeURIComponent(q)}`,
          payload,
        },
      };
    }
    case 'plot_multi':
      return await callUpstream(env, '/plot_multi', args);
    case 'plot_multi_json':
      return await callUpstream(env, '/plot_multi_json', args);
    case 'plot_multi_png_link': {
      const payload = {
        __path: '/plot_multi',
        exprs: Array.isArray(args?.exprs) ? args.exprs : [],
        labels: Array.isArray(args?.labels) ? args.labels : (args?.labels ?? null),
        x_min: parseNumber(args?.x_min, -10),
        x_max: parseNumber(args?.x_max, 10),
        points: parseInteger(args?.points, 1000),
        title: args?.title ?? 'Multi Function Plot',
        xlabel: args?.xlabel ?? 'x',
        ylabel: args?.ylabel ?? 'y',
      };
      const q = toBase64Url(btoa(JSON.stringify(payload)));
      return {
        ok: true,
        status: 200,
        data: {
          png_url: `${origin}/png?d=${encodeURIComponent(q)}`,
          payload,
        },
      };
    }
    case 'plot_series':
      return await callUpstream(env, '/plot_series', args);
    case 'plot_series_json':
      return await callUpstream(env, '/plot_series_json', args);
    case 'plot_series_png_link': {
      const payload = {
        __path: '/plot_series',
        series: Array.isArray(args?.series) ? args.series : [],
        title: args?.title ?? 'Series Plot',
        xlabel: args?.xlabel ?? 'x',
        ylabel: args?.ylabel ?? 'y',
        grid: args?.grid ?? true,
      };
      const q = toBase64Url(btoa(JSON.stringify(payload)));
      return {
        ok: true,
        status: 200,
        data: {
          png_url: `${origin}/png?d=${encodeURIComponent(q)}`,
          payload,
        },
      };
    }
    case 'force_diagram_link': {
      const payload = {
        body_label: args?.body_label ?? 'm',
        forces: Array.isArray(args?.forces) ? args.forces : [],
        show_components: !!args?.show_components,
      };
      const q = toBase64Url(btoa(JSON.stringify(payload)));
      return {
        ok: true,
        status: 200,
        data: {
          svg_url: `${origin}/force.svg?d=${encodeURIComponent(q)}`,
          payload,
        },
      };
    }
    case 'shape3d_link': {
      const payload = {
        shape: args?.shape ?? 'cube',
        title: args?.title ?? '3D Shape',
        size: args?.size ?? 1,
        radius: args?.radius ?? 1,
        height: args?.height ?? 2,
        vector: Array.isArray(args?.vector) ? args.vector : null,
        color: args?.color ?? '#4f46e5',
      };
      const q = toBase64Url(btoa(JSON.stringify(payload)));
      return {
        ok: true,
        status: 200,
        data: {
          html_url: `${origin}/shape3d.html?d=${encodeURIComponent(q)}`,
          payload,
        },
      };
    }
    default:
      throw new Error(`unknown_tool:${name}`);
  }
}

function toolResultPayload(result) {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(result, null, 2),
      },
    ],
    structuredContent: result,
  };
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);

    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/healthz')) {
      return Response.json({
        ok: true,
        name: SERVER_NAME,
        version: SERVER_VERSION,
        mcp_endpoint: `${url.origin}/mcp`,
        png_endpoint: `${url.origin}/png?d=<base64url-json>`,
        upstream: env.UPSTREAM_BASE,
        tools: TOOLS.map(t => t.name),
      }, { headers: corsHeaders() });
    }

    if (req.method === 'GET' && url.pathname === '/png') {
      try {
        const packed = url.searchParams.get('d') || '';
        if (!packed) return Response.json({ ok: false, error: 'missing_d' }, { status: 400, headers: corsHeaders() });

        const decoded = atob(fromBase64Url(packed));
        const payload = JSON.parse(decoded);
        const upstreamPath = String(payload?.__path || '/plot');
        if (!['/plot', '/plot_multi', '/plot_series'].includes(upstreamPath)) {
          return Response.json({ ok: false, error: 'invalid_png_path' }, { status: 400, headers: corsHeaders() });
        }
        if (upstreamPath === '/plot' && !payload?.expr) {
          return Response.json({ ok: false, error: 'missing_expr' }, { status: 400, headers: corsHeaders() });
        }
        if (upstreamPath === '/plot_multi' && !Array.isArray(payload?.exprs)) {
          return Response.json({ ok: false, error: 'missing_exprs' }, { status: 400, headers: corsHeaders() });
        }
        if (upstreamPath === '/plot_series' && !Array.isArray(payload?.series)) {
          return Response.json({ ok: false, error: 'missing_series' }, { status: 400, headers: corsHeaders() });
        }

        const cleaned = { ...payload };
        delete cleaned.__path;

        const upstream = await fetch(`${String(env.UPSTREAM_BASE || 'https://lingion.pythonanywhere.com').replace(/\/$/, '')}${upstreamPath}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(cleaned),
        });

        if (!upstream.ok) {
          const text = await upstream.text();
          return Response.json({ ok: false, error: 'upstream_error', status: upstream.status, body: text.slice(0, 1000) }, { status: 502, headers: corsHeaders() });
        }

        return new Response(upstream.body, {
          status: 200,
          headers: {
            'content-type': upstream.headers.get('content-type') || 'image/png',
            'cache-control': 'public, max-age=300',
            'access-control-allow-origin': '*',
          },
        });
      } catch (e) {
        return Response.json({ ok: false, error: 'bad_png_query', message: String(e?.message || e) }, { status: 400, headers: corsHeaders() });
      }
    }

    if (req.method === 'GET' && url.pathname === '/force.svg') {
      try {
        const packed = url.searchParams.get('d') || '';
        if (!packed) return Response.json({ ok: false, error: 'missing_d' }, { status: 400, headers: corsHeaders() });
        const decoded = atob(fromBase64Url(packed));
        const payload = JSON.parse(decoded);
        const svg = renderForceDiagramSvg(payload);
        return new Response(svg, {
          status: 200,
          headers: {
            'content-type': 'image/svg+xml; charset=utf-8',
            'cache-control': 'public, max-age=300',
            'access-control-allow-origin': '*',
          },
        });
      } catch (e) {
        return Response.json({ ok: false, error: 'bad_force_query', message: String(e?.message || e) }, { status: 400, headers: corsHeaders() });
      }
    }

    if (req.method === 'GET' && url.pathname === '/shape3d.html') {
      try {
        const packed = url.searchParams.get('d') || '';
        if (!packed) return Response.json({ ok: false, error: 'missing_d' }, { status: 400, headers: corsHeaders() });
        const decoded = atob(fromBase64Url(packed));
        const payload = JSON.parse(decoded);
        const html = renderShape3DHtml(payload);
        return new Response(html, {
          status: 200,
          headers: {
            'content-type': 'text/html; charset=utf-8',
            'cache-control': 'public, max-age=300',
            'access-control-allow-origin': '*',
          },
        });
      } catch (e) {
        return Response.json({ ok: false, error: 'bad_shape_query', message: String(e?.message || e) }, { status: 400, headers: corsHeaders() });
      }
    }

    if (req.method !== 'POST' || url.pathname !== '/mcp') {
      return Response.json({ ok: false, error: 'not_found' }, { status: 404, headers: corsHeaders() });
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return jsonRpcError(null, -32700, 'Parse error');
    }

    const id = body?.id ?? null;
    const method = body?.method;
    const params = body?.params || {};

    try {
      if (method === 'initialize') {
        return jsonRpc(id, {
          protocolVersion: '2025-03-26',
          capabilities: { tools: {} },
          serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
        });
      }

      if (method === 'notifications/initialized') {
        return new Response(null, { status: 202, headers: corsHeaders() });
      }

      if (method === 'tools/list') {
        return jsonRpc(id, { tools: TOOLS });
      }

      if (method === 'tools/call') {
        const name = params?.name;
        const args = params?.arguments || {};
        const result = await handleToolCall(name, args, env, url.origin);
        return jsonRpc(id, toolResultPayload(result));
      }

      return jsonRpcError(id, -32601, `Method not found: ${method}`);
    } catch (e) {
      return jsonRpcError(id, -32000, 'Tool execution failed', { message: String(e?.message || e) });
    }
  },
};
