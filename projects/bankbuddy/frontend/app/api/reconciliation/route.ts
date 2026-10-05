import { bucket, failure } from '@/lib/storage';
export const dynamic='force-dynamic';
export async function GET(){try{const file=await bucket().get('reconciliation.json');if(!file)return Response.json({error:'The statements have not been imported yet.'},{status:404});return new Response(file.body,{headers:{'Content-Type':'application/json','Cache-Control':'private, no-store'}});}catch{return failure();}}
