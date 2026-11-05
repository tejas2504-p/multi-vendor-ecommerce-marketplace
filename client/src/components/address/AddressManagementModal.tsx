import React, { useState, useEffect, useCallback } from 'react';
import { X, Plus, MapPin, Check, Trash2, Edit2, AlertCircle, Loader2 } from 'lucide-react';
import { Address, CreateAddressDto } from '../../types';
import { addressApi } from '../../services/address.api';
import { useCart } from '../../context/CartContext';

export const AddressManagementModal: React.FC = () => {
  const { isAddressModalOpen, closeAddressModal } = useCart();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form mode: 'list' | 'add' | 'edit'
  const [formMode, setFormMode] = useState<'list' | 'add' | 'edit'>('list');
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);

  const [formData, setFormData] = useState<CreateAddressDto>({
    fullName: '',
    phone: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'United States',
    isDefault: false,
  });

  const loadAddresses = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await addressApi.getAddresses();
      setAddresses(data);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to load delivery addresses');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAddressModalOpen) {
      loadAddresses();
      setFormMode('list');
      setError(null);
      setSuccessMsg(null);
    }
  }, [isAddressModalOpen, loadAddresses]);

  if (!isAddressModalOpen) return null;

  const handleOpenAdd = () => {
    setFormData({
      fullName: '',
      phone: '',
      addressLine1: '',
      addressLine2: '',
      city: '',
      state: '',
      postalCode: '',
      country: 'United States',
      isDefault: addresses.length === 0,
    });
    setFormMode('add');
    setError(null);
    setSuccessMsg(null);
  };

  const handleOpenEdit = (addr: Address) => {
    setFormData({
      fullName: addr.fullName,
      phone: addr.phone,
      addressLine1: addr.addressLine1,
      addressLine2: addr.addressLine2 || '',
      city: addr.city,
      state: addr.state,
      postalCode: addr.postalCode,
      country: addr.country,
      isDefault: addr.isDefault,
    });
    setEditingAddressId(addr.id);
    setFormMode('edit');
    setError(null);
    setSuccessMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    // Basic frontend checks
    if (!formData.fullName.trim()) return setError('Full name is required');
    if (!formData.phone.trim()) return setError('Phone number is required');
    if (!formData.addressLine1.trim()) return setError('Street address is required');
    if (!formData.city.trim()) return setError('City is required');
    if (!formData.state.trim()) return setError('State/Province is required');
    if (!formData.postalCode.trim()) return setError('Postal/ZIP code is required');

    try {
      setIsLoading(true);
      if (formMode === 'add') {
        await addressApi.createAddress(formData);
        setSuccessMsg('New delivery address added successfully');
      } else if (formMode === 'edit' && editingAddressId) {
        await addressApi.updateAddress(editingAddressId, formData);
        setSuccessMsg('Address updated successfully');
      }
      await loadAddresses();
      setFormMode('list');
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to save address');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this address?')) return;
    try {
      setIsLoading(true);
      await addressApi.deleteAddress(id);
      setSuccessMsg('Address deleted successfully');
      await loadAddresses();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to delete address');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      setIsLoading(true);
      await addressApi.setDefaultAddress(id);
      setSuccessMsg('Default address updated');
      await loadAddresses();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to update default address');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {formMode === 'list' && 'Saved Delivery Addresses'}
                {formMode === 'add' && 'Add New Address'}
                {formMode === 'edit' && 'Edit Address'}
              </h2>
              <p className="text-xs text-slate-500">Manage your shipping destinations</p>
            </div>
          </div>
          <button
            onClick={closeAddressModal}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback alerts */}
        {error && (
          <div className="mx-6 mt-4 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start space-x-2.5 text-rose-700 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="mx-6 mt-4 p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start space-x-2.5 text-emerald-700 text-xs font-medium">
            <Check className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {formMode === 'list' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  {addresses.length} {addresses.length === 1 ? 'Address' : 'Addresses'} Saved
                </span>
                <button
                  onClick={handleOpenAdd}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Address</span>
                </button>
              </div>

              {isLoading && addresses.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-400 space-y-2">
                  <Loader2 className="w-7 h-7 animate-spin text-indigo-600" />
                  <span className="text-xs">Loading addresses...</span>
                </div>
              ) : addresses.length === 0 ? (
                <div className="py-12 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-center p-6 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                    <MapPin className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">No saved addresses</h3>
                    <p className="text-xs text-slate-500 max-w-xs mt-1">
                      Add a delivery address to speed up your checkout process.
                    </p>
                  </div>
                  <button
                    onClick={handleOpenAdd}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition"
                  >
                    Add Address Now
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {addresses.map((addr) => (
                    <div
                      key={addr.id}
                      className={`relative rounded-2xl border p-4 transition ${
                        addr.isDefault
                          ? 'border-indigo-600 bg-indigo-50/20 shadow-sm'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-bold text-slate-900">{addr.fullName}</span>
                            {addr.isDefault && (
                              <span className="px-2 py-0.5 text-[10px] font-bold bg-indigo-600 text-white rounded-md uppercase tracking-wider">
                                Default
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-600 mt-1">{addr.addressLine1}</p>
                          {addr.addressLine2 && <p className="text-xs text-slate-600">{addr.addressLine2}</p>}
                          <p className="text-xs text-slate-600">
                            {addr.city}, {addr.state} {addr.postalCode}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">Phone: {addr.phone}</p>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => handleOpenEdit(addr)}
                            title="Edit"
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(addr.id)}
                            title="Delete"
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {!addr.isDefault && (
                        <div className="mt-3 pt-2 border-t border-slate-100 flex justify-end">
                          <button
                            onClick={() => handleSetDefault(addr.id)}
                            className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition"
                          >
                            Set as Default
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Address Form (Add / Edit) */
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Alice Customer"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="+1 555-123-4567"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Street Address *</label>
                <input
                  type="text"
                  required
                  value={formData.addressLine1}
                  onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="123 Main Street"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Apartment, Suite, Unit (Optional)</label>
                <input
                  type="text"
                  value={formData.addressLine2 || ''}
                  onChange={(e) => setFormData({ ...formData, addressLine2: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Apt 4B"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">City *</label>
                  <input
                    type="text"
                    required
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Springfield"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">State / Province *</label>
                  <input
                    type="text"
                    required
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="IL"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Postal / ZIP Code *</label>
                  <input
                    type="text"
                    required
                    value={formData.postalCode}
                    onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="62704"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Country *</label>
                <input
                  type="text"
                  required
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="United States"
                />
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <input
                  type="checkbox"
                  id="isDefault"
                  checked={formData.isDefault}
                  onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                />
                <label htmlFor="isDefault" className="text-xs font-medium text-slate-700 cursor-pointer">
                  Set as default delivery address
                </label>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setFormMode('list')}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex items-center space-x-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-500/20 transition disabled:opacity-50"
                >
                  {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{formMode === 'add' ? 'Save Address' : 'Update Address'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

