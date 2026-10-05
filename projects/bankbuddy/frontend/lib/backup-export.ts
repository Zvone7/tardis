import type {Database, SqlJsStatic} from 'sql.js';
import type {Decision,Report,Edit} from '../app/components/review-model';
type Row=Record<string,any>;
const rows=(db:Database,sql:string,params:any[]=[]):Row[]=>{const q=db.prepare(sql);try{q.bind(params);const out:Row[]=[];while(q.step())out.push(q.getAsObject());return out}finally{q.free()}};
let sqlReady:Promise<SqlJsStatic>|undefined;
async function engine(){
 if(!sqlReady)sqlReady=new Promise<SqlJsStatic>((resolve,reject)=>{
 const start=()=>{(window as any).initSqlJs({locateFile:()=>'/vendor/sql-wasm.wasm'}).then(resolve,(e:unknown)=>{sqlReady=undefined;reject(e)})};
 if((window as any).initSqlJs){start();return}const script=document.createElement('script');script.src='/vendor/sql-wasm.js';script.onload=start;script.onerror=()=>{sqlReady=undefined;reject(Error('Could not load the backup exporter. Please retry.'))};document.head.appendChild(script);
 });return sqlReady;
}
export async function readBackup(report:Report){
 const file=report.files.find(f=>/\.mmbak(?:\.bin)?$/i.test(f.name));if(!file)throw Error('Money Manager backup not found');
 const response=await fetch('/api/files?id='+file.id);if(!response.ok)throw Error('Could not read the original backup');
 const bytes=new Uint8Array(await response.arrayBuffer());
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(n=>n.toString(16).padStart(2,'0')).join('');
 if(hash!==file.sha256)throw Error('Original backup checksum does not match. Export stopped.');
 const SQL=await engine();return {db:new SQL.Database(bytes),hash};
}
export async function enrichReport(report:Report){
 const {db}=await readBackup(report);try{
 const map=new Map(rows(db,'SELECT Z_PK,ZTOASSETUID,ZMEMO,ZCATEGORYUID FROM ZINOUTCOME').map(r=>['mm-'+r.Z_PK,{toAccountId:r.ZTOASSETUID||'',memo:r.ZMEMO||'',categoryId:r.ZCATEGORYUID||''}]));
 const categoryOptions=rows(db,'SELECT * FROM ZCATEGORY WHERE ZISDEL=0').filter(c=>[0,1].includes(Number(c.ZDOTYPE))).map(c=>({id:String(c.ZUID),name:String(c.ZNAME),parentId:c.ZPUID?String(c.ZPUID):undefined,kind:Number(c.ZDOTYPE)===1?'expense':'income'}));
 return {...report,categoryOptions,items:report.items.map(i=>({...i,candidates:i.candidates.map(c=>({...c,target:{...c.target,...map.get(c.target.id)}}))}))};
 }finally{db.close()}
}
/** All changes occur in an in-memory copy. A failure rolls back the entire export. */
export function applyDecisions(db:Database,decisions:Decision[],report:Report){
 const confirmed=decisions.filter(d=>d.status==='confirmed'&&d.action!=='revert');
 if(!confirmed.length)throw Error('There are no confirmed changes to export.');
 const itemIds=new Set(report.items.map(i=>i.id));
 const usedSources=new Set<string>();
 for(const d of confirmed){const e:Edit=JSON.parse(d.proposed_edit||'{}');const ids=[...new Set([d.id,...(e.merge?[e.merge.purchaseId,e.merge.roundUpId,...(e.merge.creditId?[e.merge.creditId]:[])]:[])])];for(const id of ids){if(!itemIds.has(id)||usedSources.has(id))throw Error('A purchase or round-up is included in more than one confirmed change. Revert the duplicate first.');usedSources.add(id)}}
 const accounts=rows(db,'SELECT * FROM ZASSET WHERE ZISDEL IN (0,3)');
 const categories=rows(db,'SELECT * FROM ZCATEGORY WHERE ZISDEL=0');
 const currencies=rows(db,'SELECT * FROM ZCURRENCY WHERE ZISDEL=0');
 const entity=rows(db,"SELECT Z_ENT FROM Z_PRIMARYKEY WHERE Z_NAME='InOutCome'")[0]?.Z_ENT;
 if(!entity)throw Error('Unsupported Money Manager database: transaction entity missing.');
 let nextPk=Number(rows(db,'SELECT MAX(Z_PK) n FROM ZINOUTCOME')[0].n||0)+1;
 let nextAid=Number(rows(db,'SELECT MAX(ZAID) n FROM ZINOUTCOME')[0].n||0)+1;
 const touched=new Set<number>();let added=0,edited=0,deleted=0,dismissed=0;
 const now=Date.now();
 const update=(pk:number,patch:Row)=>{const keys=Object.keys(patch);db.run('UPDATE ZINOUTCOME SET '+keys.map(k=>k+'=?').join(',')+' WHERE Z_PK=?',[...keys.map(k=>patch[k]),pk])};
 const insert=(patch:Row)=>{const value={Z_PK:nextPk++,Z_ENT:entity,Z_OPT:1,ZAID:nextAid++,ZISDEL:0,ZISSYNCED:0,ZSYNCCHECK:0,ZSYNCVERSION:0,ZUTIME:now,ZUID:crypto.randomUUID().toUpperCase(),ZTXUIDFEE:'',ZCARDDIVIDEUID:'',ZCARDDIVIDEMONTH:'0',...patch};const keys=Object.keys(value);db.run('INSERT INTO ZINOUTCOME ('+keys.join(',')+') VALUES ('+keys.map(()=>'?').join(',')+')',keys.map(k=>(value as Row)[k]));return value};
 const mark=(r:Row)=>{if(touched.has(r.Z_PK))throw Error('Two confirmed changes affect the same entry or transfer. Revert one before exporting.');touched.add(r.Z_PK)};
 db.run('BEGIN');
 try{
 for(const d of confirmed){
  if(!itemIds.has(d.id))throw Error('A confirmed change refers to a missing bank transaction.');
  if(!['create','edit','delete'].includes(d.action||''))throw Error('A legacy confirmation must be reviewed again before export.');
  const pk=d.target_id?Number(d.target_id.replace(/^mm-/,'')):null;
  let original=pk?rows(db,'SELECT * FROM ZINOUTCOME WHERE Z_PK=? AND ZISDEL=0',[pk])[0]:undefined;
  if(d.target_id&&!original)throw Error('A selected Money Manager entry is missing or already deleted.');
  if(original&&!['0','1','3','4'].includes(original.ZDO_TYPE))throw Error('This entry type is not supported for export.');
  const isTransfer=original&&['3','4'].includes(original.ZDO_TYPE);
  let pair:Row[]=[];
  if(isTransfer){
   if(!original!.ZTXUIDTRANS)throw Error('Transfer link is missing.');
   pair=rows(db,'SELECT * FROM ZINOUTCOME WHERE ZTXUIDTRANS=? AND ZISDEL=0',[original!.ZTXUIDTRANS]);
   if(pair.length!==2||!pair.some(r=>r.ZDO_TYPE==='3')||!pair.some(r=>r.ZDO_TYPE==='4'))throw Error('Transfer is incomplete or has extra linked records.');
   for(const r of pair)if(r.ZTXUIDFEE)throw Error('Transfers with linked fees require manual review.');
  }
  const affected=pair.length?pair:original?[original]:[];affected.forEach(mark);
  if(d.action==='delete'){if(!original){dismissed++;continue}for(const r of affected)update(r.Z_PK,{ZISDEL:1,ZISSYNCED:0,Z_OPT:(r.Z_OPT||0)+1,ZUTIME:now});deleted++;continue}
  if(d.action==='edit'&&!original||d.action==='create'&&original)throw Error('The draft action does not match its selected entry.');
  const e:Edit=JSON.parse(d.proposed_edit||'{}');
  const kind=e.kind||(isTransfer?'transfer':e.amount<0?'expense':'income');
  if(!['expense','income','transfer'].includes(kind)||!Number.isFinite(e.amount)||!e.description?.trim())throw Error('Invalid confirmed entry.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(e.date)||e.time&&!/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(e.time))throw Error('Invalid date or time.');
  const timestamp=Date.parse(e.date+'T'+(e.time||'23:59:00')+'Z')/1000-978307200;
  if(!Number.isFinite(timestamp))throw Error('Invalid entry date.');
  const account=accounts.find(a=>a.ZUID===e.accountId);if(!account||account.ZCURRENCYUID.split('_').at(-1)!==e.currency)throw Error('Account currency does not match.');
  const target=kind==='transfer'?accounts.find(a=>a.ZUID===e.targetAccountId):null;
  if(kind==='transfer'&&(!target||target.ZUID===account.ZUID||target.ZCURRENCYUID!==account.ZCURRENCYUID))throw Error('Choose two different accounts in the same currency for a transfer.');
  let category:Row|undefined;
  if(kind!=='transfer'){
   const candidates=categories.filter(c=>(e.categoryId?c.ZUID===e.categoryId:c.ZNAME===e.category)&&Number(c.ZDOTYPE)===(kind==='expense'?1:0));
   if(candidates.length!==1)throw Error('Choose an existing, unambiguous '+kind+' category before exporting: '+e.category);
   category=candidates[0];
  }
  // Preserve the historical base-currency ratio on edits; new entries use the backup's stored rate.
  const basis=pair.find(r=>r.ZDO_TYPE==='4')||original;
  const rate=basis&&basis.ZCURRENCYUID===account.ZCURRENCYUID&&Number(basis.ZAMOUNTACCOUNT)!==0?Number(basis.ZAMOUNT)/Number(basis.ZAMOUNTACCOUNT):Number(currencies.find(c=>c.ZUID===account.ZCURRENCYUID)?.ZRATE);
  if(!Number.isFinite(rate)||rate<=0)throw Error('No valid stored exchange rate for this currency.');
  const amount=Math.abs(e.amount),base=Math.round(amount*rate*1000000)/1000000;
  const patch=(a:Row,type:string,to='',link=''):Row=>({ZDATE:timestamp,ZTXDATESTR:e.date,ZAMOUNT:base,ZAMOUNTACCOUNT:amount,ZAMOUNTSUB:amount,ZCONTENT:e.description.trim(),ZMEMO:e.memo??original?.ZMEMO??'',ZDO_TYPE:type,ZASSETUID:a.ZUID,ZASSET_NIC:a.ZNICNAME,ZASSET_NAME:a.ZNICNAME,ZCURRENCYUID:a.ZCURRENCYUID,ZCATEGORYUID:category?.ZUID||'',ZCATEGORY_NAME:category?.ZNAME||'',ZCATEGORYID:category?.ZAID||0,ZCATEGORY_ID:0,ZTOASSETUID:to,ZTXUIDTRANS:link,ZISSYNCED:0,ZUTIME:now});
  if(kind==='transfer'){
   const link=pair[0]?.ZTXUIDTRANS||crypto.randomUUID().toUpperCase();
   const out=pair.find(r=>r.ZDO_TYPE==='4')||original,into=pair.find(r=>r.ZDO_TYPE==='3');
   if(out)update(out.Z_PK,{...patch(account,'4',target!.ZUID,link),Z_OPT:(out.Z_OPT||0)+1});else insert(patch(account,'4',target!.ZUID,link));
   if(into)update(into.Z_PK,{...patch(target!,'3',account.ZUID,link),Z_OPT:(into.Z_OPT||0)+1});else insert(patch(target!,'3',account.ZUID,link));
  }else{
   if(original)update(original.Z_PK,{...patch(account,kind==='expense'?'1':'0'),Z_OPT:(original.Z_OPT||0)+1});else insert(patch(account,kind==='expense'?'1':'0'));
   for(const r of pair)if(r.Z_PK!==original!.Z_PK)update(r.Z_PK,{ZISDEL:1,ZISSYNCED:0,Z_OPT:(r.Z_OPT||0)+1,ZUTIME:now});
  }
  if(original)edited++;else added++;
 }
 db.run('UPDATE Z_PRIMARYKEY SET Z_MAX=MAX(Z_MAX,?) WHERE Z_ENT=?',[nextPk-1,entity]);
 const integrity=rows(db,'PRAGMA integrity_check');if(integrity.length!==1||Object.values(integrity[0])[0]!=='ok')throw Error('Export integrity check failed.');
 db.run('COMMIT');return {added,edited,deleted,dismissed};
 }catch(e){db.run('ROLLBACK');throw e}
}
export async function exportBackup(report:Report){
 const response=await fetch('/api/decisions');if(!response.ok)throw Error('Could not load saved decisions.');
 const decisions:Decision[]=await response.json();const {db}=await readBackup(report);
 try{const summary=applyDecisions(db,decisions,report);return {bytes:db.export(),summary}}finally{db.close()}
}
