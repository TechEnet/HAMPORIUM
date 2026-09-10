import { useEffect, useState } from "react";

import api, {
  deleteCatalogImage,
  uploadCatalogImage,
} from "../../../api/api.js";

import FileUpload from "../../../components/FileUpload.jsx";

const emptyForm = {
  name: "",
  description: "",
  image: "",
  imagePublicId: "",
  isActive: true,
  sortOrder: 0,
};

const Categories = () => {
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [imageFile, setImageFile] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadCategories = async () => {
    try {
      const response = await api.get("/catalog/admin/categories");
      setCategories(response.data.categories || []);
    } catch (error) {
      setError(
        error.response?.data?.message ||
          "Unable to load categories"
      );
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const resetForm = () => {
    setForm(emptyForm);
    setImageFile(null);
    setEditingId(null);
  };

  const saveCategory = async (event) => {
    event.preventDefault();

    setSaving(true);
    setError("");

    let uploadedImage = null;
    let categorySaved = false;

    const oldPublicId = form.imagePublicId;

    try {
      if (imageFile) {
        uploadedImage = await uploadCatalogImage(
          imageFile,
          "category"
        );
      }

      const payload = {
        ...form,
        image: uploadedImage?.url || form.image,
        imagePublicId:
          uploadedImage?.publicId || form.imagePublicId,
      };

      if (editingId) {
        await api.patch(
          `/catalog/admin/categories/${editingId}`,
          payload
        );
      } else {
        await api.post(
          "/catalog/admin/categories",
          payload
        );
      }

      categorySaved = true;

      if (
        uploadedImage &&
        oldPublicId &&
        oldPublicId !== uploadedImage.publicId
      ) {
        try {
          await deleteCatalogImage(oldPublicId);
        } catch (error) {
          console.error(
            "Old category image cleanup failed:",
            error
          );
        }
      }

      resetForm();
      await loadCategories();
    } catch (error) {
      if (uploadedImage && !categorySaved) {
        try {
          await deleteCatalogImage(uploadedImage.publicId);
        } catch {
          // Ignore cleanup error
        }
      }

      setError(
        error.response?.data?.message ||
          "Unable to save category"
      );
    } finally {
      setSaving(false);
    }
  };

  const editCategory = (category) => {
    setEditingId(category._id);
    setImageFile(null);

    setForm({
      name: category.name,
      description: category.description || "",
      image: category.image || "",
      imagePublicId: category.imagePublicId || "",
      isActive: category.isActive,
      sortOrder: category.sortOrder || 0,
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const removeCategory = async (id) => {
    if (!window.confirm("Delete this category?")) return;

    try {
      await api.delete(
        `/catalog/admin/categories/${id}`
      );
      await loadCategories();
    } catch (error) {
      setError(
        error.response?.data?.message ||
          "Unable to delete category"
      );
    }
  };

  const activeCount = categories.filter(
    (category) => category.isActive
  ).length;

  return (
    <div className="mx-auto w-full max-w-[1600px] pb-12">
      <PageHeader
        eyebrow="Catalogue Structure"
        title="Categories"
        description="Organize products into clean storefront categories and control their display order."
        stats={[
          ["Total", categories.length],
          ["Active", activeCount],
        ]}
      />

      {error && (
        <div className="mt-6 rounded-2xl border border-red-100 bg-red-50 px-5 py-4 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <section className="mt-7 overflow-hidden rounded-[26px] border border-black/[0.07] bg-white shadow-[0_12px_40px_rgba(0,0,0,0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-black/[0.06] bg-[#FFF9F2] px-6 py-5 lg:px-8">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#F97316]">
              {editingId
                ? "Editing Category"
                : "Create Category"}
            </p>

            <h2 className="mt-1 text-xl font-bold text-[#171717]">
              {editingId
                ? "Update Category Details"
                : "Add New Category"}
            </h2>

            <p className="mt-1 text-sm text-black/45">
              Basic storefront information, image and ordering.
            </p>
          </div>

          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-semibold text-black/55 transition hover:border-[#F97316] hover:text-[#F97316]"
            >
              Cancel Edit
            </button>
          )}
        </div>

        <form
          onSubmit={saveCategory}
          className="p-6 lg:p-8"
        >
          <div className="grid gap-6 lg:grid-cols-2">
            <Field label="Category Name" required>
              <input
                required
                placeholder="e.g. Wedding Hampers"
                value={form.name}
                onChange={(event) =>
                  setForm({
                    ...form,
                    name: event.target.value,
                  })
                }
                className={inputClass}
              />
            </Field>

            <Field label="Sort Order">
              <input
                type="number"
                placeholder="0"
                value={form.sortOrder}
                onChange={(event) =>
                  setForm({
                    ...form,
                    sortOrder: event.target.value,
                  })
                }
                className={inputClass}
              />
            </Field>

            <Field
              label="Description"
              className="lg:col-span-2"
            >
              <textarea
                rows="4"
                placeholder="Write a short category description..."
                value={form.description}
                onChange={(event) =>
                  setForm({
                    ...form,
                    description: event.target.value,
                  })
                }
                className={`${inputClass} resize-none`}
              />
            </Field>

            <div className="lg:col-span-2">
              <div className="rounded-2xl border border-black/[0.06] bg-[#FAFAF9] p-5">
                <FileUpload
                  label="Category Image"
                  value={form.image}
                  file={imageFile}
                  onFileChange={setImageFile}
                />
              </div>
            </div>

            <div className="lg:col-span-2">
              <SwitchRow
                title="Active Category"
                description="Keep enabled to make this category available for catalogue use."
                checked={form.isActive}
                onChange={(checked) =>
                  setForm({
                    ...form,
                    isActive: checked,
                  })
                }
              />
            </div>
          </div>

          <div className="mt-7 flex justify-end border-t border-black/[0.06] pt-6">
            <button
              type="submit"
              disabled={saving}
              className="min-w-[180px] rounded-xl bg-[#F97316] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#171717] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving
                ? "Saving..."
                : editingId
                  ? "Update Category"
                  : "Create Category"}
            </button>
          </div>
        </form>
      </section>

      <section className="mt-7 overflow-hidden rounded-[26px] border border-black/[0.07] bg-white shadow-[0_12px_40px_rgba(0,0,0,0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-black/[0.06] px-6 py-5 lg:px-8">
          <div>
            <h2 className="text-lg font-bold text-[#171717]">
              Category Library
            </h2>
            <p className="mt-1 text-sm text-black/40">
              All categories currently available in your catalogue.
            </p>
          </div>

          <div className="flex gap-2">
            <CountBadge
              label="Total"
              value={categories.length}
            />
            <CountBadge
              label="Active"
              value={activeCount}
              accent
            />
          </div>
        </div>

        {categories.length === 0 ? (
          <EmptyState
            title="No categories yet"
            description="Create your first category using the form above."
          />
        ) : (
          <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3 lg:p-6">
            {categories.map((category) => (
              <article
                key={category._id}
                className="group overflow-hidden rounded-2xl border border-black/[0.07] bg-white transition hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-[0_12px_30px_rgba(0,0,0,0.06)]"
              >
                <div className="relative h-40 bg-[#F5F5F3]">
                  {category.image ? (
                    <img
                      src={category.image}
                      alt={category.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs font-bold uppercase tracking-[0.12em] text-black/20">
                      No Image
                    </div>
                  )}

                  <span
                    className={`absolute right-3 top-3 rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide ${
                      category.isActive
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-black/10 bg-white text-black/40"
                    }`}
                  >
                    {category.isActive
                      ? "Active"
                      : "Inactive"}
                  </span>
                </div>

                <div className="p-4">
                  <h3 className="font-bold text-[#171717]">
                    {category.name}
                  </h3>

                  <p className="mt-1 truncate text-xs font-medium text-black/40">
                    /{category.slug}
                  </p>

                  {category.description && (
                    <p className="mt-3 line-clamp-2 text-sm leading-6 text-black/50">
                      {category.description}
                    </p>
                  )}

                  <div className="mt-4 flex items-center justify-between border-t border-black/[0.05] pt-4">
                    <span className="text-xs text-black/40">
                      Sort order{" "}
                      <strong className="text-black/60">
                        {category.sortOrder || 0}
                      </strong>
                    </span>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          editCategory(category)
                        }
                        className="rounded-lg border border-black/10 px-3 py-2 text-xs font-bold text-black/60 transition hover:border-[#F97316] hover:text-[#F97316]"
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          removeCategory(category._id)
                        }
                        className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-bold text-red-600 transition hover:bg-red-100"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

const inputClass =
  "w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm text-[#171717] outline-none transition placeholder:text-black/30 focus:border-[#F97316] focus:ring-4 focus:ring-orange-100";

const PageHeader = ({
  eyebrow,
  title,
  description,
  stats,
}) => (
  <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
    <div>
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-[#F97316]" />
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#F97316]">
          {eyebrow}
        </p>
      </div>

      <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#171717] sm:text-4xl">
        {title}
      </h1>

      <p className="mt-2 max-w-2xl text-sm leading-6 text-black/50">
        {description}
      </p>
    </div>

    <div className="flex gap-3">
      {stats.map(([label, value]) => (
        <div
          key={label}
          className="min-w-[90px] rounded-2xl border border-black/[0.06] bg-white px-4 py-3"
        >
          <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-black/35">
            {label}
          </p>
          <p className="mt-1 text-xl font-bold text-[#171717]">
            {value}
          </p>
        </div>
      ))}
    </div>
  </header>
);

const Field = ({
  label,
  children,
  required = false,
  className = "",
}) => (
  <label className={`block ${className}`}>
    <span className="mb-2 block text-xs font-semibold text-black/60">
      {label}
      {required && (
        <span className="ml-1 text-[#F97316]">*</span>
      )}
    </span>
    {children}
  </label>
);

const SwitchRow = ({
  title,
  description,
  checked,
  onChange,
}) => (
  <label className="flex cursor-pointer items-center justify-between gap-5 rounded-2xl border border-black/[0.06] bg-[#FAFAF9] px-5 py-4">
    <div>
      <p className="text-sm font-bold text-[#171717]">
        {title}
      </p>
      <p className="mt-1 text-xs text-black/40">
        {description}
      </p>
    </div>

    <input
      type="checkbox"
      checked={checked}
      onChange={(event) =>
        onChange(event.target.checked)
      }
      className="h-4 w-4 accent-[#F97316]"
    />
  </label>
);

const CountBadge = ({
  label,
  value,
  accent = false,
}) => (
  <span
    className={`rounded-full px-3 py-1.5 text-xs font-bold ${
      accent
        ? "bg-orange-50 text-[#F97316]"
        : "bg-black/[0.04] text-black/50"
    }`}
  >
    {label}: {value}
  </span>
);

const EmptyState = ({
  title,
  description,
}) => (
  <div className="px-6 py-16 text-center">
    <p className="font-bold text-[#171717]">
      {title}
    </p>
    <p className="mt-1 text-sm text-black/40">
      {description}
    </p>
  </div>
);

export default Categories;