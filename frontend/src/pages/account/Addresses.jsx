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

      setAddresses(
        response.data.addresses || []
      );
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to load addresses"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAddresses();
  }, []);

  useEffect(() => {
    if (!modalOpen) return undefined;

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        closeModal();
      }
    };

    window.addEventListener(
      "keydown",
      handleEscape
    );

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
      return undefined;
    }

    if (
      suppressSuggestionsRef.current
    ) {
      suppressSuggestionsRef.current = false;
      return undefined;
    }

    const query =
      String(
        form.addressLine1 || ""
      ).trim();

    if (query.length < 3) {
      setAddressSuggestions([]);
      setSuggestionsLoading(false);
      return undefined;
    }

    let active = true;

    const timer =
      window.setTimeout(
        async () => {
          setSuggestionsLoading(
            true
          );

          try {
            const response =
              await api.post(
                "/delivery/address-suggestions",
                {
                  query,
                  limit: 6,
                }
              );

            if (active) {
              setAddressSuggestions(
                response.data
                  ?.suggestions ||
                  []
              );
            }
          } catch {
            if (active) {
              setAddressSuggestions(
                []
              );
            }
          } finally {
            if (active) {
              setSuggestionsLoading(
                false
              );
            }
          }
        },
        350
      );

    return () => {
      active = false;
      window.clearTimeout(
        timer
      );
    };
  }, [
    form.addressLine1,
    modalOpen,
  ]);

  const handleChange = (
    event
  ) => {
    const {
      name,
      value,
      type,
      checked,
    } = event.target;

    const nextValue =
      type === "checkbox"
        ? checked
        : name ===
            "postalCode"
          ? String(value)
              .replace(
                /\D/g,
                ""
              )
              .slice(0, 6)
          : value;

    setForm((current) => ({
      ...current,
      [name]: nextValue,
    }));
  };

  const applySuggestedAddress =
    (suggestion) => {
      if (!suggestion) {
        return;
      }

      suppressSuggestionsRef.current =
        true;

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
          area ||
          current.addressLine2,

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

  const handleUseCurrentLocation =
    async () => {
      setError("");
      setDetectingLocation(
        true
      );

      try {
        const location =
          await detectCurrentLocation();

        suppressSuggestionsRef.current =
          true;

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
            area ||
            current.addressLine2,

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

        setAddressSuggestions(
          []
        );
      } catch (
        requestError
      ) {
        setError(
          requestError?.message ||
            "Unable to detect your current location. You can still enter the address manually."
        );
      } finally {
        setDetectingLocation(
          false
        );
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

  const startEdit = (
    address
  ) => {
    setEditingId(
      address._id
    );

    setForm({
      label:
        address.label ||
        "Home",

      fullName:
        address.fullName ||
        "",

      phone:
        address.phone ||
        "",

      addressLine1:
        address.addressLine1 ||
        "",

      addressLine2:
        address.addressLine2 ||
        "",

      landmark:
        address.landmark ||
        "",

      city:
        address.city ||
        "",

      state:
        address.state ||
        "",

      postalCode:
        address.postalCode ||
        "",

      country:
        address.country ||
        "India",

      isDefault:
        address.isDefault ||
        false,
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

  const handleSubmit = async (
    event
  ) => {
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
        await api.post(
          "/users/addresses",
          form
        );

        setMessage(
          "New address added successfully."
        );
      }

      setModalOpen(false);
      setEditingId(null);
      setForm(emptyForm);

      await loadAddresses();
    } catch (
      requestError
    ) {
      setError(
        requestError.response
          ?.data?.message ||
          "Unable to save address"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const deleteAddress =
    async (addressId) => {
      const confirmed =
        window.confirm(
          "Delete this saved address?"
        );

      if (!confirmed) {
        return;
      }

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
      } catch (
        requestError
      ) {
        setError(
          requestError.response
            ?.data?.message ||
            "Unable to delete address"
        );
      }
    };

  return (
    <>
      <style>{`
        .address-link {
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: 8px;

          transition:
            color .3s ease,
            transform .3s cubic-bezier(.22,1,.36,1);
        }

        .address-link::after {
          content: "";
          position: absolute;
          left: 0;
          bottom: -5px;

          width: 0;
          height: 1px;

          background:
            linear-gradient(
              90deg,
              #F47822,
              #C49A2B
            );

          transition:
            width .35s cubic-bezier(.22,1,.36,1);
        }

        .address-link:hover {
          color: #F47822;
          transform: translateX(2px);
        }

        .address-link:hover::after {
          width: 100%;
        }

        .address-field {
          border-bottom:
            1px solid
            rgba(24,23,21,.14);

          transition:
            border-color .25s ease;
        }

        .address-field:focus-within {
          border-color: #F47822;
        }
      `}</style>

      <section
        className={
          embedded
            ? "mt-5 border-t border-black/[0.09] pt-9"
            : "w-full text-[#181715]"
        }
      >
        {/* =================================================
            HEADER
        ================================================= */}

        <div className="flex flex-col gap-5 border-b border-black/[0.09] pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#916B17]">
              Delivery
            </p>

            <h2
              style={{
                fontFamily:
                  DISPLAY_FONT,
              }}
              className="mt-1 text-[38px] font-semibold leading-none tracking-[-0.03em]"
            >
              Saved addresses
            </h2>
          </div>

          <button
            type="button"
            onClick={
              openNewAddress
            }
            className="address-link w-fit text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#181715]"
          >
            + Add address
          </button>
        </div>

        {/* =================================================
            MESSAGES
        ================================================= */}

        {message && (
          <p className="mt-5 border-l-2 border-emerald-500 pl-4 text-[12px] font-semibold text-emerald-700">
            {message}
          </p>
        )}

        {error &&
          !modalOpen && (
            <p className="mt-5 border-l-2 border-red-500 pl-4 text-[12px] font-semibold text-red-600">
              {error}
            </p>
          )}

        {/* =================================================
            LIST
        ================================================= */}

        {loading ? (
          <AddressLoading />
        ) : addresses.length ===
          0 ? (
          <button
            type="button"
            onClick={
              openNewAddress
            }
            className="group flex min-h-[220px] w-full items-center justify-center border-b border-black/[0.09] text-center"
          >
            <div>
              <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-[#C49A2B]/30 text-[#A77B1D] transition group-hover:border-[#F47822] group-hover:text-[#F47822]">
                <LocationIcon />
              </span>

              <p
                style={{
                  fontFamily:
                    DISPLAY_FONT,
                }}
                className="mt-5 text-[30px] font-semibold"
              >
                Add your first address
              </p>

              <p className="mt-2 text-[11px] font-medium text-black/35">
                Save once and reuse it during checkout.
              </p>
            </div>
          </button>
        ) : (
          <div>
            {addresses.map(
              (address) => (
                <AddressRow
                  key={
                    address._id
                  }
                  address={
                    address
                  }
                  onEdit={() =>
                    startEdit(
                      address
                    )
                  }
                  onDelete={() =>
                    deleteAddress(
                      address._id
                    )
                  }
                />
              )
            )}

            <button
              type="button"
              onClick={
                openNewAddress
              }
              className="address-link mt-7 text-[11px] font-bold text-black/50"
            >
              + Add another address
            </button>
          </div>
        )}
      </section>

      {/* ==================================================
          MODAL
      ================================================== */}

      {modalOpen && (
        <div
          className="fixed inset-0 z-[500] flex items-center justify-center bg-black/55 p-4 backdrop-blur-[4px]"
          onMouseDown={(
            event
          ) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeModal();
            }
          }}
        >
          <div className="max-h-[92vh] w-full max-w-[760px] overflow-y-auto bg-[#FCFAF6] shadow-[0_30px_100px_rgba(0,0,0,.24)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {/* HEADER */}

            <div className="sticky top-0 z-20 flex items-start justify-between border-b border-black/[0.09] bg-[#FCFAF6]/95 px-6 py-5 backdrop-blur-xl sm:px-8">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#916B17]">
                  {editingId
                    ? "Edit Address"
                    : "New Address"}
                </p>

                <h3
                  style={{
                    fontFamily:
                      DISPLAY_FONT,
                  }}
                  className="mt-1 text-[34px] font-semibold leading-none tracking-[-0.025em]"
                >
                  Delivery details
                </h3>
              </div>

              <button
                type="button"
                onClick={
                  closeModal
                }
                aria-label="Close"
                className="text-[26px] font-light leading-none text-black/35 transition hover:text-[#181715]"
              >
                ×
              </button>
            </div>

            {/* FORM */}

            <form
              onSubmit={
                handleSubmit
              }
              className="px-6 py-7 sm:px-8"
            >
              {error && (
                <p className="mb-6 border-l-2 border-red-500 pl-4 text-[12px] font-semibold text-red-600">
                  {error}
                </p>
              )}

              <FormSection
                number="01"
                title="Recipient"
              >
                <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
                  <Field
                    label="Address Label"
                    name="label"
                    value={
                      form.label
                    }
                    onChange={
                      handleChange
                    }
                    placeholder="Home, Office..."
                  />

                  <Field
                    label="Full Name"
                    name="fullName"
                    value={
                      form.fullName
                    }
                    onChange={
                      handleChange
                    }
                    required
                  />

                  <Field
                    label="Phone Number"
                    name="phone"
                    value={
                      form.phone
                    }
                    onChange={
                      handleChange
                    }
                    required
                  />
                </div>
              </FormSection>

              <FormSection
                number="02"
                title="Location"
              >
                <div className="mb-6 flex flex-col gap-4 border-y border-black/[0.08] py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[12px] font-bold">
                      Use current location
                    </p>

                    <p className="mt-1 text-[10px] leading-5 text-black/38">
                      Detect your location or enter the address manually.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={
                      handleUseCurrentLocation
                    }
                    disabled={
                      detectingLocation
                    }
                    className="address-link w-fit text-[10px] font-extrabold uppercase tracking-[0.07em] text-[#F47822] disabled:pointer-events-none disabled:opacity-40"
                  >
                    <LocationIcon />

                    {detectingLocation
                      ? "Detecting..."
                      : "Use location"}
                  </button>
                </div>

                <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
                  <div className="relative sm:col-span-2">
                    <Field
                      label="Address Line 1"
                      name="addressLine1"
                      value={
                        form.addressLine1
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="House, street or building"
                      autoComplete="off"
                      required
                    />

                    {(suggestionsLoading ||
                      addressSuggestions.length >
                        0) && (
                      <div className="absolute left-0 right-0 top-[65px] z-30 border border-black/[0.09] bg-white shadow-[0_18px_45px_rgba(23,23,23,.13)]">
                        {suggestionsLoading ? (
                          <p className="px-4 py-3 text-[11px] font-medium text-black/35">
                            Finding address suggestions...
                          </p>
                        ) : (
                          addressSuggestions.map(
                            (
                              suggestion,
                              index
                            ) => (
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
                                className="block w-full border-b border-black/[0.06] px-4 py-3 text-left transition last:border-b-0 hover:bg-[#FBF6ED]"
                              >
                                <p className="text-[12px] font-bold">
                                  {suggestion.name ||
                                    suggestion.addressLine1 ||
                                    "Suggested address"}
                                </p>

                                <p className="mt-1 line-clamp-2 text-[10px] leading-5 text-black/40">
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
                      value={
                        form.addressLine2
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="Area / locality"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <Field
                      label="Landmark"
                      name="landmark"
                      value={
                        form.landmark
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="Nearby landmark"
                    />
                  </div>

                  <Field
                    label="City"
                    name="city"
                    value={
                      form.city
                    }
                    onChange={
                      handleChange
                    }
                    required
                  />

                  <Field
                    label="State"
                    name="state"
                    value={
                      form.state
                    }
                    onChange={
                      handleChange
                    }
                    required
                  />

                  <Field
                    label="Postal Code"
                    name="postalCode"
                    value={
                      form.postalCode
                    }
                    onChange={
                      handleChange
                    }
                    required
                  />

                  <Field
                    label="Country"
                    name="country"
                    value={
                      form.country
                    }
                    onChange={
                      handleChange
                    }
                  />
                </div>
              </FormSection>

              <label className="mt-7 flex cursor-pointer items-center justify-between gap-5 border-y border-black/[0.08] py-4">
                <div>
                  <p className="text-[12px] font-bold">
                    Default delivery address
                  </p>

                  <p className="mt-1 text-[10px] text-black/35">
                    Prefer this address during checkout.
                  </p>
                </div>

                <input
                  type="checkbox"
                  name="isDefault"
                  checked={
                    form.isDefault
                  }
                  onChange={
                    handleChange
                  }
                  className="h-4 w-4 shrink-0 accent-[#F47822]"
                />
              </label>

              <div className="mt-7 flex justify-end gap-6 border-t border-black/[0.09] pt-6">
                <button
                  type="button"
                  onClick={
                    closeModal
                  }
                  disabled={
                    submitting
                  }
                  className="address-link text-[10px] font-bold uppercase tracking-[0.08em] text-black/45 disabled:opacity-40"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    submitting
                  }
                  className="min-h-[44px] bg-[#181715] px-6 text-[10px] font-extrabold uppercase tracking-[0.08em] text-white transition hover:bg-[#F47822] disabled:cursor-not-allowed disabled:opacity-40"
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
   ADDRESS ROW
====================================================== */

const AddressRow = ({
  address,
  onEdit,
  onDelete,
}) => (
  <article className="grid gap-5 border-b border-black/[0.09] py-7 md:grid-cols-[150px_minmax(0,1fr)_auto] md:items-start md:gap-8">
    <div>
      <div className="flex items-center gap-2 text-[#916B17]">
        <LocationIcon />

        <span className="text-[12px] font-bold">
          {address.label ||
            "Address"}
        </span>
      </div>

      {address.isDefault && (
        <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.08em] text-[#A77B1D]">
          Default
        </p>
      )}
    </div>

    <div>
      <p
        style={{
          fontFamily:
            DISPLAY_FONT,
        }}
        className="text-[25px] font-semibold leading-none"
      >
        {address.fullName}
      </p>

      <p className="mt-2 text-[11px] font-medium text-black/40">
        {address.phone}
      </p>

      <p className="mt-3 max-w-[720px] text-[12px] leading-6 text-black/52">
        {address.addressLine1}

        {address.addressLine2 &&
          `, ${address.addressLine2}`}

        {address.landmark &&
          `, ${address.landmark}`}

        {", "}

        {address.city},{" "}
        {address.state}{" "}
        {address.postalCode}
      </p>
    </div>

    <div className="flex gap-5 md:flex-col md:items-end">
      <button
        type="button"
        onClick={onEdit}
        className="address-link text-[10px] font-bold uppercase tracking-[0.07em] text-black/50"
      >
        Edit
      </button>

      <button
        type="button"
        onClick={onDelete}
        className="address-link text-[10px] font-bold uppercase tracking-[0.07em] text-red-500"
      >
        Remove
      </button>
    </div>
  </article>
);

/* ======================================================
   FORM SECTION
====================================================== */

const FormSection = ({
  number,
  title,
  children,
}) => (
  <section className="mt-8 first:mt-0">
    <div className="mb-5 flex items-center gap-3">
      <span className="font-serif text-[11px] italic text-[#C49A2B]">
        {number}
      </span>

      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-black/40">
        {title}
      </p>

      <span className="h-px flex-1 bg-black/[0.08]" />
    </div>

    {children}
  </section>
);

/* ======================================================
   FIELD
====================================================== */

const Field = ({
  label,
  ...props
}) => (
  <label className="block">
    <span className="text-[10px] font-semibold text-black/38">
      {label}
    </span>

    <div className="address-field mt-2">
      <input
        {...props}
        className="h-[44px] w-full bg-transparent px-0 text-[12px] font-semibold outline-none placeholder:text-black/25"
      />
    </div>
  </label>
);

/* ======================================================
   LOADING
====================================================== */

const AddressLoading = () => (
  <div>
    {[1, 2].map(
      (item) => (
        <div
          key={item}
          className="grid animate-pulse gap-5 border-b border-black/[0.07] py-7 md:grid-cols-[150px_1fr_90px]"
        >
          <div className="h-4 w-20 bg-black/[0.04]" />

          <div>
            <div className="h-7 w-44 bg-black/[0.05]" />
            <div className="mt-4 h-3 w-72 max-w-full bg-black/[0.035]" />
          </div>

          <div className="h-3 w-14 bg-black/[0.04]" />
        </div>
      )
    )}
  </div>
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
    aria-hidden="true"
  >
    <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
    <circle cx="12" cy="10" r="2.5" />
  </svg>
);

const Addresses = () => (
  <AddressManager />
);

export default Addresses;
