import Mailjet from "node-mailjet";

const mailjet = new Mailjet({
  apiKey: process.env.MAILJET_API_KEY!,
  apiSecret: process.env.MAILJET_SECRET_KEY!,
});

function getListId(): number {
  const raw = process.env.MAILJET_LIST_ID;
  const n = Number(raw);
  if (!raw || !Number.isFinite(n) || n <= 0) {
    throw new Error("MAILJET_LIST_ID is not configured");
  }
  return n;
}

/**
 * Add a contact to the newsletter list with double opt-in.
 */
export async function subscribeToNewsletter(email: string): Promise<{ success: boolean }> {
  const listId = getListId();

  // Create or retrieve contact
  const contactRes = await mailjet.post("contact").request({ Email: email });
  const contactData = (contactRes.body as { Data: { ID: number }[] }).Data[0];
  if (!contactData) {
    throw new Error("Mailjet: failed to create or retrieve contact");
  }
  const contactId = contactData.ID;

  // Add to list (addnoforce = won't re-add if already subscribed)
  await mailjet
    .post("contact")
    .id(contactId)
    .action("managecontactslists")
    .request({
      ContactsLists: [
        {
          ListID: listId,
          Action: "addnoforce",
        },
      ],
    });

  return { success: true };
}

/**
 * Send the newsletter to the entire contact list via Campaign Draft API.
 *
 * Flow: create draft → set content → send.
 * The Campaign API handles list delivery, unsubscribe tokens ([[UNSUB_LINK_EN]]),
 * and tracking automatically.
 */
export async function sendNewsletter({
  subject,
  htmlContent,
  textContent,
}: {
  subject: string;
  htmlContent: string;
  textContent: string;
}): Promise<{ recipientCount: number }> {
  const listId = getListId();

  // Check subscriber count first
  const listRes = await mailjet.get("contactslist").id(listId).request();
  const listData = (listRes.body as { Data: { SubscriberCount: number }[] }).Data[0];
  if (!listData) {
    throw new Error("Mailjet: contact list not found");
  }
  const subscriberCount = listData.SubscriberCount;

  if (subscriberCount === 0) {
    return { recipientCount: 0 };
  }

  // 1. Create campaign draft targeting the contact list
  const draftRes = await mailjet.post("campaigndraft").request({
    Locale: "fr_FR",
    Sender: process.env.MAILJET_SENDER_NAME || "Poligraph",
    SenderName: process.env.MAILJET_SENDER_NAME || "Poligraph",
    SenderEmail: process.env.MAILJET_SENDER_EMAIL || "newsletter@poligraph.fr",
    Subject: subject,
    ContactsListID: listId,
  });
  const draftData = (draftRes.body as { Data: { ID: number }[] }).Data[0];
  if (!draftData) {
    throw new Error("Mailjet: failed to create campaign draft");
  }
  const draftId = draftData.ID;

  // 2. Set email content (HTML + plain text)
  await mailjet.post("campaigndraft").id(draftId).action("detailcontent").request({
    "Html-part": htmlContent,
    "Text-part": textContent,
  });

  // 3. Send the campaign
  await mailjet.post("campaigndraft").id(draftId).action("send").request({});

  return { recipientCount: subscriberCount };
}

/**
 * Remove a contact from the newsletter list (does NOT delete the contact).
 * Idempotent: silently no-ops if the contact does not exist on Mailjet's side.
 */
export async function removeFromList(email: string): Promise<void> {
  const listId = getListId();

  // Look up an existing contact without creating one (GDPR forget must
  // not provision a ghost contact for users who never subscribed).
  let contactId: number | null = null;
  try {
    const contactRes = await mailjet.get(`contact/${encodeURIComponent(email)}`).request();
    contactId = (contactRes.body as { Data: { ID: number }[] }).Data[0]?.ID ?? null;
  } catch (e) {
    const status = (e as { ErrorMessage?: string; statusCode?: number }).statusCode;
    if (status === 404) return;
    throw e;
  }
  if (!contactId) return;

  await mailjet
    .post("contact")
    .id(contactId)
    .action("managecontactslists")
    .request({
      ContactsLists: [{ ListID: listId, Action: "remove" }],
    });
}

/**
 * Set or update a custom contact data field on a Mailjet contact.
 * Preserves existing fields and overwrites only the named one.
 */
export async function setMailjetCustomField(
  email: string,
  fieldName: string,
  value: string
): Promise<void> {
  const contactRes = await mailjet.get(`contactdata/${encodeURIComponent(email)}`).request();
  const data = (contactRes.body as { Data: { Data: Array<{ Name: string; Value: string }> }[] })
    .Data[0];
  const updatedData = (data?.Data ?? []).filter((d) => d.Name !== fieldName);
  updatedData.push({ Name: fieldName, Value: value });
  await mailjet.put(`contactdata/${encodeURIComponent(email)}`).request({ Data: updatedData });
}
