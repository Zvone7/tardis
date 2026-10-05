import {originalEdit} from '@/app/components/review-model';
import { db, bucket, failure, validOrigin } from '@/lib/storage';
export async function GET(){try{return Response.json((await db().prepare('SELECT * FROM decisions ORDER BY updated_at DESC').all()).results,{headers:{'Cache-Control':'private, no-store'}});}catch{return failure();}}
const bad=(error:string)=>Response.json({error},{status:400});
export async function POST(request:Request){
 if(!validOrigin(request))return new Response('Forbidden',{status:403});
 let b:any;try{b=await request.json();}catch{return bad('Invalid JSON');}
 if(!b||typeof b.id!=='string'||!['confirmed','held','unresolved'].includes(b.status)||typeof b.note!=='string'||b.note.length>4000||!(b.targetId===null||typeof b.targetId==='string')||!['create','edit','delete','revert'].includes(b.action))return bad('Invalid review decision');
 try{
  const reportFile=await bucket().get('reconciliation.json');if(!reportFile)return failure();const report:any=await reportFile.json();const item=report.items.find((i:any)=>i.id===b.id);
  if(!item)return bad('Transaction not found');
  const match=item.candidates.find((c:any)=>c.target.id===b.targetId);
  if(b.targetId&&!match)return bad('Candidate not found');
  if(b.action==='edit'&&!match)return bad('Select an existing Money Manager entry to edit');
  if(b.action==='create'&&b.targetId)return bad('New entries cannot overwrite existing entries');
  let proposed=b.proposedEdit;let action=b.action;let status=b.status;let note=b.note;
  if(action==='revert'){
   proposed=originalEdit(item,b.targetId);
   action=match?'edit':'create';status='unresolved';note='';
  }else if(action!=='delete'){
   if(!proposed||typeof proposed.description!=='string'||!proposed.description.trim()||proposed.description.length>500||typeof proposed.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(proposed.date)||Number.isNaN(Date.parse(proposed.date))||new Date(proposed.date).toISOString().slice(0,10)!==proposed.date||typeof proposed.time!=='string'||(proposed.time!==''&&!/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(proposed.time))||!Number.isFinite(proposed.amount)||Math.abs(proposed.amount)>100000000||typeof proposed.category!=='string'||proposed.category.length>200)return bad('Check the title, date, time, amount and category');
   const account=report.accounts.find((a:any)=>a.id===proposed.accountId);
   if(status==='confirmed'&&!account)return bad('Choose a Money Manager account before confirming');
   if(proposed.accountId&&!account)return bad('Unknown Money Manager account');
   if(account&&account.currency?.split('_').at(-1)!==proposed.currency)return bad('The account currency must match the amount currency');
   if(proposed.currency!==item.source.currency)return bad('Currency conversion is not supported; use the statement currency');
   const kind=proposed.kind||(proposed.amount<0?'expense':'income');
   if(!['expense','income','transfer'].includes(kind))return bad('Invalid transaction type');
   const targetAccount=kind==='transfer'?report.accounts.find((a:any)=>a.id===proposed.targetAccountId):null;
   if(kind==='transfer'&&status==='confirmed'&&(!targetAccount||targetAccount.id===account?.id||targetAccount.currency!==account?.currency))return bad('Choose two different accounts with the same currency');
   if(kind==='expense'&&proposed.amount>0||kind==='income'&&proposed.amount<0)return bad('The amount sign does not match the transaction type');
   proposed={kind,targetAccountId:targetAccount?.id||'',targetAccount:targetAccount?.name||'',description:proposed.description.trim(),date:proposed.date,time:proposed.time,amount:proposed.amount,currency:proposed.currency,accountId:account?.id||'',account:account?.name||'',category:proposed.category};
  }else{proposed=null;status='confirmed';}
  if(status==='confirmed'&&b.targetId){const conflict=await db().prepare("SELECT id FROM decisions WHERE target_id=? AND status='confirmed' AND id<>?").bind(b.targetId,b.id).first();if(conflict)return Response.json({error:'This Money Manager entry already has a confirmed change for another transaction.'},{status:409});}
  const now=new Date().toISOString();
  await db().prepare('INSERT INTO decisions(id,target_id,status,note,updated_at,action,proposed_edit) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET target_id=excluded.target_id,status=excluded.status,note=excluded.note,updated_at=excluded.updated_at,action=excluded.action,proposed_edit=excluded.proposed_edit').bind(b.id,b.targetId,status,note,now,action,JSON.stringify(b.action==='revert'?{}:proposed||{})).run();
  return Response.json({id:b.id,target_id:b.targetId,status,note,updated_at:now,action,proposed_edit:JSON.stringify(b.action==='revert'?{}:proposed||{})});
 }catch(e){console.error('Decision save failed',e instanceof Error?e.message:'Storage error');return failure();}
}
