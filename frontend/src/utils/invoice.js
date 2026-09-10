import api from "../api/api.js";

const safeFilename = (value) =>
  String(value || "HAMPORIUM-order")
    .replace(/[^a-zA-Z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const readBlobError = async (error) => {
  const blob = error?.response?.data;

  if (!(blob instanceof Blob)) {
    return (
      error?.response?.data?.message ||
      error?.message ||
      "Unable to download invoice"
    );
  }

  try {
    const text = await blob.text();
    const parsed = JSON.parse(text);

    return (
      parsed?.message ||
      "Unable to download invoice"
    );
  } catch {
    return "Unable to download invoice";
  }
};

export const downloadOrderInvoice = async ({
  orderId,
  orderNumber,
} = {}) => {
  if (!orderId) {
    throw new Error("Order ID is required");
  }

  try {
    const response = await api.get(
      `/orders/${orderId}/invoice`,
      {
        responseType: "blob",
      }
    );

    const blob = new Blob([response.data], {
      type:
        response.headers?.["content-type"] ||
        "application/pdf",
    });

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = `${safeFilename(
      orderNumber || orderId
    )}-invoice.pdf`;

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    window.setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);

    return true;
  } catch (error) {
    throw new Error(await readBlobError(error));
  }
};
