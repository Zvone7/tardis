import {bucket,db} from './storage';
import type {Report} from '../app/components/review-model';
export async function loadReport():Promise<Report|null>{
 const file=await bucket().get('reconciliation.json');if(!file)return null;
 const report:Report=await file.json();
 const catalogue=await bucket().get('matching-catalogue-v2.json');
 if(catalogue){const data:any=await catalogue.json();report.moneyManagerEntries=data.entries;report.categoryOptions=data.categories;}
 const saved=await db().prepare('SELECT value FROM settings WHERE key=?').bind('new_accounts').first<{value:string}>();
 report.newAccounts=saved?JSON.parse(saved.value):[];report.accounts=[...report.accounts,...(report.newAccounts||[]).filter(a=>!report.accounts.some(x=>x.id===a.id))];
 return report;
}
