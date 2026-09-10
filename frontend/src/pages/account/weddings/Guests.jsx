import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import api from "../../../api/api.js";
import StatusBadge from "../../../components/StatusBadge.jsx";

const Guests = () => {
  const { id } = useParams();

  const [project, setProject] = useState(null);
  const [guests, setGuests] = useState([]);
  const [summary, setSummary] = useState({});
  const [file, setFile] = useState(null);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [editing, setEditing] = useState(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [projectResponse, guestResponse] = await Promise.all([
        api.get(`/weddings/projects/${id}`),
        api.get(`/weddings/projects/${id}/guests`, {
          params: { limit: 100 },
        }),
      ]);

      setProject(projectResponse.data.project);
      setGuests(guestResponse.data.guests || []);
      setSummary(guestResponse.data.summary || {});
    } catch (error) {
      setError(error.response?.data?.message || "Unable to load guests.");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const importGuests = async () => {
    if (!file) return;

    try {
      setBusy(true);
      setError("");

      let documentId = "";

      try {
        const documentData = new FormData();

        documentData.append("entityType", "wedding");
        documentData.append("entityId", id);
        documentData.append("documentType", "guest_file");
        documentData.append("title", "Wedding Guest Spreadsheet");
        documentData.append("file", file);

        const response = await api.post("/documents", documentData);
        documentId = response.data.document?._id || "";
      } catch {
        // Import remains valid even if original-file storage rejects CSV.
      }

      const data = new FormData();

      data.append("file", file);
      data.append("replaceExisting", String(replaceExisting));

      if (documentId) data.append("documentId", documentId);

      await api.post(`/weddings/projects/${id}/guests/import`, data);

      setFile(null);
      setReplaceExisting(false);

      await load();
    } catch (error) {
      setError(error.response?.data?.message || "Guest import failed.");
    } finally {
      setBusy(false);
    }
  };

  const saveGuest = async () => {
    try {
      setBusy(true);

      await api.patch(`/weddings/projects/${id}/guests/${editing._id}`, {
        familyName: editing.familyName,
        name: editing.name,
        phone: editing.phone,
        email: editing.email,
        hotelName: editing.hotelName,
        roomNumber: editing.roomNumber,
        dietaryPreference: editing.dietaryPreference,
        giftCategory: editing.giftCategory,
        personalizationText: editing.personalizationText,
        deliveryPoint: editing.deliveryPoint,
        deliveryWindow: editing.deliveryWindow,
      });

      setEditing(null);
      await load();
    } catch (error) {
      setError(error.response?.data?.message || "Unable to update guest.");
    } finally {
      setBusy(false);
    }
  };

  if (!project) {
    return <div className="rounded-2xl border bg-white p-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between gap-4">
        <div>
          <p className="font-bold text-[#F26522]">{project.weddingProjectId}</p>
          <h1 className="text-3xl font-bold">Guest & Hotel Data</h1>
        </div>

        <Link
          to={`/account/weddings/${id}`}
          className="h-fit rounded-xl border px-4 py-2 text-sm font-semibold"
        >
          ← Project
        </Link>
      </div>

      {error && <ErrorBox>{error}</ErrorBox>}

      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Total" value={summary.total || 0} />
        <Stat label="Valid" value={summary.valid || 0} />
        <Stat label="Invalid" value={summary.invalid || 0} />
        <Stat label="Approved" value={summary.approved || 0} />
      </div>

      <section className="rounded-2xl border bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">Import Guest Spreadsheet</h2>
          <StatusBadge status={project.guestImportStatus} />
        </div>

        <input
          type="file"
          accept=".csv,.xls,.xlsx"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="mt-4 w-full rounded-xl border p-3 text-sm"
        />

        <label className="mt-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={replaceExisting}
            onChange={(e) => setReplaceExisting(e.target.checked)}
            className="accent-[#F26522]"
          />
          Replace previous import
        </label>

        <button
          onClick={importGuests}
          disabled={!file || busy}
          className="mt-4 rounded-xl bg-[#F26522] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          Import Guests
        </button>

        <p className="mt-4 text-xs leading-6 text-slate-500">
          Columns: Family, Name, Phone, Email, Hotel, Room Number,
          Arrival Date, Arrival Time, Departure Date, Departure Time,
          Dietary Preference, Child, VIP, International Guest,
          Gift Category, Personalization, Delivery Point,
          Delivery Window and Notes.
        </p>
      </section>

      <section className="overflow-hidden rounded-2xl border bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50">
              <tr>
                <TH>Guest</TH>
                <TH>Hotel / Room</TH>
                <TH>Gift</TH>
                <TH>Status</TH>
                <th />
              </tr>
            </thead>

            <tbody className="divide-y">
              {guests.map((guest) => (
                <tr key={guest._id}>
                  <td className="px-4 py-4">
                    <p className="font-medium">{guest.name || "—"}</p>
                    <p className="text-xs text-slate-500">
                      {guest.familyName || ""}
                    </p>
                  </td>

                  <td className="px-4 py-4 text-sm">
                    {guest.hotelName || guest.deliveryPoint || "—"}
                    {guest.roomNumber ? ` · Room ${guest.roomNumber}` : ""}
                  </td>

                  <td className="px-4 py-4 text-sm">
                    {guest.giftCategory || "—"}
                  </td>

                  <td className="px-4 py-4">
                    <StatusBadge status={guest.status} />

                    {guest.validationErrors?.length > 0 && (
                      <p className="mt-2 max-w-xs text-xs text-red-600">
                        {guest.validationErrors.join(" • ")}
                      </p>
                    )}
                  </td>

                  <td className="px-4 py-4">
                    {guest.status !== "approved" && (
                      <button
                        onClick={() => setEditing({ ...guest })}
                        className="text-sm font-semibold text-[#F26522]"
                      >
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              ))}

              {guests.length === 0 && (
                <tr>
                  <td
                    colSpan="5"
                    className="p-10 text-center text-sm text-slate-500"
                  >
                    No guest data uploaded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-6">
            <div className="flex justify-between">
              <h2 className="text-xl font-bold">Edit Guest</h2>
              <button onClick={() => setEditing(null)}>✕</button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {[
                ["name", "Name"],
                ["familyName", "Family"],
                ["phone", "Phone"],
                ["email", "Email"],
                ["hotelName", "Hotel"],
                ["roomNumber", "Room"],
                ["dietaryPreference", "Dietary"],
                ["giftCategory", "Gift Category"],
                ["personalizationText", "Personalization"],
                ["deliveryPoint", "Delivery Point"],
                ["deliveryWindow", "Delivery Window"],
              ].map(([field, label]) => (
                <label key={field} className="text-sm">
                  {label}
                  <input
                    value={editing[field] || ""}
                    onChange={(e) =>
                      setEditing((p) => ({
                        ...p,
                        [field]: e.target.value,
                      }))
                    }
                    className="mt-2 w-full rounded-xl border px-4 py-3"
                  />
                </label>
              ))}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setEditing(null)}
                className="rounded-xl border px-5 py-2.5"
              >
                Cancel
              </button>

              <button
                onClick={saveGuest}
                disabled={busy}
                className="rounded-xl bg-[#F26522] px-5 py-2.5 font-semibold text-white"
              >
                Save Guest
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const TH = ({ children }) => (
  <th className="px-4 py-3 text-left text-xs uppercase text-slate-500">
    {children}
  </th>
);

const Stat = ({ label, value }) => (
  <div className="rounded-2xl border bg-white p-5">
    <p className="text-xs uppercase text-slate-400">{label}</p>
    <p className="mt-2 text-2xl font-bold">{value}</p>
  </div>
);

const ErrorBox = ({ children }) => (
  <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
    {children}
  </div>
);

export default Guests;