import type {Report,Item,Tx,Match,Edit,Decision} from '../app/components/review-model';
export const cents=(value:number)=>Math.round(Math.abs(value)*100);
export const isPocket=(t:Tx)=>t.bank==='revolut'&&/to pocket.*(?:lomm?e?penger|lomapenger)/i.test(t.description);
export const isRoundUp=(t:Tx)=>isPocket(t)&&t.amount<0&&cents(t.amount)>0&&cents(t.amount)<=1000;
const dayGap=(a:string,b:string)=>Math.abs(Date.parse(a)-Date.parse(b))/86400000;
const minuteGap=(a:Tx,b:Tx)=>a.time&&b.time?Math.abs(Date.parse(`${a.date}T${a.time}Z`)-Date.parse(`${b.date}T${b.time}Z`))/60000:null;
const words=(s:string)=>new Set(s.toLowerCase().match(/[\p{L}\d]{3,}/gu)||[]);
export type Pair={purchase:Item;roundUp:Item;credit?:Item;score:number;reason:string;total:number};
export type Merge={purchaseId:string;roundUpId:string;creditId?:string};
export function pairSuggestions(item:Item,report:Report):Pair[]{
 if(item.source.bank!=='revolut'||item.source.amount>=0)return [];
 const startIsRoundUp=isRoundUp(item.source);
 if(!startIsRoundUp&&(/pocket|vault|exchang|transfer/i.test(item.source.description)))return [];
 const pool=report.items.filter(i=>i.id!==item.id&&i.source.bank==='revolut'&&i.source.amount<0&&i.source.currency===item.source.currency&&i.source.account===item.source.account&&i.source.fileId===item.source.fileId&&dayGap(i.source.date,item.source.date)<=3);
 const result:Pair[]=[];
 for(const other of pool){const purchase=startIsRoundUp?other:item,roundUp=startIsRoundUp?item:other;
  if(!isRoundUp(roundUp.source)||isPocket(purchase.source)||/pocket|vault|exchang|transfer/i.test(purchase.source.description))continue;
  const expected=1000-cents(purchase.source.amount)%1000;if(cents(roundUp.source.amount)!==expected)continue;
  const minutes=minuteGap(purchase.source,roundUp.source);
  const gap=dayGap(purchase.source.date,roundUp.source.date),lineGap=Math.abs((purchase.source.line||0)-(roundUp.source.line||0));
  // Repeated equal deposits are paired by their order in the two statement sections.
  const same=(i:Item)=>i.source.fileId===roundUp.source.fileId&&i.source.date===roundUp.source.date&&i.source.description===roundUp.source.description&&i.source.currency===roundUp.source.currency&&cents(i.source.amount)===cents(roundUp.source.amount);
  const debits=report.items.filter(i=>same(i)&&i.source.amount<0).sort((a,b)=>(a.source.line||0)-(b.source.line||0));
  const credits=report.items.filter(i=>same(i)&&i.source.amount>0).sort((a,b)=>(a.source.line||0)-(b.source.line||0));
  const credit=debits.length===credits.length?credits[debits.findIndex(i=>i.id===roundUp.id)]:undefined;
  result.push({purchase,roundUp,credit,total:-(cents(purchase.source.amount)+cents(roundUp.source.amount))/100,score:Math.max(35,95-gap*12-Math.min(lineGap,20)-(minutes!==null&&Number.isFinite(minutes)?Math.min(minutes/1440,1)*5:0)),reason:`Rounds to the next 10 ${purchase.source.currency} · ${gap===0?'same day':`${gap} day${gap===1?'':'s'} apart`} · ${minutes!==null&&Number.isFinite(minutes)?`${Math.round(minutes)} minutes apart · `:''}${lineGap} statement rows apart`});
 }
 return result.sort((a,b)=>b.score-a.score||a.purchase.id.localeCompare(b.purchase.id)).slice(0,8);
}
export function validateMerge(item:Item,merge:Merge,report:Report):Pair{
 if(!merge||typeof merge.purchaseId!=='string'||typeof merge.roundUpId!=='string')throw Error('Invalid round-up pairing');
 const pair=pairSuggestions(item,report).find(p=>p.purchase.id===merge.purchaseId&&p.roundUp.id===merge.roundUpId&&p.credit?.id===(merge.creditId||undefined));
 if(!pair)throw Error('This purchase and round-up no longer form a valid pair.');return pair;
}
export const mergedIds=(itemId:string,merge?:Merge)=>[...new Set([itemId,...(merge?[merge.purchaseId,merge.roundUpId,...(merge.creditId?[merge.creditId]:[])]:[])])];
export function matchingEntries(item:Item,report:Report,total?:number):Match[]{
 const seen=new Map<string,Tx>();for(const t of report.moneyManagerEntries||[])seen.set(t.id,t);for(const i of report.items)for(const c of i.candidates)seen.set(c.target.id,c.target);for(const t of report.moneyManagerOnly)seen.set(t.id,t);
 const pool=[...seen.values()],source=item.source,sourceWords=words(source.description);
 return pool.filter(t=>t.currency===source.currency&&t.amount<0&&(!t.type||t.type==='1')&&dayGap(t.date,source.date)<=7).map(t=>{
  const gap=dayGap(t.date,source.date),sameAmount=cents(t.amount)===cents(source.amount),combined=total!==undefined&&cents(t.amount)===cents(total),rounding=Math.abs(cents(t.amount)-cents(source.amount))<=1000;
  const overlap=[...words(t.description)].filter(w=>sourceWords.has(w)).length;
  const score=Math.min(98,(sameAmount?42:combined?46:rounding?15:0)+(gap===0?25:gap<=1?18:7)+Math.min(overlap*14,28));
  return {target:t,score,roundUp:0,reason:[combined?'Combined amount matches':sameAmount?'Purchase amount matches':`Different amount: ${t.amount.toFixed(2)}`,`${gap} day gap`,overlap?'Similar merchant':'Check merchant','Account may need correction'].join(' · ')};
 }).filter(c=>c.score>=45).sort((a,b)=>b.score-a.score||a.target.id.localeCompare(b.target.id)).slice(0,12);
}
export function parseEdit(d?:Decision):Partial<Edit>{try{return JSON.parse(d?.proposed_edit||'{}')}catch{return {}}}
