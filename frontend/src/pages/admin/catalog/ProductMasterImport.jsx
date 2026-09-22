import { useMemo, useState } from "react";



import api from "../../../api/api.js";



const ACTION_STYLES = {

  CREATE: "border-emerald-200 bg-emerald-50 text-emerald-700",

  CREATED: "border-emerald-200 bg-emerald-50 text-emerald-700",

  UPDATE: "border-blue-200 bg-blue-50 text-blue-700",

  UPDATED: "border-blue-200 bg-blue-50 text-blue-700",

  SKIP: "border-black/10 bg-black/[0.04] text-black/50",

  REVIEW: "border-amber-200 bg-amber-50 text-amber-700",

  ERROR: "border-red-200 bg-red-50 text-red-700",

};



const toNumberOrNull = (value) =>

  value === "" || value === null || value === undefined

    ? null

    : Number(value);



const createContainerReviewForm = (item) => {

  const data = item?.reviewData || {};

  const outer = data.outerDimensions || {};

  const inner = data.innerDimensions || {};

  const maxWeight = data.maxContentWeight || {};

  const lead = data.productionLeadTime || {};

  const availability = data.availability || {};



  return {

    material: data.material || "",

    outerDimensions: {

      length: outer.length ?? "",

      width: outer.width ?? "",

      height: outer.height ?? "",

      unit: outer.unit || "cm",

    },

    innerDimensions: {

      length: inner.length ?? "",

      width: inner.width ?? "",

      height: inner.height ?? "",

      unit: inner.unit || outer.unit || "cm",

    },

    maxContentWeight: {

      value: maxWeight.value ?? "",

      unit: maxWeight.unit || "kg",

    },

    usableVolumePercent: data.usableVolumePercent ?? 85,

    maxItems: data.maxItems ?? 0,

    productionLeadTime: {

      personalizationDays: lead.personalizationDays ?? 0,

      assemblyDays: lead.assemblyDays ?? 0,

      packingDays: lead.packingDays ?? 0,

    },

    defaultCourierDays: data.defaultCourierDays ?? "",

    availability: {

      status: availability.status || "in_stock",

      availableQuantity:

        availability.availableQuantity ?? "",

      nextAvailableDate: availability.nextAvailableDate || "",

    },

    customerSelectable: data.customerSelectable !== false,

    sortOrder: data.sortOrder ?? 0,

  };

};



const ProductMasterImport = () => {

  const [file, setFile] = useState(null);

  const [preview, setPreview] = useState(null);

  const [importResult, setImportResult] = useState(null);

  const [analyzing, setAnalyzing] = useState(false);

  const [importing, setImporting] = useState(false);

  const [error, setError] = useState("");

  const [notice, setNotice] = useState("");



  const [reviewingContainer, setReviewingContainer] =

    useState(null);

  const [reviewForm, setReviewForm] = useState(null);

  const [reviewSaving, setReviewSaving] = useState(false);



  const currentData = importResult || preview;

  const previewCreateCount = Number(preview?.summary?.create || 0);
  const previewUpdateCount = Number(preview?.summary?.update || 0);
  const previewReviewCount = Number(preview?.summary?.review || 0);
  const previewErrorCount = Number(
    preview?.summary?.error ?? preview?.summary?.errors ?? 0
  );
  const previewSheetErrorCount = Array.isArray(preview?.compositionErrors)
    ? preview.compositionErrors.length
    : 0;
  const previewBlockingCount =
    previewReviewCount + previewErrorCount + previewSheetErrorCount;
  const replaceMode = preview?.importMode === "replace_product_master";
  const legacyMergeHasChanges = previewCreateCount + previewUpdateCount > 0;

  const canConfirmImport =
    Boolean(preview) &&
    !analyzing &&
    !importing &&
    !reviewSaving &&
    previewBlockingCount === 0 &&
    (replaceMode || legacyMergeHasChanges);



  const summaryCards = useMemo(() => {

    if (!currentData?.summary) return [];



    if (importResult) {

      return [

        ["Total Rows", currentData.summary.totalRows ?? 0],

        ["Created", currentData.summary.created ?? 0],

        ["Updated", currentData.summary.updated ?? 0],

        ["Skipped", currentData.summary.skipped ?? 0],

        ["Review", currentData.summary.review ?? 0],

        ["Errors", currentData.summary.errors ?? 0],

      ];

    }



    return [

      ["Total Rows", currentData.summary.totalRows ?? 0],

      ["Create", currentData.summary.create ?? 0],

      ["Update", currentData.summary.update ?? 0],

      ["Unchanged", currentData.summary.skip ?? 0],

      ["Review", currentData.summary.review ?? 0],

      ["Errors", currentData.summary.error ?? 0],

    ];

  }, [currentData, importResult]);



  const selectFile = (event) => {

    const selected = event.target.files?.[0] || null;



    setFile(selected);

    setPreview(null);

    setImportResult(null);

    setReviewingContainer(null);

    setReviewForm(null);

    setError("");

    setNotice("");

  };



  const uploadFile = async (endpoint, extraFields = {}) => {

    if (!file) throw new Error("Choose an Excel file first");



    const formData = new FormData();

    formData.append("file", file);



    Object.entries(extraFields).forEach(([key, value]) => {

      if (value !== undefined && value !== null) {

        formData.append(

          key,

          typeof value === "string"

            ? value

            : JSON.stringify(value)

        );

      }

    });



    const response = await api.post(endpoint, formData, {

      headers: {

        "Content-Type": "multipart/form-data",

      },

    });



    return response.data;

  };



  const analyzeFile = async ({ keepNotice = false } = {}) => {

    setAnalyzing(true);

    setError("");

    if (!keepNotice) setNotice("");

    setImportResult(null);



    try {

      const data = await uploadFile(

        "/catalog/admin/import/product-master/preview"

      );



      setPreview(data);

      return data;

    } catch (requestError) {

      setPreview(null);

      setError(

        requestError.response?.data?.message ||

          requestError.message ||

          "Unable to analyze Product Master"

      );

      return null;

    } finally {

      setAnalyzing(false);

    }

  };



  const confirmImport = async () => {

    if (!preview) return;

    const createCount = Number(preview.summary?.create || 0);
    const updateCount = Number(preview.summary?.update || 0);
    const unchangedCount = Number(preview.summary?.skip || 0);
    const reviewCount = Number(preview.summary?.review || 0);
    const errorCount = Number(
      preview.summary?.error ?? preview.summary?.errors ?? 0
    );
    const sheetErrorCount = Array.isArray(preview.compositionErrors)
      ? preview.compositionErrors.length
      : 0;
    const totalRows = Number(preview.summary?.totalRows || 0);
    const isReplaceMode =
      preview.importMode === "replace_product_master";

    if (reviewCount > 0 || errorCount > 0 || sheetErrorCount > 0) {
      setError(
        "Resolve all REVIEW and ERROR items before importing. The existing catalogue has not been changed."
      );
      return;
    }

    if (!isReplaceMode && createCount + updateCount === 0) {
      setError(
        "The backend is still using the old merge importer. Deploy the latest catalog.controller.js, analyze the file again, and then Confirm Import will replace the previous Product Master catalogue."
      );
      return;
    }

    const confirmed = window.confirm(
      isReplaceMode
        ? `Replace the current Product Master catalogue with this workbook (${totalRows} rows)? Previous Product Master Products, SKUs, Components and Containers will be removed, then this workbook will become the current catalogue. Users, orders, payments and partners are not deleted.`
        : `Import this Product Master? CREATE: ${createCount}, UPDATE: ${updateCount}, UNCHANGED: ${unchangedCount}.`
    );

    if (!confirmed) return;

    setImporting(true);
    setError("");
    setNotice("");

    try {
      const data = await uploadFile(
        "/catalog/admin/import/product-master/confirm"
      );

      setImportResult(data);
      setNotice(
        data.message || "Product Master import completed"
      );
    } catch (requestError) {
      const responseData = requestError.response?.data;

      if (responseData?.summary && responseData?.results) {
        setPreview(responseData);
      }

      setError(
        responseData?.message ||
          requestError.message ||
          "Unable to import Product Master"
      );
    } finally {
      setImporting(false);
    }

  };



  const openContainerReview = (item) => {

    if (!item?.reviewData) {

      setError(

        "This review row cannot be completed from this screen. Resolve the row conflict first."

      );

      return;

    }



    setError("");

    setNotice("");

    setReviewingContainer(item);

    setReviewForm(createContainerReviewForm(item));

  };



  const closeContainerReview = () => {

    if (reviewSaving) return;

    setReviewingContainer(null);

    setReviewForm(null);

  };



  const updateReviewSection = (section, field, value) => {

    setReviewForm((current) => ({

      ...current,

      [section]: {

        ...current[section],

        [field]: value,

      },

    }));

  };



  const completeContainerReview = async (event) => {

    event.preventDefault();



    if (!reviewingContainer || !reviewForm) return;



    setReviewSaving(true);

    setError("");

    setNotice("");



    try {

      const completion = {

        material: reviewForm.material,

        outerDimensions: {

          length: Number(reviewForm.outerDimensions.length),

          width: Number(reviewForm.outerDimensions.width),

          height: Number(reviewForm.outerDimensions.height),

          unit: reviewForm.outerDimensions.unit,

        },

        innerDimensions: {

          length: Number(reviewForm.innerDimensions.length),

          width: Number(reviewForm.innerDimensions.width),

          height: Number(reviewForm.innerDimensions.height),

          unit: reviewForm.innerDimensions.unit,

        },

        maxContentWeight: {

          value: Number(reviewForm.maxContentWeight.value),

          unit: reviewForm.maxContentWeight.unit,

        },

        usableVolumePercent: Number(

          reviewForm.usableVolumePercent

        ),

        maxItems: Number(reviewForm.maxItems || 0),

        productionLeadTime: {

          personalizationDays: Number(

            reviewForm.productionLeadTime

              .personalizationDays || 0

          ),

          assemblyDays: Number(

            reviewForm.productionLeadTime.assemblyDays || 0

          ),

          packingDays: Number(

            reviewForm.productionLeadTime.packingDays || 0

          ),

        },

        defaultCourierDays: toNumberOrNull(

          reviewForm.defaultCourierDays

        ),

        availability: {

          status: reviewForm.availability.status,

          availableQuantity: toNumberOrNull(

            reviewForm.availability.availableQuantity

          ),

          nextAvailableDate:

            reviewForm.availability.status === "incoming"

              ? reviewForm.availability.nextAvailableDate || null

              : null,

        },

        customerSelectable: Boolean(

          reviewForm.customerSelectable

        ),

        sortOrder: Number(reviewForm.sortOrder || 0),

      };



      const data = await uploadFile(

        "/catalog/admin/import/product-master/complete-container",

        {

          externalSku: reviewingContainer.externalSku,

          completion,

        }

      );



      setReviewingContainer(null);

      setReviewForm(null);

      setNotice(

        data.message || "Container review completed"

      );



      await analyzeFile({ keepNotice: true });

    } catch (requestError) {

      setError(

        requestError.response?.data?.message ||

          requestError.message ||

          "Unable to complete container review"

      );

    } finally {

      setReviewSaving(false);

    }

  };



  const reset = () => {

    setFile(null);

    setPreview(null);

    setImportResult(null);

    setReviewingContainer(null);

    setReviewForm(null);

    setError("");

    setNotice("");

  };



  return (

    <div className="pb-12">

      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">

        <div>

          <div className="flex items-center gap-2">

            <span className="h-2 w-2 rounded-full bg-[#F97316]" />

            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#F97316]">

              Catalogue Sync

            </p>

          </div>



          <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#171717] sm:text-4xl">

            Product Master Import

          </h1>



          <p className="mt-2 max-w-3xl text-sm leading-6 text-black/50">

            Analyze the workbook safely, then replace the previous Product Master

            catalogue with the approved file without modifying the source Excel.

          </p>

        </div>



        {(file || preview || importResult) && (

          <button

            type="button"

            onClick={reset}

            disabled={

              analyzing ||

              importing ||

              reviewSaving

            }

            className="rounded-xl border border-black/10 bg-white px-5 py-3 text-sm font-bold text-black/55 transition hover:border-[#F97316] hover:text-[#F97316] disabled:opacity-50"

          >

            Start Over

          </button>

        )}

      </div>



      {error && (

        <div className="mt-6 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">

          {error}

        </div>

      )}



      {notice && (

        <div className="mt-6 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">

          {notice}

        </div>

      )}



      <div className="mt-8 grid gap-3 sm:grid-cols-3">

        <WorkflowStep

          number="01"

          title="Upload"

          description="Select Product Master Excel"

          active={Boolean(file)}

        />

        <WorkflowStep

          number="02"

          title="Analyze"

          description="Preview all changes safely"

          active={Boolean(preview || importResult)}

        />

        <WorkflowStep

          number="03"

          title="Import"

          description="Confirm approved records"

          active={Boolean(importResult)}

        />

      </div>



      <section className="mt-6 overflow-hidden rounded-3xl border border-black/[0.07] bg-white shadow-[0_18px_60px_rgba(0,0,0,0.05)]">

        <div className="border-b border-black/[0.06] bg-[#FFF9F2] px-5 py-5 sm:px-7">

          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#F97316]">

            Step 1

          </p>

          <h2 className="mt-1 text-lg font-bold text-[#171717]">

            Select Product Master

          </h2>

        </div>



        <div className="p-5 sm:p-7">

          <div className="flex flex-col gap-5 lg:flex-row lg:items-end">

            <label className="block min-w-0 flex-1">

              <span className="mb-2 block text-xs font-bold text-black/60">

                Product Master Excel

              </span>



              <input

                type="file"

                accept=".xlsx,.xls"

                onChange={selectFile}

                disabled={

                  analyzing ||

                  importing ||

                  reviewSaving

                }

                className="block w-full rounded-xl border border-black/10 bg-[#FAFAF9] px-3 py-3 text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-[#171717] file:px-4 file:py-2.5 file:text-xs file:font-bold file:text-white hover:file:bg-[#F97316] disabled:opacity-50"

              />



              {file && (

                <div className="mt-2 flex items-center gap-2 text-xs text-black/45">

                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />

                  Selected:

                  <span className="font-semibold text-black/65">

                    {file.name}

                  </span>

                </div>

              )}

            </label>



            <button

              type="button"

              onClick={() => analyzeFile()}

              disabled={

                !file ||

                analyzing ||

                importing ||

                reviewSaving

              }

              className="rounded-xl bg-[#171717] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#F97316] disabled:cursor-not-allowed disabled:opacity-40"

            >

              {analyzing

                ? "Analyzing..."

                : "Analyze File"}

            </button>

          </div>



          <div className="mt-5 rounded-2xl border border-[#D4AF37]/30 bg-[#FFF9F2] px-4 py-4 text-xs leading-6 text-black/60">

            <strong className="text-[#171717]">GST import rule:</strong>{" "}

            Product Master <strong>Target Sell Price</strong> is treated as the pre-GST base selling price.

            Tax % and HSN/SAC are imported separately; the backend applies any configured discount first,

            then GST, and derives the customer-facing final price. Preview remains read-only and never edits Excel.

          </div>



          <div className="mt-5 grid gap-3 md:grid-cols-3">

            <InfoCard

              title="Read-only Preview"

              text="Analyze never changes MongoDB. Only Confirm Import can replace the current Product Master catalogue."

            />

            <InfoCard

              title="Source Protected"

              text="The selected Excel file is never edited."

            />

            <InfoCard

              title="Tax-safe Import"

              text="Base price, GST and HSN/SAC stay separate. REVIEW and ERROR items block replacement before old catalogue data is removed."

            />

          </div>

        </div>

      </section>



      {currentData?.summary && (

        <>

          <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">

            {summaryCards.map(([label, value]) => (

              <SummaryCard

                key={label}

                label={label}

                value={value}

              />

            ))}

          </section>



          <section className="mt-6 overflow-hidden rounded-3xl border border-black/[0.07] bg-white shadow-[0_18px_60px_rgba(0,0,0,0.04)]">

            <div className="flex flex-col gap-4 border-b border-black/[0.06] bg-[#FAFAF9] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">

              <div>

                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#F97316]">

                  {importResult ? "Final Result" : "Step 2"}

                </p>



                <h2 className="mt-1 font-bold text-[#171717]">

                  {importResult

                    ? "Import Result"

                    : "Preview Result"}

                </h2>



                <p className="mt-1 text-xs text-black/45">

                  {currentData.filename ||

                    file?.name ||

                    "Product Master"}

                  {currentData.sheetName

                    ? ` · ${currentData.sheetName}`

                    : ""}

                </p>

              </div>



              {!importResult && preview && (

                <button

                  type="button"

                  onClick={confirmImport}

                  disabled={!canConfirmImport}

                  className="rounded-xl bg-[#F97316] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#171717] disabled:cursor-not-allowed disabled:opacity-40"

                >

                  {importing

                    ? "Importing..."

                    : "Confirm Import"}

                </button>

              )}

            </div>

            {!importResult && preview && (
              <div
                className={`border-b px-5 py-3 text-xs font-semibold sm:px-6 ${
                  replaceMode
                    ? "border-emerald-100 bg-emerald-50 text-emerald-700"
                    : legacyMergeHasChanges
                      ? "border-amber-100 bg-amber-50 text-amber-700"
                      : "border-red-100 bg-red-50 text-red-700"
                }`}
              >
                {replaceMode
                  ? previewBlockingCount === 0
                    ? "Replace mode ready: Confirm Import will replace the previous Product Master catalogue with this workbook."
                    : "Replace mode is active, but REVIEW or ERROR items must be resolved before import."
                  : legacyMergeHasChanges
                    ? "Legacy merge mode detected. Import is available for CREATE/UPDATE rows, but it will not fully replace the old Product Master catalogue."
                    : "Old backend importer detected. Deploy the latest catalog.controller.js and analyze this file again before replacing the catalogue."}
              </div>
            )}



            <div className="overflow-x-auto">

              <table className="min-w-[1100px] w-full text-left text-sm">

                <thead className="sticky top-0 z-[1] bg-[#171717] text-[10px] uppercase tracking-[0.1em] text-white/60">

                  <tr>

                    <th className="px-4 py-3.5 font-bold">Row</th>

                    <th className="px-4 py-3.5 font-bold">Product SKU</th>

                    <th className="px-4 py-3.5 font-bold">Name</th>

                    <th className="px-4 py-3.5 font-bold">Type</th>

                    <th className="px-4 py-3.5 font-bold">Action</th>

                    <th className="px-4 py-3.5 font-bold">Details</th>

                    <th className="px-4 py-3.5 font-bold">Review</th>

                  </tr>

                </thead>



                <tbody>

                  {(currentData.results || []).map(

                    (item, index) => (

                      <tr

                        key={`${item.rowNumber}-${item.externalSku}-${index}`}

                        className="border-t border-black/[0.05] align-top transition hover:bg-[#FFF9F2]/50"

                      >

                        <td className="whitespace-nowrap px-4 py-4 text-xs font-medium text-black/35">

                          {item.rowNumber}

                        </td>



                        <td className="whitespace-nowrap px-4 py-4 text-xs font-bold text-black/60">

                          {item.externalSku || "—"}

                        </td>



                        <td className="min-w-[220px] px-4 py-4">

                          <p className="font-bold text-[#171717]">

                            {item.name || "Unnamed row"}

                          </p>

                        </td>



                        <td className="whitespace-nowrap px-4 py-4">

                          <span className="rounded-lg bg-black/[0.04] px-2.5 py-1.5 text-[10px] font-bold capitalize text-black/50">

                            {String(

                              item.recordType || ""

                            ).replaceAll("_", " ") || "—"}

                          </span>

                        </td>



                        <td className="whitespace-nowrap px-4 py-4">

                          <span

                            className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold ${

                              ACTION_STYLES[item.action] ||

                              "border-black/10 bg-black/[0.04] text-black/50"

                            }`}

                          >

                            {item.action}

                          </span>

                        </td>



                        <td className="min-w-[360px] px-4 py-4 text-xs leading-5 text-black/50">

                          <p>{item.reason || "—"}</p>



                          {item.compositionSummary && (

                            <div className="mt-2 rounded-lg bg-orange-50 px-3 py-2 text-[11px] font-medium text-[#F97316]">

                              {item.compositionSummary.contentLines ||

                                0}{" "}

                              content line(s)

                              {item.compositionSummary

                                .totalUnits !== undefined

                                ? ` · ${item.compositionSummary.totalUnits} total unit(s)`

                                : ""}

                              {item.compositionSummary

                                .containerSku

                                ? ` · Box ${item.compositionSummary.containerSku}`

                                : ""}

                            </div>

                          )}



                          {item.changedFields?.length > 0 && (

                            <div className="mt-2 rounded-lg bg-blue-50 px-3 py-2 text-[11px] text-blue-700/80">

                              <span className="font-bold">

                                Changed:

                              </span>{" "}

                              {item.changedFields.join(", ")}

                            </div>

                          )}

                        </td>



                        <td className="whitespace-nowrap px-4 py-4">

                          {item.action === "REVIEW" &&

                          item.recordType ===

                            "container" &&

                          item.reviewData ? (

                            <button

                              type="button"

                              onClick={() =>

                                openContainerReview(item)

                              }

                              disabled={reviewSaving}

                              className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-[10px] font-bold text-amber-700 transition hover:border-[#F97316] hover:bg-[#FFF9F2] hover:text-[#F97316] disabled:opacity-50"

                            >

                              Complete Container

                            </button>

                          ) : (

                            <span className="text-xs text-black/20">

                              —

                            </span>

                          )}

                        </td>

                      </tr>

                    )

                  )}

                </tbody>

              </table>

            </div>

          </section>

        </>

      )}



      {reviewingContainer && reviewForm && (

        <ContainerReviewModal

          item={reviewingContainer}

          form={reviewForm}

          setForm={setReviewForm}

          updateSection={updateReviewSection}

          saving={reviewSaving}

          onClose={closeContainerReview}

          onSubmit={completeContainerReview}

        />

      )}

    </div>

  );

};



const ContainerReviewModal = ({

  item,

  form,

  setForm,

  updateSection,

  saving,

  onClose,

  onSubmit,

}) => {

  const sourceOuterLocked =

    item.reviewData?.hasSourceOuterDimensions === true;



  const sourceInnerLocked =

    item.reviewData?.hasSourceInnerDimensions === true;



  const sourceWeightLocked =

    item.reviewData?.hasSourceMaxContentWeight === true;



  return (

    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#171717]/70 p-3 backdrop-blur-sm sm:p-5">

      <div className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-[#F7F6F3] shadow-2xl">

        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-black/[0.07] bg-white px-5 py-5 sm:px-7">

          <div>

            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#F97316]">

              Container Review

            </p>

            <h2 className="mt-1 text-xl font-bold text-[#171717] sm:text-2xl">

              {item.name}

            </h2>

            <p className="mt-1 text-xs text-black/40">

              Product Master SKU {item.externalSku}

            </p>

          </div>



          <button

            type="button"

            onClick={onClose}

            disabled={saving}

            className="rounded-xl border border-black/10 px-4 py-2.5 text-xs font-bold text-black/50 transition hover:bg-black/[0.03] disabled:opacity-50"

          >

            Close

          </button>

        </div>



        <form

          onSubmit={onSubmit}

          className="space-y-5 p-5 sm:p-7"

        >

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">

            <div className="flex gap-3">

              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-bold">

                !

              </div>

              <div>

                <p className="font-bold">

                  Why this row needs review

                </p>

                <p className="mt-1">{item.reason}</p>

                <p className="mt-2 text-xs text-amber-700/80">

                  Product Master values remain source-owned. Inner dimensions

                  and operational settings are stored only in HAMPORIUM.

                </p>

              </div>

            </div>

          </div>



          <ReviewSection

            eyebrow="Reference"

            title="Source / Commercial Snapshot"

            description="Read-only values from the selected Excel file."

          >

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">

              <ReadOnlyValue

                label="Source Product Type"

                value={

                  item.reviewData?.sourceProductType || "—"

                }

              />

              <ReadOnlyValue

                label="Category"

                value={item.reviewData?.category || "—"}

              />

              <ReadOnlyValue

                label="Subcategory"

                value={

                  item.reviewData?.subcategory || "—"

                }

              />

              <ReadOnlyValue

                label="Selling Price"

                value={

                  item.reviewData?.sellingPrice !== null &&

                  item.reviewData?.sellingPrice !== undefined

                    ? `₹${Number(

                        item.reviewData.sellingPrice

                      ).toLocaleString("en-IN")}`

                    : "Not set"

                }

              />

            </div>

          </ReviewSection>



          <ReviewSection

            eyebrow="Physical"

            title="Outer Dimensions"

            description={

              sourceOuterLocked

                ? "Provided by Product Master and locked here."

                : "Missing in Product Master. Complete locally."

            }

          >

            <DimensionFields

              value={form.outerDimensions}

              disabled={sourceOuterLocked}

              onChange={(field, value) =>

                updateSection(

                  "outerDimensions",

                  field,

                  value

                )

              }

            />

          </ReviewSection>



          <ReviewSection

            eyebrow="Fit Engine"

            title="Inner Dimensions"

            highlight

            description={

              sourceInnerLocked

                ? "True inner dimensions were supplied by the workbook and are locked here."

                : "Enter the true usable inside dimensions. These values drive the hamper fit engine."

            }

          >

            <DimensionFields

              value={form.innerDimensions}

              disabled={sourceInnerLocked}

              onChange={(field, value) =>

                updateSection(

                  "innerDimensions",

                  field,

                  value

                )

              }

            />

          </ReviewSection>



          <ReviewSection

            eyebrow="Capacity"

            title="Container Capacity"

            description={

              sourceWeightLocked

                ? "Maximum safe load came from Product Master."

                : "Maximum safe load must be completed locally."

            }

          >

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

              <ReviewField

                label="Max Content Weight"

                type="number"

                min="0.001"

                required

                disabled={sourceWeightLocked}

                value={form.maxContentWeight.value}

                onChange={(value) =>

                  updateSection(

                    "maxContentWeight",

                    "value",

                    value

                  )

                }

              />



              <ReviewSelect

                label="Weight Unit"

                disabled={sourceWeightLocked}

                value={form.maxContentWeight.unit}

                onChange={(value) =>

                  updateSection(

                    "maxContentWeight",

                    "unit",

                    value

                  )

                }

                options={[

                  ["kg", "kg"],

                  ["g", "g"],

                ]}

              />



              <ReviewField

                label="Usable Volume %"

                type="number"

                min="1"

                max="100"

                required

                value={form.usableVolumePercent}

                onChange={(value) =>

                  setForm((current) => ({

                    ...current,

                    usableVolumePercent: value,

                  }))

                }

              />



              <ReviewField

                label="Max Items"

                type="number"

                min="0"

                value={form.maxItems}

                onChange={(value) =>

                  setForm((current) => ({

                    ...current,

                    maxItems: value,

                  }))

                }

              />

            </div>

          </ReviewSection>



          <ReviewSection

            eyebrow="Operations"

            title="Container Setup"

          >

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

              <ReviewField

                label="Material"

                value={form.material}

                onChange={(value) =>

                  setForm((current) => ({

                    ...current,

                    material: value,

                  }))

                }

                placeholder="e.g. rigid board"

              />



              <ReviewField

                label="Sort Order"

                type="number"

                min="0"

                value={form.sortOrder}

                onChange={(value) =>

                  setForm((current) => ({

                    ...current,

                    sortOrder: value,

                  }))

                }

              />



              <ReviewField

                label="Default Courier Days"

                type="number"

                min="0"

                max="60"

                value={form.defaultCourierDays}

                onChange={(value) =>

                  setForm((current) => ({

                    ...current,

                    defaultCourierDays: value,

                  }))

                }

                placeholder="Optional"

              />



              <label className="flex items-end">

                <span className="flex min-h-[46px] w-full items-center gap-3 rounded-xl border border-black/10 bg-white px-3.5 py-3 text-xs font-semibold text-black/60">

                  <input

                    type="checkbox"

                    checked={form.customerSelectable}

                    onChange={(event) =>

                      setForm((current) => ({

                        ...current,

                        customerSelectable:

                          event.target.checked,

                      }))

                    }

                    className="accent-[#F97316]"

                  />

                  Custom hamper builder

                </span>

              </label>

            </div>

          </ReviewSection>



          <ReviewSection

            eyebrow="Timeline"

            title="Production Defaults"

          >

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">

              <ReviewField

                label="Personalization Days"

                type="number"

                min="0"

                value={

                  form.productionLeadTime

                    .personalizationDays

                }

                onChange={(value) =>

                  updateSection(

                    "productionLeadTime",

                    "personalizationDays",

                    value

                  )

                }

              />



              <ReviewField

                label="Assembly Days"

                type="number"

                min="0"

                value={

                  form.productionLeadTime.assemblyDays

                }

                onChange={(value) =>

                  updateSection(

                    "productionLeadTime",

                    "assemblyDays",

                    value

                  )

                }

              />



              <ReviewField

                label="Packing Days"

                type="number"

                min="0"

                value={

                  form.productionLeadTime.packingDays

                }

                onChange={(value) =>

                  updateSection(

                    "productionLeadTime",

                    "packingDays",

                    value

                  )

                }

              />

            </div>

          </ReviewSection>



          <ReviewSection

            eyebrow="Stock"

            title="Availability"

          >

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">

              <ReviewSelect

                label="Status"

                value={form.availability.status}

                onChange={(value) =>

                  updateSection(

                    "availability",

                    "status",

                    value

                  )

                }

                options={[

                  ["in_stock", "In stock"],

                  ["incoming", "Incoming"],

                  ["out_of_stock", "Out of stock"],

                ]}

              />



              <ReviewField

                label="Available Quantity"

                type="number"

                min="0"

                value={

                  form.availability.availableQuantity

                }

                onChange={(value) =>

                  updateSection(

                    "availability",

                    "availableQuantity",

                    value

                  )

                }

                placeholder="Optional"

              />



              {form.availability.status === "incoming" && (

                <ReviewField

                  label="Next Available Date"

                  type="date"

                  required

                  value={

                    form.availability.nextAvailableDate

                  }

                  onChange={(value) =>

                    updateSection(

                      "availability",

                      "nextAvailableDate",

                      value

                    )

                  }

                />

              )}

            </div>

          </ReviewSection>



          <div className="sticky bottom-0 -mx-5 -mb-5 flex flex-wrap justify-end gap-3 border-t border-black/[0.07] bg-white px-5 py-4 sm:-mx-7 sm:-mb-7 sm:px-7">

            <button

              type="button"

              onClick={onClose}

              disabled={saving}

              className="rounded-xl border border-black/10 px-5 py-3 text-sm font-bold text-black/55 disabled:opacity-50"

            >

              Cancel

            </button>



            <button

              type="submit"

              disabled={saving}

              className="rounded-xl bg-[#F97316] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#171717] disabled:opacity-50"

            >

              {saving

                ? "Saving..."

                : "Complete & Import Container"}

            </button>

          </div>

        </form>

      </div>

    </div>

  );

};



const WorkflowStep = ({

  number,

  title,

  description,

  active,

}) => (

  <div

    className={`rounded-2xl border p-4 transition ${

      active

        ? "border-orange-200 bg-[#FFF9F2]"

        : "border-black/[0.06] bg-white"

    }`}

  >

    <div className="flex items-center gap-3">

      <span

        className={`flex h-9 w-9 items-center justify-center rounded-xl text-[10px] font-bold ${

          active

            ? "bg-[#F97316] text-white"

            : "bg-black/[0.04] text-black/35"

        }`}

      >

        {number}

      </span>



      <div>

        <p className="text-sm font-bold text-[#171717]">

          {title}

        </p>

        <p className="mt-0.5 text-xs text-black/40">

          {description}

        </p>

      </div>

    </div>

  </div>

);



const SummaryCard = ({ label, value }) => (

  <div className="rounded-2xl border border-black/[0.06] bg-white p-4 shadow-[0_8px_24px_rgba(0,0,0,0.025)]">

    <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-black/35">

      {label}

    </p>

    <p className="mt-2 text-3xl font-bold tracking-tight text-[#171717]">

      {value}

    </p>

  </div>

);



const InfoCard = ({ title, text }) => (

  <div className="rounded-xl border border-black/[0.06] bg-[#FAFAF9] p-4">

    <p className="text-xs font-bold text-[#171717]">{title}</p>

    <p className="mt-1 text-[11px] leading-5 text-black/40">

      {text}

    </p>

  </div>

);



const ReviewSection = ({

  eyebrow,

  title,

  description,

  children,

  highlight = false,

}) => (

  <section

    className={`rounded-2xl border p-5 ${

      highlight

        ? "border-[#D4AF37]/35 bg-[#FFF9F2]"

        : "border-black/[0.07] bg-white"

    }`}

  >

    {eyebrow && (

      <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#F97316]">

        {eyebrow}

      </p>

    )}



    <h3 className="mt-1 font-bold text-[#171717]">{title}</h3>



    {description && (

      <p className="mt-1 text-xs leading-5 text-black/40">

        {description}

      </p>

    )}



    <div className="mt-4">{children}</div>

  </section>

);



const DimensionFields = ({

  value,

  onChange,

  disabled = false,

}) => (

  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

    <ReviewField

      label="Length"

      type="number"

      min="0.001"

      required

      disabled={disabled}

      value={value.length}

      onChange={(next) =>

        onChange("length", next)

      }

    />



    <ReviewField

      label="Width"

      type="number"

      min="0.001"

      required

      disabled={disabled}

      value={value.width}

      onChange={(next) =>

        onChange("width", next)

      }

    />



    <ReviewField

      label="Height"

      type="number"

      min="0.001"

      required

      disabled={disabled}

      value={value.height}

      onChange={(next) =>

        onChange("height", next)

      }

    />



    <ReviewSelect

      label="Unit"

      disabled={disabled}

      value={value.unit}

      onChange={(next) =>

        onChange("unit", next)

      }

      options={[

        ["cm", "cm"],

        ["mm", "mm"],

      ]}

    />

  </div>

);



const ReviewField = ({

  label,

  value,

  onChange,

  type = "text",

  required = false,

  disabled = false,

  min,

  max,

  placeholder = "",

}) => (

  <label className="block">

    <span className="mb-2 block text-xs font-semibold text-black/60">

      {label}

      {required && (

        <span className="ml-1 text-[#F97316]">*</span>

      )}

    </span>



    <input

      type={type}

      required={required}

      disabled={disabled}

      min={min}

      max={max}

      step={type === "number" ? "any" : undefined}

      value={value}

      onChange={(event) =>

        onChange(event.target.value)

      }

      placeholder={placeholder}

      className="w-full rounded-xl border border-black/10 bg-white px-3.5 py-3 text-sm outline-none transition focus:border-[#F97316] focus:ring-4 focus:ring-orange-100 disabled:bg-black/[0.035] disabled:text-black/40"

    />

  </label>

);



const ReviewSelect = ({

  label,

  value,

  onChange,

  options,

  disabled = false,

}) => (

  <label className="block">

    <span className="mb-2 block text-xs font-semibold text-black/60">

      {label}

    </span>



    <select

      value={value}

      disabled={disabled}

      onChange={(event) =>

        onChange(event.target.value)

      }

      className="w-full rounded-xl border border-black/10 bg-white px-3.5 py-3 text-sm outline-none transition focus:border-[#F97316] focus:ring-4 focus:ring-orange-100 disabled:bg-black/[0.035] disabled:text-black/40"

    >

      {options.map(

        ([optionValue, optionLabel]) => (

          <option

            key={optionValue}

            value={optionValue}

          >

            {optionLabel}

          </option>

        )

      )}

    </select>

  </label>

);



const ReadOnlyValue = ({ label, value }) => (

  <div className="rounded-xl border border-black/[0.05] bg-[#FAFAF9] px-3.5 py-3">

    <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-black/30">

      {label}

    </p>

    <p className="mt-1.5 text-sm font-bold text-[#171717]">

      {value}

    </p>

  </div>

);



export default ProductMasterImport;