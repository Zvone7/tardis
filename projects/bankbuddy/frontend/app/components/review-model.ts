import type {Merge} from '../../lib/reconciliation';
export type Tx={id:string;date:string;time?:string;amount:number;currency:string;description:string;account:string;accountId?:string;category:string;categoryId?:string;bank?:string;fileId?:string;line?:number;type?:string;toAccountId?:string;memo?:string};
export type Match={target:Tx;score:number;reason:string;roundUp:number};
export type Item={id:string;source:Tx;candidates:Match[]};
export type Edit={description:string;date:string;time:string;amount:number;currency:string;accountId:string;account:string;category:string;categoryId?:string;kind?:'expense'|'income'|'transfer';targetAccountId?:string;targetAccount?:string;memo?:string;merge?:Merge};
export type Decision={id:string;target_id:string|null;status:string;note:string;updated_at:string;action?:string;proposed_edit?:string};
export type Report={accountMappings?:Record<string,string>;moneyManagerEntries?:Tx[];categoryOptions?:{name:string;kind:string;id:string;parentId?:string}[];items:Item[];moneyManagerOnly:Tx[];accounts:{id:string;name:string;currency:string}[];files:{id:string;name:string;bytes:number;sha256:string}[];summary:{transactions:number;withSuggestions:number;moneyManagerEntries:number;files:number;excluded:Record<string,number>};notes:string[]};
export type Field='description'|'date'|'time'|'amount'|'accountId'|'targetAccountId'|'category';
export type Choice={value:string;label:string;score:number;detail?:string;disabled?:boolean};
export const defaults:Record<string,string>={help:'K',queue:'M',previous:'Ø',next:'Æ',skip:'Å',save:'^',fieldUp:'W',fieldLeft:'A',fieldDown:'S',fieldRight:'D'};
export const labels:Record<string,string>={help:'Keyboard overview',queue:'Match queue',previous:'Previous transaction',next:'Next transaction',skip:'Skip for later',save:'Confirm draft change',fieldUp:'Amount options',fieldLeft:'Account options',fieldDown:'Category options',fieldRight:'Entry options'};
export const fieldLabels:Record<Field,string>={description:'Title',date:'Date',time:'Time',amount:'Amount',accountId:'Source account',targetAccountId:'Target account',category:'Category'};
export const physical:Record<string,string>={BracketLeft:'Å',BracketRight:'^',Semicolon:'Ø',Quote:'Æ'};
export function previousMonth(now=new Date()){const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Oslo',year:'numeric',month:'2-digit'}).formatToParts(now);const year=Number(p.find(p=>p.type==='year')?.value),month=Number(p.find(p=>p.type==='month')?.value);return new Date(Date.UTC(year,month-2,1)).toISOString().slice(0,7);}
export const monthLabel=(month:string)=>new Intl.DateTimeFormat('en-GB',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(month+'-01T12:00:00Z'));
export const dateLabel=(date:string)=>new Intl.DateTimeFormat('en-GB',{weekday:'short',day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'));
export const money=(t:{amount:number;currency:string})=>new Intl.NumberFormat('nb-NO',{style:'currency',currency:t.currency||'NOK',maximumFractionDigits:2}).format(t.amount);
const accountWords=(name:string)=>name.replace(/®[️]?/gu,'r').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export const pocketEntry=(t:Tx)=>t.bank==='revolut'&&/to pocket.*(?:lomm?e?penger|lomapenger)/i.test(t.description);
export const accountMappingKey=(t:Tx)=>pocketEntry(t)?`pocket|${t.currency}|lommepenger`:`${t.bank}|${t.currency}|${t.account}`;
export const reviewOrder=(a:Item,b:Item)=>{const rank=(t:Tx)=>pocketEntry(t)?4:t.amount<0?(t.bank==='nordea'?0:1):(t.bank==='nordea'?2:3);return rank(a.source)-rank(b.source)||a.source.date.localeCompare(b.source.date)||(a.source.line||0)-(b.source.line||0)||a.id.localeCompare(b.id)};
export function sourceAccount(source:Tx,accounts:Report['accounts'],mappings:Record<string,string>={}){
 const pool=accounts.filter(a=>a.currency.split('_').at(-1)===source.currency);
 const configured=pool.find(a=>a.id===mappings[accountMappingKey(source)]);if(configured)return configured;
 if(pocketEntry(source)){const pockets=pool.filter(a=>/revolut.*(?:lomm?e?penger|lomapenger)/.test(accountWords(a.name)));if(pockets.length===1)return pockets[0];return undefined;}
 const byId=pool.find(a=>a.id===source.accountId);if(byId)return byId;
 const name=accountWords(source.account),bank=source.bank||'';
 const exact=pool.filter(a=>accountWords(a.name)===name);if(exact.length===1)return exact[0];
 let matches:typeof pool=[];
 if(bank==='revolut'&&/personal account/.test(name))matches=pool.filter(a=>accountWords(a.name)==='revolut');
 else if(bank==='revolut'&&/lomm?e?penger|lomapenger/.test(name))matches=pool.filter(a=>/revolut.*(?:lomm?e?penger|lomapenger)/.test(accountWords(a.name)));
 else if(bank==='nordea'&&/brukskonto/.test(name))matches=pool.filter(a=>accountWords(a.name)==='nordea'&&!/🐖/.test(a.name));
 else if(bank==='nordea'&&/\bask\b/.test(name))matches=pool.filter(a=>/nordea.*\bask\b/.test(accountWords(a.name)));
 return matches.length===1?matches[0]:undefined;
}
export function originalEdit(item:Item,targetId:string|null,accounts:Report['accounts']=[],mappings:Record<string,string>={}):Edit{const inferred=sourceAccount(item.source,accounts,mappings);const t=item.candidates.find(c=>c.target.id===targetId)?.target||item.source;return {description:t.description||'Unlabelled',date:t.date,time:t.time||'23:59',amount:t.amount,currency:t.currency,accountId:t.type==='3'?t.toAccountId||'':t.type==='4'?t.accountId||'':inferred?.id||t.accountId||'',account:t.type==='3'?'':inferred?.name||(t.accountId?t.account:''),category:t.accountId?t.category:'',categoryId:t.categoryId,kind:['3','4'].includes(t.type||'')?'transfer':t.amount<0?'expense':'income',targetAccountId:t.type==='3'?t.accountId||'':t.toAccountId||'',targetAccount:'',memo:t.memo||(!targetId&&t.amount<0?'Newly created expense (BankBuddy)':'')};}
export function initialEdit(item:Item,decision?:Decision,accounts:Report['accounts']=[],mappings:Record<string,string>={}):{targetId:string|null;edit:Edit;note:string}{const targetId=decision?(decision.target_id||null):(item.candidates[0]?.target.id||null);const original=originalEdit(item,targetId,accounts,mappings);let saved;try{saved=JSON.parse(decision?.proposed_edit||'{}')}catch{saved={}}return {targetId,edit:typeof saved?.description==='string'?{...original,...saved}:original,note:decision?.note||''};}
export function choicesFor(field:Field,item:Item,report:Report,categories:string[]):Choice[]{
 const map=new Map<string,Choice>();const add=(value:string,label:string,score:number,detail?:string,disabled=false)=>{const old=map.get(value);if(!old||old.score<score)map.set(value,{value,label,score,detail,disabled});};
 for(const c of item.candidates){const t=c.target;const val=(field==='accountId'||field==='targetAccountId')?(field==='targetAccountId'?(t.type==='3'?t.accountId:t.toAccountId)||'':(t.type==='3'?t.toAccountId:t.accountId)||''):String(t[field as keyof Tx]??'');add(val,(field==='accountId'||field==='targetAccountId')?(report.accounts.find(a=>a.id===val)?.name||val):field==='amount'?money(t):field==='date'?dateLabel(t.date):val||'Time unavailable',(field==='accountId'||field==='targetAccountId')?Math.min(90,c.score):c.score,'Existing Money Manager entry');}
 if(['description','date','time','amount'].includes(field)){const s=item.source;const val=String(s[field as keyof Tx]??'');if(val)add(val,field==='amount'?money(s):field==='date'?dateLabel(s.date):val,100,'From bank statement');}
 if(field==='accountId'){const a=sourceAccount(item.source,report.accounts,report.accountMappings);if(a)add(a.id,a.name,100,report.accountMappings?.[accountMappingKey(item.source)]?'Your account mapping':'Source account / pocket and currency');}
 if(field==='accountId'||field==='targetAccountId')for(const a of report.accounts){const currency=a.currency.split('_').at(-1);const prior=map.get(a.id);add(a.id,a.name,prior?.score||(currency===item.source.currency?(accountWords(a.name).includes(item.source.bank||'unknown')?50:10):0),currency+(currency!==item.source.currency?' · different currency':''),currency!==item.source.currency);if(prior&&currency!==item.source.currency)prior.disabled=true;}
 if(field==='category')for(const category of categories)add(category,category,0,'No matching evidence');
 if(field==='time')add('23:59','23:59',0,'Default when the time is unknown');
 return [...map.values()].sort((a,b)=>b.score-a.score||a.label.localeCompare(b.label));
}
export function progressRows(items:Item[],decisions:Record<string,Decision>,key:(i:Item)=>string){const map=new Map<string,{name:string;total:number;done:number;held:number}>();const merged=new Set<string>();for(const d of Object.values(decisions))if(d.status==='confirmed'){try{const m=JSON.parse(d.proposed_edit||'{}').merge;if(m)for(const id of [m.purchaseId,m.roundUpId,m.creditId])if(id)merged.add(id)}catch{}}for(const i of items){const name=key(i);const row=map.get(name)||{name,total:0,done:0,held:0};row.total++;if(decisions[i.id]?.status==='confirmed'||merged.has(i.id))row.done++;else if(decisions[i.id]?.status==='held')row.held++;map.set(name,row)}return [...map.values()].sort((a,b)=>a.name.localeCompare(b.name));}
