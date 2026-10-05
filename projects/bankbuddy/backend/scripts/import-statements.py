"""Read-only statement import. Outputs private report JSON, never changes the backup."""
import csv, sqlite3, pathlib, re, json, hashlib, datetime, collections, sys
root=pathlib.Path(sys.argv[1]); out=pathlib.Path(sys.argv[2]); files=sorted(root.glob('**/*'))
files=[p for p in files if p.is_file() and (p.suffix=='.csv' or p.name.endswith('.mmbak.bin') or p.suffix=='.mmbak')]
backup=next(p for p in files if '.mmbak' in p.name)
before=hashlib.sha256(backup.read_bytes()).hexdigest()
c=sqlite3.connect(f'file:{backup}?mode=ro',uri=True); c.row_factory=sqlite3.Row
accounts=[dict(r) for r in c.execute('SELECT ZUID as id,ZNICNAME as name,ZCURRENCYUID as currency FROM ZASSET WHERE ZISDEL IN (0,3)')]
mm=[]
for r in c.execute("SELECT t.Z_PK id,date(t.ZDATE+978307200,'unixepoch') date,time(t.ZDATE+978307200,'unixepoch') time,t.ZAMOUNTACCOUNT amount,t.ZDO_TYPE type,t.ZASSETUID accountId,a.ZNICNAME account,coalesce(t.ZCONTENT,'') description,t.ZCURRENCYUID currency,coalesce(cat.ZNAME,t.ZCATEGORY_NAME,'Uncategorized') category FROM ZINOUTCOME t JOIN ZASSET a ON a.ZUID=t.ZASSETUID LEFT JOIN ZCATEGORY cat ON cat.ZUID=t.ZCATEGORYUID WHERE t.ZISDEL=0 AND a.ZISDEL IN (0,3)"):
 d=dict(r);d['id']='mm-'+str(d['id']);d['currency']=(d['currency'] or '').split('_')[-1];d['amount']=round(abs(float(d['amount']))*(-1 if d['type'] in ['1','4'] else 1),2);mm.append(d)
sources=[];manifest=[];skipped=collections.Counter()
def number(s,decimal_comma=False):
 s=re.sub(r'[^0-9,.\-]','',s)
 return round(float(s.replace('.','').replace(',','.') if decimal_comma else s.replace(',','')),2)
def iso(s):
 for fmt in ['%Y/%m/%d','%Y-%m-%d','%b %d, %Y','%d %b %Y']:
  try:return datetime.datetime.strptime(s,fmt).date().isoformat()
  except ValueError:pass
 return None
for p in files:
 raw=p.read_bytes();name=p.name.removesuffix('.bin');fid=hashlib.sha256(raw).hexdigest();manifest.append({'id':fid,'name':name,'bytes':len(raw),'sha256':fid})
 if p.suffix!='.csv':continue
 bank='revolut' if p.name.startswith('consolidated_') else 'nordea';rows=list(csv.reader(raw.decode('utf-8-sig',errors='replace').splitlines(),delimiter=',' if bank=='revolut' else ';'))
 section='';currency='';active=False
 for n,r in enumerate(rows):
  if not r:continue
  if bank=='revolut':
   if re.search(r'\([A-Z]{3}\)$',r[0]):section=r[0];currency=r[0][-4:-1];active=False
   if r[:3]==['Date','Description','Category']:active=True;continue
   if r[0]=='Date':active=False
   date=iso(r[0])
   if not active or not date or len(r)<4:continue
   try:value=number(r[3])
   except ValueError:skipped['invalidAmount']+=1;continue
   if not currency:skipped['unknownCurrency']+=1;continue
   desc=r[1];category=r[2];account='Revolut · '+section
  else:
   if n==0:continue
   date=iso(r[0])
   if not date:skipped['undatedOrReservedNordea']+=1;continue
   value=number(r[1],True);desc=r[5] or r[4] or 'Unlabelled';category=r[7];currency=r[6];account='Nordea · '+p.name.split(' - ')[0]
  sources.append({'id':bank+'-'+fid[:12]+'-'+str(n),'date':date,'amount':value,'currency':currency,'description':desc,'category':category,'account':account,'bank':bank,'fileId':fid,'line':n+1})
by_day=collections.defaultdict(list)
for m in mm:
 if m['date']:by_day[(m['date'],m['currency'])].append(m)
items=[];mentioned=set()
for s in sources:
 candidates=[];day=datetime.date.fromisoformat(s['date'])
 for offset in range(-7,8):
  for m in by_day[((day+datetime.timedelta(days=offset)).isoformat(),s['currency'])]:
   if (s['amount']<0)!=(m['amount']<0):continue
   diff=round(abs(m['amount'])-abs(s['amount']),2); roundup=round((-abs(s['amount']))%10,2)
   exact=abs(diff)<.005;rounded=s['bank']=='revolut' and s['currency']=='NOK' and s['amount']<0 and m['type']=='1' and roundup>0 and abs(diff-roundup)<.005
   if not exact and not rounded:continue
   name=m['account'].lower();same=('evolut' in name) if s['bank']=='revolut' else 'nordea' in name
   words=set(re.findall(r'\w{3,}',s['description'].lower()))&set(re.findall(r'\w{3,}',m['description'].lower()))
   score=min(99,40+(24 if same else 0)+(15 if abs(offset)<=1 else 8 if abs(offset)<=3 else 2)+min(15,len(words)*7)+(5 if exact else 0))
   reason=('Exact amount' if exact else f'{roundup:.2f} NOK possible round-up')+f' · {abs(offset)} day gap'+(' · same bank' if same else ' · different bank/account')
   candidates.append({'target':m,'score':score,'reason':reason,'roundUp':roundup if rounded else 0,'accountReview':True})
 candidates.sort(key=lambda x:x['score'],reverse=True);candidates=candidates[:5]
 for e in candidates:mentioned.add(e['target']['id'])
 items.append({'id':s['id'],'source':s,'candidates':candidates})
items.sort(key=lambda i:(i['source']['date'],i['id']),reverse=True)
relevant=[m for m in mm if m['date'] and '2020-01-01'<=m['date']<='2026-10-04' and any(b in m['account'].lower() for b in ['evolut','nordea'])]
report={'version':1,'generatedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'items':items,'moneyManagerOnly':[m for m in relevant if m['id'] not in mentioned],'accounts':accounts,'files':manifest,'summary':{'transactions':len(items),'withSuggestions':sum(bool(i['candidates']) for i in items),'moneyManagerEntries':len(mm),'files':len(files),'excluded':dict(skipped)},'notes':['Scores rank suggestions; they are not probabilities or confirmations.','Account pairings are not verified. Check the exact account before confirming.','Native statement currencies are preserved; no inferred exchange rates.','Undated reserved Nordea entries are retained in source files but excluded from matching.','Money Manager dates and times use the handoff’s UTC conversion; they may differ from local app time.','Money Manager-only means no amount/date candidate in these exports, not proof of a missing bank transaction.']}
out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(report,ensure_ascii=False,separators=(',',':')))
assert hashlib.sha256(backup.read_bytes()).hexdigest()==before
assert len({s['id'] for s in sources})==len(sources)
assert all(abs(s['amount'])<100000000 for s in sources)
print(json.dumps(report['summary']))
