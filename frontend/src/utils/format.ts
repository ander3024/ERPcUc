export const formatCurrency = (amount: number, currency = 'EUR') =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency }).format(amount);
export const formatDate = (date: string | Date) =>
  new Intl.DateTimeFormat('es-ES').format(new Date(date));
