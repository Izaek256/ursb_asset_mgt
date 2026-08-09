type RoleProps = {
  role: string;
};

export default function RoleBadge({ role }: RoleProps) {
  const norm = role.toLowerCase().replace(/\s+/g, "");

  let colorClasses = "bg-badge-greyBg text-badge-greyText";

  if (norm.includes("systemadministrator") || norm.includes("admin")) {
    colorClasses = "bg-badge-roseBg text-badge-roseText";
  } else if (norm.includes("assetmanager") || norm.includes("manager")) {
    colorClasses = "bg-badge-blueBg text-badge-blueText";
  } else if (norm.includes("custodian")) {
    colorClasses = "bg-badge-greenBg text-badge-greenText";
  } else if (norm.includes("employee") || norm.includes("staff")) {
    colorClasses = "bg-badge-greyBg text-badge-greyText";
  }

  return (
    <span
      className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold select-none tracking-wide ${colorClasses}`}
    >
      {role}
    </span>
  );
}
