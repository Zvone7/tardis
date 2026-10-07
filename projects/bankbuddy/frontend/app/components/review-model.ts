import type {Merge} from '../../lib/reconciliation';
export type Tx={id:string;date:string;time?:string;amount:number;currency:string;description:string;account:string;accountId?:string;category:string;categoryId?:string;bank?:string;fileId?:string;line?:number;type?:string;toAccountId?:string;memo?:string};
export type Match={target:Tx;score:number;reason:string;roundUp:number};
export type Item={id:string;source:Tx;candidates:Match[]};
export type Edit={description:string;date:string;time:string;amount:number;currency:string;accountId:string;account:string;category:string;categoryId?:string;kind?:'expense'|'income'|'transfer';targetAccountId?:string;targetAccount?:string;memo?:string;merge?:Merge};
export type Decision={id:string;target_id:string|null;status:string;note:string;updated_at:string;action?:string;proposed_edit?:string;review_context?:string};
export type NewAccount={id:string;name:string;currency:string;templateId:string};
export type Report={newAccounts?:NewAccount[];accountHistory?:{id:string;name:string;currency:string;status:number;transactionCount:number}[];accountMappings?:Record<string,string>;moneyManagerEntries?:Tx[];categoryOptions?:{name:string;kind:string;id:string;parentId?:string}[];items:Item[];moneyManagerOnly:Tx[];accounts:{id:string;name:string;currency:string}[];files:{id:string;name:string;bytes:number;sha256:string}[];summary:{transactions:number;withSuggestions:number;moneyManagerEntries:number;files:number;excluded:Record<string,number>};notes:string[]};
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
export function reviewDifficulty(item:Item,report?:Report){
 const best=[...item.candidates].sort((a,b)=>b.score-a.score)[0];const score=best?.score||0;
 const account=report?sourceAccount(item.source,report.accounts,report.accountMappings):undefined;
 const missing=[!(account||best?.target.accountId),!best?.target.category,!item.source.description?.trim()].filter(Boolean).length;
 const tier=score>=85&&missing===0?0:missing===1?1:score>=50?2:3;
 return {tier,score,missing,label:tier===0?'Strong match':tier===1?'Missing one field':tier===2?'Needs review':'Uncertain'};
}
export const reviewOrder=(a:Item,b:Item,report?:Report)=>{const rank=(t:Tx)=>pocketEntry(t)?4:t.amount<0?(t.bank==='nordea'?0:1):(t.bank==='nordea'?2:3);const x=reviewDifficulty(a,report),y=reviewDifficulty(b,report);return rank(a.source)-rank(b.source)||x.tier-y.tier||y.score-x.score||x.missing-y.missing||a.source.date.localeCompare(b.source.date)||(a.source.line||0)-(b.source.line||0)||a.id.localeCompare(b.id)};

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
export function originalEdit(item:Item,targetId:string|null,accounts:Report['accounts']=[],mappings:Record<string,string>={}):Edit{const inferred=sourceAccount(item.source,accounts,mappings);const t=item.candidates.find(c=>c.target.id===targetId)?.target||item.source;return {description:t.description||(targetId?'':item.source.description||'Unlabelled'),date:t.date,time:t.time||'23:59',amount:t.amount,currency:t.currency,accountId:t.type==='3'?t.toAccountId||'':t.type==='4'?t.accountId||'':inferred?.id||t.accountId||'',account:t.type==='3'?'':inferred?.name||(t.accountId?t.account:''),category:t.accountId?t.category:'',categoryId:t.categoryId,kind:['3','4'].includes(t.type||'')?'transfer':t.amount<0?'expense':'income',targetAccountId:t.type==='3'?t.accountId||'':t.toAccountId||'',targetAccount:'',memo:t.memo||(!targetId&&t.amount<0?'Newly created expense (BankBuddy)':'')};}
export function unchangedEntry(item:Item,targetId:string|null,edit:Edit|null){
 if(!targetId||!edit||edit.merge||!item.candidates.some(c=>c.target.id===targetId))return false;
 const original=originalEdit(item,targetId);
 const time=(t:string)=>t.length===5?t+':00':t;
 return ['description','date','currency','accountId','kind'].every(k=>(original as any)[k]===(edit as any)[k])&&Math.round(original.amount*100)===Math.round(edit.amount*100)&&time(original.time)===time(edit.time)&&(original.memo||'')===(edit.memo||'')&&(original.kind==='transfer'?(original.targetAccountId||'')===(edit.targetAccountId||''):(original.categoryId&&edit.categoryId?original.categoryId===edit.categoryId:original.category===edit.category));
}
export function initialEdit(item:Item,decision?:Decision,accounts:Report['accounts']=[],mappings:Record<string,string>={}):{targetId:string|null;edit:Edit;note:string}{const targetId=decision?(decision.target_id||null):(item.candidates[0]?.target.id||null);const original=originalEdit(item,targetId,accounts,mappings);if(!decision&&!original.description.trim())original.description=item.source.description||'Unlabelled';let saved;try{saved=JSON.parse(decision?.proposed_edit||'{}')}catch{saved={}}return {targetId,edit:typeof saved?.description==='string'?{...original,...saved}:original,note:decision?.note||''};}
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

export const merchantKey=(t:Tx)=>[t.bank,t.account,t.currency,t.amount<0?'out':'in',t.description.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim()].join('|');
export type Preference={key:string;merchant:string;count:number;consistent:boolean;edit:Partial<Edit>};
export function learnedPreferences(report:Report,decisions:Record<string,Decision>):Preference[]{
 const groups=new Map<string,{item:Item;edits:Edit[]}>();const items=new Map(report.items.map(i=>[i.id,i]));
 for(const d of Object.values(decisions)){if(d.status!=='confirmed'||!['create','edit'].includes(d.action||''))continue;const item=items.get(d.id);if(!item||/^(omkostninger|fee|fees|transfer|payment|unknown|unlabelled)$/i.test(item.source.description.trim()))continue;let e:Edit;try{e=JSON.parse(d.proposed_edit||'{}')}catch{continue}if(!e.accountId||!e.kind||e.kind==='transfer'||e.merge)continue;
 const key=merchantKey(item.source),group=groups.get(key)||{item,edits:[]};group.edits.push(e);groups.set(key,group);
 }
 return [...groups].map(([key,g])=>{const first=g.edits[0];return {key,merchant:g.item.source.description,count:g.edits.length,consistent:g.edits.every(e=>e.kind===first.kind&&e.accountId===first.accountId&&(e.categoryId||e.category)===(first.categoryId||first.category)),edit:{kind:first.kind,accountId:first.accountId,account:first.account,category:first.category,categoryId:first.categoryId}}}).sort((a,b)=>b.count-a.count||a.merchant.localeCompare(b.merchant));
}
export function applyPreference(edit:Edit,item:Item,report:Report,preference?:Preference):Edit{
 if(!preference?.consistent||preference.edit.kind!==edit.kind)return edit;
 const category=report.categoryOptions?.filter(c=>c.kind===edit.kind&&(preference.edit.categoryId?c.id===preference.edit.categoryId:c.name===preference.edit.category));
 const account=report.accounts.find(a=>a.id===preference.edit.accountId&&a.currency.split('_').at(-1)===edit.currency);
 return {...edit,...(account&&!report.accountMappings?.[accountMappingKey(item.source)]?{accountId:account.id,account:account.name}:{}),...(category?.length===1?{category:category[0].name,categoryId:category[0].id}:{})};
}
export const sortedCategories=(report:Report,kind:string)=>[...(report.categoryOptions||[])].filter(c=>c.kind===kind).sort((a,b)=>a.name.trim().localeCompare(b.name.trim(),'nb',{sensitivity:'base',numeric:true})||a.id.localeCompare(b.id));

export function availableCandidates(candidates:Match[],itemId:string,decisions:Record<string,Decision>){
 const used=new Set(Object.values(decisions).filter(d=>d.id!==itemId&&d.status==='confirmed'&&d.target_id).map(d=>d.target_id));
 return candidates.filter(c=>!used.has(c.target.id));
}
export function strongestCandidates(candidates:Match[]){
 const best=new Map<string,Match>();
 for(const candidate of candidates){const current=best.get(candidate.target.id);if(!current||candidate.score>current.score)best.set(candidate.target.id,candidate)}
 return [...best.values()].sort((a,b)=>b.score-a.score||a.target.id.localeCompare(b.target.id));
}
export function entryChanges(item:Item,targetId:string|null,edit:Edit|null,accounts:Report['accounts']=[]){
 if(!targetId||!edit)return [];
 const o=originalEdit(item,targetId),name=(id?:string)=>accounts.find(a=>a.id===id)?.name||id||'—',time=(t:string)=>t.length===5?t+':00':t;
 const row=(label:string,before:string|undefined,after:string|undefined,changed=before!==after)=>({label,before:before||'—',after:after||'—',changed});
 return [row('Type',o.kind,edit.kind),row('Date',o.date,edit.date),row('Time (imported UTC)',o.time,edit.time,time(o.time)!==time(edit.time)),row('Account',name(o.accountId),name(edit.accountId),o.accountId!==edit.accountId),
 ...(o.kind==='transfer'||edit.kind==='transfer'?[row('To account',name(o.targetAccountId),name(edit.targetAccountId),(o.targetAccountId||'')!==(edit.targetAccountId||''))]:[]),
 ...(edit.kind!=='transfer'?[row('Category',o.category,edit.category,o.categoryId&&edit.categoryId?o.categoryId!==edit.categoryId:o.category!==edit.category)]:[]),
 row('Amount',money(o),money(edit),Math.round(o.amount*100)!==Math.round(edit.amount*100)||o.currency!==edit.currency),row('Note',o.description,edit.description),row('Description',o.memo||'',edit.memo||''),
 ...(edit.merge?[row('Pairing','Single bank entry','Purchase + round-up',true)]:[])];
}
