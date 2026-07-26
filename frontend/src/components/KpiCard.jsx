import { DollarSign, ShoppingCart, Package, Users } from 'lucide-react';
import './KpiCard.css';

const ICON_MAP = {
  accent:  { Icon: DollarSign,  color: '#0071e3' },
  violet:  { Icon: ShoppingCart, color: '#af52de' },
  success: { Icon: Package,     color: '#28cd41' },
  warning: { Icon: Users,       color: '#ff9f0a' },
};

export default function KpiCard({ label, value, sub, icon, color = 'accent', loading }) {
  const { Icon, color: iconColor } = ICON_MAP[color] || ICON_MAP.accent;

  return (
    <div className={`kpi-card kpi-${color}`}>
      <div className="kpi-body">
        <div className="kpi-label">{label}</div>
        <div className="kpi-value">
          {loading ? <div className="kpi-skeleton" /> : value}
        </div>
        {sub && <div className="kpi-sub">{sub}</div>}
      </div>
      <div className="kpi-icon">
        <Icon size={20} strokeWidth={1.8} color={iconColor} />
      </div>
    </div>
  );
}
