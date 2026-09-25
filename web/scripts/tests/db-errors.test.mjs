import { test } from 'node:test';
import assert from 'node:assert/strict';
import { friendlyDbError } from '../../lib/db-errors.ts';

test('unique violations name the field and value', () => {
  const msg = 'duplicate key value violates unique constraint "orders_order_number_key"\nKey (order_number)=(ORD-1) already exists.';
  assert.match(friendlyDbError(msg), /order number “ORD-1” already exists/);
  assert.match(friendlyDbError('duplicate key value violates unique constraint "batches_lot_code_key"'), /lot code is already in use/);
});

test('fk, not-null, and syntax errors become plain language', () => {
  assert.match(friendlyDbError('update or delete on table "strains" violates foreign key constraint "batches_strain_id_fkey" on table "batches"'), /can’t be removed/);
  assert.match(friendlyDbError('insert or update on table "order_lines" violates foreign key constraint "order_lines_product_id_fkey"'), /no longer exists/);
  assert.equal(friendlyDbError('null value in column "order_date" of relation "orders" violates not-null constraint'), 'Order date is required.');
  assert.match(friendlyDbError('invalid input syntax for type numeric: "abc"'), /valid number/);
});

test('already-friendly copy and empty values pass through', () => {
  assert.equal(friendlyDbError('Pick a customer.'), 'Pick a customer.');
  assert.equal(friendlyDbError(undefined), undefined);
});
