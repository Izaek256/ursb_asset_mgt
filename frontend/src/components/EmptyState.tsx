type Props = {
  icon?: string;
  title: string;
  description?: string;
};

export default function EmptyState({ icon = "📭", title, description }: Props) {
  return (
    <div className="page-empty">
      <div className="empty-state-icon">{icon}</div>
      <h3>{title}</h3>
      {description && <p className="text-muted">{description}</p>}
    </div>
  );
}
