"""Importer regression checks against synthetic fixtures only."""
from pathlib import Path
import hashlib
import json
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT / 'tests/fixtures/dummy'

class ImportTests(unittest.TestCase):
    def test_amounts_matches_and_immutable_backup(self):
        backup = FIXTURES / 'money-manager-dummy.mmbak'
        before = hashlib.sha256(backup.read_bytes()).hexdigest()
        with tempfile.TemporaryDirectory() as tmp:
            report_path = Path(tmp) / 'report.json'
            subprocess.run([sys.executable, str(ROOT / 'scripts/import-statements.py'),
                            str(FIXTURES), str(report_path)], check=True, capture_output=True)
            report = json.loads(report_path.read_text())
        self.assertEqual(before, hashlib.sha256(backup.read_bytes()).hexdigest())
        self.assertEqual(report['summary']['transactions'], 6)
        items = {item['source']['description']: item for item in report['items']}
        self.assertEqual(items['DEMO Income']['source']['amount'], 3080.21)
        self.assertEqual(items['DEMO Groceries']['source']['amount'], -125.50)
        self.assertEqual(items['DEMO Coffee']['candidates'][0]['roundUp'], 4.50)
        self.assertEqual(items['DEMO Unmatched']['candidates'], [])
        self.assertEqual(len({item['id'] for item in report['items']}), 6)

if __name__ == '__main__':
    unittest.main()
