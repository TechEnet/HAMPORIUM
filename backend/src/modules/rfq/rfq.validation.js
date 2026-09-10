const isValidEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    String(email || "").trim()
  );
};

export const validateCreateRFQ = (req, res, next) => {
  const {
    contactName,
    contactEmail,
    title,
    quantity,
    budgetPerGift,
    totalBudget,
  } = req.body;

  if (!contactName?.trim()) {
    return res.status(400).json({
      success: false,
      message: "Contact name is required.",
    });
  }

  if (!contactEmail?.trim()) {
    return res.status(400).json({
      success: false,
      message: "Contact email is required.",
    });
  }

  if (!isValidEmail(contactEmail)) {
    return res.status(400).json({
      success: false,
      message: "Enter a valid contact email.",
    });
  }

  if (!title?.trim()) {
    return res.status(400).json({
      success: false,
      message: "RFQ title is required.",
    });
  }

  if (!quantity || Number(quantity) < 1) {
    return res.status(400).json({
      success: false,
      message: "Quantity must be at least 1.",
    });
  }

  if (
    budgetPerGift !== undefined &&
    Number(budgetPerGift) < 0
  ) {
    return res.status(400).json({
      success: false,
      message: "Budget per gift cannot be negative.",
    });
  }

  if (
    totalBudget !== undefined &&
    Number(totalBudget) < 0
  ) {
    return res.status(400).json({
      success: false,
      message: "Total budget cannot be negative.",
    });
  }

  next();
};

export const validateCreateCustomHamperRFQ = (req, res, next) => {
  const {
    containerId,
    items,
    decorations,
    quantity,
    requiredDeliveryDate,
    addressModel,
  } = req.body;

  if (!containerId) {
    return res.status(400).json({
      success: false,
      message: "Choose a hamper box before requesting a quotation.",
    });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Add at least one gift to the hamper.",
    });
  }

  if (decorations !== undefined && !Array.isArray(decorations)) {
    return res.status(400).json({
      success: false,
      message: "Decorations must be an array.",
    });
  }

  const parsedQuantity = Number(quantity);

  if (
    !Number.isInteger(parsedQuantity) ||
    parsedQuantity < 1 ||
    parsedQuantity > 100000
  ) {
    return res.status(400).json({
      success: false,
      message: "Bulk quantity must be between 1 and 100000.",
    });
  }

  if (!requiredDeliveryDate) {
    return res.status(400).json({
      success: false,
      message: "Required delivery date is required for a bulk quotation.",
    });
  }

  const parsedDate = new Date(requiredDeliveryDate);

  if (Number.isNaN(parsedDate.getTime())) {
    return res.status(400).json({
      success: false,
      message: "Enter a valid required delivery date.",
    });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (parsedDate < today) {
    return res.status(400).json({
      success: false,
      message: "Required delivery date cannot be in the past.",
    });
  }

  if (
    addressModel !== undefined &&
    ![
      "single_address",
      "multiple_addresses",
      "not_decided",
    ].includes(addressModel)
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid delivery model.",
    });
  }

  next();
};

export const validateSubmitRFQ = (req, res, next) => {
  next();
};
