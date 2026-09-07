"""Acknowledge only queued fields represented by the successful workbook export."""
from datetime import datetime, timezone
import os
import httpx

EXPORTED_FIELDS = {
    'strain': {'name', 'active', 'vendor', 'potency', 'ease_rating', 'grow_again', 'notes'},
    'batch': {'lot_code', 'strain_id', 'inoculated_on', 'colonized_on', 'fruiting_on', 'contamination_flag', 'notes'},
    'harvest': {'batch_id', 'harvested_on', 'flush_number', 'weight_kg', 'dry_weight_kg', 'notes'},
    'customer': {'name', 'channel', 'notes'},
}


def is_exported(row: dict) -> bool:
    fields = EXPORTED_FIELDS.get(row.get('entity'), set())
    payload = row.get('payload')
    return row.get('op') in ('insert', 'update') and isinstance(payload, dict) and bool(payload) and set(payload) <= fields


def reconcile(client: httpx.Client, url: str, cutoff: str) -> int:
    datetime.fromisoformat(cutoff.replace('Z', '+00:00'))
    endpoint = f"{url.rstrip('/')}/rest/v1/sheet_sync_queue"
    after = 0
    count = 0
    while True:
        response = client.get(endpoint, params={'select': 'id,entity,op,payload', 'synced_at': 'is.null',
            'created_at': f'lte.{cutoff}', 'id': f'gt.{after}', 'order': 'id', 'limit': '500'})
        response.raise_for_status()
        rows = response.json()
        if not rows:
            return count
        after = rows[-1]['id']
        ids = [str(row['id']) for row in rows if is_exported(row)]
        if ids:
            response = client.patch(endpoint, params={'id': f"in.({','.join(ids)})", 'synced_at': 'is.null'},
                json={'synced_at': datetime.now(timezone.utc).isoformat()})
            response.raise_for_status()
            count += len(ids)


if __name__ == '__main__':
    url = os.environ.get('SUPABASE_URL')
    key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
    if not url or not key:
        raise SystemExit('Supabase queue credentials are missing; pending changes were kept.')
    with httpx.Client(headers={'apikey': key, 'Authorization': f'Bearer {key}'}, timeout=30) as client:
        count = reconcile(client, url, os.environ['SHEET_EXPORT_CUTOFF'])
    print(f'Reconciled {count} supported changes. Unmapped fields and deletions remain pending.')
