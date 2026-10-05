import {failure} from '@/lib/storage';
import {loadReport} from '@/lib/report';
export const dynamic='force-dynamic';
export async function GET(){try{const report=await loadReport();if(!report)return Response.json({error:'The statements have not been imported yet.'},{status:404});return Response.json(report,{headers:{'Cache-Control':'private, no-store'}});}catch{return failure();}}
