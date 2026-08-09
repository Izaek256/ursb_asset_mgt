type StatusProps = {
  status: string;
};

export default function StatusBadge({ status }: StatusProps) {
  const normStatus = status.toLowerCase().replace(/\s+/g, "");

  /*
   * Color Palette Rationale for the 10 Asset Statuses:
   * 1. Positive Grouping (Green / Blue):
   *    - Green (bg-badge-greenBg / text-badge-greenText): Assigned (asset is active and in-use)
   *    - Blue (bg-badge-blueBg / text-badge-blueText): Available (asset is ready in storage)
   * 2. Transitional Grouping (Amber):
   *    - Amber (bg-badge-amberBg / text-badge-amberText): Reserved, Pending Acceptance, Pending Pickup,
   *      Under Transfer, Under Maintenance, Returned (asset is in-between states or requires custodian action)
   * 3. Terminal Grouping (Rose / Grey):
   *    - Rose (bg-badge-roseBg / text-badge-roseText): Disposed (asset is retired / destroyed / sold)
   *    - Grey (bg-badge-greyBg / text-badge-greyText): Deactivated (asset is permanently deactivated)
   */
  let colorClasses = "bg-badge-greyBg text-badge-greyText"; // Default / fallback

  // Groupings for colors
  if (["assigned", "active", "approved", "completed", "active/assigned", "pickedup"].includes(normStatus)) {
    colorClasses = "bg-badge-greenBg text-badge-greenText";
  } else if (["available", "instorage", "instore"].includes(normStatus)) {
    colorClasses = "bg-badge-blueBg text-badge-blueText";
  } else if (
    [
      "reserved",
      "pendingacceptance",
      "pendingpickup",
      "undertransfer",
      "undermaintenance",
      "returned",
      "high",
      "pending",
    ].includes(normStatus)
  ) {
    colorClasses = "bg-badge-amberBg text-badge-amberText";
  } else if (["low", "normal"].includes(normStatus)) {
    colorClasses = "bg-badge-greyBg text-badge-greyText";
  } else if (["disposed", "urgent", "rejected", "cancelled"].includes(normStatus)) {
    colorClasses = "bg-badge-roseBg text-badge-roseText";
  } else if (["deactivated"].includes(normStatus)) {
    colorClasses = "bg-badge-greyBg text-badge-greyText";
  }

  // Display human-readable label
  let label = status;
  if (normStatus === "available") label = "Available";
  if (normStatus === "reserved") label = "Reserved";
  if (normStatus === "pendingacceptance") label = "Pending Acceptance";
  if (normStatus === "pendingpickup") label = "Pending Pickup";
  if (normStatus === "assigned") label = "Assigned";
  if (normStatus === "undertransfer") label = "Under Transfer";
  if (normStatus === "undermaintenance") label = "Under Maintenance";
  if (normStatus === "returned") label = "Returned";
  if (normStatus === "disposed") label = "Disposed";
  if (normStatus === "deactivated") label = "Deactivated";
  if (normStatus === "instorage") label = "In Storage";
  if (normStatus === "pickedup") label = "Picked Up";

  return (
    <span
      className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold select-none tracking-wide ${colorClasses}`}
    >
      {label}
    </span>
  );
}
