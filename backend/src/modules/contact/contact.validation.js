// Server-side validation for the public Contact Us form.
export const CONTACT_TYPES = Object.freeze({
  general: "General enquiry",
  bulk: "Corporate / bulk gifting",
  partnership: "Business partnership",
  website: "Website feedback",
  other: "Other enquiry",
});

const trimText = (value) => (typeof value === "string" ? value.trim() : "");

export const normalizeContact = (body) => {
  const data = body && typeof body === "object" && !Array.isArray(body) ? body : {};
  return {
    name: trimText(data.name),
    email: trimText(data.email).toLowerCase(),
    phone: trimText(data.phone),
    enquiryType: trimText(data.enquiryType),
    message: trimText(data.message),
    website: trimText(data.website),
  };
};

export const validateContact = ({ name, email, phone, enquiryType, message }) => {
  if (name.length < 2 || name.length > 100 || /[\r\n<>]/.test(name)) {
    return "Please enter a valid full name (2 to 100 characters).";
  }

  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return "Please enter a valid email address.";
  }

  if (phone.length > 25 || /[\r\n<>]/.test(phone)) {
    return "Please enter a valid phone number.";
  }

  if (!Object.hasOwn(CONTACT_TYPES, enquiryType)) {
    return "Please select an enquiry type.";
  }

  if (message.length < 15 || message.length > 2000) {
    return "Message must contain 15 to 2000 characters.";
  }

  return null;
};

export const escapeHtml = (text) =>
  String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
