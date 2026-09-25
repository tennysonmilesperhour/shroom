// Turn raw Postgres / PostgREST error text into something an operator can act
// on. Server actions pass `error.message` straight through in many places, so
// this runs where messages are shown (toasts, inline form status) and leaves
// already-friendly copy untouched.

const COLUMN_LABELS: Record<string, string> = {
  order_number: "order number",
  lot_code: "lot code",
  sku: "SKU",
  po_number: "PO number",
  name: "name",
  code: "code",
  email: "email",
  contact_email: "email",
  slug: "slug",
};

function humanColumn(col: string): string {
  return COLUMN_LABELS[col] ?? col.replace(/_id$/, "").replace(/_/g, " ");
}

export function friendlyDbError(message: string | null | undefined): string | undefined {
  if (!message) return message ?? undefined;
  const m = message.trim();

  // 23505 unique_violation: `duplicate key value violates unique constraint
  // "orders_order_number_key"` + optional `Key (order_number)=(X) already exists.`
  if (/duplicate key value violates unique constraint/i.test(m)) {
    const key = /Key \(([^)]+)\)=\(([^)]*)\)/i.exec(m);
    if (key) {
      const cols = key[1].split(",").map((c) => humanColumn(c.trim()));
      return `A record with ${cols.join(" + ")} “${key[2]}” already exists. Use a different value or edit the existing one.`;
    }
    const constraint = /constraint "([^"]+)"/i.exec(m)?.[1] ?? "";
    const col = constraint
      .replace(/^[a-z_]+?s_/, "")
      .replace(/_(key|idx|uniq|unique)$/, "");
    return col
      ? `That ${humanColumn(col)} is already in use. Use a different value or edit the existing record.`
      : "That value is already in use. Use a different value or edit the existing record.";
  }

  // 23503 foreign_key_violation.
  if (/violates foreign key constraint/i.test(m)) {
    if (/update or delete on table/i.test(m)) {
      return "Other records still reference this one, so it can’t be removed. Unlink or delete those first.";
    }
    return "A linked record it points to no longer exists. Reload the page and pick it again.";
  }

  // 23502 not_null_violation: `null value in column "x" of relation "y" ...`
  const notNull = /null value in column "([^"]+)"/i.exec(m);
  if (notNull) return `${cap(humanColumn(notNull[1]))} is required.`;

  // 23514 check_violation.
  if (/violates check constraint/i.test(m)) {
    return "One of the values is outside the allowed range. Check the numbers and options and try again.";
  }

  // 22P02 invalid_text_representation / 22007 invalid date.
  if (/invalid input syntax for type (numeric|integer|bigint)/i.test(m)) {
    return "One of the number fields isn’t a valid number.";
  }
  if (/invalid input syntax for type (date|timestamp)|date\/time field value out of range/i.test(m)) {
    return "One of the dates isn’t valid.";
  }

  if (/fetch failed|ECONNREFUSED|network/i.test(m) && m.length < 120) {
    return "Couldn’t reach the database. Check your connection and try again.";
  }
  return m;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
