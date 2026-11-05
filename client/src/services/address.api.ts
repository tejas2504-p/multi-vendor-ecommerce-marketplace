import { apiClient } from './api';
import { ApiResponse, Address, CreateAddressDto } from '../types';

export const addressApi = {
  getAddresses: async (): Promise<Address[]> => {
    const response = await apiClient.get<ApiResponse<Address[]>>('/api/addresses');
    return response.data.data;
  },

  createAddress: async (dto: CreateAddressDto): Promise<Address> => {
    const response = await apiClient.post<ApiResponse<Address>>('/api/addresses', dto);
    return response.data.data;
  },

  updateAddress: async (id: string, dto: Partial<CreateAddressDto>): Promise<Address> => {
    const response = await apiClient.patch<ApiResponse<Address>>(`/api/addresses/${id}`, dto);
    return response.data.data;
  },

  deleteAddress: async (id: string): Promise<{ deleted: boolean; newDefaultId?: string }> => {
    const response = await apiClient.delete<ApiResponse<{ deleted: boolean; newDefaultId?: string }>>(
      `/api/addresses/${id}`
    );
    return response.data.data;
  },

  setDefaultAddress: async (id: string): Promise<Address> => {
    const response = await apiClient.patch<ApiResponse<Address>>(`/api/addresses/${id}/default`);
    return response.data.data;
  },
};

