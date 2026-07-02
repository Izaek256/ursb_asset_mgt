import React from "react";
import { apiFetch } from "../AuthContext";

const ASSET_TYPES = ["ICT Equipment", "Furniture", "Vehicle", "Software", "Other"];
const CONDITIONS = ["New", "Good", "Refurbished", "Damaged"];
const STATUSES = ["Active", "In Store"];
const SOURCE_TYPES = ["Procurement", "Donation", "Other"];

interface FormState {
  name: string;
  asset_type: string;
  serial_number: string;
  condition: string;
  cost: string;
  department: string;
  acquisition_date: string;
  status: string;
  category: string;
  supplier: string;
  source_type: string;
}

const INITIAL: FormState = {
  name: "",
  asset_type: "ICT Equipment",
  serial_number: "",
  condition: "New",
  cost: "",
  department: "",
  acquisition_date: "",
  status: "Active",
  category: "",
  supplier: "",
  source_type: "Procurement",
};

export default function AssetRegistration() {
  const [form, setForm] = React.useState<FormState>(INITIAL);
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const set = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Basic client-side validation
    if (!form.name.trim()) return setError("Asset name is required.");
    if (!form.serial_number.trim()) return setError("Serial number is required.");
    if (!form.category.trim()) return setError("Category is required.");
    if (!form.supplier.trim()) return setError("Supplier is required.");
    if (!form.cost || parseFloat(form.cost) <= 0) return setError("Cost must be a positive number.");
    if (!form.acquisition_date) return setError("Acquisition date is required.");

    setSubmitting(true);
    try {
      await apiFetch("/assets", {
        method: "POST",
        body: JSON.stringify({
          name: form.name.trim(),
          asset_type: form.asset_type,
          serial_number: form.serial_number.trim(),
          condition: form.condition,
          cost: parseFloat(form.cost),
          department: form.department.trim() || null,
          acquisition_date: form.acquisition_date,
          status: form.status,
          category: form.category.trim(),
          supplier: form.supplier.trim(),
          source_type: form.source_type,
        }),
      });

      // Success — navigate back to assets list
      window.history.pushState({}, "", "/assets");
      window.dispatchEvent(new PopStateEvent("popstate"));
    } catch (err: any) {
      setError(err.message || "Failed to register asset.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Register New Asset</h3>
        </div>
        <div className="card-body">
          {error && <div className="alert-error">{error}</div>}

          <form onSubmit={handleSubmit}>
            {/* Row 1: Name + Serial Number */}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="reg-name">Asset Name *</label>
                <input
                  id="reg-name"
                  type="text"
                  className="form-control"
                  placeholder="e.g. Dell Latitude 5520"
                  value={form.name}
                  onChange={set("name")}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="reg-serial">Serial Number *</label>
                <input
                  id="reg-serial"
                  type="text"
                  className="form-control"
                  placeholder="e.g. SN-2024-00123"
                  value={form.serial_number}
                  onChange={set("serial_number")}
                  required
                />
              </div>
            </div>

            {/* Row 2: Type + Category */}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="reg-type">Asset Type *</label>
                <select
                  id="reg-type"
                  className="form-control"
                  value={form.asset_type}
                  onChange={set("asset_type")}
                >
                  {ASSET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="reg-category">Category *</label>
                <input
                  id="reg-category"
                  type="text"
                  className="form-control"
                  placeholder="e.g. Laptops"
                  value={form.category}
                  onChange={set("category")}
                  required
                />
              </div>
            </div>

            {/* Row 3: Condition + Status */}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="reg-condition">Condition *</label>
                <select
                  id="reg-condition"
                  className="form-control"
                  value={form.condition}
                  onChange={set("condition")}
                >
                  {CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="reg-status">Status *</label>
                <select
                  id="reg-status"
                  className="form-control"
                  value={form.status}
                  onChange={set("status")}
                >
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            {/* Row 4: Cost + Acquisition Date */}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="reg-cost">Cost (UGX) *</label>
                <input
                  id="reg-cost"
                  type="number"
                  className="form-control"
                  placeholder="e.g. 2500000"
                  value={form.cost}
                  onChange={set("cost")}
                  min="0"
                  step="0.01"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="reg-date">Acquisition Date *</label>
                <input
                  id="reg-date"
                  type="date"
                  className="form-control"
                  value={form.acquisition_date}
                  onChange={set("acquisition_date")}
                  required
                />
              </div>
            </div>

            {/* Row 5: Supplier + Source Type */}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="reg-supplier">Supplier *</label>
                <input
                  id="reg-supplier"
                  type="text"
                  className="form-control"
                  placeholder="e.g. ABC Supplies Ltd"
                  value={form.supplier}
                  onChange={set("supplier")}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="reg-source">Source Type *</label>
                <select
                  id="reg-source"
                  className="form-control"
                  value={form.source_type}
                  onChange={set("source_type")}
                >
                  {SOURCE_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            {/* Row 6: Department (optional, single column) */}
            <div className="form-group">
              <label className="form-label" htmlFor="reg-dept">Department (optional)</label>
              <input
                id="reg-dept"
                type="text"
                className="form-control"
                placeholder="e.g. ICT Department"
                value={form.department}
                onChange={set("department")}
              />
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting}
              >
                {submitting ? "Registering…" : "Register Asset"}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  window.history.pushState({}, "", "/assets");
                  window.dispatchEvent(new PopStateEvent("popstate"));
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
