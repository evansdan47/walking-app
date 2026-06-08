type AccountSectionPlaceholderProps = {
  title: string;
  description: string;
};

export function AccountSectionPlaceholder({ title, description }: AccountSectionPlaceholderProps) {
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">{title}</h1>
      <p className="text-sm text-gray-500 mb-6">{description}</p>
      <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
        <p className="text-sm text-gray-500">This section is coming soon.</p>
      </div>
    </div>
  );
}
