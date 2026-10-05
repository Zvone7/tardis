"""Read-only Money Manager catalogue for account/amount correction suggestions."""
import sqlite3,pathlib,json,sys,hashlib
source=pathlib.Path(sys.argv[1]);out=pathlib.Path(sys.argv[2]);before=hashlib.sha256(source.read_bytes()).hexdigest()
c=sqlite3.connect(f'file:{source}?mode=ro',uri=True);c.row_factory=sqlite3.Row
entries=[]
for r in c.execute("SELECT t.Z_PK id,date(t.ZDATE+978307200,'unixepoch') date,time(t.ZDATE+978307200,'unixepoch') time,t.ZAMOUNTACCOUNT amount,t.ZDO_TYPE type,t.ZASSETUID accountId,t.ZTOASSETUID toAccountId,a.ZNICNAME account,coalesce(t.ZCONTENT,'') description,coalesce(t.ZMEMO,'') memo,t.ZCURRENCYUID currency,coalesce(cat.ZNAME,t.ZCATEGORY_NAME,'') category FROM ZINOUTCOME t JOIN ZASSET a ON a.ZUID=t.ZASSETUID LEFT JOIN ZCATEGORY cat ON cat.ZUID=t.ZCATEGORYUID WHERE t.ZISDEL=0 AND a.ZISDEL IN (0,3)"):
 d=dict(r);d['id']='mm-'+str(d['id']);d['currency']=(d['currency'] or '').split('_')[-1];d['amount']=round(abs(float(d['amount']))*(-1 if str(d['type']) in ['1','4'] else 1),2);entries.append(d)
categories=[dict(r) for r in c.execute("SELECT ZUID id,ZNAME name,CASE ZDOTYPE WHEN 1 THEN 'expense' WHEN 0 THEN 'income' ELSE 'other' END kind FROM ZCATEGORY WHERE ZISDEL=0")]
out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps({'entries':entries,'categories':categories},ensure_ascii=False,separators=(',',':')))
assert hashlib.sha256(source.read_bytes()).hexdigest()==before
print('Catalogue built read-only:',len(entries),'entries,',len(categories),'categories')
