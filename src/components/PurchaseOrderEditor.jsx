import { useEffect, useMemo, useState } from "react";
import "../styles/po.css";

/* ---------- Helpers ---------- */
const parseNum = (v) => {
  if (v === null || v === undefined) return 0;
  const n = parseFloat(String(v).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const money = (n) => parseNum(n).toFixed(2);

const daysUntil = (dateISO) => {
  try {
    const today = new Date();
    const target = new Date(dateISO + "T23:59:59");
    return Math.ceil((target - new Date(today.toDateString())) / 86400000);
  } catch {
    return NaN;
  }
};

/* ---------- Constants ---------- */
const STATUS_STEPS = [
  "Supplier PO Released",
  "Under Production",
  "Shipped",
  "Stored",
  "Delivered",
  "Invoiced",
  "Completed",
];

const statusColor = (s) =>
  ({
    "Supplier PO Released": "#2563eb",
    "Under Production": "#7c3aed",
    Shipped: "#0ea5e9",
    Stored: "#0891b2",
    Delivered: "#16a34a",
    Invoiced: "#f59e0b",
    Completed: "#111827",
  }[s] || "#6b7280");

const BENEFICIARY_OPTIONS = {
  KNPC_73000: {
    beneficiaryName: "Kuwait National Petroleum Company",
    ltsaNumber: "73000",
    label: "Option 1: 73000 – Kuwait National Petroleum Company",
  },
  KIPIC_71449: {
    beneficiaryName: "Kuwait Integrated Petroleum Industries Company",
    ltsaNumber: "71449",
    label: "Option 2: 71449 – Kuwait Integrated Petroleum Industries Company",
  },
};

/* ---------- Storage & defaults ---------- */
const STORAGE_KEY = "po_app_state_v3"; // free-text version

const defaultHeader = () => ({
  poNumber: "419513",
  ltsaNumber: BENEFICIARY_OPTIONS.KNPC_73000.ltsaNumber,
  beneficiaryName: BENEFICIARY_OPTIONS.KNPC_73000.beneficiaryName,
  ltsaDescription:
    "Long-Term Service Agreement related to supply and support for refinery operations.",
  dateOfIssue: "2025-04-16",
  siteDate: "2025-08-14",
  francoDate: "2025-08-14",
  status: "Supplier PO Released",
});

const defaultItem = () => ({
  maximoNo: "",
  item: "",
  description: "",
  tpi: "",        // <- free text
  material: "",   // <- free text
  grade: "",      // <- free text
  unitCode: "",   // <- free text
  qty: "",        // <- free text; numbers parsed
  unitPrice: "",  // <- free text; numbers parsed
});

const defaultState = () => ({
  option: "KNPC_73000",
  header: defaultHeader(),
  items: [defaultItem()],
  sales: [], // array of strings per row
});

/* ---------- Component ---------- */
export default function PurchaseOrderEditor() {
  const [state, setState] = useState(() => {
    try {
      // Try v3 first
      const v3 = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (v3) return v3;

      // Migrate older versions if present
      const v2 = JSON.parse(localStorage.getItem("po_app_state_v2") || "null");
      const v1 = JSON.parse(localStorage.getItem("po_app_state_v1") || "null");
      const old = v2 || v1;

      if (old) {
        const migrated = {
          ...old,
          items: Array.isArray(old.items)
            ? old.items.map((r) => ({
                maximoNo: r.maximoNo ?? "",
                item: r.item ?? "",
                description: r.description ?? "",
                tpi: r.tpi ?? "",
                material: r.material ?? "",
                grade: r.grade ?? "",
                unitCode: r.unitCode ?? "",
                qty: r.qty ?? r.ltsaQty ?? "",
                unitPrice: r.unitPrice ?? "",
              }))
            : [defaultItem()],
          sales: Array.isArray(old.sales)
            ? old.sales.map((s) => (s === 0 ? "" : String(s ?? "")))
            : [],
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        return migrated;
      }

      return defaultState();
    } catch {
      return defaultState();
    }
  });

  const { option, header, items, sales } = state;

  const [savedFlag, setSavedFlag] = useState(false);
  const setAndSave = (updater) => {
    setState((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setSavedFlag(true);
      setTimeout(() => setSavedFlag(false), 800);
      return next;
    });
  };

  // keep beneficiary & LTSA number in sync with option
  useEffect(() => {
    const b = BENEFICIARY_OPTIONS[option];
    setAndSave((s) => ({
      ...s,
      header: { ...s.header, beneficiaryName: b.beneficiaryName, ltsaNumber: b.ltsaNumber },
    }));
    
  }, [option]);

  // numeric helpers
  const qtyOf = (row) => parseNum(row?.qty);
  const soldOf = (i) => parseNum(sales[i]);

  // totals
  const lineTotals = useMemo(
    () => items.map((r) => qtyOf(r) * parseNum(r.unitPrice)),
    [items]
  );
  const grandTotal = useMemo(
    () => lineTotals.reduce((a, b) => a + b, 0),
    [lineTotals]
  );

  // Franco info
  const francoInfo = useMemo(() => {
    const d = daysUntil(header.francoDate);
    if (isNaN(d)) return { text: "Invalid Franco Date", color: "#b91c1c" };
    if (d < 0) return { text: `Franco date passed by ${Math.abs(d)} day(s).`, color: "#b91c1c" };
    if (d <= 15) return { text: `${d} day(s) left until Franco date.`, color: "#b45309" };
    return { text: `${d} day(s) left until Franco date.`, color: "#065f46" };
  }, [header.francoDate]);

  // keep sales length aligned with items
  useEffect(() => {
    if (sales.length !== items.length) {
      const nextSales = items.map((_, i) => (sales[i] == null ? "" : String(sales[i])));
      setAndSave((s) => ({ ...s, sales: nextSales }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  const remainingByRow = items.map((r, i) => {
    const qty = qtyOf(r);
    const sold = soldOf(i);
    return Math.max(qty - sold, 0);
  });

  /* ---------- actions ---------- */
  const newPO = () =>
    setAndSave({
      option: "KNPC_73000",
      header: defaultHeader(),
      items: [defaultItem()],
      sales: [""],
    });

  const updateHeader = (patch) =>
    setAndSave((s) => ({ ...s, header: { ...s.header, ...patch } }));

  const updateItem = (i, k, v) =>
    setAndSave((s) => ({
      ...s,
      items: s.items.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)),
    }));

  const addRow = () =>
    setAndSave((s) => ({
      ...s,
      items: [...s.items, defaultItem()],
      sales: [...s.sales, ""],
    }));

  const removeRow = (i) =>
    setAndSave((s) => {
      if (s.items.length === 1) return s;
      const items = s.items.filter((_, x) => x !== i);
      const sales = s.sales.filter((_, x) => x !== i);
      return { ...s, items, sales };
    });

  const clearAllItems = () =>
    setAndSave((s) => ({ ...s, items: [defaultItem()], sales: [""] }));

  // Export/Import/Clear storage
  const exportJSON = () => {
    try {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const name = `purchase-order-${state.header.poNumber || "draft"}.json`;
      a.href = url; a.download = name; a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("Export failed: " + e.message);
    }
  };

  const importJSON = async (file) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data || !data.header || !Array.isArray(data.items)) {
        return alert("Invalid PO file.");
      }
      // normalize to string fields
      const migrated = {
        ...data,
        items: data.items.map((r) => ({
          maximoNo: r.maximoNo ?? "",
          item: r.item ?? "",
          description: r.description ?? "",
          tpi: r.tpi ?? "",
          material: r.material ?? "",
          grade: r.grade ?? "",
          unitCode: r.unitCode ?? "",
          qty: r.qty ?? r.ltsaQty ?? "",
          unitPrice: r.unitPrice ?? "",
        })),
        sales: Array.isArray(data.sales)
          ? data.sales.map((s) => (s == null ? "" : String(s)))
          : [],
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      setState(migrated);
      setSavedFlag(true);
      setTimeout(() => setSavedFlag(false), 800);
    } catch (e) {
      alert("Import failed: " + e.message);
    }
  };

  const clearStorage = () => {
    if (confirm("Clear saved PO from this browser?")) {
      localStorage.removeItem(STORAGE_KEY);
      newPO();
    }
  };

  // Tabs
  const [tab, setTab] = useState("purchase"); // purchase | sales | remaining
  const salesEnabled = header.status === "Invoiced" || header.status === "Completed";

  /* ---------- UI ---------- */
  return (
    <div className="po-page">
      {/* top bar with New PO + Saved indicator */}
      <div className="po-topbar">
        <div className="po-tabs">
          <button
            className={`po-tab ${tab === "purchase" ? "active" : ""}`}
            onClick={() => setTab("purchase")}
          >
            Purchase
          </button>
        <button
            className={`po-tab ${tab === "sales" ? "active" : ""}`}
            onClick={() => setTab("sales")}
            disabled={!salesEnabled}
            title={salesEnabled ? "" : "Sales unlocks when Status is Invoiced"}
          >
            Sales
          </button>
          <button
            className={`po-tab ${tab === "remaining" ? "active" : ""}`}
            onClick={() => setTab("remaining")}
          >
            Remaining
          </button>
        </div>
        <div className="po-top-actions">
          <button className="po-btn" onClick={newPO}>＋ New PO</button>

          <button className="po-btn" onClick={exportJSON}>Export</button>
          <label className="po-btn" style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
            Import
            <input
              type="file"
              accept=".json,application/json"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importJSON(f);
                e.target.value = "";
              }}
            />
          </label>
          <button className="po-btn danger" onClick={clearStorage}>Clear Saved</button>

          <button className="po-btn outline" onClick={() => window.print()}>
            Print / Save PDF
          </button>
          <span className={`po-save-ind ${savedFlag ? "show" : ""}`}>Saved ✓</span>
        </div>
      </div>

      {tab === "purchase" && (
        <>
          {/* header card */}
          <section className="po-card">
            <header className="po-card__header">
              <h2 className="po-title">Purchase Order (Edit)</h2>

              {/* Option picker kept for convenience. You can type over the fields below anyway */}
              <select
                className="po-select"
                value={option}
                onChange={(e) => setAndSave((s) => ({ ...s, option: e.target.value }))}
                title="Select Beneficiary/LTSA"
              >
                {Object.entries(BENEFICIARY_OPTIONS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            </header>

            <p className="po-note">
              Delivery must be on or before the Required Franco Date.
            </p>

            <div className="po-grid">
              <label className="po-label">Beneficiary</label>
              <input
                className="po-input"
                value={header.beneficiaryName}
                onChange={(e) => updateHeader({ beneficiaryName: e.target.value })}
              />

              <label className="po-label">PO Number</label>
              <input
                className="po-input"
                value={header.poNumber}
                onChange={(e) => updateHeader({ poNumber: e.target.value })}
              />

              <label className="po-label">LTSA Number</label>
              <input
                className="po-input"
                value={header.ltsaNumber}
                onChange={(e) => updateHeader({ ltsaNumber: e.target.value })}
              />

              <label className="po-label">Status</label>
              <div className="po-status-wrap">
                <input
                  className="po-input"
                  value={header.status}
                  onChange={(e) => updateHeader({ status: e.target.value })}
                  list="status-list"
                  placeholder="Type a status"
                />
                <datalist id="status-list">
                  {STATUS_STEPS.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
                <span
                  className="po-badge"
                  style={{ background: statusColor(header.status) }}
                >
                  {header.status}
                </span>
              </div>

              <label className="po-label">LTSA Description</label>
              <textarea
                className="po-input po-textarea"
                value={header.ltsaDescription}
                onChange={(e) => updateHeader({ ltsaDescription: e.target.value })}
              />

              <label className="po-label">Date of Issue</label>
              <input
                className="po-input"
                value={header.dateOfIssue}
                onChange={(e) => updateHeader({ dateOfIssue: e.target.value })}
                placeholder="YYYY-MM-DD"
              />

              <label className="po-label">Required on Site Date</label>
              <input
                className="po-input"
                value={header.siteDate}
                onChange={(e) => updateHeader({ siteDate: e.target.value })}
                placeholder="YYYY-MM-DD"
              />

              <label className="po-label">Required Franco Date</label>
              <input
                className="po-input"
                value={header.francoDate}
                onChange={(e) => updateHeader({ francoDate: e.target.value })}
                placeholder="YYYY-MM-DD"
              />
            </div>

            <div className="po-alert" style={{ borderColor: francoInfo.color }}>
              <span style={{ color: francoInfo.color }}>{francoInfo.text}</span>
            </div>
          </section>

          {/* items card — all inputs are plain text, with TPI/Material/Grade/Unit Code */}
          <section className="po-card">
            <div className="po-card__header">
              <h3 className="po-title">Items</h3>
              <div className="po-actions">
                <button className="po-btn" onClick={addRow}>+ Add Item</button>
                <button className="po-btn danger" onClick={clearAllItems}>Delete All</button>
              </div>
            </div>

            <div className="po-table-wrap">
              <table className="po-table">
                <thead>
                  <tr>
                    <th>MAXIMO NO.</th>
                    <th>Item</th>
                    <th>ITEM DESCRIPTION</th>
                    <th>TPI</th>
                    <th>Material</th>
                    <th>Grade</th>
                    <th>UNIT CODE</th>
                    <th>QTY</th>
                    <th>UNIT PRICE</th>
                    <th>LINE TOTAL</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((r, i) => (
                    <tr key={i}>
                      <td data-label="MAXIMO NO.">
                        <input
                          className="po-input"
                          value={r.maximoNo}
                          onChange={(e) => updateItem(i, "maximoNo", e.target.value)}
                          placeholder="e.g., 1002456"
                        />
                      </td>

                      <td data-label="Item">
                        <input
                          className="po-input"
                          value={r.item}
                          onChange={(e) => updateItem(i, "item", e.target.value)}
                          placeholder="Item code/name"
                        />
                      </td>

                      <td data-label="ITEM DESCRIPTION" className="col-wide">
                        <input
                          className="po-input"
                          value={r.description}
                          onChange={(e) => updateItem(i, "description", e.target.value)}
                          placeholder="Detailed description"
                        />
                      </td>

                      <td data-label="TPI">
                        <input
                          className="po-input"
                          value={r.tpi}
                          onChange={(e) => updateItem(i, "tpi", e.target.value)}
                          placeholder="e.g., BV / LR / ABS"
                        />
                      </td>

                      <td data-label="Material">
                        <input
                          className="po-input"
                          value={r.material}
                          onChange={(e) => updateItem(i, "material", e.target.value)}
                          placeholder="e.g., CS / SS316"
                        />
                      </td>

                      <td data-label="Grade">
                        <input
                          className="po-input"
                          value={r.grade}
                          onChange={(e) => updateItem(i, "grade", e.target.value)}
                          placeholder="e.g., A105 / A182 F316"
                        />
                      </td>

                      <td data-label="UNIT CODE">
                        <input
                          className="po-input"
                          value={r.unitCode}
                          onChange={(e) => updateItem(i, "unitCode", e.target.value)}
                          placeholder="e.g., EA / SET / MTR"
                        />
                      </td>

                      <td data-label="QTY" width="120">
                        <input
                          className="po-input"
                          value={r.qty}
                          onChange={(e) => updateItem(i, "qty", e.target.value)}
                          placeholder="e.g., 10 or '10 pcs'"
                        />
                      </td>

                      <td data-label="UNIT PRICE" width="140">
                        <input
                          className="po-input"
                          value={r.unitPrice}
                          onChange={(e) => updateItem(i, "unitPrice", e.target.value)}
                          placeholder="e.g., 12.50 or 'KWD 12.50'"
                        />
                      </td>

                      <td data-label="LINE TOTAL" className="nowrap">
                        {money(lineTotals[i])}
                      </td>

                      <td data-label="Action">
                        <button className="po-btn danger ghost" onClick={() => removeRow(i)}>
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>

                <tfoot>
                  <tr>
                    <td className="right bold" colSpan="9">GRAND TOTAL</td>
                    <td className="bold">{money(grandTotal)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        </>
      )}

      {/* SALES: free text; math uses parsed numbers */}
      {tab === "sales" && (
        <section className="po-card">
          <div className="po-card__header">
            <h3 className="po-title">Sales (free text; numbers parsed automatically)</h3>
          </div>
          <div className="po-table-wrap">
            <table className="po-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Description</th>
                  <th>QTY</th>
                  <th>Sold QTY</th>
                  <th>Remaining</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r, i) => (
                  <tr key={i}>
                    <td data-label="Item" width="220">
                      <input
                        className="po-input"
                        value={r.item}
                        onChange={(e) => updateItem(i, "item", e.target.value)}
                        placeholder="Item code/name"
                      />
                    </td>
                    <td data-label="Description" className="col-wide">
                      <textarea
                        className="po-input po-textarea"
                        value={r.description}
                        onChange={(e) => updateItem(i, "description", e.target.value)}
                        placeholder="Detailed description"
                      />
                    </td>
                    <td data-label="QTY" className="nowrap">
                      {qtyOf(r)}
                    </td>
                    <td data-label="Sold QTY" width="160">
                      <input
                        className="po-input"
                        value={sales[i] ?? ""}
                        onChange={(e) => {
                          const typed = e.target.value; // keep as string
                          const qtyN = qtyOf(items[i]);
                          const soldN = Math.min(qtyN, Math.max(parseNum(typed), 0));
                          const nextVal =
                            parseNum(typed) !== soldN ? String(soldN) : typed;
                          setAndSave((s) => {
                            const next = [...s.sales];
                            next[i] = nextVal;
                            return { ...s, sales: next };
                          });
                        }}
                        placeholder="e.g., 2 or '2 pcs'"
                      />
                    </td>
                    <td data-label="Remaining" className="nowrap">
                      {remainingByRow[i]}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td className="right bold" colSpan="3">TOTALS</td>
                  <td className="bold">
                    {sales.reduce((a, b) => a + parseNum(b), 0)}
                  </td>
                  <td className="bold">
                    {remainingByRow.reduce((a, b) => a + b, 0)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}

      {/* REMAINING: read-only */}
      {tab === "remaining" && (
        <section className="po-card">
          <div className="po-card__header">
            <h3 className="po-title">Remaining Items</h3>
          </div>
          <div className="po-table-wrap">
            <table className="po-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Description</th>
                  <th>QTY</th>
                  <th>Sold</th>
                  <th>Remaining</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r, i) => (
                  <tr key={i}>
                    <td data-label="Item">{r.item}</td>
                    <td data-label="Description" className="col-wide">{r.description}</td>
                    <td data-label="QTY" className="nowrap">{qtyOf(r)}</td>
                    <td data-label="Sold" className="nowrap">{soldOf(i)}</td>
                    <td data-label="Remaining" className="nowrap">{remainingByRow[i]}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td className="right bold" colSpan="3">TOTALS</td>
                  <td className="bold">
                    {sales.reduce((a, b) => a + parseNum(b), 0)}
                  </td>
                  <td className="bold">
                    {remainingByRow.reduce((a, b) => a + b, 0)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
