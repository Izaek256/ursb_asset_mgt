type ConditionProps = {
  condition: string;
};

export default function ConditionBadge({ condition }: ConditionProps) {
  const norm = condition.toLowerCase().trim();

  let colorClasses = "bg-badge-greyBg text-badge-greyText";

  if (["new", "good"].includes(norm)) {
    colorClasses = "bg-badge-greenBg text-badge-greenText";
  } else if (["fair"].includes(norm)) {
    colorClasses = "bg-badge-amberBg text-badge-amberText";
  } else if (["poor", "broken", "damaged"].includes(norm)) {
    colorClasses = "bg-badge-roseBg text-badge-roseText";
  }

  return (
    <span
      className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold select-none tracking-wide ${colorClasses}`}
    >
      {condition}
    </span>
  );
}
