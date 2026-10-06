import {db,failure,validOrigin} from '@/lib/storage';
import {loadReport} from '@/lib/report';
export async function POST(request:Request){
 if(!validOrigin(request))return new Response('Forbidden',{status:403});
 try{const b:any=await request.json();if(typeof b.name!=='string'||!b.name.trim()||b.name.length>100||typeof b.templateId!=='string')return Response.json({error:'Enter an account name and choose a template account'},{status:400});
 const report=await loadReport();if(!report)return failure();const template=report.accounts.find(a=>a.id===b.templateId&&!report.newAccounts?.some(n=>n.id===a.id));if(!template)return Response.json({error:'Choose an existing Money Manager account as template'},{status:400});
 if(report.accounts.some(a=>a.name.trim().toLowerCase()===b.name.trim().toLowerCase()&&a.currency===template.currency))return Response.json({error:'An account with this name and currency already exists'},{status:409});
 const row=await db().prepare('SELECT value FROM settings WHERE key=?').bind('new_accounts').first<{value:string}>();const previous=row?.value||'[]',list=JSON.parse(previous);if(list.length>=100)return Response.json({error:'Export the current account drafts before adding more'},{status:400});
 const account={id:crypto.randomUUID().toUpperCase(),name:b.name.trim(),currency:template.currency,templateId:template.id};list.push(account);
 const result=row?await db().prepare('UPDATE settings SET value=? WHERE key=? AND value=?').bind(JSON.stringify(list),'new_accounts',previous).run():await db().prepare('INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)').bind('new_accounts',JSON.stringify(list)).run();
 if(!result.meta.changes)return Response.json({error:'Account list changed. Retry creating this account.'},{status:409});return Response.json(account);
 }catch{return failure()}
}
