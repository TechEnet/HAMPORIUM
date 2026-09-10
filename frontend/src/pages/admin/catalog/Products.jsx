import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import api from "../../../api/api.js";
import formatCurrency from "../../../utils/formatCurrency.js";

const statusStyles = {
  active: "border-emerald-200 bg-emerald-50 text-emerald-700",
  draft: "border-amber-200 bg-amber-50 text-amber-700",
  archived: "border-black/10 bg-black/[0.04] text-black/45",
};

const Products = () => {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const loadProducts = async () => {
    const params = new URLSearchParams();

    if (search) params.set("search", search);
    if (status) params.set("status", status);

    const response = await api.get(`/catalog/admin/products?${params}`);
    setProducts(response.data.products || []);
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const archiveProduct = async (id) => {
    if (!window.confirm("Archive this product?")) return;

    await api.delete(`/catalog/admin/products/${id}`);
    loadProducts();
  };

  return (
    <div className="pb-10">
      <div className="overflow-hidden rounded-3xl border border-black/[0.06] bg-white shadow-[0_18px_60px_rgba(0,0,0,0.05)]">
        <div className="border-b border-black/[0.06] bg-gradient-to-r from-[#FFF9F2] via-white to-white px-5 py-6 sm:px-7 lg:px-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#F97316]" />
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#F97316]">
                  Catalogue
                </p>
              </div>

              <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#171717] sm:text-4xl">
                Products
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-black/50">
                Manage public products, ready-made hampers, pricing, status and
                their sellable SKU configurations.
              </p>
            </div>

            <Link
              to="/admin/catalog/products/new"
              className="inline-flex items-center justify-center rounded-xl bg-[#F97316] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#171717]"
            >
              + Add Product
            </Link>
          </div>
        </div>

        <div className="p-5 sm:p-7 lg:p-8">
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard label="Visible Results" value={products.length} />
            <StatCard
              label="Active"
              value={products.filter((product) => product.status === "active").length}
            />
            <StatCard
              label="Draft / Archived"
              value={
                products.filter((product) => product.status !== "active").length
              }
            />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              loadProducts();
            }}
            className="mt-6 rounded-2xl border border-black/[0.07] bg-[#FAFAF9] p-4"
          >
            <div className="flex flex-col gap-3 lg:flex-row">
              <div className="min-w-0 flex-1">
                <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.12em] text-black/40">
                  Search
                </label>
                <input
                  placeholder="Search by product name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-black/30 focus:border-[#F97316] focus:ring-4 focus:ring-orange-100"
                />
              </div>

              <div className="lg:w-56">
                <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.12em] text-black/40">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#F97316] focus:ring-4 focus:ring-orange-100"
                >
                  <option value="">All Statuses</option>
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              <div className="flex items-end">
                <button className="w-full rounded-xl bg-[#171717] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#F97316] lg:w-auto">
                  Apply Filter
                </button>
              </div>
            </div>
          </form>

          <div className="mt-6 overflow-hidden rounded-2xl border border-black/[0.07] bg-white">
            <div className="flex items-center justify-between border-b border-black/[0.06] px-5 py-4">
              <div>
                <h2 className="font-bold text-[#171717]">Product Catalogue</h2>
                <p className="mt-1 text-xs text-black/40">
                  {products.length} product{products.length === 1 ? "" : "s"} shown
                </p>
              </div>
            </div>

            {products.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFF9F2] text-xl">
                  ◇
                </div>
                <p className="mt-4 font-semibold text-[#171717]">
                  No products found
                </p>
                <p className="mt-1 text-sm text-black/40">
                  Add a product or change your filters.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-[850px] w-full text-left text-sm">
                  <thead>
                    <tr className="bg-[#FAFAF9] text-[10px] uppercase tracking-[0.12em] text-black/40">
                      <th className="px-5 py-3.5 font-bold">Product</th>
                      <th className="px-5 py-3.5 font-bold">Category</th>
                      <th className="px-5 py-3.5 font-bold">Price</th>
                      <th className="px-5 py-3.5 font-bold">SKUs</th>
                      <th className="px-5 py-3.5 font-bold">Status</th>
                      <th className="px-5 py-3.5 text-right font-bold">Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {products.map((product) => (
                      <tr
                        key={product._id}
                        className="border-t border-black/[0.05] transition hover:bg-[#FFF9F2]/60"
                      >
                        <td className="px-5 py-4">
                          <div className="flex min-w-[240px] items-center gap-3.5">
                            {product.images?.[0]?.url ? (
                              <img
                                src={product.images[0].url}
                                alt={product.name}
                                className="h-14 w-14 shrink-0 rounded-xl border border-black/[0.06] object-cover"
                              />
                            ) : (
                              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-dashed border-black/10 bg-[#FAFAF9] text-xs font-bold text-black/25">
                                IMG
                              </div>
                            )}

                            <div className="min-w-0">
                              <p className="truncate font-bold text-[#171717]">
                                {product.name}
                              </p>

                              {product.shortDescription && (
                                <p className="mt-1 max-w-xs truncate text-xs text-black/40">
                                  {product.shortDescription}
                                </p>
                              )}

                              {product.isFeatured && (
                                <span className="mt-2 inline-flex rounded-full border border-[#D4AF37]/30 bg-[#FFF9F2] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#8A6D15]">
                                  Featured
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4 text-black/60">
                          {product.category?.name || "—"}
                        </td>

                        <td className="px-5 py-4">
                          <p className="font-bold text-[#171717]">
                            {product.minPrice !== null
                              ? formatCurrency(product.minPrice)
                              : "No SKU"}
                          </p>

                          {product.maxPrice !== null &&
                            product.maxPrice !== product.minPrice && (
                              <p className="mt-1 text-xs text-black/35">
                                up to {formatCurrency(product.maxPrice)}
                              </p>
                            )}
                        </td>

                        <td className="px-5 py-4">
                          <span className="inline-flex min-w-8 justify-center rounded-lg bg-black/[0.04] px-2.5 py-1.5 text-xs font-bold text-black/60">
                            {product.skuCount}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                              statusStyles[product.status] ||
                              "border-black/10 bg-black/[0.04] text-black/50"
                            }`}
                          >
                            {product.status}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-2">
                            <Link
                              to={`/admin/catalog/products/${product._id}/edit`}
                              className="rounded-lg border border-black/10 bg-white px-3.5 py-2 text-xs font-bold text-[#171717] transition hover:border-[#F97316] hover:text-[#F97316]"
                            >
                              Edit
                            </Link>

                            {product.status !== "archived" && (
                              <button
                                type="button"
                                onClick={() => archiveProduct(product._id)}
                                className="rounded-lg border border-red-100 bg-red-50 px-3.5 py-2 text-xs font-bold text-red-600 transition hover:border-red-200 hover:bg-red-100"
                              >
                                Archive
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ label, value }) => (
  <div className="rounded-2xl border border-black/[0.06] bg-white p-4 shadow-[0_8px_24px_rgba(0,0,0,0.025)]">
    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-black/35">
      {label}
    </p>
    <p className="mt-2 text-2xl font-bold tracking-tight text-[#171717]">
      {value}
    </p>
  </div>
);

export default Products;