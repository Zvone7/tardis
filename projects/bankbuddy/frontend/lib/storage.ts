import { env } from 'cloudflare:workers';
export function db() { if (!env.DB) throw new Error('Decision storage unavailable'); return env.DB; }
export function bucket() { if (!env.BUCKET) throw new Error('File storage unavailable'); return env.BUCKET; }
export function failure() { return Response.json({error:'Storage unavailable. Your changes have not been saved. Please retry.'},{status:503}); }
export function validOrigin(r:Request) { const o=r.headers.get('origin'); return !o || o===new URL(r.url).origin; }
