import { useQuery } from '@tanstack/react-query';
import { healthApi } from '../services/api';

export const useHealth = () => {
  return useQuery({
    queryKey: ['system-health'],
    queryFn: healthApi.checkHealth,
    refetchInterval: 10000,
    retry: 2,
  });
};

