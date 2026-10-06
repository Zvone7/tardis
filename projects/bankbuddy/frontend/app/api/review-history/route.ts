import {db,failure} from '@/lib/storage';
export async function GET(){try{const rows=await db().prepare("SELECT value FROM settings WHERE key LIKE 'review_history_%' ORDER BY json_extract(value,'$.at') DESC LIMIT 200").all<{value:string}>();return Response.json(rows.results.map(r=>JSON.parse(r.value)),{headers:{'Cache-Control':'private, no-store'}})}catch{return failure()}}
