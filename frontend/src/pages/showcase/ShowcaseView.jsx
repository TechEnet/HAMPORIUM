import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useNavigate,
  useParams,
} from "react-router-dom";

import api from "../../api/api.js";


const ShowcaseView = () => {
  const { token } =
    useParams();

  const navigate =
    useNavigate();

  const [showcase, setShowcase] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [comment, setComment] =
    useState("");

  const [busy, setBusy] =
    useState(false);


  const sessionToken =
    sessionStorage.getItem(
      `showcaseSession:${token}`
    );


  const headers = useMemo(
    () => ({
      "x-showcase-session":
        sessionToken,
    }),
    [sessionToken]
  );


  const load = async () => {
    if (!sessionToken) {
      navigate(
        `/showcase/${token}`
      );

      return;
    }

    try {
      const response =
        await api.get(
          "/showcases/public/session/view",
          {
            headers,
          }
        );

      setShowcase(
        response.data.showcase
      );
    } catch (err) {
      sessionStorage.removeItem(
        `showcaseSession:${token}`
      );

      setError(
        err.response?.data?.message ||
          "Showcase session expired."
      );
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    load();
  }, []);


  const action = async (
    actionType,
    itemId,
    actionComment = ""
  ) => {
    setBusy(true);
    setError("");

    try {
      await api.post(
        "/showcases/public/session/actions",
        {
          action:
            actionType,

          itemId:
            itemId ||
            undefined,

          comment:
            actionComment ||
            undefined,
        },
        {
          headers,
        }
      );

      setComment("");

      await load();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to record action."
      );
    } finally {
      setBusy(false);
    }
  };


  const shortlisted =
    useMemo(() => {
      const state =
        new Set();

      showcase?.actions?.forEach(
        (entry) => {
          if (
            entry.action ===
            "shortlist"
          ) {
            state.add(
              String(
                entry.itemId
              )
            );
          }

          if (
            entry.action ===
            "unshortlist"
          ) {
            state.delete(
              String(
                entry.itemId
              )
            );
          }
        }
      );

      return state;
    }, [showcase]);


  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#171717] text-white">
        Loading private showcase...
      </div>
    );
  }


  if (!showcase) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#171717] px-5 text-white">

        <div className="text-center">

          <h1 className="text-2xl font-black">
            Showcase unavailable
          </h1>

          <p className="mt-2 text-sm text-white/50">
            {error}
          </p>

          <button
            onClick={() =>
              navigate(
                `/showcase/${token}`
              )
            }
            className="mt-6 rounded-full bg-[#F97316] px-6 py-3 font-bold"
          >
            Request Access Again
          </button>

        </div>

      </main>
    );
  }


  return (
    <main className="min-h-screen bg-[#FFF9F2] text-[#171717]">

      {/* HERO */}

      <section className="bg-[#171717] px-5 py-16 text-white sm:px-10 lg:px-16">

        <div className="mx-auto max-w-7xl">

          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#D4AF37]">
            Private HAMPORIUM Showcase
          </p>


          <h1 className="mt-4 max-w-4xl text-4xl font-black sm:text-6xl">
            {showcase.title}
          </h1>


          <p className="mt-5 max-w-2xl text-sm leading-6 text-white/55">
            {showcase.introduction}
          </p>


          <div className="mt-8 flex flex-wrap gap-3">

            <div className="rounded-full border border-white/10 px-4 py-2 text-xs">
              Curated by{" "}
              <strong className="text-[#D4AF37]">
                {showcase.partner
                  ?.businessName ||
                  "HAMPORIUM Partner"}
              </strong>
            </div>

            {showcase.project
              ?.eventType && (
              <div className="rounded-full border border-white/10 px-4 py-2 text-xs">
                {
                  showcase.project
                    .eventType
                }
              </div>
            )}

          </div>

        </div>

      </section>


      {/* PRODUCTS */}

      <section className="mx-auto max-w-7xl px-5 py-12 sm:px-10 lg:px-16">

        <div>

          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#F97316]">
            Curated Options
          </p>

          <h2 className="mt-2 text-3xl font-black">
            Your gifting selection
          </h2>

        </div>


        <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">

          {showcase.items.map(
            (item) => {
              const isShortlisted =
                shortlisted.has(
                  String(item._id)
                );

              const image =
                item.product
                  ?.images?.[0];

              const imageUrl =
                typeof image ===
                "string"
                  ? image
                  : image?.url ||
                    image?.secure_url ||
                    "";


              return (
                <article
                  key={item._id}
                  className="overflow-hidden rounded-[28px] bg-white shadow-sm"
                >

                  <div className="aspect-[4/3] bg-[#FFF9F2]">

                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={
                          item.product
                            ?.name ||
                          item.title
                        }
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-5xl">
                        🎁
                      </div>
                    )}

                  </div>


                  <div className="p-5">

                    <h3 className="text-xl font-black">
                      {item.product
                        ?.name ||
                        item.title}
                    </h3>


                    {item.product
                      ?.shortDescription && (
                      <p className="mt-2 text-sm leading-6 text-black/50">
                        {
                          item.product
                            .shortDescription
                        }
                      </p>
                    )}


                    <div className="mt-5 flex items-end justify-between">

                      <div>

                        <p className="text-xs text-black/40">
                          Client Price
                        </p>

                        <p className="mt-1 text-xl font-black text-[#F97316]">
                          ₹
                          {Number(
                            item.clientPrice
                          ).toLocaleString(
                            "en-IN"
                          )}
                        </p>

                      </div>


                      <button
                        disabled={busy}
                        onClick={() =>
                          action(
                            isShortlisted
                              ? "unshortlist"
                              : "shortlist",
                            item._id
                          )
                        }
                        className={`rounded-full px-4 py-2.5 text-xs font-bold transition ${
                          isShortlisted
                            ? "bg-[#D4AF37] text-[#171717]"
                            : "bg-[#171717] text-white"
                        }`}
                      >
                        {isShortlisted
                          ? "✓ Shortlisted"
                          : "Shortlist"}
                      </button>

                    </div>

                  </div>

                </article>
              );
            }
          )}

        </div>

      </section>


      {/* CLIENT ACTION */}

      <section className="bg-white px-5 py-14 sm:px-10 lg:px-16">

        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-2">

          <div>

            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#D4AF37]">
              Your Feedback
            </p>

            <h2 className="mt-2 text-3xl font-black">
              Tell us what you think.
            </h2>

            <p className="mt-3 max-w-lg text-sm leading-6 text-black/45">
              Approve the selection, enquire with HAMPORIUM or request a change.
            </p>

          </div>


          <div className="rounded-[28px] bg-[#FFF9F2] p-6">

            <textarea
              rows="4"
              value={comment}
              onChange={(event) =>
                setComment(
                  event.target.value
                )
              }
              placeholder="Add your feedback..."
              className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:border-[#F97316]"
            />


            <div className="mt-4 flex flex-wrap gap-3">

              <button
                disabled={
                  busy ||
                  !comment.trim()
                }
                onClick={() =>
                  action(
                    "comment",
                    null,
                    comment
                  )
                }
                className="rounded-full border border-black/10 bg-white px-5 py-3 text-sm font-bold"
              >
                Add Comment
              </button>


              <button
                disabled={
                  busy ||
                  !comment.trim()
                }
                onClick={() =>
                  action(
                    "request_change",
                    null,
                    comment
                  )
                }
                className="rounded-full border border-[#D4AF37] px-5 py-3 text-sm font-bold text-[#8C6B12]"
              >
                Request Changes
              </button>

            </div>


            <div className="mt-4 grid gap-3 sm:grid-cols-2">

              <button
                disabled={busy}
                onClick={() =>
                  action(
                    "enquire"
                  )
                }
                className="rounded-full bg-[#F97316] px-5 py-3.5 text-sm font-black text-white"
              >
                Enquire
              </button>


              <button
                disabled={busy}
                onClick={() =>
                  action(
                    "approve"
                  )
                }
                className="rounded-full bg-[#171717] px-5 py-3.5 text-sm font-black text-white"
              >
                Approve Selection
              </button>

            </div>

          </div>

        </div>

      </section>

    </main>
  );
};


export default ShowcaseView;