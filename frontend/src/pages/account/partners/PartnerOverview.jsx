import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import api from "../../../api/api.js";


const emptyApplication = {
  businessName: "",
  legalName: "",
  partnerType: "event_planner",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  website: "",
  gstNumber: "",
  panNumber: "",
  city: "",
  state: "",
  pincode: "",
  about: "",
  experienceYears: "",
  portfolioUrl: "",
};


const PartnerOverview = () => {
  const [partner, setPartner] =
    useState(null);

  const [projects, setProjects] =
    useState([]);

  const [commissions, setCommissions] =
    useState([]);

  const [form, setForm] =
    useState(emptyApplication);

  const [memberForm, setMemberForm] =
    useState({
      email: "",
      role: "partner_user",
    });

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");


  const loadData = async () => {
    setLoading(true);
    setError("");

    try {
      const partnerResponse =
        await api.get("/partners/me");

      const currentPartner =
        partnerResponse.data.partner ||
        null;

      setPartner(currentPartner);

      if (currentPartner) {
        const [
          projectsResponse,
          commissionsResponse,
        ] = await Promise.all([
          api.get(
            "/partners/projects/mine"
          ),
          api.get(
            "/commissions/mine"
          ),
        ]);

        setProjects(
          projectsResponse.data.projects ||
            []
        );

        setCommissions(
          commissionsResponse.data
            .commissions || []
        );
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to load partner workspace."
      );
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    loadData();
  }, []);


  const updateField = (
    name,
    value
  ) => {
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };


  const submitApplication =
    async (event) => {
      event.preventDefault();

      setSaving(true);
      setError("");
      setMessage("");

      try {
        const response =
          await api.post(
            "/partners/apply",
            {
              businessName:
                form.businessName,

              legalName:
                form.legalName,

              partnerType:
                form.partnerType,

              contact: {
                name:
                  form.contactName,

                email:
                  form.contactEmail,

                phone:
                  form.contactPhone,
              },

              website:
                form.website,

              gstNumber:
                form.gstNumber,

              panNumber:
                form.panNumber,

              address: {
                city: form.city,
                state: form.state,
                pincode:
                  form.pincode,
                country: "India",
              },

              about:
                form.about,

              experienceYears:
                Number(
                  form.experienceYears ||
                    0
                ),

              portfolioUrl:
                form.portfolioUrl,
            }
          );

        setPartner(
          response.data.partner
        );

        setMessage(
          "Partner application submitted successfully."
        );
      } catch (err) {
        setError(
          err.response?.data?.message ||
            "Unable to submit application."
        );
      } finally {
        setSaving(false);
      }
    };


  const addMember =
    async (event) => {
      event.preventDefault();

      if (!memberForm.email.trim()) {
        return;
      }

      setSaving(true);
      setError("");
      setMessage("");

      try {
        await api.post(
          "/partners/members",
          memberForm
        );

        setMemberForm({
          email: "",
          role: "partner_user",
        });

        setMessage(
          "Partner member added."
        );

        await loadData();
      } catch (err) {
        setError(
          err.response?.data?.message ||
            "Unable to add member."
        );
      } finally {
        setSaving(false);
      }
    };


  const removeMember =
    async (userId) => {
      if (
        !window.confirm(
          "Remove this partner member?"
        )
      ) {
        return;
      }

      try {
        await api.delete(
          `/partners/members/${userId}`
        );

        await loadData();
      } catch (err) {
        setError(
          err.response?.data?.message ||
            "Unable to remove member."
        );
      }
    };


  if (loading) {
    return <LoadingState />;
  }


  if (!partner) {
    return (
      <div className="space-y-6">

        <PageHeader
          eyebrow="Event Partner"
          title="Become a HAMPORIUM Partner"
          description="Create private client gifting projects, secure showcases and earn attributed commission."
        />


        <Message
          error={error}
          message={message}
        />


        <form
          onSubmit={
            submitApplication
          }
          className="grid gap-6 rounded-[28px] border border-black/10 bg-white p-6 shadow-sm lg:grid-cols-2 lg:p-8"
        >

          <Input
            label="Business Name"
            value={
              form.businessName
            }
            onChange={(value) =>
              updateField(
                "businessName",
                value
              )
            }
            required
          />


          <Input
            label="Legal Name"
            value={
              form.legalName
            }
            onChange={(value) =>
              updateField(
                "legalName",
                value
              )
            }
          />


          <Select
            label="Partner Type"
            value={
              form.partnerType
            }
            onChange={(value) =>
              updateField(
                "partnerType",
                value
              )
            }
            options={[
              [
                "event_planner",
                "Event Planner",
              ],
              [
                "wedding_planner",
                "Wedding Planner",
              ],
              [
                "event_agency",
                "Event Agency",
              ],
              [
                "venue_partner",
                "Venue Partner",
              ],
              [
                "corporate_event_partner",
                "Corporate Event Partner",
              ],
              ["other", "Other"],
            ]}
          />


          <Input
            label="Experience Years"
            type="number"
            min="0"
            value={
              form.experienceYears
            }
            onChange={(value) =>
              updateField(
                "experienceYears",
                value
              )
            }
          />


          <Input
            label="Contact Name"
            value={
              form.contactName
            }
            onChange={(value) =>
              updateField(
                "contactName",
                value
              )
            }
            required
          />


          <Input
            label="Contact Email"
            type="email"
            value={
              form.contactEmail
            }
            onChange={(value) =>
              updateField(
                "contactEmail",
                value
              )
            }
            required
          />


          <Input
            label="Phone"
            value={
              form.contactPhone
            }
            onChange={(value) =>
              updateField(
                "contactPhone",
                value
              )
            }
          />


          <Input
            label="Website"
            value={
              form.website
            }
            onChange={(value) =>
              updateField(
                "website",
                value
              )
            }
          />


          <Input
            label="GST Number"
            value={
              form.gstNumber
            }
            onChange={(value) =>
              updateField(
                "gstNumber",
                value
              )
            }
          />


          <Input
            label="PAN Number"
            value={
              form.panNumber
            }
            onChange={(value) =>
              updateField(
                "panNumber",
                value
              )
            }
          />


          <Input
            label="City"
            value={
              form.city
            }
            onChange={(value) =>
              updateField(
                "city",
                value
              )
            }
          />


          <Input
            label="State"
            value={
              form.state
            }
            onChange={(value) =>
              updateField(
                "state",
                value
              )
            }
          />


          <Input
            label="Pincode"
            value={
              form.pincode
            }
            onChange={(value) =>
              updateField(
                "pincode",
                value
              )
            }
          />


          <Input
            label="Portfolio URL"
            value={
              form.portfolioUrl
            }
            onChange={(value) =>
              updateField(
                "portfolioUrl",
                value
              )
            }
          />


          <div className="lg:col-span-2">
            <label className="text-sm font-bold text-[#171717]">
              About Business
            </label>

            <textarea
              rows="5"
              value={form.about}
              onChange={(event) =>
                updateField(
                  "about",
                  event.target.value
                )
              }
              className="mt-2 w-full rounded-2xl border border-black/10 px-4 py-3 text-sm outline-none transition focus:border-[#F97316]"
            />
          </div>


          <div className="lg:col-span-2">
            <button
              disabled={saving}
              className="rounded-full bg-[#F97316] px-7 py-3.5 text-sm font-bold text-white transition hover:bg-[#171717] disabled:opacity-60"
            >
              {saving
                ? "Submitting..."
                : "Submit Partner Application"}
            </button>
          </div>

        </form>

      </div>
    );
  }


  const activeProjects =
    projects.filter(
      (project) =>
        ![
          "cancelled",
          "order_attributed",
        ].includes(
          project.status
        )
    ).length;


  const totalCommission =
    commissions.reduce(
      (sum, item) =>
        sum +
        Number(
          item.amount || 0
        ),
      0
    );


  return (
    <div className="space-y-7">

      <PageHeader
        eyebrow="Partner Workspace"
        title={
          partner.businessName
        }
        description={`Partner ID: ${partner.partnerId}`}
      />


      <Message
        error={error}
        message={message}
      />


      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">

        <Stat
          label="Partner Status"
          value={
            formatStatus(
              partner.status
            )
          }
        />

        <Stat
          label="Projects"
          value={projects.length}
        />

        <Stat
          label="Active Projects"
          value={activeProjects}
        />

        <Stat
          label="Attributed Commission"
          value={`₹${totalCommission.toLocaleString(
            "en-IN"
          )}`}
        />

      </div>


      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">

        <section className="rounded-[28px] border border-black/10 bg-white p-6">

          <div className="flex items-center justify-between">

            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#D4AF37]">
                Recent Projects
              </p>

              <h2 className="mt-2 text-2xl font-black text-[#171717]">
                Client gifting projects
              </h2>
            </div>


            <Link
              to="/account/partner/projects"
              className="text-sm font-bold text-[#F97316]"
            >
              View All →
            </Link>

          </div>


          <div className="mt-6 space-y-3">

            {projects
              .slice(0, 5)
              .map((project) => (
                <Link
                  key={project._id}
                  to={`/account/partner/projects/${project._id}`}
                  className="flex items-center justify-between rounded-2xl bg-[#FFF9F2] p-4 transition hover:-translate-y-0.5 hover:shadow-md"
                >

                  <div>
                    <p className="font-bold text-[#171717]">
                      {project.title}
                    </p>

                    <p className="mt-1 text-xs text-black/45">
                      {project.client?.name}
                    </p>
                  </div>


                  <StatusPill
                    value={
                      project.status
                    }
                  />

                </Link>
              ))}


            {!projects.length && (
              <Empty
                text="No partner projects yet."
              />
            )}

          </div>

        </section>


        <section className="rounded-[28px] bg-[#171717] p-6 text-white">

          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#D4AF37]">
            Quick Actions
          </p>


          <h2 className="mt-2 text-2xl font-black">
            Partner tools
          </h2>


          <div className="mt-6 space-y-3">

            <QuickLink
              to="/account/partner/projects"
              title="Create Client Project"
              text="Build and submit a new gifting project."
            />

            <QuickLink
              to="/account/partner/commissions"
              title="View Commission"
              text="Track attributed and payable earnings."
            />

          </div>

        </section>

      </div>


      <section className="rounded-[28px] border border-black/10 bg-white p-6">

        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#D4AF37]">
            Team
          </p>

          <h2 className="mt-2 text-2xl font-black">
            Partner members
          </h2>
        </div>


        <form
          onSubmit={addMember}
          className="mt-5 grid gap-3 md:grid-cols-[1fr_220px_auto]"
        >

          <input
            type="email"
            placeholder="Existing HAMPORIUM user email"
            value={
              memberForm.email
            }
            onChange={(event) =>
              setMemberForm(
                (prev) => ({
                  ...prev,
                  email:
                    event.target
                      .value,
                })
              )
            }
            className="rounded-xl border border-black/10 px-4 py-3 text-sm outline-none focus:border-[#F97316]"
          />


          <select
            value={
              memberForm.role
            }
            onChange={(event) =>
              setMemberForm(
                (prev) => ({
                  ...prev,
                  role:
                    event.target
                      .value,
                })
              )
            }
            className="rounded-xl border border-black/10 px-4 py-3 text-sm outline-none"
          >

            <option value="partner_user">
              Partner User
            </option>

            <option value="partner_admin">
              Partner Admin
            </option>

          </select>


          <button className="rounded-xl bg-[#F97316] px-5 py-3 text-sm font-bold text-white">
            Add Member
          </button>

        </form>


        <div className="mt-5 divide-y divide-black/5">

          {partner.members?.map(
            (member) => (
              <div
                key={
                  member.user?._id ||
                  member.user
                }
                className="flex items-center justify-between py-4"
              >

                <div>
                  <p className="font-bold">
                    {member.user
                      ?.name ||
                      "Partner Member"}
                  </p>

                  <p className="mt-1 text-xs text-black/40">
                    {formatStatus(
                      member.role
                    )}
                  </p>
                </div>


                {member.isActive &&
                  String(
                    member.user?._id ||
                      member.user
                  ) !==
                    String(
                      partner.owner?._id ||
                        partner.owner
                    ) && (
                    <button
                      onClick={() =>
                        removeMember(
                          member.user
                            ?._id ||
                            member.user
                        )
                      }
                      className="text-xs font-bold text-red-500"
                    >
                      Remove
                    </button>
                  )}

              </div>
            )
          )}

        </div>

      </section>

    </div>
  );
};


// ======================================================
// SMALL COMPONENTS
// ======================================================

const PageHeader = ({
  eyebrow,
  title,
  description,
}) => (
  <div>
    <p className="text-xs font-black uppercase tracking-[0.2em] text-[#F97316]">
      {eyebrow}
    </p>

    <h1 className="mt-2 text-3xl font-black text-[#171717] sm:text-4xl">
      {title}
    </h1>

    <p className="mt-2 max-w-2xl text-sm text-black/50">
      {description}
    </p>
  </div>
);


const Stat = ({
  label,
  value,
}) => (
  <div className="rounded-2xl border border-black/10 bg-white p-5">

    <p className="text-xs font-semibold text-black/45">
      {label}
    </p>

    <p className="mt-2 text-2xl font-black text-[#171717]">
      {value}
    </p>

  </div>
);


const StatusPill = ({
  value,
}) => (
  <span className="rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-[#8B6C10]">
    {formatStatus(value)}
  </span>
);


const QuickLink = ({
  to,
  title,
  text,
}) => (
  <Link
    to={to}
    className="group block rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-[#D4AF37]/50 hover:bg-white/10"
  >

    <div className="flex items-center justify-between">

      <p className="font-bold">
        {title}
      </p>

      <span className="text-[#F97316] transition group-hover:translate-x-1">
        →
      </span>

    </div>

    <p className="mt-1 text-xs leading-5 text-white/45">
      {text}
    </p>

  </Link>
);


const Input = ({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  ...props
}) => (
  <label>
    <span className="text-sm font-bold text-[#171717]">
      {label}
    </span>

    <input
      {...props}
      type={type}
      required={required}
      value={value}
      onChange={(event) =>
        onChange(
          event.target.value
        )
      }
      className="mt-2 w-full rounded-2xl border border-black/10 px-4 py-3 text-sm outline-none transition focus:border-[#F97316]"
    />
  </label>
);


const Select = ({
  label,
  value,
  onChange,
  options,
}) => (
  <label>
    <span className="text-sm font-bold">
      {label}
    </span>

    <select
      value={value}
      onChange={(event) =>
        onChange(
          event.target.value
        )
      }
      className="mt-2 w-full rounded-2xl border border-black/10 px-4 py-3 text-sm outline-none"
    >
      {options.map(
        ([value, label]) => (
          <option
            key={value}
            value={value}
          >
            {label}
          </option>
        )
      )}
    </select>
  </label>
);


const Message = ({
  error,
  message,
}) => (
  <>
    {error && (
      <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
        {error}
      </div>
    )}

    {message && (
      <div className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">
        {message}
      </div>
    )}
  </>
);


const Empty = ({ text }) => (
  <div className="rounded-2xl border border-dashed border-black/10 p-8 text-center text-sm text-black/40">
    {text}
  </div>
);


const LoadingState = () => (
  <div className="flex min-h-[320px] items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#F97316]/20 border-t-[#F97316]" />
  </div>
);


const formatStatus = (
  value = ""
) =>
  String(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) =>
      char.toUpperCase()
    );


export default PartnerOverview;