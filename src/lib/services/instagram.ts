export interface InstagramTemplateButton {
  type: "postback";
  title: string;
  payload: string;
}

export interface InstagramTemplateElement {
  title: string;
  image_url?: string;
  subtitle?: string;
  buttons?: InstagramTemplateButton[];
}

const API_VERSION = process.env.INSTAGRAM_API_VERSION || "v22.0";
const PAGE_ACCESS_TOKEN = process.env.INSTAGRAM_PAGE_ACCESS_TOKEN || "";

function getMessagesUrl(): string {
  if (!PAGE_ACCESS_TOKEN) {
    throw new Error("Missing INSTAGRAM_PAGE_ACCESS_TOKEN");
  }
  return `https://graph.facebook.com/${API_VERSION}/me/messages?access_token=${PAGE_ACCESS_TOKEN}`;
}

async function postMessage(payload: Record<string, unknown>): Promise<void> {
  const url = getMessagesUrl();
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Instagram API error ${res.status}: ${body}`);
  }
}

export async function sendInstagramText(recipientId: string, text: string): Promise<void> {
  await postMessage({
    recipient: { id: recipientId },
    message: { text },
  });
}

export async function sendInstagramTemplate(
  recipientId: string,
  elements: InstagramTemplateElement[]
): Promise<void> {
  await postMessage({
    recipient: { id: recipientId },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements,
        },
      },
    },
  });
}
