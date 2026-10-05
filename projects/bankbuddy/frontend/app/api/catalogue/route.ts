import { bucket, failure } from '@/lib/storage';
export async function GET(){try{const f=await bucket().get('catalogue.json');return f?new Response(f.body,{headers:{'Content-Type':'application/json','Cache-Control':'private, no-store'}}):Response.json({categories:[]});}catch{return failure();}}
