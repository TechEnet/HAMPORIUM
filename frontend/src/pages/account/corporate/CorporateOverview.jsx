import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { Link } from "react-router-dom";

import api from "../../../api/api.js";
import StatusBadge from "../../../components/StatusBadge.jsx";


const emptyOrganization = {
  name: "",
  legalName: "",
  gstNumber: "",
  panNumber: "",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
};


const CorporateOverview = () => {
  const [organizations, setOrganizations] =
    useState([]);

  const [campaigns, setCampaigns] =
    useState([]);

  const [
    selectedOrganizationId,
    setSelectedOrganizationId,
  ] = useState("");

  const [form, setForm] =
    useState(emptyOrganization);

  const [memberEmail, setMemberEmail] =
    useState("");

  const [memberRole, setMemberRole] =
    useState("viewer");

  const [loading, setLoading] =
    useState(true);

  const [busy, setBusy] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");


  const selectedOrganization =
    useMemo(
      () =>
        organizations.find(
          (item) =>
            item._id ===
            selectedOrganizationId
        ) || null,
      [
        organizations,
        selectedOrganizationId,
      ]
    );


  const fillOrganizationForm = (
    organization
  ) => {
    if (!organization) {
      setForm(emptyOrganization);
      return;
    }

    setForm({
      name:
        organization.name || "",

      legalName:
        organization.legalName || "",

      gstNumber:
        organization.gstNumber || "",

      panNumber:
        organization.panNumber || "",

      contactName:
        organization.primaryContact
          ?.name || "",

      contactEmail:
        organization.primaryContact
          ?.email || "",

      contactPhone:
        organization.primaryContact
          ?.phone || "",
    });
  };


  const loadData =
    useCallback(async () => {
      try {
        setLoading(true);
        setError("");

        const [
          organizationResponse,
          campaignResponse,
        ] = await Promise.all([
          api.get(
            "/corporate/organizations/mine"
          ),

          api.get(
            "/corporate/campaigns/mine"
          ),
        ]);


        const organizationList =
          organizationResponse.data
            .organizations || [];

        setOrganizations(
          organizationList
        );

        setCampaigns(
          campaignResponse.data
            .campaigns || []
        );


        setSelectedOrganizationId(
          (current) => {
            if (
              current &&
              organizationList.some(
                (item) =>
                  item._id === current
              )
            ) {
              return current;
            }

            return (
              organizationList[0]
                ?._id || ""
            );
          }
        );
      } catch (error) {
        setError(
          error.response?.data
            ?.message ||
            "Unable to load corporate workspace."
        );
      } finally {
        setLoading(false);
      }
    }, []);


  useEffect(() => {
    loadData();
  }, [loadData]);


  useEffect(() => {
    fillOrganizationForm(
      selectedOrganization
    );
  }, [selectedOrganization]);


  const updateField = (
    name,
    value
  ) => {
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };


  const saveOrganization =
    async (event) => {
      event.preventDefault();

      if (!form.name.trim()) {
        setError(
          "Organization name is required."
        );

        return;
      }

      try {
        setBusy(true);
        setError("");
        setSuccess("");

        const payload = {
          name: form.name.trim(),

          legalName:
            form.legalName.trim(),

          gstNumber:
            form.gstNumber.trim(),

          panNumber:
            form.panNumber.trim(),

          primaryContact: {
            name:
              form.contactName.trim(),

            email:
              form.contactEmail.trim(),

            phone:
              form.contactPhone.trim(),
          },
        };


        if (selectedOrganization) {
          await api.patch(
            `/corporate/organizations/${selectedOrganization._id}`,
            payload
          );

          setSuccess(
            "Organization updated successfully."
          );
        } else {
          const { data } =
            await api.post(
              "/corporate/organizations",
              payload
            );

          setSelectedOrganizationId(
            data.organization._id
          );

          setSuccess(
            "Organization created successfully."
          );
        }


        await loadData();
      } catch (error) {
        setError(
          error.response?.data
            ?.message ||
            "Unable to save organization."
        );
      } finally {
        setBusy(false);
      }
    };


  const addMember = async () => {
    if (
      !selectedOrganization ||
      !memberEmail.trim()
    ) {
      return;
    }

    try {
      setBusy(true);
      setError("");

      await api.post(
        `/corporate/organizations/${selectedOrganization._id}/members`,
        {
          email:
            memberEmail.trim(),

          role:
            memberRole,
        }
      );

      setMemberEmail("");
      setMemberRole("viewer");

      setSuccess(
        "Organization member added."
      );

      await loadData();
    } catch (error) {
      setError(
        error.response?.data
          ?.message ||
          "Unable to add member."
      );
    } finally {
      setBusy(false);
    }
  };


  const removeMember = async (
    userId
  ) => {
    if (!selectedOrganization) {
      return;
    }

    if (
      !window.confirm(
        "Remove this member from the organization?"
      )
    ) {
      return;
    }

    try {
      setBusy(true);

      await api.delete(
        `/corporate/organizations/${selectedOrganization._id}/members/${userId}`
      );

      setSuccess(
        "Organization member removed."
      );

      await loadData();
    } catch (error) {
      setError(
        error.response?.data
          ?.message ||
          "Unable to remove member."
      );
    } finally {
      setBusy(false);
    }
  };


  const stats = {
    campaigns:
      campaigns.length,

    active:
      campaigns.filter(
        (campaign) =>
          ![
            "cancelled",
            "ready_for_production",
          ].includes(
            campaign.workflowStatus
          )
      ).length,

    ready:
      campaigns.filter(
        (campaign) =>
          campaign.workflowStatus ===
          "ready_for_production"
      ).length,

    organizations:
      organizations.length,
  };


  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
        Loading corporate workspace...
      </div>
    );
  }


  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.15em] text-[#F26522]">
            HAMPORIUM Business
          </p>

          <h1 className="mt-1 text-3xl font-bold text-slate-950">
            Corporate Workspace
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Manage your organizations,
            gifting campaigns, quotations,
            proofs, commercial confirmation
            and recipients.
          </p>
        </div>

        <Link
          to="/account/corporate/campaigns?new=1"
          className="rounded-xl bg-[#F26522] px-5 py-3 text-center text-sm font-semibold text-white hover:bg-[#d95416]"
        >
          + New Campaign
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
        <StatCard
          label="Organizations"
          value={stats.organizations}
        />

        <StatCard
          label="Campaigns"
          value={stats.campaigns}
        />

        <StatCard
          label="Active"
          value={stats.active}
        />

        <StatCard
          label="Ready for Production"
          value={stats.ready}
        />
      </div>


      <div className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Organization
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Company identity used for
                corporate campaigns.
              </p>
            </div>

            {organizations.length >
              0 && (
              <button
                type="button"
                onClick={() => {
                  setSelectedOrganizationId(
                    ""
                  );

                  setForm(
                    emptyOrganization
                  );
                }}
                className="text-sm font-semibold text-[#F26522]"
              >
                + New Organization
              </button>
            )}
          </div>


          {organizations.length > 0 && (
            <select
              value={
                selectedOrganizationId
              }
              onChange={(e) =>
                setSelectedOrganizationId(
                  e.target.value
                )
              }
              className="mt-5 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#F26522]"
            >
              {organizations.map(
                (organization) => (
                  <option
                    key={
                      organization._id
                    }
                    value={
                      organization._id
                    }
                  >
                    {organization.name} —{" "}
                    {
                      organization.organizationId
                    }
                  </option>
                )
              )}
            </select>
          )}


          <form
            onSubmit={saveOrganization}
            className="mt-5 grid gap-4 md:grid-cols-2"
          >
            <Input
              label="Organization Name *"
              value={form.name}
              onChange={(value) =>
                updateField(
                  "name",
                  value
                )
              }
              required
            />

            <Input
              label="Legal Name"
              value={form.legalName}
              onChange={(value) =>
                updateField(
                  "legalName",
                  value
                )
              }
            />

            <Input
              label="GST Number"
              value={form.gstNumber}
              onChange={(value) =>
                updateField(
                  "gstNumber",
                  value
                )
              }
            />

            <Input
              label="PAN Number"
              value={form.panNumber}
              onChange={(value) =>
                updateField(
                  "panNumber",
                  value
                )
              }
            />

            <Input
              label="Primary Contact"
              value={form.contactName}
              onChange={(value) =>
                updateField(
                  "contactName",
                  value
                )
              }
            />

            <Input
              label="Contact Email"
              type="email"
              value={form.contactEmail}
              onChange={(value) =>
                updateField(
                  "contactEmail",
                  value
                )
              }
            />

            <Input
              label="Contact Phone"
              value={form.contactPhone}
              onChange={(value) =>
                updateField(
                  "contactPhone",
                  value
                )
              }
            />

            <div className="flex items-end">
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-xl bg-[#F26522] px-5 py-3 text-sm font-semibold text-white hover:bg-[#d95416] disabled:opacity-60"
              >
                {busy
                  ? "Saving..."
                  : selectedOrganization
                    ? "Update Organization"
                    : "Create Organization"}
              </button>
            </div>
          </form>
        </section>


        <section className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
          <h2 className="text-lg font-bold text-slate-900">
            Team Access
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Add existing HAMPORIUM users
            to this organization.
          </p>


          {!selectedOrganization ? (
            <div className="mt-5 rounded-xl bg-slate-50 p-5 text-sm text-slate-500">
              Create or select an organization first.
            </div>
          ) : (
            <>
              <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_180px]">
                <input
                  type="email"
                  value={memberEmail}
                  onChange={(e) =>
                    setMemberEmail(
                      e.target.value
                    )
                  }
                  placeholder="user@company.com"
                  className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#F26522]"
                />

                <select
                  value={memberRole}
                  onChange={(e) =>
                    setMemberRole(
                      e.target.value
                    )
                  }
                  className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#F26522]"
                >
                  <option value="corporate_admin">
                    Corporate Admin
                  </option>

                  <option value="requester">
                    Requester
                  </option>

                  <option value="approver">
                    Approver
                  </option>

                  <option value="procurement_finance">
                    Procurement / Finance
                  </option>

                  <option value="viewer">
                    Viewer
                  </option>
                </select>
              </div>

              <button
                type="button"
                onClick={addMember}
                disabled={
                  busy ||
                  !memberEmail.trim()
                }
                className="mt-3 rounded-xl border border-[#F26522] px-5 py-2.5 text-sm font-semibold text-[#F26522] hover:bg-orange-50 disabled:opacity-50"
              >
                Add Member
              </button>


              <div className="mt-6 divide-y divide-slate-100">
                {selectedOrganization
                  .members
                  ?.filter(
                    (member) =>
                      member.isActive
                  )
                  .map((member) => {
                    const user =
                      member.user;

                    const userId =
                      typeof user ===
                      "string"
                        ? user
                        : user?._id;

                    return (
                      <div
                        key={
                          member._id ||
                          userId
                        }
                        className="flex items-center justify-between gap-4 py-3"
                      >
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {typeof user ===
                            "object"
                              ? user?.name ||
                                user?.email
                              : "Member"}
                          </p>

                          <p className="mt-1 text-xs capitalize text-slate-500">
                            {member.role.replaceAll(
                              "_",
                              " "
                            )}
                          </p>
                        </div>

                        {member.role !==
                          "owner" && (
                          <button
                            type="button"
                            onClick={() =>
                              removeMember(
                                userId
                              )
                            }
                            className="text-xs font-semibold text-red-600"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    );
                  })}
              </div>
            </>
          )}
        </section>
      </div>


      <section className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Recent Campaigns
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Corporate and Diwali bulk
              programmes.
            </p>
          </div>

          <Link
            to="/account/corporate/campaigns"
            className="text-sm font-semibold text-[#F26522]"
          >
            View All →
          </Link>
        </div>


        {campaigns.length === 0 ? (
          <div className="mt-5 rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">
            No campaigns yet.
          </div>
        ) : (
          <div className="mt-5 divide-y divide-slate-100">
            {campaigns
              .slice(0, 5)
              .map((campaign) => (
                <Link
                  key={campaign._id}
                  to={`/account/corporate/campaigns/${campaign._id}`}
                  className="flex flex-col gap-3 py-4 hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-semibold text-slate-900">
                      {campaign.title}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      {campaign.campaignId} ·{" "}
                      {campaign.campaignType ===
                      "diwali_bulk"
                        ? "Diwali Bulk"
                        : "Corporate"}
                    </p>
                  </div>

                  <StatusBadge
                    status={
                      campaign.workflowStatus
                    }
                  />
                </Link>
              ))}
          </div>
        )}
      </section>


      <div className="grid gap-4 sm:grid-cols-3">
        <WorkspaceLink
          to="/account/corporate/rfqs"
          title="RFQs"
          text="Requirements and quotation workflow."
        />

        <WorkspaceLink
          to="/account/corporate/quotes"
          title="Quotations"
          text="Review quotation versions and actions."
        />

        <WorkspaceLink
          to="/account/corporate/campaigns"
          title="Campaigns"
          text="PO/payment and recipient workflow."
        />
      </div>
    </div>
  );
};


const Input = ({
  label,
  value,
  onChange,
  type = "text",
  ...props
}) => (
  <label className="text-sm font-medium text-slate-700">
    {label}

    <input
      {...props}
      type={type}
      value={value}
      onChange={(e) =>
        onChange(e.target.value)
      }
      className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#F26522] focus:ring-2 focus:ring-orange-100"
    />
  </label>
);


const StatCard = ({
  label,
  value,
}) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-5">
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
      {label}
    </p>

    <p className="mt-2 text-2xl font-bold text-slate-950">
      {value}
    </p>
  </div>
);


const WorkspaceLink = ({
  to,
  title,
  text,
}) => (
  <Link
    to={to}
    className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-orange-200 hover:shadow-sm"
  >
    <h3 className="font-bold text-slate-900">
      {title}
    </h3>

    <p className="mt-2 text-sm text-slate-500">
      {text}
    </p>

    <span className="mt-4 inline-block text-sm font-semibold text-[#F26522]">
      Open →
    </span>
  </Link>
);


export default CorporateOverview;