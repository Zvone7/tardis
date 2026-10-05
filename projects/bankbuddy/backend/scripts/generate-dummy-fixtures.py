"""Generate synthetic importer fixtures from scratch. Never reads real bank data."""
from pathlib import Path
import sqlite3

ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT / 'tests/fixtures/dummy'

def generate():
    FIXTURES.mkdir(parents=True, exist_ok=True)
    (FIXTURES / 'consolidated_revolut_dummy.csv').write_text(
        'Demo Revolut (NOK)\nDate,Description,Category,Amount\n'
        '2026/09/02,DEMO Coffee,Foods,-45.50\n'
        '2026/09/03,DEMO Books,Shopping,-120.00\n'
        '2026/09/04,DEMO Refund,Others,25.00\n', encoding='utf-8')
    (FIXTURES / 'nordea_dummy.csv').write_text(
        'Date;Amount;Balance;Reference;Text;Description;Currency;Category\n'
        '2026-09-01;3080,21;3080,21;DEMO-001;;DEMO Income;NOK;Income\n'
        '2026-09-02;-125,50;2954,71;DEMO-002;;DEMO Groceries;NOK;Food\n'
        '2026-09-05;-99,00;2855,71;DEMO-003;;DEMO Unmatched;NOK;Shopping\n', encoding='utf-8')
    backup = FIXTURES / 'money-manager-dummy.mmbak'
    if backup.exists():
        backup.unlink()
    with sqlite3.connect(backup) as db:
        db.executescript('''
        CREATE TABLE ZASSET (ZUID TEXT, ZNICNAME TEXT, ZCURRENCYUID TEXT, ZISDEL INTEGER);
        CREATE TABLE ZCATEGORY (ZUID TEXT, ZNAME TEXT);
        CREATE TABLE ZINOUTCOME (Z_PK INTEGER, ZDATE REAL, ZAMOUNTACCOUNT REAL,
          ZDO_TYPE TEXT, ZASSETUID TEXT, ZCONTENT TEXT, ZCURRENCYUID TEXT,
          ZCATEGORYUID TEXT, ZCATEGORY_NAME TEXT, ZISDEL INTEGER);
        INSERT INTO ZASSET VALUES ('demo-revolut','Demo Revolut','currency_NOK',0),
          ('demo-nordea','Demo Nordea','currency_NOK',0);
        INSERT INTO ZCATEGORY VALUES ('demo-food','Demo Food'),('demo-income','Demo Income');
        INSERT INTO ZINOUTCOME VALUES
          (1,strftime('%s','2026-09-02 09:00:00')-978307200,50,'1','demo-revolut','DEMO Coffee','currency_NOK','demo-food','Demo Food',0),
          (2,strftime('%s','2026-09-03 10:00:00')-978307200,120,'1','demo-revolut','DEMO Books','currency_NOK','demo-food','Demo Food',0),
          (3,strftime('%s','2026-09-01 08:00:00')-978307200,3080.21,'0','demo-nordea','DEMO Income','currency_NOK','demo-income','Demo Income',0),
          (4,strftime('%s','2026-09-02 12:00:00')-978307200,125.50,'1','demo-nordea','DEMO Groceries','currency_NOK','demo-food','Demo Food',0);
        ''')
    print('Generated 2 synthetic CSVs and 1 minimal synthetic SQLite backup.')

if __name__ == '__main__':
    generate()
