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
  bannerImage: "",
  bannerImagePublicId: "",
  isFeatured: false,
  isActive: true,
  sortOrder: 0,
};

const Collections = () => {
  const [collections, setCollections] = useState([]);
  const [form, setForm] = useState(emptyForm);

  const [imageFile, setImageFile] = useState(null);
  const [bannerFile, setBannerFile] = useState(null);

  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadCollections = async () => {
    try {
      const response = await api.get(
        "/catalog/admin/collections"
      );
      setCollections(response.data.collections || []);
    } catch (error) {
      setError(
        error.response?.data?.message ||
          "Unable to load collections"
      );
    }
  };

  useEffect(() => {
    loadCollections();
  }, []);

  const resetForm = () => {
    setForm(emptyForm);
    setImageFile(null);
    setBannerFile(null);
    setEditingId(null);
  };

  const saveCollection = async (event) => {
    event.preventDefault();

    setSaving(true);
    setError("");

    const uploadedImages = [];
    let collectionSaved = false;

    const oldImagePublicId = form.imagePublicId;
    const oldBannerPublicId =
      form.bannerImagePublicId;

    try {
      let newImage = null;
      let newBanner = null;

      if (imageFile) {
        newImage = await uploadCatalogImage(
          imageFile,
          "collection"
        );

        uploadedImages.push(newImage);
      }

      if (bannerFile) {
        newBanner = await uploadCatalogImage(
          bannerFile,
          "collection"
        );

        uploadedImages.push(newBanner);
      }

      const payload = {
        ...form,

        image: newImage?.url || form.image,
        imagePublicId:
          newImage?.publicId || form.imagePublicId,

        bannerImage:
          newBanner?.url || form.bannerImage,

        bannerImagePublicId:
          newBanner?.publicId ||
          form.bannerImagePublicId,
      };

      if (editingId) {
        await api.patch(
          `/catalog/admin/collections/${editingId}`,
          payload
        );
      } else {
        await api.post(
          "/catalog/admin/collections",
          payload
        );
      }

      collectionSaved = true;

      if (
        newImage &&
        oldImagePublicId &&
        oldImagePublicId !== newImage.publicId
      ) {
        try {
          await deleteCatalogImage(
            oldImagePublicId
          );
        } catch (error) {
          console.error(
            "Old collection image cleanup failed:",
            error
          );
        }
      }

      if (
        newBanner &&
        oldBannerPublicId &&
        oldBannerPublicId !== newBanner.publicId
      ) {
        try {
          await deleteCatalogImage(
            oldBannerPublicId
          );
        } catch (error) {
          console.error(
            "Old banner cleanup failed:",
            error
          );
        }
      }

      resetForm();
      await loadCollections();
    } catch (error) {
      if (!collectionSaved) {
        for (const image of uploadedImages) {
          try {
            await deleteCatalogImage(
              image.publicId
            );
          } catch {
            // Ignore rollback cleanup error
          }
        }
      }

      setError(
        error.response?.data?.message ||
          "Unable to save collection"
      );
    } finally {
      setSaving(false);
    }
  };

  const editCollection = (collection) => {
    setEditingId(collection._id);
    setImageFile(null);
    setBannerFile(null);

    setForm({
      name: collection.name,
      description:
        collection.description || "",
      image: collection.image || "",
      imagePublicId:
        collection.imagePublicId || "",
      bannerImage:
        collection.bannerImage || "",
      bannerImagePublicId:
        collection.bannerImagePublicId || "",
      isFeatured: collection.isFeatured,
      isActive: collection.isActive,
      sortOrder: collection.sortOrder || 0,
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const removeCollection = async (id) => {
    if (
      !window.confirm(
        "Delete this collection?"
      )
    )
      return;

    try {
      await api.delete(
        `/catalog/admin/collections/${id}`
      );
      await loadCollections();
    } catch (error) {
      setError(
        error.response?.data?.message ||
          "Unable to delete collection"
      );
    }
  };

  const activeCount = collections.filter(
    (collection) => collection.isActive
  ).length;

  const featuredCount =
    collections.filter(
      (collection) => collection.isFeatured
    ).length;

  return (
    <div className="mx-auto w-full max-w-[1600px] pb-12">
      <PageHeader
        eyebrow="Catalogue Merchandising"
        title="Collections"
        description="Create seasonal, premium and campaign-based product groupings for the storefront."
        stats={[
          ["Total", collections.length],
          ["Featured", featuredCount],
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
                ? "Editing Collection"
                : "Create Collection"}
            </p>

            <h2 className="mt-1 text-xl font-bold text-[#171717]">
              {editingId
                ? "Update Collection"
                : "Add New Collection"}
            </h2>

            <p className="mt-1 text-sm text-black/45">
              Set the title, artwork, banner and storefront visibility.
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
          onSubmit={saveCollection}
          className="p-6 lg:p-8"
        >
          <div className="grid gap-6 lg:grid-cols-2">
            <Field
              label="Collection Name"
              required
            >
              <input
                required
                placeholder="e.g. Diwali Luxe Edit"
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
                    sortOrder:
                      event.target.value,
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
                placeholder="Describe this collection..."
                value={form.description}
                onChange={(event) =>
                  setForm({
                    ...form,
                    description:
                      event.target.value,
                  })
                }
                className={`${inputClass} resize-none`}
              />
            </Field>

            <div className="rounded-2xl border border-black/[0.06] bg-[#FAFAF9] p-5">
              <FileUpload
                label="Collection Image"
                value={form.image}
                file={imageFile}
                onFileChange={setImageFile}
              />
            </div>

            <div className="rounded-2xl border border-black/[0.06] bg-[#FAFAF9] p-5">
              <FileUpload
                label="Collection Banner"
                value={form.bannerImage}
                file={bannerFile}
                onFileChange={setBannerFile}
              />
            </div>

            <SwitchRow
              title="Featured Collection"
              description="Highlight this collection on premium merchandising surfaces."
              checked={form.isFeatured}
              onChange={(checked) =>
                setForm({
                  ...form,
                  isFeatured: checked,
                })
              }
            />

            <SwitchRow
              title="Active Collection"
              description="Keep enabled to make this collection available for catalogue use."
              checked={form.isActive}
              onChange={(checked) =>
                setForm({
                  ...form,
                  isActive: checked,
                })
              }
            />
          </div>

          <div className="mt-7 flex justify-end border-t border-black/[0.06] pt-6">
            <button
              type="submit"
              disabled={saving}
              className="min-w-[190px] rounded-xl bg-[#F97316] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#171717] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving
                ? "Saving..."
                : editingId
                  ? "Update Collection"
                  : "Create Collection"}
            </button>
          </div>
        </form>
      </section>

      <section className="mt-7 overflow-hidden rounded-[26px] border border-black/[0.07] bg-white shadow-[0_12px_40px_rgba(0,0,0,0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-black/[0.06] px-6 py-5 lg:px-8">
          <div>
            <h2 className="text-lg font-bold text-[#171717]">
              Collection Library
            </h2>

            <p className="mt-1 text-sm text-black/40">
              Preview and manage all storefront collections.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <CountBadge
              label="Total"
              value={collections.length}
            />
            <CountBadge
              label="Featured"
              value={featuredCount}
              gold
            />
            <CountBadge
              label="Active"
              value={activeCount}
              accent
            />
          </div>
        </div>

        {collections.length === 0 ? (
          <EmptyState
            title="No collections yet"
            description="Create your first collection using the form above."
          />
        ) : (
          <div className="grid gap-5 p-5 md:grid-cols-2 xl:grid-cols-3 lg:p-6">
            {collections.map((collection) => (
              <article
                key={collection._id}
                className="group overflow-hidden rounded-2xl border border-black/[0.07] bg-white transition hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-[0_12px_30px_rgba(0,0,0,0.06)]"
              >
                <div className="relative h-40 bg-[#F5F5F3]">
                  {collection.bannerImage ? (
                    <img
                      src={collection.bannerImage}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : collection.image ? (
                    <img
                      src={collection.image}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs font-bold uppercase tracking-[0.12em] text-black/20">
                      No Artwork
                    </div>
                  )}

                  <div className="absolute left-3 top-3 flex flex-wrap gap-2">
                    {collection.isFeatured && (
                      <span className="rounded-full border border-[#D4AF37]/35 bg-[#FFF9F2] px-2.5 py-1 text-[9px] font-bold uppercase text-[#8A6D15]">
                        Featured
                      </span>
                    )}

                    <span
                      className={`rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase ${
                        collection.isActive
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-black/10 bg-white text-black/40"
                      }`}
                    >
                      {collection.isActive
                        ? "Active"
                        : "Inactive"}
                    </span>
                  </div>
                </div>

                <div className="p-4">
                  <div className="flex items-start gap-3">
                    {collection.image && (
                      <img
                        src={collection.image}
                        alt={collection.name}
                        className="h-12 w-12 shrink-0 rounded-xl border border-black/[0.06] object-cover"
                      />
                    )}

                    <div className="min-w-0">
                      <h3 className="truncate font-bold text-[#171717]">
                        {collection.name}
                      </h3>

                      <p className="mt-1 truncate text-xs text-black/40">
                        /{collection.slug}
                      </p>
                    </div>
                  </div>

                  {collection.description && (
                    <p className="mt-3 line-clamp-2 text-sm leading-6 text-black/50">
                      {collection.description}
                    </p>
                  )}

                  <div className="mt-4 flex items-center justify-between border-t border-black/[0.05] pt-4">
                    <span className="text-xs text-black/40">
                      Sort order{" "}
                      <strong className="text-black/60">
                        {collection.sortOrder || 0}
                      </strong>
                    </span>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          editCollection(collection)
                        }
                        className="rounded-lg border border-black/10 px-3 py-2 text-xs font-bold text-black/60 transition hover:border-[#F97316] hover:text-[#F97316]"
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          removeCollection(
                            collection._id
                          )
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
        <span className="h-2 w-2 rounded-full bg-[#D4AF37]" />
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#8A6D15]">
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

    <div className="flex flex-wrap gap-3">
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
  gold = false,
}) => (
  <span
    className={`rounded-full px-3 py-1.5 text-xs font-bold ${
      accent
        ? "bg-orange-50 text-[#F97316]"
        : gold
          ? "bg-[#FFF9F2] text-[#8A6D15]"
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

export default Collections;