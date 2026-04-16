import { type LucideIcon, Inbox } from 'lucide-react';

interface EmptyStateProps {
  icon?:    LucideIcon;
  title:    string;
  message?: string;
  action?:  React.ReactNode;
}

export default function EmptyState({ icon: Icon = Inbox, title, message, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-4">
      <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-slate-400" />
      </div>
      <h3 className="font-semibold text-slate-700">{title}</h3>
      {message && <p className="mt-1 text-sm text-slate-400 max-w-xs">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
