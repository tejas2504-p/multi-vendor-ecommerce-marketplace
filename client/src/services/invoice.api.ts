import { apiClient } from './api';
import { ApiResponse, Invoice } from '../types';

export interface ListInvoicesResponse {
  invoices: Invoice[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const invoiceApi = {
  /**
   * Retrieves or on-demand generates the customer / vendor invoice for an order.
   */
  getOrderInvoice: async (
    orderId: string,
    params?: { type?: 'customer_parent' | 'vendor_order'; vendorOrderId?: string }
  ): Promise<Invoice> => {
    const response = await apiClient.get<ApiResponse<Invoice>>(`/api/orders/${orderId}/invoice`, {
      params,
    });
    return response.data.data;
  },

  /**
   * Fetches an invoice by ID.
   */
  getInvoiceById: async (invoiceId: string): Promise<Invoice> => {
    const response = await apiClient.get<ApiResponse<Invoice>>(`/api/invoices/${invoiceId}`);
    return response.data.data;
  },

  /**
   * Lists invoices with pagination and filters according to the current role.
   */
  listInvoices: async (params?: {
    page?: number;
    limit?: number;
    orderId?: string;
    invoiceType?: 'customer_parent' | 'vendor_order';
  }): Promise<ListInvoicesResponse> => {
    const response = await apiClient.get<ApiResponse<ListInvoicesResponse>>('/api/invoices', {
      params,
    });
    return response.data.data;
  },

  /**
   * Downloads the PDF file directly in the browser.
   */
  downloadInvoicePdf: async (invoiceId: string, preferredFileName?: string): Promise<void> => {
    const response = await apiClient.get(`/api/invoices/${invoiceId}/download`, {
      responseType: 'blob',
    });

    const blob = new Blob([response.data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = preferredFileName || `Invoice-${invoiceId}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },
};

