import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";

import api from "../../../api/api.js";
import StatusBadge from "../../../components/StatusBadge.jsx";


const emptyCampaign = {
  organizationId: "",
  campaignType: "corporate",

  title: "",
  objective: "",
  occasion: "",
  recipientType: "",
  description: "",

  quantity: 1,
  budgetPerGift: "",
  totalBudget: "",

  deliveryCities: "",
  addressModel: "not_decided",
  requiredDeliveryDate: "",
  productInterest: "",

  contactName: "",
  contactEmail: "",
  contactPhone: "",

  brandingRequired: false,
  logoRequired: false,
  personalizationRequired: false,

  brandingMethod: "",
  brandingNotes: "",

  packagingRequirements: "",
  dietaryRequirements: "",
  personalizationRequirements: "",

  notes: "",
};


const Campaigns = () => {
  const { id } = useParams();

  if (id) {
    return (
      <CampaignDetail
        campaignId={id}
      />
    );
  }

  return <CampaignList />;
};


const CampaignList = () => {
  const navigate = useNavigate();

  const [
    searchParams,
    setSearchParams,
  ] = useSearchParams();

  const [organizations, setOrganizations] =
    useState([]);

  const [campaigns, setCampaigns] =
    useState([]);

  const [rfqs, setRfqs] =
    useState([]);

  const [form, setForm] =
    useState({
      ...emptyCampaign,
      campaignType:
        searchParams.get("type") ===
        "diwali_bulk"
          ? "diwali_bulk"
          : "corporate",
    });

  const [showForm, setShowForm] =
    useState(
      searchParams.get("new") === "1"
    );

  const [loading, setLoading] =
    useState(true);

  const [busy, setBusy] =
    useState(false);

  const [error, setError] =
    useState("");


  const loadData =
    useCallback(async () => {
      try {
        setLoading(true);
        setError("");

        const [
          organizationResponse,
          campaignResponse,
          rfqResponse,
        ] = await Promise.all([
          api.get(
            "/corporate/organizations/mine"
          ),

          api.get(
            "/corporate/campaigns/mine"
          ),

          api.get("/rfqs/mine"),
        ]);


        const organizationList =
          organizationResponse.data
            .organizations || [];

        const campaignList =
          campaignResponse.data
            .campaigns || [];


        setOrganizations(
          organizationList
        );

        setCampaigns(
          campaignList
        );

        setRfqs(
          rfqResponse.data.rfqs ||
            []
        );


        setForm((prev) => ({
          ...prev,

          organizationId:
            prev.organizationId ||
            organizationList[0]
              ?._id ||
            "",
        }));
      } catch (error) {
        setError(
          error.response?.data
            ?.message ||
            "Unable to load campaigns."
        );
      } finally {
        setLoading(false);
      }
    }, []);


  useEffect(() => {
    loadData();
  }, [loadData]);


  const update = (
    field,
    value
  ) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };


  const toArray = (value) =>
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);


  const createCampaign =
    async (event) => {
      event.preventDefault();

      try {
        setBusy(true);
        setError("");

        const { data } =
          await api.post(
            "/corporate/campaigns",
            {
              organizationId:
                form.organizationId,

              campaignType:
                form.campaignType,

              title:
                form.title,

              objective:
                form.objective,

              occasion:
                form.occasion,

              recipientType:
                form.recipientType,

              description:
                form.description,

              quantity:
                Number(
                  form.quantity
                ),

              budgetPerGift:
                Number(
                  form.budgetPerGift ||
                    0
                ),

              totalBudget:
                Number(
                  form.totalBudget ||
                    0
                ),

              currency:
                "INR",

              deliveryCities:
                toArray(
                  form.deliveryCities
                ),

              addressModel:
                form.addressModel,

              requiredDeliveryDate:
                form.requiredDeliveryDate ||
                null,

              productInterest:
                toArray(
                  form.productInterest
                ),

              contact: {
                name:
                  form.contactName,

                email:
                  form.contactEmail,

                phone:
                  form.contactPhone,
              },

              branding: {
                required:
                  form.brandingRequired,

                logoRequired:
                  form.logoRequired,

                personalizationRequired:
                  form.personalizationRequired,

                method:
                  form.brandingMethod,

                notes:
                  form.brandingNotes,
              },

              packagingRequirements:
                form.packagingRequirements,

              dietaryRequirements:
                toArray(
                  form.dietaryRequirements
                ),

              personalizationRequirements:
                form.personalizationRequirements,

              notes:
                form.notes,
            }
          );


        navigate(
          `/account/corporate/campaigns/${data.campaign._id}`
        );
      } catch (error) {
        setError(
          error.response?.data
            ?.message ||
            "Unable to create campaign."
        );
      } finally {
        setBusy(false);
      }
    };


  const convertRFQ =
    async (rfqId) => {
      try {
        setBusy(true);
        setError("");

        const { data } =
          await api.post(
            `/corporate/campaigns/from-rfq/${rfqId}`
          );

        navigate(
          `/account/corporate/campaigns/${data.campaign._id}`
        );
      } catch (error) {
        setError(
          error.response?.data
            ?.message ||
            "Unable to create campaign from RFQ."
        );
      } finally {
        setBusy(false);
      }
    };


  const linkedRFQIds =
    new Set(
      campaigns
        .map((campaign) => {
          if (
            typeof campaign.rfq ===
            "string"
          ) {
            return campaign.rfq;
          }

          return campaign.rfq?._id;
        })
        .filter(Boolean)
    );


  const convertibleRFQs =
    rfqs.filter(
      (rfq) =>
        [
          "corporate",
          "diwali_bulk",
        ].includes(
          rfq.sourceType
        ) &&
        !linkedRFQIds.has(
          rfq._id
        )
    );


  const openCreate = () => {
    setShowForm(true);

    setSearchParams({
      new: "1",
      type:
        form.campaignType,
    });
  };


  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
        Loading campaigns...
      </div>
    );
  }


  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-wider text-[#F26522]">
            Corporate Workspace
          </p>

          <h1 className="mt-1 text-3xl font-bold text-slate-950">
            Campaigns
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Corporate and Diwali bulk
            campaigns from requirement
            through production handoff.
          </p>
        </div>

        <button
          onClick={openCreate}
          className="rounded-xl bg-[#F26522] px-5 py-3 text-sm font-semibold text-white hover:bg-[#d95416]"
        >
          + New Campaign
        </button>
      </div>


      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}


      {showForm && (
        <section className="rounded-2xl border border-orange-200 bg-white p-5 md:p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Create Campaign
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                The campaign will create
                and reuse the shared RFQ
                workflow after submission.
              </p>
            </div>

            <button
              onClick={() => {
                setShowForm(false);
                setSearchParams({});
              }}
              className="text-sm font-semibold text-slate-500"
            >
              Close
            </button>
          </div>


          {organizations.length === 0 ? (
            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
              Create an organization first from{" "}
              <Link
                to="/account/corporate"
                className="font-bold underline"
              >
                Corporate Overview
              </Link>
              .
            </div>
          ) : (
            <form
              onSubmit={
                createCampaign
              }
              className="mt-6 space-y-6"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Organization">
                  <select
                    value={
                      form.organizationId
                    }
                    onChange={(e) =>
                      update(
                        "organizationId",
                        e.target.value
                      )
                    }
                    className={inputClass}
                    required
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
                          {
                            organization.name
                          }
                        </option>
                      )
                    )}
                  </select>
                </Field>


                <Field label="Campaign Type">
                  <select
                    value={
                      form.campaignType
                    }
                    onChange={(e) =>
                      update(
                        "campaignType",
                        e.target.value
                      )
                    }
                    className={inputClass}
                  >
                    <option value="corporate">
                      Corporate
                    </option>

                    <option value="diwali_bulk">
                      Diwali Bulk
                    </option>
                  </select>
                </Field>


                <FormInput
                  label="Campaign Title *"
                  value={form.title}
                  required
                  onChange={(value) =>
                    update(
                      "title",
                      value
                    )
                  }
                />

                <FormInput
                  label="Objective"
                  value={
                    form.objective
                  }
                  onChange={(value) =>
                    update(
                      "objective",
                      value
                    )
                  }
                />

                <FormInput
                  label="Occasion"
                  value={
                    form.occasion
                  }
                  onChange={(value) =>
                    update(
                      "occasion",
                      value
                    )
                  }
                />

                <FormInput
                  label="Recipient Type"
                  value={
                    form.recipientType
                  }
                  onChange={(value) =>
                    update(
                      "recipientType",
                      value
                    )
                  }
                />

                <FormInput
                  label="Quantity *"
                  type="number"
                  min="1"
                  required
                  value={
                    form.quantity
                  }
                  onChange={(value) =>
                    update(
                      "quantity",
                      value
                    )
                  }
                />

                <FormInput
                  label="Budget Per Gift"
                  type="number"
                  min="0"
                  value={
                    form.budgetPerGift
                  }
                  onChange={(value) =>
                    update(
                      "budgetPerGift",
                      value
                    )
                  }
                />

                <FormInput
                  label="Total Budget"
                  type="number"
                  min="0"
                  value={
                    form.totalBudget
                  }
                  onChange={(value) =>
                    update(
                      "totalBudget",
                      value
                    )
                  }
                />

                <FormInput
                  label="Required Delivery Date"
                  type="date"
                  value={
                    form.requiredDeliveryDate
                  }
                  onChange={(value) =>
                    update(
                      "requiredDeliveryDate",
                      value
                    )
                  }
                />

                <FormInput
                  label="Delivery Cities"
                  value={
                    form.deliveryCities
                  }
                  placeholder="Delhi, Noida, Mumbai"
                  onChange={(value) =>
                    update(
                      "deliveryCities",
                      value
                    )
                  }
                />


                <Field label="Address Model">
                  <select
                    className={inputClass}
                    value={
                      form.addressModel
                    }
                    onChange={(e) =>
                      update(
                        "addressModel",
                        e.target.value
                      )
                    }
                  >
                    <option value="not_decided">
                      Not Decided
                    </option>

                    <option value="single_address">
                      Single Address
                    </option>

                    <option value="multiple_addresses">
                      Multiple Addresses
                    </option>
                  </select>
                </Field>


                <FormInput
                  label="Product Interest"
                  value={
                    form.productInterest
                  }
                  placeholder="Hampers, wellness, gourmet"
                  onChange={(value) =>
                    update(
                      "productInterest",
                      value
                    )
                  }
                />


                <div className="md:col-span-2">
                  <Field label="Requirement Description">
                    <textarea
                      rows="4"
                      value={
                        form.description
                      }
                      onChange={(e) =>
                        update(
                          "description",
                          e.target.value
                        )
                      }
                      className={inputClass}
                    />
                  </Field>
                </div>
              </div>


              <div>
                <h3 className="font-bold text-slate-900">
                  Contact
                </h3>

                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <FormInput
                    label="Contact Name"
                    value={
                      form.contactName
                    }
                    onChange={(value) =>
                      update(
                        "contactName",
                        value
                      )
                    }
                  />

                  <FormInput
                    label="Contact Email"
                    type="email"
                    value={
                      form.contactEmail
                    }
                    onChange={(value) =>
                      update(
                        "contactEmail",
                        value
                      )
                    }
                  />

                  <FormInput
                    label="Contact Phone"
                    value={
                      form.contactPhone
                    }
                    onChange={(value) =>
                      update(
                        "contactPhone",
                        value
                      )
                    }
                  />
                </div>
              </div>


              <div>
                <h3 className="font-bold text-slate-900">
                  Branding
                </h3>

                <div className="mt-4 flex flex-wrap gap-3">
                  <Checkbox
                    label="Branding Required"
                    checked={
                      form.brandingRequired
                    }
                    onChange={(value) =>
                      update(
                        "brandingRequired",
                        value
                      )
                    }
                  />

                  <Checkbox
                    label="Logo Required"
                    checked={
                      form.logoRequired
                    }
                    onChange={(value) =>
                      update(
                        "logoRequired",
                        value
                      )
                    }
                  />

                  <Checkbox
                    label="Personalization Required"
                    checked={
                      form.personalizationRequired
                    }
                    onChange={(value) =>
                      update(
                        "personalizationRequired",
                        value
                      )
                    }
                  />
                </div>


                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <FormInput
                    label="Branding Method"
                    value={
                      form.brandingMethod
                    }
                    onChange={(value) =>
                      update(
                        "brandingMethod",
                        value
                      )
                    }
                  />

                  <FormInput
                    label="Dietary Requirements"
                    value={
                      form.dietaryRequirements
                    }
                    placeholder="Vegetarian, vegan"
                    onChange={(value) =>
                      update(
                        "dietaryRequirements",
                        value
                      )
                    }
                  />

                  <FormInput
                    label="Packaging Requirements"
                    value={
                      form.packagingRequirements
                    }
                    onChange={(value) =>
                      update(
                        "packagingRequirements",
                        value
                      )
                    }
                  />

                  <FormInput
                    label="Personalization Requirements"
                    value={
                      form.personalizationRequirements
                    }
                    onChange={(value) =>
                      update(
                        "personalizationRequirements",
                        value
                      )
                    }
                  />
                </div>
              </div>


              <div className="flex justify-end">
                <button
                  disabled={busy}
                  type="submit"
                  className="rounded-xl bg-[#F26522] px-6 py-3 text-sm font-semibold text-white hover:bg-[#d95416] disabled:opacity-60"
                >
                  {busy
                    ? "Creating..."
                    : "Create Campaign"}
                </button>
              </div>
            </form>
          )}
        </section>
      )}


      {convertibleRFQs.length >
        0 && (
        <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
          <h2 className="font-bold text-blue-950">
            Existing RFQs
          </h2>

          <p className="mt-1 text-sm text-blue-700">
            Convert an existing Phase 5
            Corporate/Diwali RFQ into a
            Phase 6 campaign without
            creating another RFQ.
          </p>

          <div className="mt-4 space-y-3">
            {convertibleRFQs.map(
              (rfq) => (
                <div
                  key={rfq._id}
                  className="flex flex-col gap-3 rounded-xl bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-semibold text-slate-900">
                      {rfq.title}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      {rfq.rfqId} ·{" "}
                      {rfq.quantity} gifts
                    </p>
                  </div>

                  <button
                    disabled={busy}
                    onClick={() =>
                      convertRFQ(
                        rfq._id
                      )
                    }
                    className="rounded-lg border border-blue-300 px-4 py-2 text-sm font-semibold text-blue-700"
                  >
                    Create Campaign
                  </button>
                </div>
              )
            )}
          </div>
        </section>
      )}


      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 p-5">
          <h2 className="text-lg font-bold text-slate-900">
            All Campaigns
          </h2>
        </div>

        {campaigns.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            No campaigns found.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {campaigns.map(
              (campaign) => (
                <Link
                  key={campaign._id}
                  to={`/account/corporate/campaigns/${campaign._id}`}
                  className="grid gap-4 p-5 hover:bg-slate-50 md:grid-cols-[1.5fr_1fr_1fr_auto] md:items-center"
                >
                  <div>
                    <p className="font-bold text-slate-900">
                      {campaign.title}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      {campaign.campaignId}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs uppercase text-slate-400">
                      Type
                    </p>

                    <p className="mt-1 text-sm font-medium text-slate-700">
                      {campaign.campaignType ===
                      "diwali_bulk"
                        ? "Diwali Bulk"
                        : "Corporate"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs uppercase text-slate-400">
                      Quantity
                    </p>

                    <p className="mt-1 font-semibold text-slate-900">
                      {campaign.quantity}
                    </p>
                  </div>

                  <StatusBadge
                    status={
                      campaign.workflowStatus
                    }
                  />
                </Link>
              )
            )}
          </div>
        )}
      </section>
    </div>
  );
};


const CampaignDetail = ({
  campaignId,
}) => {
  const navigate = useNavigate();

  const [campaign, setCampaign] =
    useState(null);

  const [quote, setQuote] =
    useState(null);

  const [approvals, setApprovals] =
    useState([]);

  const [documents, setDocuments] =
    useState([]);

  const [commercialRoute, setCommercialRoute] =
    useState("");

  const [poFile, setPOFile] =
    useState(null);

  const [poReference, setPOReference] =
    useState("");

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
      try {
        setLoading(true);
        setError("");

        const { data } =
          await api.get(
            `/corporate/campaigns/${campaignId}`
          );

        setCampaign(
          data.campaign
        );

        setQuote(
          data.quote || null
        );

        setApprovals(
          data.approvals || []
        );

        setDocuments(
          data.documents || []
        );

        setCommercialRoute(
          data.campaign
            ?.commercialRoute ===
            "undecided"
            ? ""
            : data.campaign
                ?.commercialRoute ||
              ""
        );
      } catch (error) {
        setError(
          error.response?.data
            ?.message ||
            "Unable to load campaign."
        );
      } finally {
        setLoading(false);
      }
    }, [campaignId]);


  useEffect(() => {
    loadCampaign();
  }, [loadCampaign]);


  const rfqId =
    useMemo(() => {
      if (!campaign?.rfq) {
        return "";
      }

      return typeof campaign.rfq ===
        "string"
        ? campaign.rfq
        : campaign.rfq._id;
    }, [campaign]);


  const submitRFQ =
    async () => {
      try {
        setBusy(true);
        setError("");

        await api.post(
          `/corporate/campaigns/${campaignId}/submit-rfq`
        );

        setSuccess(
          "Campaign RFQ submitted successfully."
        );

        await loadCampaign();
      } catch (error) {
        setError(
          error.response?.data
            ?.message ||
            "Unable to submit campaign RFQ."
        );
      } finally {
        setBusy(false);
      }
    };


  const syncCampaign =
    async () => {
      try {
        setBusy(true);

        await api.post(
          `/corporate/campaigns/${campaignId}/sync`
        );

        setSuccess(
          "Campaign status synchronized."
        );

        await loadCampaign();
      } catch (error) {
        setError(
          error.response?.data
            ?.message ||
            "Unable to sync campaign."
        );
      } finally {
        setBusy(false);
      }
    };


  const chooseCommercialRoute =
    async () => {
      if (!commercialRoute) {
        return;
      }

      try {
        setBusy(true);
        setError("");

        await api.post(
          `/corporate/campaigns/${campaignId}/commercial-route`,
          {
            route:
              commercialRoute,
          }
        );

        setSuccess(
          commercialRoute === "po"
            ? "PO route selected."
            : "Payment route selected."
        );

        await loadCampaign();
      } catch (error) {
        setError(
          error.response?.data
            ?.message ||
            "Unable to select commercial route."
        );
      } finally {
        setBusy(false);
      }
    };


  const uploadPO = async () => {
    if (!poFile || !rfqId) {
      setError(
        "Select a PO file first."
      );

      return;
    }

    try {
      setBusy(true);
      setError("");

      const fileData =
        new FormData();

      fileData.append(
        "entityType",
        "rfq"
      );

      fileData.append(
        "entityId",
        rfqId
      );

      fileData.append(
        "documentType",
        "po"
      );

      fileData.append(
        "title",
        "Purchase Order"
      );

      fileData.append(
        "file",
        poFile
      );


      const documentResponse =
        await api.post(
          "/documents",
          fileData
        );


      const document =
        documentResponse.data
          .document;


      if (!document?._id) {
        throw new Error(
          "PO document upload did not return a document ID."
        );
      }


      await api.post(
        `/corporate/campaigns/${campaignId}/po`,
        {
          documentId:
            document._id,

          referenceNumber:
            poReference,

          note:
            "Purchase order submitted by customer.",
        }
      );


      setPOFile(null);
      setPOReference("");

      setSuccess(
        "Purchase order submitted for verification."
      );

      await loadCampaign();
    } catch (error) {
      setError(
        error.response?.data
          ?.message ||
          error.message ||
          "Unable to upload PO."
      );
    } finally {
      setBusy(false);
    }
  };


  const cancelCampaign =
    async () => {
      const reason =
        window.prompt(
          "Reason for cancelling this campaign"
        );

      if (reason === null) {
        return;
      }

      if (
        !window.confirm(
          "Cancel this campaign?"
        )
      ) {
        return;
      }

      try {
        setBusy(true);

        await api.post(
          `/corporate/campaigns/${campaignId}/cancel`,
          {
            reason,
          }
        );

        setSuccess(
          "Campaign cancelled."
        );

        await loadCampaign();
      } catch (error) {
        setError(
          error.response?.data
            ?.message ||
            "Unable to cancel campaign."
        );
      } finally {
        setBusy(false);
      }
    };


  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
        Loading campaign...
      </div>
    );
  }


  if (!campaign) {
    return null;
  }


  const canChooseCommercial =
    campaign.workflowStatus ===
      "approved" ||
    [
      "commercial_pending",
      "po_pending",
      "payment_pending",
      "commercial_confirmed",
      "recipients_pending",
      "recipients_review",
      "recipients_ready",
      "ready_for_production",
    ].includes(
      campaign.workflowStatus
    );


  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-wider text-[#F26522]">
            {campaign.campaignId}
          </p>

          <h1 className="mt-1 text-3xl font-bold text-slate-950">
            {campaign.title}
          </h1>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <StatusBadge
              status={
                campaign.workflowStatus
              }
            />

            <span className="text-sm text-slate-500">
              {campaign.campaignType ===
              "diwali_bulk"
                ? "Diwali Bulk"
                : "Corporate"}
            </span>
          </div>
        </div>


        <div className="flex flex-wrap gap-2">
          <button
            onClick={syncCampaign}
            disabled={busy}
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700"
          >
            Sync Status
          </button>

          <button
            onClick={() =>
              navigate(
                "/account/corporate/campaigns"
              )
            }
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700"
          >
            ← Campaigns
          </button>
        </div>
      </div>


      {error && (
        <Alert type="error">
          {error}
        </Alert>
      )}

      {success && (
        <Alert type="success">
          {success}
        </Alert>
      )}


      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Summary
          label="Quantity"
          value={
            campaign.quantity
          }
        />

        <Summary
          label="Budget / Gift"
          value={`₹${Number(
            campaign.budgetPerGift ||
              0
          ).toLocaleString(
            "en-IN"
          )}`}
        />

        <Summary
          label="Delivery"
          value={
            campaign.requiredDeliveryDate
              ? new Date(
                  campaign.requiredDeliveryDate
                ).toLocaleDateString(
                  "en-IN"
                )
              : "—"
          }
        />

        <Summary
          label="Next Action"
          value={
            campaign.nextAction ||
            "—"
          }
        />
      </div>


      {!campaign.rfq && (
        <section className="rounded-2xl border border-orange-200 bg-orange-50 p-5">
          <h2 className="font-bold text-orange-950">
            Campaign Draft
          </h2>

          <p className="mt-2 text-sm text-orange-800">
            Submit this campaign to
            create its shared Corporate
            RFQ.
          </p>

          <button
            onClick={submitRFQ}
            disabled={busy}
            className="mt-4 rounded-xl bg-[#F26522] px-5 py-3 text-sm font-semibold text-white"
          >
            Submit RFQ
          </button>
        </section>
      )}


      {campaign.rfq && (
        <div className="grid gap-5 lg:grid-cols-3">
          <LinkCard
            title="RFQ"
            value={
              campaign.rfq.rfqId ||
              "Open Requirement"
            }
            to={`/account/corporate/rfqs/${rfqId}`}
          />

          {quote ? (
            <LinkCard
              title="Quotation"
              value={`${quote.quoteId} · V${quote.currentVersionNumber}`}
              to={`/account/corporate/quotes/${quote._id}`}
            />
          ) : (
            <SimpleCard
              title="Quotation"
              value="Awaiting HAMPORIUM quotation"
            />
          )}

          <SimpleCard
            title="Approvals"
            value={`${approvals.length} approval record(s)`}
          />
        </div>
      )}


      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-bold text-slate-900">
          Campaign Requirement
        </h2>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Detail
            label="Organization"
            value={
              campaign.organization
                ?.name
            }
          />

          <Detail
            label="Objective"
            value={
              campaign.objective
            }
          />

          <Detail
            label="Occasion"
            value={
              campaign.occasion
            }
          />

          <Detail
            label="Recipients"
            value={
              campaign.recipientType
            }
          />

          <Detail
            label="Delivery Cities"
            value={
              campaign.deliveryCities
                ?.join(", ")
            }
          />

          <Detail
            label="Products"
            value={
              campaign.productInterest
                ?.join(", ")
            }
          />

          <Detail
            label="Packaging"
            value={
              campaign.packagingRequirements
            }
          />

          <Detail
            label="Personalization"
            value={
              campaign.personalizationRequirements
            }
          />
        </div>
      </section>


      {canChooseCommercial && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-bold text-slate-900">
            PO / Payment
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Choose the commercial
            confirmation route after
            proof approval.
          </p>


          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm font-semibold text-slate-900">
                Commercial Route
              </p>

              <div className="mt-3 flex gap-3">
                <label className="flex flex-1 cursor-pointer items-center gap-3 rounded-xl bg-slate-50 p-4">
                  <input
                    type="radio"
                    name="commercialRoute"
                    value="po"
                    checked={
                      commercialRoute ===
                      "po"
                    }
                    onChange={(e) =>
                      setCommercialRoute(
                        e.target.value
                      )
                    }
                    className="accent-[#F26522]"
                  />

                  <span className="text-sm font-medium">
                    Purchase Order
                  </span>
                </label>

                <label className="flex flex-1 cursor-pointer items-center gap-3 rounded-xl bg-slate-50 p-4">
                  <input
                    type="radio"
                    name="commercialRoute"
                    value="payment"
                    checked={
                      commercialRoute ===
                      "payment"
                    }
                    onChange={(e) =>
                      setCommercialRoute(
                        e.target.value
                      )
                    }
                    className="accent-[#F26522]"
                  />

                  <span className="text-sm font-medium">
                    Payment
                  </span>
                </label>
              </div>

              <button
                onClick={
                  chooseCommercialRoute
                }
                disabled={
                  busy ||
                  !commercialRoute
                }
                className="mt-4 rounded-xl bg-[#F26522] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                Save Commercial Route
              </button>
            </div>


            <div className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-900">
                  Current Status
                </span>

                <StatusBadge
                  status={
                    campaign.commercialRoute ===
                    "po"
                      ? campaign.po
                          ?.status
                      : campaign.paymentInfo
                          ?.status
                  }
                />
              </div>

              <p className="mt-3 text-sm text-slate-500">
                {campaign.commercialRoute ===
                "po"
                  ? "Upload your purchase order for HAMPORIUM verification."
                  : campaign.commercialRoute ===
                      "payment"
                    ? "Payment status will use the shared HAMPORIUM payment record."
                    : "Select PO or payment to continue."}
              </p>
            </div>
          </div>


          {campaign.commercialRoute ===
            "po" && (
            <div className="mt-5 rounded-xl bg-slate-50 p-5">
              <h3 className="font-semibold text-slate-900">
                Upload Purchase Order
              </h3>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <input
                  value={
                    poReference
                  }
                  onChange={(e) =>
                    setPOReference(
                      e.target.value
                    )
                  }
                  placeholder="PO reference number"
                  className={inputClass}
                />

                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                  onChange={(e) =>
                    setPOFile(
                      e.target.files?.[0] ||
                        null
                    )
                  }
                  className={inputClass}
                />
              </div>

              <button
                onClick={uploadPO}
                disabled={
                  busy || !poFile
                }
                className="mt-4 rounded-xl bg-[#F26522] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                Submit Purchase Order
              </button>
            </div>
          )}
        </section>
      )}


      {campaign.recipientSummary && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Recipients
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Validated spreadsheet
                recipient intake.
              </p>
            </div>

            <Link
              to={`/account/corporate/campaigns/${campaignId}/recipients`}
              className="rounded-xl bg-[#F26522] px-5 py-2.5 text-center text-sm font-semibold text-white"
            >
              Manage Recipients
            </Link>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-4">
            <SmallStat
              label="Total"
              value={
                campaign.recipientSummary
                  .total || 0
              }
            />

            <SmallStat
              label="Valid"
              value={
                campaign.recipientSummary
                  .valid || 0
              }
            />

            <SmallStat
              label="Invalid"
              value={
                campaign.recipientSummary
                  .invalid || 0
              }
            />

            <SmallStat
              label="Approved"
              value={
                campaign.recipientSummary
                  .approved || 0
              }
            />
          </div>
        </section>
      )}


      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-bold text-slate-900">
          Documents
        </h2>

        {documents.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            No campaign documents.
          </p>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {documents.map(
              (document) => (
                <div
                  key={
                    document._id
                  }
                  className="rounded-xl border border-slate-200 p-4"
                >
                  <p className="text-xs font-bold uppercase text-[#F26522]">
                    {
                      document.documentType
                    }
                  </p>

                  <p className="mt-2 font-semibold text-slate-900">
                    {document.title ||
                      document.fileName}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    Version{" "}
                    {
                      document.version
                    }
                  </p>

                  {document.url && (
                    <a
                      href={
                        document.url
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-block text-sm font-semibold text-[#F26522]"
                    >
                      Open →
                    </a>
                  )}
                </div>
              )
            )}
          </div>
        )}
      </section>


      {campaign.workflowStatus !==
        "ready_for_production" &&
        campaign.workflowStatus !==
          "cancelled" && (
          <div className="flex justify-end">
            <button
              onClick={cancelCampaign}
              disabled={busy}
              className="text-sm font-semibold text-red-600"
            >
              Cancel Campaign
            </button>
          </div>
        )}
    </div>
  );
};


const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-[#F26522] focus:ring-2 focus:ring-orange-100";


const Field = ({
  label,
  children,
}) => (
  <label className="text-sm font-medium text-slate-700">
    {label}

    <div className="mt-2">
      {children}
    </div>
  </label>
);


const FormInput = ({
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
      className={`mt-2 ${inputClass}`}
    />
  </label>
);


const Checkbox = ({
  label,
  checked,
  onChange,
}) => (
  <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) =>
        onChange(
          e.target.checked
        )
      }
      className="accent-[#F26522]"
    />

    {label}
  </label>
);


const Summary = ({
  label,
  value,
}) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-5">
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
      {label}
    </p>

    <p className="mt-2 font-bold text-slate-900">
      {value}
    </p>
  </div>
);


const SmallStat = ({
  label,
  value,
}) => (
  <div className="rounded-xl bg-slate-50 p-4">
    <p className="text-xs uppercase text-slate-400">
      {label}
    </p>

    <p className="mt-1 text-xl font-bold text-slate-900">
      {value}
    </p>
  </div>
);


const Detail = ({
  label,
  value,
}) => (
  <div className="border-b border-slate-100 pb-3">
    <p className="text-xs uppercase tracking-wide text-slate-400">
      {label}
    </p>

    <p className="mt-1 text-sm font-medium text-slate-800">
      {value || "—"}
    </p>
  </div>
);


const LinkCard = ({
  title,
  value,
  to,
}) => (
  <Link
    to={to}
    className="rounded-2xl border border-slate-200 bg-white p-5 hover:border-orange-200"
  >
    <p className="text-xs uppercase text-slate-400">
      {title}
    </p>

    <p className="mt-2 font-bold text-slate-900">
      {value}
    </p>

    <span className="mt-3 inline-block text-sm font-semibold text-[#F26522]">
      Open →
    </span>
  </Link>
);


const SimpleCard = ({
  title,
  value,
}) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-5">
    <p className="text-xs uppercase text-slate-400">
      {title}
    </p>

    <p className="mt-2 font-bold text-slate-900">
      {value}
    </p>
  </div>
);


const Alert = ({
  type,
  children,
}) => (
  <div
    className={
      type === "error"
        ? "rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        : "rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700"
    }
  >
    {children}
  </div>
);


export default Campaigns;