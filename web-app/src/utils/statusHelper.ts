export function getLogicalStatus(i: any) {
  if (i.final_status === 'rejected') return 'rejected';
  if (i.final_status === 'paid') return 'paid';
  if (i.final_status === 'pending_finance_outstanding') return 'pending_finance_outstanding';
  if (i.final_status === 'ready_to_pay' || i.final_status === 'executive_approved') return 'ready_to_pay';
  if (i.final_status === 'finance_selected') return 'finance_selected';
  if (i.final_status === 'executive_1_approved') return 'executive_1_approved';
  if (i.final_status === 'manager_approved' || (i.final_status === 'pending' && i.manager_status === 'approved')) {
    return 'manager_approved';
  }
  return 'pending';
}
