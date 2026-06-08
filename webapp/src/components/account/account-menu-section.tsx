type AccountMenuSectionProps = {
  title: string;
  description: string;
};

export function AccountMenuSection({ title, description }: AccountMenuSectionProps) {
  return (
    <div className="px-1 py-2">
      <h2 className="text-sm font-bold text-gray-900 mb-1">{title}</h2>
      <p className="text-xs text-gray-500 mb-4">{description}</p>
      <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center">
        <p className="text-xs text-gray-500">This section is coming soon.</p>
      </div>
    </div>
  );
}
