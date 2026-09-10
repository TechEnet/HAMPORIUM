import {
  useEffect,
  useState,
} from "react";

import {
  Link,
  useNavigate,
} from "react-router-dom";

import api from "../../../api/api.js";


const emptyProject = {
  title: "",
  clientName: "",
  clientEmail: "",
  clientPhone: "",
  clientCompany: "",
  eventType: "",
  eventDate: "",
  deliveryCity: "",
  requiredDeliveryDate: "",
  quantity: "1",
  budgetPerGift: "",
  totalBudget: "",
  requirements: "",
  brandingRequirements: "",
};


const Projects = () => {
  const navigate =
    useNavigate();

  const [projects, setProjects] =
    useState([]);

  const [partner, setPartner] =
    useState(null);

  const [showCreate, setShowCreate] =
    useState(false);

  const [form, setForm] =
    useState(emptyProject);

  const [items, setItems] =
    useState([
      {
        requestedTitle: "",
        quantity: 1,
        personalization: "",
        partnerNote: "",
      },
    ]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");


  const load = async () => {
    setLoading(true);

    try {
      const [
        partnerResponse,
        projectsResponse,
      ] = await Promise.all([
        api.get("/partners/me"),
        api.get(
          "/partners/projects/mine"
        ),
      ]);

      setPartner(
        partnerResponse.data.partner ||
          null
      );

      setProjects(
        projectsResponse.data.projects ||
          []
      );
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to load projects."
      );
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    load();
  }, []);


  const updateItem = (
    index,
    field,
    value
  ) => {
    setItems((current) =>
      current.map(
        (item, itemIndex) =>
          itemIndex === index
            ? {
                ...item,
                [field]: value,
              }
            : item
      )
    );
  };


  const addItem = () => {
    setItems((current) => [
      ...current,
      {
        requestedTitle: "",
        quantity: 1,
        personalization: "",
        partnerNote: "",
      },
    ]);
  };


  const removeItem = (index) => {
    setItems((current) =>
      current.filter(
        (_, itemIndex) =>
          itemIndex !== index
      )
    );
  };


  const createProject =
    async (event) => {
      event.preventDefault();

      setSaving(true);
      setError("");

      try {
        const response =
          await api.post(
            "/partners/projects",
            {
              title: form.title,

              client: {
                name:
                  form.clientName,

                email:
                  form.clientEmail,

                phone:
                  form.clientPhone,

                company:
                  form.clientCompany,
              },

              eventType:
                form.eventType,

              eventDate:
                form.eventDate ||
                null,

              deliveryCity:
                form.deliveryCity,

              requiredDeliveryDate:
                form.requiredDeliveryDate ||
                null,

              quantity:
                Number(
                  form.quantity ||
                    1
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

              requirements:
                form.requirements,

              brandingRequirements:
                form.brandingRequirements,

              items: items
                .filter(
                  (item) =>
                    item.requestedTitle.trim()
                )
                .map((item) => ({
                  ...item,
                  quantity:
                    Number(
                      item.quantity ||
                        1
                    ),
                })),
            }
          );

        navigate(
          `/account/partner/projects/${response.data.project._id}`
        );
      } catch (err) {
        setError(
          err.response?.data?.message ||
            "Unable to create project."
        );
      } finally {
        setSaving(false);
      }
    };


  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        Loading...
      </div>
    );
  }


  if (!partner) {
    return (
      <div className="rounded-3xl border border-black/10 bg-white p-8 text-center">

        <h1 className="text-2xl font-black">
          Partner account required
        </h1>

        <Link
          to="/account/partner"
          className="mt-5 inline-flex rounded-full bg-[#F97316] px-6 py-3 text-sm font-bold text-white"
        >
          Apply as Partner
        </Link>

      </div>
    );
  }


  return (
    <div className="space-y-7">

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">

        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#F97316]">
            Event Partner
          </p>

          <h1 className="mt-2 text-3xl font-black">
            Client Projects
          </h1>

          <p className="mt-2 text-sm text-black/45">
            Submit client gifting requirements for HAMPORIUM validation.
          </p>
        </div>


        {partner.status ===
          "approved" && (
          <button
            onClick={() =>
              setShowCreate(
                !showCreate
              )
            }
            className="rounded-full bg-[#F97316] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#171717]"
          >
            {showCreate
              ? "Close"
              : "+ New Project"}
          </button>
        )}

      </div>


      {error && (
        <div className="rounded-xl bg-red-50 p-4 text-sm text-red-600">
          {error}
        </div>
      )}


      {partner.status !==
        "approved" && (
        <div className="rounded-2xl border border-[#D4AF37]/30 bg-[#FFF9F2] p-5">

          <p className="font-bold">
            Partner approval pending
          </p>

          <p className="mt-1 text-sm text-black/50">
            New client projects can be created once HAMPORIUM approves your partner account.
          </p>

        </div>
      )}


      {showCreate && (
        <form
          onSubmit={
            createProject
          }
          className="rounded-[28px] border border-black/10 bg-white p-6"
        >

          <h2 className="text-xl font-black">
            New Client Project
          </h2>


          <div className="mt-6 grid gap-4 md:grid-cols-2">

            <Field
              label="Project Title"
              value={form.title}
              setValue={(value) =>
                setForm((prev) => ({
                  ...prev,
                  title: value,
                }))
              }
              required
            />

            <Field
              label="Event Type"
              value={
                form.eventType
              }
              setValue={(value) =>
                setForm((prev) => ({
                  ...prev,
                  eventType: value,
                }))
              }
            />

            <Field
              label="Client Name"
              value={
                form.clientName
              }
              setValue={(value) =>
                setForm((prev) => ({
                  ...prev,
                  clientName:
                    value,
                }))
              }
              required
            />

            <Field
              label="Client Email"
              type="email"
              value={
                form.clientEmail
              }
              setValue={(value) =>
                setForm((prev) => ({
                  ...prev,
                  clientEmail:
                    value,
                }))
              }
              required
            />

            <Field
              label="Client Phone"
              value={
                form.clientPhone
              }
              setValue={(value) =>
                setForm((prev) => ({
                  ...prev,
                  clientPhone:
                    value,
                }))
              }
            />

            <Field
              label="Client Company"
              value={
                form.clientCompany
              }
              setValue={(value) =>
                setForm((prev) => ({
                  ...prev,
                  clientCompany:
                    value,
                }))
              }
            />

            <Field
              label="Event Date"
              type="date"
              value={
                form.eventDate
              }
              setValue={(value) =>
                setForm((prev) => ({
                  ...prev,
                  eventDate: value,
                }))
              }
            />

            <Field
              label="Required Delivery"
              type="date"
              value={
                form.requiredDeliveryDate
              }
              setValue={(value) =>
                setForm((prev) => ({
                  ...prev,
                  requiredDeliveryDate:
                    value,
                }))
              }
            />

            <Field
              label="Delivery City"
              value={
                form.deliveryCity
              }
              setValue={(value) =>
                setForm((prev) => ({
                  ...prev,
                  deliveryCity:
                    value,
                }))
              }
            />

            <Field
              label="Total Quantity"
              type="number"
              value={
                form.quantity
              }
              setValue={(value) =>
                setForm((prev) => ({
                  ...prev,
                  quantity: value,
                }))
              }
            />

            <Field
              label="Budget / Gift"
              type="number"
              value={
                form.budgetPerGift
              }
              setValue={(value) =>
                setForm((prev) => ({
                  ...prev,
                  budgetPerGift:
                    value,
                }))
              }
            />

            <Field
              label="Total Budget"
              type="number"
              value={
                form.totalBudget
              }
              setValue={(value) =>
                setForm((prev) => ({
                  ...prev,
                  totalBudget:
                    value,
                }))
              }
            />

          </div>


          <div className="mt-4 grid gap-4 md:grid-cols-2">

            <Textarea
              label="Project Requirements"
              value={
                form.requirements
              }
              setValue={(value) =>
                setForm((prev) => ({
                  ...prev,
                  requirements:
                    value,
                }))
              }
            />

            <Textarea
              label="Branding Requirements"
              value={
                form.brandingRequirements
              }
              setValue={(value) =>
                setForm((prev) => ({
                  ...prev,
                  brandingRequirements:
                    value,
                }))
              }
            />

          </div>


          <div className="mt-7">

            <div className="flex items-center justify-between">

              <h3 className="font-black">
                Gift Options
              </h3>

              <button
                type="button"
                onClick={addItem}
                className="text-sm font-bold text-[#F97316]"
              >
                + Add Option
              </button>

            </div>


            <div className="mt-4 space-y-4">

              {items.map(
                (item, index) => (
                  <div
                    key={index}
                    className="grid gap-3 rounded-2xl bg-[#FFF9F2] p-4 md:grid-cols-2"
                  >

                    <Field
                      label="Gift / Product Request"
                      value={
                        item.requestedTitle
                      }
                      setValue={(value) =>
                        updateItem(
                          index,
                          "requestedTitle",
                          value
                        )
                      }
                    />

                    <Field
                      label="Quantity"
                      type="number"
                      value={
                        item.quantity
                      }
                      setValue={(value) =>
                        updateItem(
                          index,
                          "quantity",
                          value
                        )
                      }
                    />

                    <Field
                      label="Personalisation"
                      value={
                        item.personalization
                      }
                      setValue={(value) =>
                        updateItem(
                          index,
                          "personalization",
                          value
                        )
                      }
                    />

                    <Field
                      label="Partner Note"
                      value={
                        item.partnerNote
                      }
                      setValue={(value) =>
                        updateItem(
                          index,
                          "partnerNote",
                          value
                        )
                      }
                    />


                    {items.length >
                      1 && (
                      <button
                        type="button"
                        onClick={() =>
                          removeItem(
                            index
                          )
                        }
                        className="w-fit text-xs font-bold text-red-500"
                      >
                        Remove Option
                      </button>
                    )}

                  </div>
                )
              )}

            </div>

          </div>


          <button
            disabled={saving}
            className="mt-7 rounded-full bg-[#171717] px-7 py-3.5 text-sm font-bold text-white transition hover:bg-[#F97316] disabled:opacity-50"
          >
            {saving
              ? "Creating..."
              : "Create Project"}
          </button>

        </form>
      )}


      <div className="grid gap-4 lg:grid-cols-2">

        {projects.map(
          (project) => (
            <Link
              key={project._id}
              to={`/account/partner/projects/${project._id}`}
              className="group rounded-[24px] border border-black/10 bg-white p-5 transition hover:-translate-y-1 hover:border-[#D4AF37]/60 hover:shadow-lg"
            >

              <div className="flex items-start justify-between gap-4">

                <div>

                  <p className="text-xs font-bold uppercase tracking-[0.13em] text-[#D4AF37]">
                    {project.projectId}
                  </p>

                  <h2 className="mt-2 text-lg font-black">
                    {project.title}
                  </h2>

                  <p className="mt-1 text-sm text-black/45">
                    {project.client?.name}
                  </p>

                </div>


                <Status
                  value={
                    project.status
                  }
                />

              </div>


              <div className="mt-5 flex items-center justify-between border-t border-black/5 pt-4">

                <p className="text-xs text-black/45">
                  {project.items?.length ||
                    0}{" "}
                  gift options
                </p>

                <span className="font-bold text-[#F97316] transition group-hover:translate-x-1">
                  →
                </span>

              </div>

            </Link>
          )
        )}

      </div>


      {!projects.length && (
        <div className="rounded-2xl border border-dashed border-black/10 p-10 text-center text-sm text-black/40">
          No projects yet.
        </div>
      )}

    </div>
  );
};


const Field = ({
  label,
  value,
  setValue,
  type = "text",
  required,
}) => (
  <label className="block">

    <span className="text-xs font-bold text-black/60">
      {label}
    </span>

    <input
      type={type}
      required={required}
      value={value}
      onChange={(event) =>
        setValue(
          event.target.value
        )
      }
      className="mt-2 w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:border-[#F97316]"
    />

  </label>
);


const Textarea = ({
  label,
  value,
  setValue,
}) => (
  <label>

    <span className="text-xs font-bold text-black/60">
      {label}
    </span>

    <textarea
      rows="4"
      value={value}
      onChange={(event) =>
        setValue(
          event.target.value
        )
      }
      className="mt-2 w-full rounded-xl border border-black/10 px-4 py-3 text-sm outline-none focus:border-[#F97316]"
    />

  </label>
);


const Status = ({ value }) => (
  <span className="rounded-full bg-[#FFF9F2] px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-[#F97316]">
    {String(value)
      .replaceAll("_", " ")}
  </span>
);


export default Projects;