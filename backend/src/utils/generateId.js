import { randomBytes } from "node:crypto";

const generateId = (prefix = "ID") => {
  const time = Date.now().toString(36).toUpperCase();
  const random = randomBytes(3).toString("hex").toUpperCase();

  return `${prefix}-${time}-${random}`;
};

export default generateId;