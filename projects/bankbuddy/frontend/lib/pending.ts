import type {Decision} from '../app/components/review-model';
/** Called only by the explicit Save batch action. Successful rows are acknowledged individually. */
export async function saveQueued(pending:Record<string,Decision>,onSaved:(decision:Decision)=>void){
 const ordered=Object.values(pending).sort((a,b)=>Number(a.status==='confirmed')-Number(b.status==='confirmed'));
 for(const d of ordered){
  const response=await fetch('/api/decisions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:d.id,targetId:d.target_id,status:d.status,note:d.note,action:d.action,proposedEdit:JSON.parse(d.proposed_edit||'{}'),reviewContext:JSON.parse(d.review_context||'{}')})});
  const result=await response.json() as Decision&{error?:string};
  if(!response.ok){const error=Error(result.error||'Could not save batch');(error as Error & {decisionId?:string}).decisionId=d.id;throw error;}
  onSaved(result);
 }
}
