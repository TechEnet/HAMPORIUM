import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import api from "../../../api/api.js";
import StatusBadge from "../../../components/StatusBadge.jsx";

const WeddingProject = () => {
  const { id } = useParams();

  const [project, setProject] = useState(null);
  const [events, setEvents] = useState([]);
  const [quote, setQuote] = useState(null);
  const [approvals, setApprovals] = useState([]);

  const [eventForm, setEventForm] = useState({
    title: "",
    eventType: "other",
    eventDate: "",
    venueName: "",
    expectedGuests: "",
    giftQuantity: "",
  });

  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState("family");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/weddings/projects/${id}`);

      setProject(data.project);
      setEvents(data.events || []);
      setQuote(data.quote || null);
      setApprovals(data.approvals || []);
    } catch (error) {
      setError(error.response?.data?.message || "Unable to load project.");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const createEvent = async () => {
    if (!eventForm.title.trim()) return;

    try {
      setBusy(true);

      await api.post(`/weddings/projects/${id}/events`, {
        ...eventForm,
        expectedGuests: Number(eventForm.expectedGuests || 0),
        giftQuantity: Number(eventForm.giftQuantity || 0),
      });

      setEventForm({
        title: "",
        eventType: "other",
        eventDate: "",
        venueName: "",
        expectedGuests: "",
        giftQuantity: "",
      });

      await load();
    } catch (error) {
      setError(error.response?.data?.message || "Unable to add event.");
    } finally {
      setBusy(false);
    }
  };

  const deleteEvent = async (eventId) => {
    if (!window.confirm("Delete this wedding event?")) return;

    try {
      await api.delete(`/weddings/projects/${id}/events/${eventId}`);
      await load();
    } catch (error) {
      setError(error.response?.data?.message || "Unable to delete event.");
    }
  };

  const addMember = async () => {
    if (!memberEmail.trim()) return;

    try {
      setBusy(true);

      await api.post(`/weddings/projects/${id}/members`, {
        email: memberEmail.trim(),
        role: memberRole,
      });

      setMemberEmail("");
      await load();
    } catch (error) {
      setError(error.response?.data?.message || "Unable to add member.");
    } finally {
      setBusy(false);
    }
  };

  const sync = async () => {
    await api.post(`/weddings/projects/${id}/sync`);
    await load();
  };

  const submit = async () => {
    try {
      setBusy(true);
      await api.post(`/weddings/projects/${id}/submit`);
      await load();
    } catch (error) {
      setError(error.response?.data?.message || "Unable to submit brief.");
    } finally {
      setBusy(false);
    }
  };

  if (!project) {
    return (
      <div className="rounded-2xl border bg-white p-8">
        {error || "Loading wedding project..."}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:justify-between">
        <div>
          <p className="font-bold text-[#F26522]">
            {project.weddingProjectId}
          </p>

          <h1 className="mt-1 text-3xl font-bold">{project.projectTitle}</h1>

          <div className="mt-3">
            <StatusBadge status={project.status} />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {project.status === "draft" && (
            <>
              <Link
                to={`/account/weddings/${id}/edit`}
                className="rounded-xl border px-4 py-2 text-sm font-semibold"
              >
                Edit Brief
              </Link>

              <button
                onClick={submit}
                disabled={busy}
                className="rounded-xl bg-[#F26522] px-4 py-2 text-sm font-semibold text-white"
              >
                Submit Brief
              </button>
            </>
          )}

          <button
            onClick={sync}
            className="rounded-xl border border-[#F26522] px-4 py-2 text-sm font-semibold text-[#F26522]"
          >
            Sync Status
          </button>
        </div>
      </div>

      {error && <ErrorBox>{error}</ErrorBox>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Guests" value={project.estimatedGuestCount || 0} />
        <Stat label="Gift Quantity" value={project.totalGiftQuantity || 0} />
        <Stat
          label="Budget / Gift"
          value={`₹${Number(project.budgetPerGift || 0).toLocaleString(
            "en-IN"
          )}`}
        />
        <Stat label="Next Action" value={project.nextAction || "—"} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <WorkspaceLink
          to={`/account/weddings/${id}/concepts`}
          title="Concepts"
          subtitle={`${project.concepts?.length || 0} versions`}
        />

        <WorkspaceLink
          to={`/account/weddings/${id}/quotes`}
          title="Quotation"
          subtitle={quote ? quote.status : "Not available"}
        />

        <WorkspaceLink
          to={`/account/weddings/${id}/approvals`}
          title="Approvals"
          subtitle={`${approvals.length} records`}
        />

        <WorkspaceLink
          to={`/account/weddings/${id}/guests`}
          title="Guest Data"
          subtitle={project.guestImportStatus?.replaceAll("_", " ")}
        />
      </div>

      <section className="rounded-2xl border bg-white p-6">
        <h2 className="text-lg font-bold">Wedding Details</h2>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Info label="Couple" value={project.coupleName} />
          <Info label="Family" value={project.familyName} />
          <Info
            label="Dates"
            value={
              project.weddingStartDate
                ? `${new Date(
                    project.weddingStartDate
                  ).toLocaleDateString("en-IN")} - ${
                    project.weddingEndDate
                      ? new Date(project.weddingEndDate).toLocaleDateString(
                          "en-IN"
                        )
                      : ""
                  }`
                : "—"
            }
          />
          <Info
            label="Destination"
            value={[
              project.destination?.city,
              project.destination?.state,
              project.destination?.country,
            ]
              .filter(Boolean)
              .join(", ")}
          />
          <Info label="Venue" value={project.venueName} />
          <Info label="Hotel" value={project.hotelName} />
          <Info label="Theme" value={project.theme} />
          <Info label="Style" value={project.style} />
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-6">
        <h2 className="text-lg font-bold">Wedding Events</h2>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <input
            placeholder="Event title"
            value={eventForm.title}
            onChange={(e) =>
              setEventForm((p) => ({ ...p, title: e.target.value }))
            }
            className={inputClass}
          />

          <select
            value={eventForm.eventType}
            onChange={(e) =>
              setEventForm((p) => ({ ...p, eventType: e.target.value }))
            }
            className={inputClass}
          >
            {[
              "welcome",
              "room_hamper",
              "mehendi",
              "haldi",
              "sangeet",
              "wedding",
              "reception",
              "vip_family",
              "return_favour",
              "departure",
              "other",
            ].map((value) => (
              <option key={value} value={value}>
                {value.replaceAll("_", " ")}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={eventForm.eventDate}
            onChange={(e) =>
              setEventForm((p) => ({ ...p, eventDate: e.target.value }))
            }
            className={inputClass}
          />

          <input
            placeholder="Venue"
            value={eventForm.venueName}
            onChange={(e) =>
              setEventForm((p) => ({ ...p, venueName: e.target.value }))
            }
            className={inputClass}
          />

          <input
            type="number"
            placeholder="Expected guests"
            value={eventForm.expectedGuests}
            onChange={(e) =>
              setEventForm((p) => ({
                ...p,
                expectedGuests: e.target.value,
              }))
            }
            className={inputClass}
          />

          <button
            onClick={createEvent}
            disabled={busy || !eventForm.title.trim()}
            className="rounded-xl bg-[#F26522] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            Add Event
          </button>
        </div>

        <div className="mt-6 divide-y">
          {events.map((event) => (
            <div
              key={event._id}
              className="flex items-center justify-between gap-4 py-4"
            >
              <div>
                <p className="font-semibold">{event.title}</p>
                <p className="mt-1 text-xs capitalize text-slate-500">
                  {event.eventType.replaceAll("_", " ")}
                  {event.eventDate
                    ? ` · ${new Date(event.eventDate).toLocaleDateString(
                        "en-IN"
                      )}`
                    : ""}
                </p>
              </div>

              <button
                onClick={() => deleteEvent(event._id)}
                className="text-xs font-semibold text-red-600"
              >
                Delete
              </button>
            </div>
          ))}

          {events.length === 0 && (
            <p className="py-5 text-sm text-slate-500">No events added.</p>
          )}
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-6">
        <h2 className="text-lg font-bold">Project Access</h2>

        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_180px_auto]">
          <input
            type="email"
            placeholder="family@domain.com"
            value={memberEmail}
            onChange={(e) => setMemberEmail(e.target.value)}
            className={inputClass}
          />

          <select
            value={memberRole}
            onChange={(e) => setMemberRole(e.target.value)}
            className={inputClass}
          >
            <option value="family">Family</option>
            <option value="planner">Planner</option>
            <option value="finance">Finance</option>
            <option value="viewer">Viewer</option>
          </select>

          <button
            onClick={addMember}
            disabled={busy || !memberEmail}
            className="rounded-xl border border-[#F26522] px-4 text-sm font-semibold text-[#F26522]"
          >
            Add Member
          </button>
        </div>

        <div className="mt-5 divide-y">
          {project.members
            ?.filter((m) => m.isActive)
            .map((member) => (
              <div key={member._id} className="py-3">
                <p className="font-medium">
                  {member.user?.name || member.user?.email || "Member"}
                </p>
                <p className="text-xs capitalize text-slate-500">
                  {member.role}
                </p>
              </div>
            ))}
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-6">
        <h2 className="text-lg font-bold">Payment Milestones</h2>

        {project.paymentMilestones?.length ? (
          <div className="mt-4 divide-y">
            {project.paymentMilestones.map((milestone) => (
              <div
                key={milestone._id}
                className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-semibold">{milestone.title}</p>
                  <p className="text-xs text-slate-500">
                    ₹{Number(milestone.amount || 0).toLocaleString("en-IN")}
                  </p>
                </div>

                <StatusBadge status={milestone.status} />
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-500">
            No payment milestones yet.
          </p>
        )}
      </section>
    </div>
  );
};

const inputClass =
  "w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#F26522]";

const Stat = ({ label, value }) => (
  <div className="rounded-2xl border bg-white p-5">
    <p className="text-xs uppercase text-slate-400">{label}</p>
    <p className="mt-2 font-bold text-slate-900">{value}</p>
  </div>
);

const Info = ({ label, value }) => (
  <div className="border-b pb-3">
    <p className="text-xs uppercase text-slate-400">{label}</p>
    <p className="mt-1 text-sm font-medium">{value || "—"}</p>
  </div>
);

const WorkspaceLink = ({ to, title, subtitle }) => (
  <Link
    to={to}
    className="rounded-2xl border bg-white p-5 hover:border-orange-200"
  >
    <h3 className="font-bold">{title}</h3>
    <p className="mt-2 text-sm capitalize text-slate-500">{subtitle || "—"}</p>
    <span className="mt-4 inline-block text-sm font-semibold text-[#F26522]">
      Open →
    </span>
  </Link>
);

const ErrorBox = ({ children }) => (
  <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
    {children}
  </div>
);

export default WeddingProject;