import React from 'react';
import { Sparkles, AlertTriangle, X, ThumbsDown, BellRing } from 'lucide-react';
import { WarningNotification } from '../types';

interface WarningToastProps {
  notification: WarningNotification | null;
  onDismiss: () => void;
  onReportFalseAlarm: (notification: WarningNotification) => void;
}

export const WarningToast: React.FC<WarningToastProps> = ({
  notification,
  onDismiss,
  onReportFalseAlarm,
}) => {
  if (!notification || notification.dismissed) return null;

  const getToastStyle = () => {
    switch (notification.severity) {
      case 1:
        return {
          bg: 'bg-[#0E172A]/95 border-brand-500/40 text-brand-100 shadow-brand-500/20',
          iconBg: 'bg-brand-500/20 text-brand-300',
          icon: Sparkles,
        };
      case 2:
        return {
          bg: 'bg-[#1C140E]/95 border-amber-500/50 text-amber-100 shadow-amber-500/20',
          iconBg: 'bg-amber-500/20 text-amber-300',
          icon: BellRing,
        };
      case 3:
      default:
        return {
          bg: 'bg-[#1F0E14]/95 border-rose-500/50 text-rose-100 shadow-rose-500/25',
          iconBg: 'bg-rose-500/20 text-rose-300',
          icon: AlertTriangle,
        };
    }
  };

  const style = getToastStyle();
  const Icon = style.icon;

  return (
    <div className="fixed top-20 right-4 sm:right-8 z-50 max-w-md w-full animate-bounce-subtle pointer-events-auto">
      <div
        className={`rounded-2xl p-4 sm:p-5 border backdrop-blur-xl shadow-2xl flex items-start gap-3.5 ${style.bg}`}
      >
        <div className={`p-2 rounded-xl mt-0.5 flex-shrink-0 ${style.iconBg}`}>
          <Icon className="w-5 h-5" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-display font-bold text-white tracking-tight">
              {notification.title}
            </h4>
            <button
              onClick={onDismiss}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs text-slate-200 mt-1 leading-relaxed">{notification.message}</p>

          <div className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-white/10 text-xs">
            <button
              onClick={() => onReportFalseAlarm(notification)}
              className="flex items-center gap-1 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <ThumbsDown className="w-3 h-3" />
              <span>Not me / False alarm</span>
            </button>

            <button
              onClick={onDismiss}
              className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium transition-all"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
