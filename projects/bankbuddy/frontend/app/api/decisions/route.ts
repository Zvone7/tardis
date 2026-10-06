import {originalEdit,type Edit} from '@/app/components/review-model';
import {db,failure,validOrigin} from '@/lib/storage';
import {loadReport} from '@/lib/report';
import {matchingEntries,validateMerge,mergedIds} from '@/lib/reconciliation';
export async function GET(){try{return Response.json((await db().prepare('SELECT * FROM decisions ORDER BY updated_at DESC').all()).results,{headers:{'Cache-Control':'private, no-store'}});}catch{return failure();}}
const bad=(error:string,status=400)=>Response.json({error},{status});
export async function POST(request:Request){
 if(!validOrigin(request))return new Response('Forbidden',{status:403});
 let b:any;try{b=await request.json()}catch{return bad('Invalid JSON')}
 if(!b||typeof b.id!=='string'||!['confirmed','held','unresolved'].includes(b.status)||typeof b.note!=='string'||b.note.length>4000||!(b.targetId===null||typeof b.targetId==='string')||!['create','edit','delete','revert','match'].includes(b.action))return bad('Invalid review decision');
 try{
  const report=await loadReport();if(!report)return failure();const item=report.items.find(i=>i.id===b.id);if(!item)return bad('Transaction not found');
  let proposed:Edit=b.proposedEdit,action=b.action,status=b.status,note=b.note;
  let pair;try{if(action!=='revert'&&action!=='delete'&&proposed?.merge)pair=validateMerge(item,proposed.merge,report)}catch(e){return bad((e as Error).message)}
  const matches=[...(pair?[]:item.candidates),...matchingEntries(pair?.purchase||item,report,pair?.total)];
  const match=matches.find(c=>c.target.id===b.targetId);
  // Previously saved targets can always be reverted, even if suggestion ranking changed.
  if(action!=='revert'&&b.targetId&&!match)return bad('Select a suggested Money Manager entry');
  if((action==='edit'||action==='match')&&!match)return bad('Select an existing Money Manager entry to update');
  if(action==='create'&&b.targetId)return bad('A new entry cannot overwrite an existing entry');
  if(action==='revert'){proposed=originalEdit(item,b.targetId);action=match?'edit':'create';status='unresolved';note=''}
  else if(action==='match'){if(proposed?.merge)return bad('A merged expense must be reviewed as a change');proposed={} as Edit;status='confirmed'}
  else if(action!=='delete'){
   if(!proposed||typeof proposed.description!=='string'||!proposed.description.trim()||proposed.description.length>500||typeof proposed.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(proposed.date)||Number.isNaN(Date.parse(proposed.date))||new Date(proposed.date).toISOString().slice(0,10)!==proposed.date||typeof proposed.time!=='string'||proposed.time!==''&&!/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(proposed.time)||!Number.isFinite(proposed.amount)||Math.abs(proposed.amount)>100000000||typeof proposed.category!=='string'||proposed.category.length>200||proposed.memo!==undefined&&(typeof proposed.memo!=='string'||proposed.memo.length>4000))return bad('Check the note, date, time, amount and description');
   const account=report.accounts.find(a=>a.id===proposed.accountId),kind=proposed.kind||(proposed.amount<0?'expense':'income');
   if(!['expense','income','transfer'].includes(kind))return bad('Invalid transaction type');
   if(status==='confirmed'&&!account)return bad('Choose an account');
   if(proposed.accountId&&!account)return bad('Unknown account');
   if(proposed.currency!==item.source.currency||account&&account.currency.split('_').at(-1)!==proposed.currency)return bad('Choose an account in the statement currency');
   const target=kind==='transfer'?report.accounts.find(a=>a.id===proposed.targetAccountId):undefined;
   if(status==='confirmed'&&kind==='transfer'&&(!target||target.id===account?.id||target.currency!==account?.currency))return bad('Choose two different accounts in the same currency');
   if(status==='confirmed'&&kind!=='transfer'&&!proposed.category.trim())return bad('Choose a category');
   if(kind==='expense'&&proposed.amount>0||kind==='income'&&proposed.amount<0)return bad('Amount sign does not match the transaction type');
   if(pair&&(kind!=='expense'||Math.round(proposed.amount*100)!==Math.round(pair.total*100)))return bad('The merged expense must equal the purchase plus the round-up');
   let memo=proposed.memo||'';if(action==='create'&&kind==='expense'&&!memo.includes('Newly created expense'))memo=[memo,'Newly created expense (BankBuddy)'].filter(Boolean).join('\n');
   proposed={kind,description:proposed.description.trim(),memo,date:proposed.date,time:proposed.time||'23:59',amount:proposed.amount,currency:proposed.currency,accountId:account?.id||'',account:account?.name||'',targetAccountId:target?.id||'',targetAccount:target?.name||'',category:kind==='transfer'?'':proposed.category,...(typeof proposed.categoryId==='string'&&proposed.categoryId.length<=100&&kind!=='transfer'?{categoryId:proposed.categoryId}:{}),...(pair?{merge:{purchaseId:pair.purchase.id,roundUpId:pair.roundUp.id,...(pair.credit?{creditId:pair.credit.id}:{})}}:{})};
  }else{proposed={} as Edit;status='confirmed'}
  const sources=status==='confirmed'?mergedIds(item.id,proposed?.merge):[];
  if(sources.length){const conflict=await db().prepare(`SELECT id FROM decisions WHERE id IN (${sources.map(()=>'?').join(',')}) AND id<>? AND status='confirmed'`).bind(...sources,item.id).first();if(conflict)return bad('One of these bank transactions is already confirmed. Revert its other decision first.',409)}
  const context=b.reviewContext&&typeof b.reviewContext==='object'?JSON.stringify(b.reviewContext):'{}';if(context.length>20000)return bad('Review context is too large');
  const now=new Date().toISOString(),payload=JSON.stringify(b.action==='revert'?{}:proposed||{});
  const audit=JSON.stringify({id:item.id,at:now,action:b.action,status,source:item.source,original:match?.target||null,after:{targetId:b.targetId,status,note,action,proposedEdit:proposed},context:JSON.parse(context)});
  await db().batch([
   db().prepare("INSERT INTO settings(key,value) SELECT ?,json_set(?, '$.previous', json(COALESCE((SELECT json_object('targetId',target_id,'status',status,'note',note,'action',action,'proposedEdit',json(proposed_edit)) FROM decisions WHERE id=?),'null')))").bind('review_history_'+crypto.randomUUID(),audit,item.id),
   db().prepare('DELETE FROM decision_sources WHERE decision_id=?').bind(item.id),
   db().prepare('INSERT INTO decisions(id,target_id,status,note,updated_at,action,proposed_edit) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET target_id=excluded.target_id,status=excluded.status,note=excluded.note,updated_at=excluded.updated_at,action=excluded.action,proposed_edit=excluded.proposed_edit').bind(item.id,b.targetId,status,note,now,action,payload),
   ...sources.map(sourceId=>db().prepare('INSERT INTO decision_sources(source_id,decision_id) VALUES(?,?)').bind(sourceId,item.id))
  ]);
  return Response.json({id:item.id,target_id:b.targetId,status,note,updated_at:now,action,proposed_edit:payload});
 }catch(e){const message=e instanceof Error?e.message:'';if(/unique|constraint/i.test(message))return bad('An entry or round-up is already used by another confirmed change. Revert that change first.',409);console.error('Decision save failed',message);return failure()}
}
