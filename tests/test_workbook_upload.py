from datetime import date
from pathlib import Path
import importlib.util
import io
import sys
import pytest
from openpyxl import Workbook

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(Path(__file__).parent / 'fixtures'))
import master_reference_sample
from backend.app.sheet.parse import ParsedWorkbook, Harvest
from backend.app.sheet.sinks import build_import_plan
spec = importlib.util.spec_from_file_location('workbook_api', ROOT / 'web/api/workbook.py')
api = importlib.util.module_from_spec(spec)
spec.loader.exec_module(api)


def test_upload_preview_uses_canonical_parser(tmp_path):
    raw = Path(master_reference_sample.build(tmp_path / 'sample.xlsx')).read_bytes()
    plan, preview = api.preview_workbook(raw)
    assert preview['total'] > 10
    assert plan['batches'] and plan['harvests']
    assert all(not row['lot_code'].endswith(('-F1', '-F2')) for row in plan['batches'])
    assert all('_batch_lot_code' in row for row in plan['harvests'])
    assert any(row['notes'] for row in plan['harvests'])
    assert all('batch_id' not in row for row in plan['harvests'])


def test_harvest_only_import_preserves_relations_without_overwriting_batch():
    parsed = ParsedWorkbook(harvests=[Harvest('T1-F1', 'T1', 'Oyster', 1, date(2026, 9, 7), 12, 1, 'First flush')])
    plan = build_import_plan(parsed)
    assert plan['strains'] == [{'name': 'Oyster', '_ensure_only': True}]
    assert plan['batches'][0]['_ensure_only'] is True
    assert plan['harvests'][0]['_batch_lot_code'] == 'T1'
    assert not parsed.strains and not parsed.batches


@pytest.mark.parametrize('data', [b'', b'not an xlsx', b'x' * (api.MAX_BYTES + 1)])
def test_reject_invalid_file(data):
    with pytest.raises(ValueError): api.preview_workbook(data)


def test_reject_unrecognized_sheet():
    wb = Workbook(); wb.active.append(['Unrelated', 'Data']); wb.active.append(['test', 4])
    raw = io.BytesIO(); wb.save(raw)
    with pytest.raises(ValueError, match='No supported records'): api.preview_workbook(raw.getvalue())


def test_preview_receipt_binds_file_and_prevents_tampering():
    receipt = api.receipt_for('digest', 'secret')
    assert api.verify_receipt(receipt, 'digest', 'secret')
    for digest, secret in [('different-file', 'secret'), ('digest', 'different-key')]:
        with pytest.raises(ValueError): api.verify_receipt(receipt, digest, secret)
    with pytest.raises(ValueError): api.verify_receipt(receipt + '0', 'digest', 'secret')


def test_expired_preview(monkeypatch):
    monkeypatch.setattr(api.time, 'time', lambda: 100)
    receipt = api.receipt_for('digest', 'secret')
    monkeypatch.setattr(api.time, 'time', lambda: 2000)
    with pytest.raises(ValueError, match='expired'): api.verify_receipt(receipt, 'digest', 'secret')
