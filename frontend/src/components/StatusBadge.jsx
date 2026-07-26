const STATUS_CONFIG = {
  // Order statuses
  pending:    { label: 'Pending',    cls: 'badge-warning' },
  processing: { label: 'Processing', cls: 'badge-info'    },
  shipped:    { label: 'Shipped',    cls: 'badge-violet'  },
  delivered:  { label: 'Delivered',  cls: 'badge-success' },
  cancelled:  { label: 'Cancelled',  cls: 'badge-danger'  },

  // Payment statuses
  unpaid:     { label: 'Unpaid',     cls: 'badge-danger'  },
  partial:    { label: 'Partial',    cls: 'badge-warning' },
  paid:       { label: 'Paid',       cls: 'badge-success' },
  refunded:   { label: 'Refunded',   cls: 'badge-muted'   },

  // Product status
  active:     { label: 'Active',     cls: 'badge-success' },
  inactive:   { label: 'Inactive',   cls: 'badge-muted'   },
  archived:   { label: 'Archived',   cls: 'badge-muted'   },

  // User roles
  admin:      { label: 'Admin',      cls: 'badge-violet'  },
  manager:    { label: 'Manager',    cls: 'badge-info'    },
  staff:      { label: 'Staff',      cls: 'badge-muted'   },
};

export default function StatusBadge({ status }) {
  if (!status) return null;
  const cfg = STATUS_CONFIG[status] || { label: status, cls: 'badge-muted' };
  return <span className={`badge ${cfg.cls}`}>{cfg.label}</span>;
}
