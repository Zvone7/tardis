import {bucket} from './storage';
import type {Report} from '../app/components/review-model';
export async function loadReport():Promise<Report|null>{
 const file=await bucket().get('reconciliation.json');if(!file)return null;
 const report:Report=await file.json();
 const catalogue=await bucket().get('matching-catalogue-v2.json');
 if(catalogue){const data:any=await catalogue.json();report.moneyManagerEntries=data.entries;report.categoryOptions=data.categories;}
 return report;
}
