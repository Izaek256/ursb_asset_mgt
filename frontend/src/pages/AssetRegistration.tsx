import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useNavigate } from "react-router-dom";
import { createAsset, ApiError } from "../services/assetService";
import { ASSET_STATUSES } from "../types/asset";
import { useAuth } from "../context/AuthContext";

const assetFormSchema = z.object({
  asset_name: z.string().min(1, "Asset name is required").max(255),
  category: z.string().min(1, "Category is required").max(100),
  description: z.string().optional().or(z.literal("")),
  status: z.enum(
    ["Active", "Inactive", "In Storage", "Under Maintenance", "Disposed"] as const,
    { errorMap: () => ({ message: "Please select a valid status" }) },
  ),
  purchase_date: z
    .string()
    .min(1, "Purchase date is required")
    .refine((val) => !isNaN(Date.parse(val)), "Invalid date")
    .refine((val) => new Date(val) <= new Date(), "Purchase date cannot be in the future"),
  purchase_cost: z.coerce
    .number()
    .positive("Purchase cost must be greater than 0"),
  location: z.string().min(1, "Location is required").max(255),
  serial_number: z.string().optional().or(z.literal("")),
});

type AssetFormData = z.infer<typeof assetFormSchema>;

export default function AssetRegistration() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [success, setSuccess] = useState<{ assetId: string } | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<AssetFormData>({
    resolver: zodResolver(assetFormSchema),
    defaultValues: {
      asset_name: "",
      category: "",
      description: "",
      status: "Active",
      purchase_date: "",
      purchase_cost: undefined,
      location: "",
      serial_number: "",
    },
  });

  const onSubmit = async (data: AssetFormData) => {
    setSubmitting(true);
    setSubmitError("");
    try {
      const response = await createAsset({
        asset_name: data.asset_name,
        category: data.category,
        description: data.description || undefined,
        status: data.status,
        purchase_date: data.purchase_date,
        purchase_cost: data.purchase_cost,
        location: data.location,
        serial_number: data.serial_number || undefined,
      });
      setSuccess({ assetId: response.asset_id });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 422) {
          // Map field-level errors back to form fields
          err.fieldErrors.forEach((msg, field) => {
            setError(field as keyof AssetFormData, { message: msg });
          });
          setSubmitError("Please correct the highlighted fields.");
        } else if (err.status === 403) {
          setSubmitError("You do not have permission to register assets.");
        } else {
          setSubmitError(err.message);
        }
      } else {
        setSubmitError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div style={{ maxWidth: 600, margin: "4rem auto", textAlign: "center", fontFamily: "system-ui" }}>
        <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>&#10003;</div>
        <h1 style={{ color: "#166534" }}>Asset Registered Successfully</h1>
        <p style={{ fontSize: "1.1rem", marginBottom: "0.5rem" }}>
          Your asset has been registered with the following ID:
        </p>
        <div
          style={{
            display: "inline-block",
            padding: "0.75rem 1.5rem",
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            borderRadius: 8,
            fontFamily: "monospace",
            fontSize: "1.3rem",
            fontWeight: "bold",
            color: "#166534",
            marginBottom: "2rem",
          }}
        >
          {success.assetId}
        </div>
        <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
          <button
            onClick={() => {
              setSuccess(null);
              navigate("/assets");
            }}
            style={{
              padding: "0.6rem 1.5rem",
              background: "#2563eb",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            View All Assets
          </button>
          <button
            onClick={() => setSuccess(null)}
            style={{
              padding: "0.6rem 1.5rem",
              background: "#f3f4f6",
              border: "1px solid #d1d5db",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            Register Another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "2rem", fontFamily: "system-ui" }}>
      <header style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <Link to="/assets" style={{ color: "#2563eb", textDecoration: "none", fontSize: "0.9rem" }}>
              &larr; Back to Assets
            </Link>
            <h1 style={{ margin: "0.5rem 0 0" }}>Register New Asset</h1>
          </div>
          <button
            onClick={signOut}
            style={{
              padding: "0.5rem 1rem",
              background: "#f3f4f6",
              border: "1px solid #d1d5db",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: "0.85rem",
            }}
          >
            Sign out
          </button>
        </div>
      </header>

      {submitError && (
        <div
          style={{
            padding: "0.75rem 1rem",
            background: "#fef2f2",
            color: "#b91c1c",
            borderRadius: 6,
            marginBottom: "1rem",
          }}
        >
          {submitError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        {/* Asset Name */}
        <Field label="Asset Name" error={errors.asset_name?.message}>
          <input
            {...register("asset_name")}
            type="text"
            placeholder="e.g. Dell Latitude 5540"
            style={inputStyle(errors.asset_name?.message)}
          />
        </Field>

        {/* Category */}
        <Field label="Category" error={errors.category?.message}>
          <input
            {...register("category")}
            type="text"
            placeholder="e.g. ICT Equipment"
            style={inputStyle(errors.category?.message)}
          />
        </Field>

        {/* Description */}
        <Field label="Description (optional)" error={errors.description?.message}>
          <textarea
            {...register("description")}
            placeholder="Brief description of the asset"
            rows={3}
            style={inputStyle(errors.description?.message)}
          />
        </Field>

        {/* Status + Purchase Date row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <Field label="Asset Status" error={errors.status?.message}>
            <select {...register("status")} style={inputStyle(errors.status?.message)}>
              {ASSET_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Purchase Date" error={errors.purchase_date?.message}>
            <input
              {...register("purchase_date")}
              type="date"
              style={inputStyle(errors.purchase_date?.message)}
            />
          </Field>
        </div>

        {/* Purchase Cost + Location row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <Field label="Purchase Cost (UGX)" error={errors.purchase_cost?.message}>
            <input
              {...register("purchase_cost")}
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              style={inputStyle(errors.purchase_cost?.message)}
            />
          </Field>

          <Field label="Location" error={errors.location?.message}>
            <input
              {...register("location")}
              type="text"
              placeholder="e.g. Main Office, Kampala"
              style={inputStyle(errors.location?.message)}
            />
          </Field>
        </div>

        {/* Serial Number */}
        <Field label="Serial Number (optional)" error={errors.serial_number?.message}>
          <input
            {...register("serial_number")}
            type="text"
            placeholder="e.g. SN-12345678"
            style={inputStyle(errors.serial_number?.message)}
          />
        </Field>

        <button
          type="submit"
          disabled={submitting}
          style={{
            padding: "0.75rem",
            background: submitting ? "#93c5fd" : "#2563eb",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            fontSize: "1rem",
            cursor: submitting ? "not-allowed" : "pointer",
            marginTop: "0.5rem",
          }}
        >
          {submitting ? "Registering..." : "Register Asset"}
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label style={{ display: "block", fontWeight: 500, marginBottom: "0.35rem", fontSize: "0.9rem" }}>
        {label}
      </label>
      {children}
      {error && (
        <p style={{ margin: "0.25rem 0 0", color: "#dc2626", fontSize: "0.82rem" }}>{error}</p>
      )}
    </div>
  );
}

function inputStyle(error?: string): React.CSSProperties {
  return {
    width: "100%",
    padding: "0.55rem 0.75rem",
    border: `1px solid ${error ? "#dc2626" : "#d1d5db"}`,
    borderRadius: 6,
    fontSize: "0.9rem",
    boxSizing: "border-box",
  };
}
