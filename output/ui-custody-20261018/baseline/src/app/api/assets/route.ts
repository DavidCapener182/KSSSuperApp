import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { forbidden, privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";

const uuid = (value: unknown): value is string => typeof value === "string" && isUuid(value);
const text = (value: unknown, max = 500) => typeof value === "string" && value.trim().length > 0 && value.trim().length <= max;
const integer = (value: unknown) => typeof value === "number" && Number.isInteger(value) && value >= 0;
const signedInteger = (value: unknown) => typeof value === "number" && Number.isInteger(value) && value !== 0;
const condition = (value: unknown) => ["GOOD", "SERVICEABLE", "DAMAGED", "UNSERVICEABLE", "UNKNOWN"].includes(String(value));
const holder = (value: unknown) => ["PERSON", "STORE", "SITE", "SITE_SERVICE", "EVENT"].includes(String(value));

export async function GET(request: Request) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  const url = new URL(request.url);
  const assetId = url.searchParams.get("assetId");
  const stockId = url.searchParams.get("stockId");
  const admin = url.searchParams.get("admin") === "1";
  const holders = url.searchParams.get("holders") === "1";
  const self = url.searchParams.get("self") === "1";
  const register = url.searchParams.get("register") === "1";
  const support = url.searchParams.get("support") === "1";
  const stockChoices = url.searchParams.get("stockChoices");
  const receipt = url.searchParams.get("receipt");
  const stockReceipt = url.searchParams.get("stockReceipt");
  const page = Number(url.searchParams.get("page") ?? "1");
  const size = Number(url.searchParams.get("size") ?? "30");
  if (register && (!Number.isInteger(page) || page < 1 || page > 100000 || !Number.isInteger(size) || size < 1 || size > 100))
    return privateJson({ error: "Invalid asset page" }, 400);
  if (url.searchParams.has("context") && !uuid(url.searchParams.get("context")))
    return privateJson({ error: "Invalid asset context" }, 400);
  for (const value of [stockChoices, receipt, stockReceipt])
    if (value && !uuid(value)) return privateJson({ error: "Invalid asset reference" }, 400);
  if ((register || support || stockChoices) && !principal.roles.some((role) =>
    ["OPERATIONS", "OFFICE_ADMIN", "SUPER_ADMIN"].includes(role))) return forbidden();
  if (assetId && !uuid(assetId)) return privateJson({ error: "Invalid asset" }, 400);
  if (stockId && !uuid(stockId)) return privateJson({ error: "Invalid stock" }, 400);
  if (admin && !principal.roles.includes("SUPER_ADMIN")) return forbidden();
  if (holders && !principal.roles.some((role) => role === "OPERATIONS" || role === "OFFICE_ADMIN")) return forbidden();
  if (self && !principal.roles.includes("SECURITY_STAFF")) return forbidden();
  const call = register ? client.rpc("asset_register_page", {
    p_search: url.searchParams.get("search"), p_class: url.searchParams.get("class"),
    p_holder_kind: url.searchParams.get("holder"), p_context: url.searchParams.get("context"),
    p_condition: url.searchParams.get("condition"), p_repair: url.searchParams.get("repair"),
    p_exception: url.searchParams.get("exception"), p_return: url.searchParams.get("return"),
    p_view: url.searchParams.get("view"), p_page: page, p_size: size,
  }) : support ? client.rpc("asset_register_support")
    : stockChoices ? client.rpc("asset_stock_issue_choices", { p_stock: stockChoices })
    : receipt ? client.rpc("asset_event_receipt", { p_event: receipt })
    : stockReceipt ? client.rpc("asset_stock_event_receipt", { p_event: stockReceipt })
    : admin ? client.rpc("asset_admin_choices")
    : assetId ? client.rpc("asset_history", { p_asset: assetId })
      : stockId ? client.rpc("asset_stock_history", { p_stock: stockId })
        : holders ? client.rpc("asset_holder_choices")
          : self ? client.rpc("asset_my_workspace") : client.rpc("asset_workspace");
  const { data, error } = await call;
  return error ? privateJson({ error: "Asset view unavailable" }, 403) : privateJson({ data });
}

export async function POST(request: Request) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || !uuid(body.requestKey)) return privateJson({ error: "Invalid asset request" }, 400);

  const office = principal.roles.includes("OFFICE_ADMIN");
  const ops = principal.roles.includes("OPERATIONS");
  const superAdmin = principal.roles.includes("SUPER_ADMIN");
  let operation: ReturnType<typeof client.rpc> | null = null;
  if (body.action === "REGISTER" && office && text(body.reference, 32) && text(body.description, 160) &&
    ["RADIO", "KEY_CARD", "PHONE", "LAPTOP_TABLET", "BODYCAM"].includes(body.class) &&
    uuid(body.storeId) && condition(body.condition)) {
    operation = client.rpc("asset_register", {
      p_reference: body.reference, p_class: body.class, p_description: body.description,
      p_serial: typeof body.serial === "string" ? body.serial : null,
      p_store: body.storeId, p_condition: body.condition, p_request_key: body.requestKey,
    });
  } else if (body.action === "STOCK_CREATE" && office && text(body.sku, 32) &&
    text(body.garment, 100) && text(body.size, 20) && uuid(body.storeId) &&
    integer(body.quantity) && body.quantity > 0 && text(body.reason)) {
    operation = client.rpc("asset_stock_create", {
      p_sku: body.sku, p_garment: body.garment, p_size: body.size, p_store: body.storeId,
      p_opening: body.quantity, p_reason: body.reason, p_request_key: body.requestKey,
    });
  } else if (body.action === "GRANT" && superAdmin && uuid(body.personId) && uuid(body.scopeId) &&
    ["STORE", "SITE", "SITE_SERVICE", "EVENT"].includes(body.scopeKind) && text(body.reason, 300) &&
    typeof body.until === "string" && Number.isFinite(Date.parse(body.until))) {
    operation = client.rpc("asset_grant", {
      p_person: body.personId, p_scope_kind: body.scopeKind, p_scope_id: body.scopeId,
      p_until: new Date(body.until).toISOString(), p_reason: body.reason,
    });
  } else if (body.action === "REVOKE_GRANT" && superAdmin && uuid(body.grantId) && text(body.reason, 300)) {
    operation = client.rpc("asset_revoke_grant", { p_grant: body.grantId, p_reason: body.reason });
  } else if (body.action === "STOCK_ACK" && uuid(body.issueId) && typeof body.dispute === "boolean" &&
    (!body.dispute || text(body.reason))) {
    operation = client.rpc("asset_stock_ack", {
      p_issue: body.issueId, p_dispute: body.dispute, p_reason: body.reason ?? null, p_request_key: body.requestKey,
    });
  } else if (["STOCK_ISSUE", "STOCK_RETURN", "STOCK_ADJUST"].includes(body.action) &&
    (body.action === "STOCK_ADJUST" ? office : ops) && uuid(body.stockId) &&
    (body.action === "STOCK_ADJUST" ? signedInteger(body.quantity) : integer(body.quantity) && body.quantity > 0) &&
    integer(body.expectedRevision) &&
    (body.action === "STOCK_ADJUST" || uuid(body.personId))) {
    operation = client.rpc("asset_stock_move", {
      p_stock: body.stockId, p_action: body.action.replace("STOCK_", ""),
      p_quantity: body.quantity, p_person: body.personId ?? null,
      p_issue: body.issueId ?? null, p_expected_revision: body.expectedRevision,
      p_request_key: body.requestKey, p_reason: body.reason ?? null,
    });
  } else if (uuid(body.assetId) && integer(body.expectedRevision) &&
    ["ISSUE", "TRANSFER", "RETURN", "ACK_ISSUE", "DISPUTE_ISSUE", "ACK_RETURN", "INSPECT",
      "REPORT_DAMAGE", "REPORT_LOSS", "RECOVER", "REPAIR_START", "REPAIR_COMPLETE", "RETIRE"].includes(body.action) &&
    ((["ACK_ISSUE", "DISPUTE_ISSUE", "REPORT_DAMAGE", "REPORT_LOSS"].includes(body.action)) || ops ||
      (office && body.action === "RETIRE")) &&
    (!["ISSUE", "TRANSFER", "RETURN"].includes(body.action) || (holder(body.holderKind) && uuid(body.holderId))) &&
    (!["INSPECT"].includes(body.action) || condition(body.condition))) {
    operation = client.rpc("asset_act", {
      p_asset: body.assetId, p_action: body.action, p_expected_revision: body.expectedRevision,
      p_request_key: body.requestKey, p_holder_kind: body.holderKind ?? null,
      p_holder_id: body.holderId ?? null, p_condition: body.condition ?? null,
      p_expected_return_at: body.expectedReturnAt ?? null, p_reason: body.reason ?? null,
    });
  }
  if (!operation) return privateJson({ error: "Invalid or unauthorised asset action" }, 403);
  const { data, error } = await operation;
  if (error) return privateJson({ error: "Asset action was not saved. Refresh and review the current state." }, 409);
  if (["GRANT", "REVOKE_GRANT"].includes(body.action)) return privateJson({ result: data });
  if (!data || typeof data !== "object" || !uuid(data.eventId))
    return privateJson({ error: "Asset action response is incomplete. Refresh before retrying." }, 409);
  const stockAction = typeof body.action === "string" && body.action.startsWith("STOCK_");
  const { data: receiptData, error: receiptError } = await client.rpc(
    stockAction ? "asset_stock_event_receipt" : "asset_event_receipt", { p_event: data.eventId });
  const wrongAssetEvent = !stockAction && receiptData && (receiptData.action !== body.action ||
    receiptData.assetId !== data.id ||
    (["ISSUE", "TRANSFER", "RETURN"].includes(body.action) &&
      (receiptData.holderKind !== body.holderKind || receiptData.holderId !== body.holderId)));
  if (receiptError || !receiptData || receiptData.eventId !== data.eventId || wrongAssetEvent ||
    (body.action !== "STOCK_ACK" && receiptData.revision !== data.revision))
    return privateJson({ result: data, error: "Action submitted; exact event readback is unavailable. Refresh before retrying." }, 202);
  return privateJson({ result: data, receipt: receiptData });
}
