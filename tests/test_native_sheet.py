from backend.app.sheet import source


def test_native_values_and_dates(monkeypatch):
    class Response:
        def raise_for_status(self): pass
        def json(self):
            return {"sheets": [{"properties": {"title": "Harvest Tracker"}, "data": [{"startRow": 1, "rowData": [{"values": [{"effectiveValue": {"numberValue": 67}}, {"effectiveValue": {"numberValue": 46000}, "effectiveFormat": {"numberFormat": {"type": "DATE"}}}]}]}]}]}
    def get(url, **kwargs):
        assert url.startswith("https://sheets.googleapis.com/v4/spreadsheets/")
        return Response()
    monkeypatch.setattr(source.httpx, "get", get)
    wb = source.load_google_sheet(source.DEFAULT_FILE_ID, "test")
    assert wb["Harvest Tracker"]["A2"].value == 67
    assert wb["Harvest Tracker"]["B2"].value.year == 2025


def test_native_id_precedes_frozen_backup(monkeypatch):
    monkeypatch.setenv("MASTER_SHEET_GOOGLE_ID", "native")
    monkeypatch.setenv("MASTER_SHEET_FILE_ID", "backup")
    assert source.resolve_read_file_id() == "native"
