import { useEffect, useRef, useState } from "react";
import api from "../../api/api.js";
import {
  useDeliveryLocation,
} from "../../context/LocationContext.jsx";

const DISPLAY_FONT =
  "'Cormorant Garamond', 'Playfair Display', Georgia, serif";

const emptyForm = {
  label: "Home",
  fullName: "",
  phone: "",
  addressLine1: "",
  addressLine2: "",
  landmark: "",
  city: "",
  state: "",
  postalCode: "",
  country: "India",
  isDefault: false,
};

export const AddressManager = ({ embedded = false }) => {
  const {
    detectCurrentLocation,
    applyDeliveryLocation,
  } = useDeliveryLocation();

  const suppressSuggestionsRef =
    useRef(false);

  const [addresses, setAddresses] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [addressSuggestions, setAddressSuggestions] =
    useState([]);

  const [suggestionsLoading, setSuggestionsLoading] =
    useState(false);

  const [detectingLocation, setDetectingLocation] =
    useState(false);

  const loadAddresses = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get("/users/addresses");
      setAddresses(response.data.addresses || []);
    } catch (error) {
      setError(
        error.response?.data?.message ||
          "Unable to load addresses"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAddresses();
  }, []);

  useEffect(() => {
    if (!modalOpen) return;

    const handleEscape = (event) => {
      if (event.key === "Escape") closeModal();
    };

    window.addEventListener("keydown", handleEscape);

    return () =>
      window.removeEventListener(
        "keydown",
        handleEscape
      );
  }, [modalOpen]);

  useEffect(() => {
    if (!modalOpen) {
      setAddressSuggestions([]);
      setSuggestionsLoading(false);
      return;
    }

    if (suppressSuggestionsRef.current) {
      suppressSuggestionsRef.current = false;
      return;
    }

    const query =
      String(form.addressLine1 || "").trim();

    if (query.length < 3) {
      setAddressSuggestions([]);
      setSuggestionsLoading(false);
      return;
    }

    let active = true;

    const timer = window.setTimeout(
      async () => {
        setSuggestionsLoading(true);

        try {
          const response = await api.post(
            "/delivery/address-suggestions",
            {
              query,
              limit: 6,
            }
          );

          if (active) {
            setAddressSuggestions(
              response.data?.suggestions || []
            );
          }
        } catch {
          if (active) {
            setAddressSuggestions([]);
          }
        } finally {
          if (active) {
            setSuggestionsLoading(false);
          }
        }
      },
      350
    );

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [
    form.addressLine1,
    modalOpen,
  ]);

  const handleChange = (event) => {
    const { name, value, type, checked } =
      event.target;

    const nextValue =
      type === "checkbox"
        ? checked
        : name === "postalCode"
          ? String(value)
              .replace(/\D/g, "")
              .slice(0, 6)
          : value;

    setForm((current) => ({
      ...current,
      [name]: nextValue,
    }));
  };

  const applySuggestedAddress = (suggestion) => {
    if (!suggestion) {
      return;
    }

    suppressSuggestionsRef.current = true;

    const area =
      suggestion.neighborhood ||
      suggestion.locality ||
      suggestion.district ||
      "";

    setForm((current) => ({
      ...current,
      addressLine1:
        suggestion.addressLine1 ||
        suggestion.name ||
        current.addressLine1,
      addressLine2:
        area || current.addressLine2,
      city:
        suggestion.city ||
        current.city,
      state:
        suggestion.state ||
        current.state,
      postalCode:
        suggestion.pincode ||
        current.postalCode,
      country:
        suggestion.country ||
        current.country ||
        "India",
    }));

    setAddressSuggestions([]);

    applyDeliveryLocation(
      suggestion
    );
  };

  const handleUseCurrentLocation = async () => {
    setError("");
    setDetectingLocation(true);

    try {
      const location =
        await detectCurrentLocation();

      suppressSuggestionsRef.current = true;

      const area =
        location?.neighborhood ||
        location?.locality ||
        location?.district ||
        "";

      setForm((current) => ({
        ...current,
        addressLine1:
          location?.addressLine1 ||
          location?.name ||
          current.addressLine1,
        addressLine2:
          area || current.addressLine2,
        city:
          location?.city ||
          current.city,
        state:
          location?.state ||
          current.state,
        postalCode:
          location?.pincode ||
          current.postalCode,
        country:
          location?.country ||
          current.country ||
          "India",
      }));

      setAddressSuggestions([]);
    } catch (requestError) {
      setError(
        requestError?.message ||
          "Unable to detect your current location. You can still enter the address manually."
      );
    } finally {
      setDetectingLocation(false);
    }
  };

  const openNewAddress = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setMessage("");
    setAddressSuggestions([]);
    setModalOpen(true);
  };

  const startEdit = (address) => {
    setEditingId(address._id);

    setForm({
      label: address.label || "Home",
      fullName: address.fullName || "",
      phone: address.phone || "",
      addressLine1:
        address.addressLine1 || "",
      addressLine2:
        address.addressLine2 || "",
      landmark: address.landmark || "",
      city: address.city || "",
      state: address.state || "",
      postalCode:
        address.postalCode || "",
      country: address.country || "India",
      isDefault:
        address.isDefault || false,
    });

    setError("");
    setMessage("");
    setAddressSuggestions([]);
    setModalOpen(true);
  };

  const closeModal = () => {
    if (submitting) return;

    setModalOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    setAddressSuggestions([]);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");
    setMessage("");
    setSubmitting(true);

    try {
      if (editingId) {
        await api.patch(
          `/users/addresses/${editingId}`,
          form
        );

        setMessage(
          "Address updated successfully."
        );
      } else {
        await api.post("/users/addresses", form);

        setMessage(
          "New address added successfully."
        );
      }

      setModalOpen(false);
      setEditingId(null);
      setForm(emptyForm);

      await loadAddresses();
    } catch (error) {
      setError(
        error.response?.data?.message ||
          "Unable to save address"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const deleteAddress = async (addressId) => {
    const confirmed = window.confirm(
      "Delete this saved address?"
    );

    if (!confirmed) return;

    try {
      setError("");
      setMessage("");

      await api.delete(
        `/users/addresses/${addressId}`
      );

      setMessage(
        "Address removed successfully."
      );

      await loadAddresses();
    } catch (error) {
      setError(
        error.response?.data?.message ||
          "Unable to delete address"
      );
    }
  };

  return (
    <>
      <section
        className={
          embedded
            ? "mt-7"
            : "w-full text-[#171717]"
        }
      >
        {/* HEADER */}
        <div className="flex flex-col gap-4 border-b border-black/[0.06] pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="h-px w-6 bg-[#D4AF37]" />

              <p className="text-[8px] font-extrabold uppercase tracking-[0.2em] text-[#A9812C]">
                Delivery Details
              </p>
            </div>

            <h2
              style={{ fontFamily: DISPLAY_FONT }}
              className="mt-2 text-[30px] font-semibold leading-none tracking-[-0.02em]"
            >
              Saved Addresses
            </h2>

            <p className="mt-2 text-[10px] font-medium leading-5 text-black/40">
              Manage the addresses used for
              orders, gifting and checkout.
            </p>
          </div>

          <button
            type="button"
            onClick={openNewAddress}
            className="group inline-flex h-[42px] w-fit items-center justify-center gap-2 rounded-[10px] bg-[#171717] px-4 text-[9px] font-extrabold uppercase tracking-[0.08em] text-white transition hover:bg-[#F97316]"
          >
            <span className="text-[17px] font-light leading-none">
              +
            </span>
            Add New Address
          </button>
        </div>

        {/* SUCCESS */}
        {message && (
          <div className="mt-4 flex items-center gap-3 rounded-[10px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-[10px] font-semibold text-emerald-700">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-[10px]">
              ✓
            </span>

            {message}
          </div>
        )}

        {/* ERROR OUTSIDE MODAL */}
        {error && !modalOpen && (
          <div className="mt-4 rounded-[10px] border border-red-200 bg-red-50 px-4 py-3 text-[10px] font-semibold text-red-700">
            {error}
          </div>
        )}

        {/* ADDRESSES */}
        {loading ? (
          <div className="mt-5 rounded-[16px] border border-black/[0.06] bg-white px-5 py-10 text-center text-[11px] text-black/40">
            Loading saved addresses...
          </div>
        ) : addresses.length === 0 ? (
          <button
            type="button"
            onClick={openNewAddress}
            className="group mt-5 flex w-full flex-col items-center justify-center rounded-[16px] border border-dashed border-black/10 bg-white px-6 py-9 text-center transition hover:border-[#F97316]/35 hover:bg-[#FFFDFC]"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#FFF1E8] text-[#F97316] transition group-hover:scale-105">
              <LocationIcon />
            </span>

            <p className="mt-3 text-[12px] font-bold text-[#171717]">
              Add your first delivery address
            </p>

            <p className="mt-1 text-[9px] font-medium text-black/35">
              Save an address once and reuse it
              during checkout.
            </p>
          </button>
        ) : (
          <div className="mt-5 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {addresses.map((address) => (
              <AddressCard
                key={address._id}
                address={address}
                onEdit={() =>
                  startEdit(address)
                }
                onDelete={() =>
                  deleteAddress(address._id)
                }
              />
            ))}

            {/* ADD ANOTHER */}
            <button
              type="button"
              onClick={openNewAddress}
              className="group min-h-[190px] rounded-[15px] border border-dashed border-black/10 bg-white p-5 text-left transition hover:border-[#F97316]/35 hover:bg-[#FFFDFC]"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FFF1E8] text-[20px] font-light text-[#F97316]">
                +
              </div>

              <p className="mt-5 text-[12px] font-bold">
                Add another address
              </p>

              <p className="mt-1 max-w-[210px] text-[9px] leading-4 text-black/35">
                Save home, office or another
                preferred delivery location.
              </p>
            </button>
          </div>
        )}
      </section>

      {/* ==================================================
          ADDRESS MODAL
      ================================================== */}

      {modalOpen && (
        <div
          className="fixed inset-0 z-[500] flex items-center justify-center bg-black/55 p-4 backdrop-blur-[3px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeModal();
            }
          }}
        >
          <div className="max-h-[92vh] w-full max-w-[720px] overflow-y-auto rounded-[20px] bg-[#FBFAF8] shadow-[0_30px_100px_rgba(0,0,0,.28)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {/* MODAL HEADER */}
            <div className="sticky top-0 z-10 flex items-start justify-between border-b border-black/[0.06] bg-[#FBFAF8]/95 px-5 py-5 backdrop-blur-xl sm:px-6">
              <div>
                <p className="text-[8px] font-extrabold uppercase tracking-[0.2em] text-[#F97316]">
                  {editingId
                    ? "Update Address"
                    : "New Address"}
                </p>

                <h3
                  style={{
                    fontFamily: DISPLAY_FONT,
                  }}
                  className="mt-1 text-[28px] font-semibold leading-none"
                >
                  {editingId
                    ? "Edit Delivery Address"
                    : "Add Delivery Address"}
                </h3>

                <p className="mt-2 text-[9px] font-medium text-black/35">
                  Enter the recipient and
                  delivery information below.
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-black/[0.07] bg-white text-[18px] text-black/45 transition hover:bg-[#171717] hover:text-white"
              >
                ×
              </button>
            </div>

            {/* FORM */}
            <form
              onSubmit={handleSubmit}
              className="p-5 sm:p-6"
            >
              {error && (
                <div className="mb-5 rounded-[10px] border border-red-200 bg-red-50 px-4 py-3 text-[10px] font-semibold text-red-700">
                  {error}
                </div>
              )}

              {/* RECIPIENT */}
              <FormSection
                number="01"
                title="Recipient"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Address Label"
                    name="label"
                    value={form.label}
                    onChange={handleChange}
                    placeholder="Home, Office..."
                  />

                  <Field
                    label="Full Name"
                    name="fullName"
                    value={form.fullName}
                    onChange={handleChange}
                    required
                  />

                  <Field
                    label="Phone Number"
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    required
                  />
                </div>
              </FormSection>

              {/* LOCATION */}
              <FormSection
                number="02"
                title="Delivery Location"
              >
                <div className="mb-4 flex flex-col gap-3 rounded-[12px] border border-[#F97316]/15 bg-[#FFF8F2] p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[10px] font-extrabold text-[#171717]">
                      Fill address faster
                    </p>

                    <p className="mt-1 text-[9px] leading-4 text-black/40">
                      Detect your current location, or type the address manually below.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleUseCurrentLocation}
                    disabled={detectingLocation}
                    className="inline-flex h-[40px] shrink-0 items-center justify-center gap-2 rounded-[9px] border border-[#F97316]/30 bg-white px-4 text-[9px] font-extrabold uppercase tracking-[0.05em] text-[#F97316] transition hover:border-[#F97316] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <LocationIcon />
                    {detectingLocation
                      ? "Detecting..."
                      : "Use Current Location"}
                  </button>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="relative sm:col-span-2">
                    <Field
                      label="Address Line 1"
                      name="addressLine1"
                      value={form.addressLine1}
                      onChange={handleChange}
                      placeholder="Start typing house, street or building"
                      autoComplete="off"
                      required
                    />

                    {(suggestionsLoading ||
                      addressSuggestions.length > 0) && (
                      <div className="absolute left-0 right-0 top-[68px] z-30 overflow-hidden rounded-[10px] border border-black/[0.08] bg-white shadow-[0_18px_45px_rgba(23,23,23,.14)]">
                        {suggestionsLoading ? (
                          <div className="px-4 py-3 text-[9px] font-semibold text-black/35">
                            Finding address suggestions...
                          </div>
                        ) : (
                          addressSuggestions.map(
                            (suggestion, index) => (
                              <button
                                key={
                                  suggestion.mapboxId ||
                                  `${suggestion.label}-${index}`
                                }
                                type="button"
                                onClick={() =>
                                  applySuggestedAddress(
                                    suggestion
                                  )
                                }
                                className="block w-full border-b border-black/[0.05] px-4 py-3 text-left transition last:border-b-0 hover:bg-[#FFF8F2]"
                              >
                                <p className="text-[10px] font-bold text-[#171717]">
                                  {suggestion.name ||
                                    suggestion.addressLine1 ||
                                    "Suggested address"}
                                </p>

                                <p className="mt-1 line-clamp-2 text-[9px] leading-4 text-black/40">
                                  {suggestion.label ||
                                    suggestion.formattedAddress}
                                </p>
                              </button>
                            )
                          )
                        )}
                      </div>
                    )}
                  </div>

                  <div className="sm:col-span-2">
                    <Field
                      label="Address Line 2"
                      name="addressLine2"
                      value={form.addressLine2}
                      onChange={handleChange}
                      placeholder="Area / locality"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <Field
                      label="Landmark"
                      name="landmark"
                      value={form.landmark}
                      onChange={handleChange}
                      placeholder="Nearby landmark"
                    />
                  </div>

                  <Field
                    label="City"
                    name="city"
                    value={form.city}
                    onChange={handleChange}
                    required
                  />

                  <Field
                    label="State"
                    name="state"
                    value={form.state}
                    onChange={handleChange}
                    required
                  />

                  <Field
                    label="Postal Code"
                    name="postalCode"
                    value={form.postalCode}
                    onChange={handleChange}
                    required
                  />

                  <Field
                    label="Country"
                    name="country"
                    value={form.country}
                    onChange={handleChange}
                  />
                </div>
              </FormSection>

              {/* DEFAULT */}
              <label className="mt-5 flex cursor-pointer items-center justify-between gap-4 rounded-[12px] border border-black/[0.07] bg-white px-4 py-3.5">
                <div>
                  <p className="text-[11px] font-bold">
                    Default delivery address
                  </p>

                  <p className="mt-1 text-[9px] text-black/35">
                    Prefer this address during
                    checkout.
                  </p>
                </div>

                <input
                  type="checkbox"
                  name="isDefault"
                  checked={form.isDefault}
                  onChange={handleChange}
                  className="h-4 w-4 shrink-0 accent-[#F97316]"
                />
              </label>

              {/* ACTIONS */}
              <div className="mt-6 flex justify-end gap-3 border-t border-black/[0.06] pt-5">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={submitting}
                  className="h-[44px] rounded-[10px] border border-black/10 bg-white px-5 text-[9px] font-extrabold uppercase tracking-[0.07em] text-black/45 transition hover:border-black/30 hover:text-black disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="h-[44px] rounded-[10px] bg-[#F97316] px-6 text-[9px] font-extrabold uppercase tracking-[0.07em] text-white shadow-[0_10px_25px_rgba(249,115,22,.18)] transition hover:bg-[#171717] disabled:opacity-50"
                >
                  {submitting
                    ? "Saving..."
                    : editingId
                      ? "Update Address"
                      : "Save Address"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

/* ======================================================
   ADDRESS CARD
====================================================== */

const AddressCard = ({
  address,
  onEdit,
  onDelete,
}) => (
  <div
    className={`relative min-h-[190px] rounded-[15px] border bg-white p-5 transition hover:shadow-[0_10px_30px_rgba(23,23,23,.05)] ${
      address.isDefault
        ? "border-[#D4AF37]/40"
        : "border-black/[0.07]"
    }`}
  >
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FFF1E8] text-[#F97316]">
          <LocationIcon />
        </span>

        <div>
          <p className="text-[11px] font-extrabold">
            {address.label || "Address"}
          </p>

          {address.isDefault && (
            <p className="mt-0.5 text-[7px] font-extrabold uppercase tracking-[0.12em] text-[#A9812C]">
              Default Address
            </p>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={onEdit}
        className="text-[9px] font-extrabold uppercase tracking-[0.06em] text-[#F97316] hover:underline"
      >
        Edit
      </button>
    </div>

    <p className="mt-4 text-[11px] font-bold">
      {address.fullName}
    </p>

    <p className="mt-1 text-[9px] text-black/40">
      {address.phone}
    </p>

    <p className="mt-3 text-[10px] leading-5 text-black/50">
      {address.addressLine1}
      {address.addressLine2 &&
        `, ${address.addressLine2}`}
      {address.landmark &&
        `, ${address.landmark}`}
      <br />
      {address.city}, {address.state}{" "}
      {address.postalCode}
    </p>

    <div className="mt-4 border-t border-black/[0.05] pt-3">
      <button
        type="button"
        onClick={onDelete}
        className="text-[8px] font-extrabold uppercase tracking-[0.08em] text-red-400 transition hover:text-red-600"
      >
        Remove Address
      </button>
    </div>
  </div>
);

/* ======================================================
   FORM SECTION
====================================================== */

const FormSection = ({
  number,
  title,
  children,
}) => (
  <div className="not-first:mt-6">
    <div className="mb-4 flex items-center gap-3">
      <span className="font-serif text-[10px] italic text-[#D4AF37]">
        {number}
      </span>

      <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-black/40">
        {title}
      </p>

      <span className="h-px flex-1 bg-black/[0.06]" />
    </div>

    {children}
  </div>
);

/* ======================================================
   FIELD
====================================================== */

const Field = ({ label, ...props }) => (
  <label className="block">
    <span className="mb-1.5 block text-[8px] font-extrabold uppercase tracking-[0.09em] text-black/45">
      {label}
    </span>

    <input
      {...props}
      className="h-[46px] w-full rounded-[10px] border border-black/[0.09] bg-white px-3.5 text-[11px] font-semibold outline-none transition placeholder:text-black/25 focus:border-[#F97316] focus:ring-4 focus:ring-[#F97316]/10"
    />
  </label>
);

/* ======================================================
   ICON
====================================================== */

const LocationIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-4 w-4"
  >
    <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
    <circle cx="12" cy="10" r="2.5" />
  </svg>
);

const Addresses = () => (
  <AddressManager />
);

export default Addresses;