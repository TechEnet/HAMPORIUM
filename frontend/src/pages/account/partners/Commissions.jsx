import {
  useEffect,
  useState,
} from "react";

import api from "../../../api/api.js";


const Commissions = () => {
  const [commissions, setCommissions] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [status, setStatus] =
    useState("");


  useEffect(() => {
    const load = async () => {
      try {
        const response =
          await api.get(
            "/commissions/mine",
            {
              params: status
                ? { status }
                : {},
            }
          );

        setCommissions(
          response.data.commissions ||
            []
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [status]);


  const total =
    commissions.reduce(
      (sum, item) =>
        sum +
        Number(
          item.amount || 0
        ),
      0
    );


  const paid =
    commissions
      .filter(
        (item) =>
          item.status ===
          "paid"
      )
      .reduce(
        (sum, item) =>
          sum +
          Number(
            item.amount || 0
          ),
        0
      );


  return (
    <div className="space-y-7">

      <div>

        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#F97316]">
          Event Partner
        </p>

        <h1 className="mt-2 text-3xl font-black">
          Commission
        </h1>

        <p className="mt-2 text-sm text-black/45">
          Track attributed, payable and paid partner commission.
        </p>

      </div>


      <div className="grid gap-4 md:grid-cols-3">

        <Stat
          label="Records"
          value={
            commissions.length
          }
        />

        <Stat
          label="Current Total"
          value={`₹${total.toLocaleString(
            "en-IN"
          )}`}
        />

        <Stat
          label="Paid"
          value={`₹${paid.toLocaleString(
            "en-IN"
          )}`}
        />

      </div>


      <div className="flex items-center justify-between">

        <h2 className="text-xl font-black">
          Commission History
        </h2>


        <select
          value={status}
          onChange={(event) =>
            setStatus(
              event.target.value
            )
          }
          className="rounded-xl border border-black/10 px-4 py-2.5 text-sm outline-none"
        >

          <option value="">
            All Statuses
          </option>

          {[
            "attributed",
            "order_confirmed",
            "eligible",
            "payable",
            "paid",
            "reversed",
          ].map((value) => (
            <option
              key={value}
              value={value}
            >
              {format(value)}
            </option>
          ))}

        </select>

      </div>


      {loading ? (
        <div className="py-20 text-center">
          Loading...
        </div>
      ) : (
        <div className="overflow-hidden rounded-[24px] border border-black/10 bg-white">

          {commissions.map(
            (commission) => (
              <div
                key={
                  commission._id
                }
                className="grid gap-4 border-b border-black/5 p-5 last:border-b-0 md:grid-cols-[1fr_auto]"
              >

                <div>

                  <p className="text-xs font-bold uppercase tracking-wider text-[#D4AF37]">
                    {
                      commission.commissionId
                    }
                  </p>


                  <p className="mt-2 font-black">
                    {commission.project
                      ?.title ||
                      "Partner Project"}
                  </p>


                  <p className="mt-1 text-xs text-black/40">
                    Eligible Value ₹
                    {Number(
                      commission.eligibleValue ||
                        0
                    ).toLocaleString(
                      "en-IN"
                    )}
                  </p>

                </div>


                <div className="md:text-right">

                  <p className="text-xl font-black text-[#F97316]">
                    ₹
                    {Number(
                      commission.amount ||
                        0
                    ).toLocaleString(
                      "en-IN"
                    )}
                  </p>


                  <div className="mt-2 flex flex-wrap gap-2 md:justify-end">

                    <Badge
                      value={
                        commission.status
                      }
                    />

                    <Badge
                      value={
                        commission.payoutStatus
                      }
                    />

                  </div>

                </div>

              </div>
            )
          )}


          {!commissions.length && (
            <div className="p-12 text-center text-sm text-black/40">
              No commission records yet.
            </div>
          )}

        </div>
      )}

    </div>
  );
};


const Stat = ({
  label,
  value,
}) => (
  <div className="rounded-2xl border border-black/10 bg-white p-5">

    <p className="text-xs text-black/40">
      {label}
    </p>

    <p className="mt-2 text-2xl font-black">
      {value}
    </p>

  </div>
);


const Badge = ({ value }) => (
  <span className="rounded-full bg-[#FFF9F2] px-3 py-1 text-[9px] font-black uppercase tracking-wider text-[#F97316]">
    {format(value)}
  </span>
);


const format = (
  value = ""
) =>
  String(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) =>
      char.toUpperCase()
    );


export default Commissions;