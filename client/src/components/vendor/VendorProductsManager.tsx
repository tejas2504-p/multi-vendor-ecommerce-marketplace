import React, { useState, useEffect, useCallback } from 'react';
import {
  Package,
  Plus,
  Search,
  Edit2,
  Trash2,
  RefreshCw,
  Loader2,
  AlertCircle,
  CheckCircle2,
  X,
  Box,
} from 'lucide-react';
import { productApi, ProductItem, CategoryItem, CreateProductDto } from '../../services/product.api';

export const PRODUCT_IMAGE_PRESETS = [
  { label: 'Studio DAC / Audio', url: '/images/products/alpha-studio-monitor-pro.jpg' },
  { label: 'Smartwatch Ultra', url: '/images/products/beta-smartwatch-ultra.jpg' },
  { label: 'NovaBook Laptop', url: '/images/products/novabook-pro-16.jpg' },
  { label: 'Titanium Phone', url: '/images/products/apex-phone-15-pro.jpg' },
  { label: 'ANC Earbuds', url: '/images/products/pulsebuds-anc.jpg' },
  { label: 'RGB Keyboard', url: '/images/products/vortex-mechanical-keyboard.jpg' },
];

export const getProductImageUrl = (image: any): string => {
  if (!image) {
    return '/images/products/alpha-studio-monitor-pro.jpg';
  }
  if (typeof image === 'string') {
    if (image.startsWith('http://') || image.startsWith('https://') || image.startsWith('/')) {
      return image;
    }
    return `/${image}`;
  }
  if (typeof image === 'object') {
    if (image.url && typeof image.url === 'string') return image.url;
    if (image.key && typeof image.key === 'string') {
      if (image.key.startsWith('http://') || image.key.startsWith('https://') || image.key.startsWith('/')) {
        return image.key;
      }
      return `/${image.key}`;
    }
  }
  return '/images/products/alpha-studio-monitor-pro.jpg';
};

export const VendorProductsManager: React.FC = () => {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');

  // Modal State for Add / Edit
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalSuccess, setModalSuccess] = useState<string | null>(null);

  // Form Fields
  const [formData, setFormData] = useState<{
    name: string;
    brand: string;
    categoryId: string;
    price: string;
    stock: string;
    sku: string;
    description: string;
    imageUrl: string;
    status: 'draft' | 'active' | 'inactive';
  }>({
    name: '',
    brand: '',
    categoryId: '',
    price: '',
    stock: '',
    sku: '',
    description: '',
    imageUrl: '',
    status: 'active',
  });

  // Load Vendor Products and Categories
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [prodRes, catRes] = await Promise.all([
        productApi.getVendorProducts(),
        productApi.getCategories(),
      ]);
      setProducts(prodRes.products);
      setCategories(catRes);
      if (catRes.length > 0 && !formData.categoryId) {
        setFormData((prev) => ({ ...prev, categoryId: catRes[0].id }));
      }
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to load your store products');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Open modal for Create
  const handleOpenCreateModal = () => {
    setEditingProductId(null);
    setFormData({
      name: '',
      brand: '',
      categoryId: categories.length > 0 ? categories[0].id : '',
      price: '',
      stock: '10',
      sku: '',
      description: '',
      imageUrl: PRODUCT_IMAGE_PRESETS[0].url,
      status: 'active',
    });
    setModalError(null);
    setModalSuccess(null);
    setIsModalOpen(true);
  };

  // Open modal for Edit
  const handleOpenEditModal = (product: ProductItem) => {
    setEditingProductId(product.id);
    const catId = typeof product.categoryId === 'string' ? product.categoryId : product.categoryId?.id || '';
    setFormData({
      name: product.name,
      brand: product.brand || '',
      categoryId: catId || (categories.length > 0 ? categories[0].id : ''),
      price: product.price.toString(),
      stock: product.stock.toString(),
      sku: product.sku || '',
      description: product.description,
      imageUrl: getProductImageUrl(product.images?.[0]),
      status: product.status,
    });
    setModalError(null);
    setModalSuccess(null);
    setIsModalOpen(true);
  };

  // Submit Create or Edit Form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || formData.name.trim().length < 2) {
      setModalError('Product name must be at least 2 characters long.');
      return;
    }
    if (!formData.description.trim() || formData.description.trim().length < 10) {
      setModalError('Product description must be at least 10 characters long.');
      return;
    }
    const priceNum = parseFloat(formData.price);
    if (isNaN(priceNum) || priceNum <= 0) {
      setModalError('Please enter a valid price greater than $0.');
      return;
    }
    const stockNum = parseInt(formData.stock, 10);
    if (isNaN(stockNum) || stockNum < 0) {
      setModalError('Stock count must be a non-negative integer.');
      return;
    }
    if (!formData.categoryId) {
      setModalError('Please select a valid product category.');
      return;
    }

    try {
      setIsSaving(true);
      setModalError(null);

      const imagesArray: string[] = [];
      if (formData.imageUrl.trim()) {
        imagesArray.push(formData.imageUrl.trim());
      } else {
        // Fallback default image for clean catalog display
        imagesArray.push(
          'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&q=80'
        );
      }

      const payload: CreateProductDto = {
        name: formData.name.trim(),
        brand: formData.brand.trim() || undefined,
        categoryId: formData.categoryId,
        price: priceNum,
        stock: stockNum,
        sku: formData.sku.trim() ? formData.sku.trim().toUpperCase() : undefined,
        description: formData.description.trim(),
        images: imagesArray,
        status: formData.status,
      };

      if (editingProductId) {
        await productApi.updateProduct(editingProductId, payload);
        setModalSuccess('Product updated successfully!');
      } else {
        await productApi.createProduct(payload);
        setModalSuccess('Product created and listed successfully!');
      }

      await loadData();
      setTimeout(() => {
        setIsModalOpen(false);
      }, 800);
    } catch (err: any) {
      setModalError(err?.response?.data?.error?.message || 'Failed to save product. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete product handler
  const handleDeleteProduct = async (productId: string, productName: string) => {
    if (!window.confirm(`Are you sure you want to delete "${productName}" from your store?`)) {
      return;
    }

    try {
      setIsLoading(true);
      await productApi.deleteProduct(productId);
      await loadData();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to delete product');
      setIsLoading(false);
    }
  };

  // Quick stock increment/decrement
  const handleQuickStockUpdate = async (productId: string, currentStock: number, delta: number) => {
    const newStock = Math.max(0, currentStock + delta);
    try {
      await productApi.updateInventory(productId, newStock);
      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, stock: newStock } : p))
      );
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || 'Failed to update stock');
    }
  };

  // Filtered Products
  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.brand && p.brand.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus =
      selectedStatusFilter === 'all' || p.status === selectedStatusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
      {/* Header with Title and Add Product Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Product Catalog & Inventory
            </h2>
            <p className="text-xs text-slate-500">
              Manage your store items, pricing, inventory stock, and public visibility.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={loadData}
            disabled={isLoading}
            className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition"
            title="Refresh Products"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleOpenCreateModal}
            className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-500/20 transition flex items-center space-x-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Product</span>
          </button>
        </div>
      </div>

      {/* Global Error Banner */}
      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-center space-x-2.5 text-rose-700 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Search & Status Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, brand, or SKU..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="flex items-center space-x-1 self-start sm:self-auto bg-slate-100 p-1 rounded-xl text-xs">
          {['all', 'active', 'draft', 'inactive'].map((st) => (
            <button
              key={st}
              onClick={() => setSelectedStatusFilter(st)}
              className={`px-3 py-1 rounded-lg font-semibold capitalize transition ${
                selectedStatusFilter === st
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Product List Table / Grid */}
      {isLoading ? (
        <div className="py-16 text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mx-auto" />
          <p className="text-xs text-slate-500 font-medium">Loading store inventory...</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="py-16 text-center space-y-3 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
          <Box className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-sm font-bold text-slate-800">No products found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchQuery
              ? 'No products match your search criteria. Try a different query.'
              : "You haven't listed any products in your store yet."}
          </p>
          <button
            onClick={handleOpenCreateModal}
            className="mt-2 px-4 py-2 bg-emerald-500 text-white rounded-xl text-xs font-bold hover:bg-emerald-600 transition shadow-sm inline-flex items-center space-x-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Your First Product</span>
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600 border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase text-[10px] tracking-wider bg-slate-50/60">
                <th className="py-3 px-3">Product</th>
                <th className="py-3 px-3">SKU & Brand</th>
                <th className="py-3 px-3">Price</th>
                <th className="py-3 px-3">Inventory Stock</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.map((p) => {
                const img = getProductImageUrl(p.images?.[0]);

                return (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-3">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 rounded-xl border border-slate-200 overflow-hidden bg-slate-100 shrink-0 relative flex items-center justify-center p-0.5">
                          <img
                            src={img}
                            alt={p.name}
                            className="w-full h-full object-cover rounded-lg"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=300&q=80';
                            }}
                          />
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 line-clamp-1">{p.name}</div>
                          <div className="text-[11px] text-slate-400">
                            {typeof p.categoryId === 'object' ? p.categoryId?.name : 'Category'}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <div className="font-mono text-slate-700 font-semibold">{p.sku || '—'}</div>
                      <div className="text-[11px] text-slate-400">{p.brand || 'Generic'}</div>
                    </td>

                    <td className="py-3 px-3 font-extrabold text-slate-900 text-sm">
                      ${p.price.toFixed(2)}
                    </td>

                    <td className="py-3 px-3">
                      <div className="flex items-center space-x-1.5">
                        <span
                          className={`font-bold px-2 py-0.5 rounded-md text-[11px] ${
                            p.stock > 10
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : p.stock > 0
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {p.stock > 0 ? `${p.stock} units` : 'Out of Stock'}
                        </span>
                        <div className="flex items-center space-x-0.5">
                          <button
                            onClick={() => handleQuickStockUpdate(p.id, p.stock, -1)}
                            disabled={p.stock <= 0}
                            className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center transition disabled:opacity-40"
                            title="Decrement 1"
                          >
                            -
                          </button>
                          <button
                            onClick={() => handleQuickStockUpdate(p.id, p.stock, 5)}
                            className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center transition"
                            title="Add 5"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <span
                        className={`capitalize font-bold text-[10px] px-2 py-0.5 rounded-full border ${
                          p.status === 'active'
                            ? 'bg-emerald-100/60 text-emerald-800 border-emerald-200'
                            : p.status === 'draft'
                            ? 'bg-slate-100 text-slate-700 border-slate-200'
                            : 'bg-rose-100/60 text-rose-800 border-rose-200'
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleOpenEditModal(p)}
                          className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 transition"
                          title="Edit Product"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(p.id, p.name)}
                          className="p-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-600 transition"
                          title="Delete Product"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-100 overflow-hidden my-6">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Package className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingProductId ? 'Edit Store Product' : 'Add New Product to Store'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
              {modalError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              {modalSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 font-semibold flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{modalSuccess}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Product Title / Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. AcousticWave Studio Monitor Pro"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Category *</label>
                  <select
                    value={formData.categoryId}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs bg-white"
                  >
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Brand Name</label>
                  <input
                    type="text"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    placeholder="e.g. Apex Digital"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Price ($ USD) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="149.00"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Initial Stock *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                    placeholder="25"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">SKU Code</label>
                  <input
                    type="text"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    placeholder="AW-PRO-01"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs uppercase"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700">Product Image URL</label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={formData.imageUrl}
                    onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                    placeholder="/images/products/alpha-studio-monitor-pro.jpg"
                    className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs"
                  />
                  {formData.imageUrl && (
                    <img
                      src={formData.imageUrl}
                      alt="Preview"
                      className="w-10 h-10 object-cover rounded-xl border border-slate-200 shrink-0 bg-slate-100"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=300&q=80';
                      }}
                    />
                  )}
                </div>

                {/* Quick Presets */}
                <div className="pt-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Or select a catalog image preset:
                  </span>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                    {PRODUCT_IMAGE_PRESETS.map((preset) => (
                      <button
                        key={preset.url}
                        type="button"
                        onClick={() => setFormData({ ...formData, imageUrl: preset.url })}
                        className={`p-1 rounded-xl border text-center transition flex flex-col items-center space-y-1 ${
                          formData.imageUrl === preset.url
                            ? 'border-emerald-500 bg-emerald-50/60 ring-1 ring-emerald-500'
                            : 'border-slate-200 hover:border-slate-300 bg-slate-50'
                        }`}
                      >
                        <img
                          src={preset.url}
                          alt={preset.label}
                          className="w-8 h-8 object-cover rounded-lg"
                        />
                        <span className="text-[9px] font-semibold text-slate-600 truncate max-w-full block">
                          {preset.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Description *</label>
                <textarea
                  rows={3}
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Provide detailed product specifications, features, and package contents..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Listing Status</label>
                <div className="flex space-x-3 pt-1">
                  {(['active', 'draft', 'inactive'] as const).map((st) => (
                    <label key={st} className="flex items-center space-x-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="status"
                        checked={formData.status === st}
                        onChange={() => setFormData({ ...formData, status: st })}
                        className="text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="capitalize text-slate-700 font-medium">{st}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold shadow-md shadow-emerald-500/20 transition flex items-center space-x-1.5 disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving to Catalog...</span>
                    </>
                  ) : (
                    <span>{editingProductId ? 'Update Product' : 'List Product in Marketplace'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
