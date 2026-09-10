import sendTransactionalEmail from "./transactionalEmail.js";

/*
 * Compatibility wrapper for older callers that use { text, html }.
 * All email now goes through one Brevo implementation.
 */
const sendEmail = async ({
  to,
  toName = "",
  subject,
  text = "",
  html = "",
  textContent = "",
  htmlContent = "",
  replyTo = "",
  tags = [],
}) =>
  sendTransactionalEmail({
    to,
    toName,
    subject,
    textContent: textContent || text,
    htmlContent: htmlContent || html,
    replyTo,
    tags,
  });

export default sendEmail;
