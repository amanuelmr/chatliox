// Attachment URLs come back from the API as paths relative to the backend
// (e.g. "/media/{conversation_id}/{file}"), not the frontend origin.
export function resolveAttachmentUrl(url: string): string {
  if (/^https?:\/\//.test(url)) return url
  return `${import.meta.env.VITE_API_URL as string}${url}`
}

export function isImageAttachment(mime: string | null): boolean {
  return mime !== null && mime.startsWith('image/')
}
