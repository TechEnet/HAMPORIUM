import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  Link,
  useParams,
} from "react-router-dom";

import api from "../../../api/api.js";
import StatusBadge from "../../../components/StatusBadge.jsx";


const Recipients = () => {
  const { id } = useParams();

  const [campaign, setCampaign] =
    useState(null);

  const [recipients, setRecipients] =
    useState([]);

  const [summary, setSummary] =
    useState({
      total: 0,
      valid: 0,
      invalid: 0,
      approved: 0,
    });

  const [status, setStatus] =
    useState("");

  const [page, setPage] =
    useState(1);

  const [pages, setPages] =
    useState(1);

  const [file, setFile] =
    useState(null);

  const [
    replaceExisting,
    setReplaceExisting,
  ] = useState(false);

  const [
    editingRecipient,
    setEditingRecipient,
  ] = useState(null);

  const [loading, setLoading] =
    useState(true);

  const [busy, setBusy] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");


  const loadCampaign =
    useCallback(async () => {
      const { data } =
        await api.get(
          `/corporate/campaigns/${id}`
        );

      setCampaign(
        data.campaign
      );
    }, [id]);


  const loadRecipients =
    useCallback(async () => {
      try {
        setLoading(true);

        const { data } =
          await api.get(
            `/corporate/campaigns/${id}/recipients`,
            {
              params: {
                page,
                limit: 50,

                ...(status && {
                  status,
                }),
              },
            }
          );

        setRecipients(
          data.recipients || []
        );

        setSummary(
          data.summary || {
            total: 0,
            valid: 0,
            invalid: 0,
            approved: 0,
          }
        );

        setPages(
          data.pagination?.pages ||
            1
        );
      } catch (error) {
        setError(
          error.response?.data
            ?.message ||
            "Unable to load recipients."
        );
      } finally {
        setLoading(false);
      }
    }, [id, page, status]);


  useEffect(() => {
    loadCampaign().catch(
      (error) => {
        setError(
          error.response?.data
            ?.message ||
            "Unable to load campaign."
        );
      }
    );
  }, [loadCampaign]);


  useEffect(() => {
    loadRecipients();
  }, [loadRecipients]);


  const getRFQId = () => {
    if (!campaign?.rfq) {
      return "";
    }

    return typeof campaign.rfq ===
      "string"
      ? campaign.rfq
      : campaign.rfq._id;
  };


  const importSpreadsheet =
    async () => {
      if (!file) {
        setError(
          "Select a CSV, XLS or XLSX file."
        );

        return;
      }

      try {
        setBusy(true);
        setError("");
        setSuccess("");

        let documentId = "";

        const rfqId =
          getRFQId();


        if (rfqId) {
          const documentData =
            new FormData();

          documentData.append(
            "entityType",
            "rfq"
          );

          documentData.append(
            "entityId",
            rfqId
          );

          documentData.append(
            "documentType",
            "recipient_file"
          );

          documentData.append(
            "title",
            "Recipient Spreadsheet"
          );

          documentData.append(
            "file",
            file
          );


          const documentResponse =
            await api.post(
              "/documents",
              documentData
            );

          documentId =
            documentResponse.data
              .document?._id ||
            "";
        }


        const importData =
          new FormData();

        importData.append(
          "file",
          file
        );

        importData.append(
          "replaceExisting",
          String(
            replaceExisting
          )
        );

        if (documentId) {
          importData.append(
            "documentId",
            documentId
          );
        }


        const { data } =
          await api.post(
            `/corporate/campaigns/${id}/recipients/import`,
            importData
          );


        setSuccess(
          `${data.summary?.total || 0} recipient rows imported.`
        );

        setFile(null);
        setReplaceExisting(false);
        setPage(1);

        await Promise.all([
          loadCampaign(),
          loadRecipients(),
        ]);
      } catch (error) {
        setError(
          error.response?.data
            ?.message ||
            "Unable to import recipient spreadsheet."
        );
      } finally {
        setBusy(false);
      }
    };


  const editRecipient = (
    recipient
  ) => {
    setEditingRecipient({
      ...recipient,

      address: {
        addressLine1:
          recipient.address
            ?.addressLine1 || "",

        addressLine2:
          recipient.address
            ?.addressLine2 || "",

        city:
          recipient.address
            ?.city || "",

        state:
          recipient.address
            ?.state || "",

        pincode:
          recipient.address
            ?.pincode || "",

        country:
          recipient.address
            ?.country ||
          "India",
      },
    });
  };


  const updateEditingField = (
    field,
    value
  ) => {
    setEditingRecipient(
      (prev) => ({
        ...prev,
        [field]: value,
      })
    );
  };


  const updateAddressField = (
    field,
    value
  ) => {
    setEditingRecipient(
      (prev) => ({
        ...prev,

        address: {
          ...prev.address,
          [field]: value,
        },
      })
    );
  };


  const saveRecipient =
    async () => {
      if (!editingRecipient) {
        return;
      }

      try {
        setBusy(true);
        setError("");

        await api.patch(
          `/corporate/campaigns/${id}/recipients/${editingRecipient._id}`,
          {
            employeeId:
              editingRecipient.employeeId,

            name:
              editingRecipient.name,

            email:
              editingRecipient.email,

            phone:
              editingRecipient.phone,

            address:
              editingRecipient.address,

            giftMessage:
              editingRecipient.giftMessage,

            personalizationText:
              editingRecipient.personalizationText,

            dietaryPreference:
              editingRecipient.dietaryPreference,

            deliveryNotes:
              editingRecipient.deliveryNotes,
          }
        );

        setEditingRecipient(
          null
        );

        setSuccess(
          "Recipient updated."
        );

        await loadRecipients();
      } catch (error) {
        setError(
          error.response?.data
            ?.message ||
            "Unable to update recipient."
        );
      } finally {
        setBusy(false);
      }
    };


  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-wider text-[#F26522]">
            Recipient Data
          </p>

          <h1 className="mt-1 text-3xl font-bold text-slate-950">
            {campaign?.title ||
              "Campaign Recipients"}
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Upload and correct recipient
            delivery data before admin
            approval.
          </p>
        </div>

        <Link
          to={`/account/corporate/campaigns/${id}`}
          className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700"
        >
          ← Campaign
        </Link>
      </div>


      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          {success}
        </div>
      )}


      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <RecipientStat
          label="Total Rows"
          value={summary.total}
        />

        <RecipientStat
          label="Valid"
          value={summary.valid}
        />

        <RecipientStat
          label="Invalid"
          value={summary.invalid}
        />

        <RecipientStat
          label="Approved"
          value={summary.approved}
        />
      </div>


      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Import Spreadsheet
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Supported: CSV, XLS and XLSX.
              Required delivery fields are
              validated by the backend.
            </p>
          </div>

          <StatusBadge
            status={
              campaign?.recipientImportStatus
            }
          />
        </div>


        <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <input
              type="file"
              accept=".csv,.xls,.xlsx"
              onChange={(e) =>
                setFile(
                  e.target.files?.[0] ||
                    null
                )
              }
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-orange-50 file:px-3 file:py-2 file:font-semibold file:text-[#F26522]"
            />

            <label className="mt-3 flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={
                  replaceExisting
                }
                onChange={(e) =>
                  setReplaceExisting(
                    e.target.checked
                  )
                }
                className="accent-[#F26522]"
              />

              Replace existing recipient import
            </label>
          </div>

          <button
            onClick={
              importSpreadsheet
            }
            disabled={
              busy || !file
            }
            className="rounded-xl bg-[#F26522] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy
              ? "Importing..."
              : "Import Recipients"}
          </button>
        </div>


        <div className="mt-5 rounded-xl bg-slate-50 p-4 text-xs leading-6 text-slate-500">
          Recommended columns: Name,
          Phone, Email, Employee ID,
          Address, Address 2, City,
          State, Pincode, Country,
          Gift Message, Personalization,
          Dietary and Delivery Notes.
        </div>
      </section>


      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-bold text-slate-900">
            Recipient Rows
          </h2>

          <select
            value={status}
            onChange={(e) => {
              setStatus(
                e.target.value
              );

              setPage(1);
            }}
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-[#F26522]"
          >
            <option value="">
              All Statuses
            </option>

            <option value="valid">
              Valid
            </option>

            <option value="invalid">
              Invalid
            </option>

            <option value="approved">
              Approved
            </option>
          </select>
        </div>


        {loading ? (
          <div className="p-8 text-sm text-slate-500">
            Loading recipients...
          </div>
        ) : recipients.length ===
          0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            No recipient rows found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-slate-50">
                <tr>
                  <TableHeading>
                    Row
                  </TableHeading>

                  <TableHeading>
                    Recipient
                  </TableHeading>

                  <TableHeading>
                    Contact
                  </TableHeading>

                  <TableHeading>
                    Delivery
                  </TableHeading>

                  <TableHeading>
                    Status
                  </TableHeading>

                  <th className="px-5 py-4" />
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {recipients.map(
                  (recipient) => (
                    <tr
                      key={
                        recipient._id
                      }
                    >
                      <td className="px-5 py-4 text-sm text-slate-500">
                        {
                          recipient.rowNumber
                        }
                      </td>

                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-900">
                          {recipient.name ||
                            "—"}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          {recipient.employeeId ||
                            recipient.recipientId}
                        </p>
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-600">
                        <p>
                          {recipient.phone ||
                            "—"}
                        </p>

                        <p className="text-xs">
                          {recipient.email ||
                            ""}
                        </p>
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-600">
                        <p>
                          {recipient.address
                            ?.city ||
                            "—"}
                          {recipient.address
                            ?.state
                            ? `, ${recipient.address.state}`
                            : ""}
                        </p>

                        <p className="text-xs text-slate-400">
                          {recipient.address
                            ?.pincode ||
                            ""}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <StatusBadge
                          status={
                            recipient.status
                          }
                        />

                        {recipient
                          .validationErrors
                          ?.length >
                          0 && (
                          <div className="mt-2 max-w-xs text-xs text-red-600">
                            {recipient.validationErrors.join(
                              " • "
                            )}
                          </div>
                        )}
                      </td>

                      <td className="px-5 py-4 text-right">
                        {recipient.status !==
                          "approved" && (
                          <button
                            onClick={() =>
                              editRecipient(
                                recipient
                              )
                            }
                            className="text-sm font-semibold text-[#F26522]"
                          >
                            Edit
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}


        {pages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 p-4">
            <button
              disabled={page <= 1}
              onClick={() =>
                setPage((value) =>
                  Math.max(
                    1,
                    value - 1
                  )
                )
              }
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm disabled:opacity-40"
            >
              Previous
            </button>

            <span className="text-sm text-slate-500">
              Page {page} of {pages}
            </span>

            <button
              disabled={page >= pages}
              onClick={() =>
                setPage((value) =>
                  Math.min(
                    pages,
                    value + 1
                  )
                )
              }
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </section>


      {editingRecipient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Edit Recipient
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Row{" "}
                  {
                    editingRecipient.rowNumber
                  }
                </p>
              </div>

              <button
                onClick={() =>
                  setEditingRecipient(
                    null
                  )
                }
                className="text-xl text-slate-400"
              >
                ×
              </button>
            </div>


            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <EditInput
                label="Name"
                value={
                  editingRecipient.name ||
                  ""
                }
                onChange={(value) =>
                  updateEditingField(
                    "name",
                    value
                  )
                }
              />

              <EditInput
                label="Phone"
                value={
                  editingRecipient.phone ||
                  ""
                }
                onChange={(value) =>
                  updateEditingField(
                    "phone",
                    value
                  )
                }
              />

              <EditInput
                label="Email"
                type="email"
                value={
                  editingRecipient.email ||
                  ""
                }
                onChange={(value) =>
                  updateEditingField(
                    "email",
                    value
                  )
                }
              />

              <EditInput
                label="Employee ID"
                value={
                  editingRecipient.employeeId ||
                  ""
                }
                onChange={(value) =>
                  updateEditingField(
                    "employeeId",
                    value
                  )
                }
              />

              <EditInput
                label="Address"
                value={
                  editingRecipient.address
                    .addressLine1
                }
                onChange={(value) =>
                  updateAddressField(
                    "addressLine1",
                    value
                  )
                }
              />

              <EditInput
                label="Address 2"
                value={
                  editingRecipient.address
                    .addressLine2
                }
                onChange={(value) =>
                  updateAddressField(
                    "addressLine2",
                    value
                  )
                }
              />

              <EditInput
                label="City"
                value={
                  editingRecipient.address
                    .city
                }
                onChange={(value) =>
                  updateAddressField(
                    "city",
                    value
                  )
                }
              />

              <EditInput
                label="State"
                value={
                  editingRecipient.address
                    .state
                }
                onChange={(value) =>
                  updateAddressField(
                    "state",
                    value
                  )
                }
              />

              <EditInput
                label="Pincode"
                value={
                  editingRecipient.address
                    .pincode
                }
                onChange={(value) =>
                  updateAddressField(
                    "pincode",
                    value
                  )
                }
              />

              <EditInput
                label="Personalization"
                value={
                  editingRecipient.personalizationText ||
                  ""
                }
                onChange={(value) =>
                  updateEditingField(
                    "personalizationText",
                    value
                  )
                }
              />
            </div>


            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() =>
                  setEditingRecipient(
                    null
                  )
                }
                className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold"
              >
                Cancel
              </button>

              <button
                onClick={saveRecipient}
                disabled={busy}
                className="rounded-xl bg-[#F26522] px-5 py-2.5 text-sm font-semibold text-white"
              >
                Save Recipient
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


const RecipientStat = ({
  label,
  value,
}) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-5">
    <p className="text-xs font-semibold uppercase text-slate-400">
      {label}
    </p>

    <p className="mt-2 text-2xl font-bold text-slate-900">
      {value || 0}
    </p>
  </div>
);


const TableHeading = ({
  children,
}) => (
  <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
    {children}
  </th>
);


const EditInput = ({
  label,
  value,
  onChange,
  type = "text",
}) => (
  <label className="text-sm font-medium text-slate-700">
    {label}

    <input
      type={type}
      value={value}
      onChange={(e) =>
        onChange(e.target.value)
      }
      className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#F26522]"
    />
  </label>
);


export default Recipients;