import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
export function useAlerts() {
  const { data } = useQuery({
    queryKey: ['alertas'],
    queryFn: () => api.get('/dashboard/alertas').then(r => r.data),
    refetchInterval: 120000,
  });
  const alertCount = (data?.stockBajo?.length || 0) + (data?.facturasVencidas?.length || 0);
  return { alertas: data, alertCount };
}
