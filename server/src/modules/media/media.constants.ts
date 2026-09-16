// The image library.
//
// This module used to own a list of "sections" — the hero rings — each with a
// fixed number of numbered frames an admin filled from a page of its own.
// Every image on the site is an ordinary field in Admin > Editor now
// (page-content.constants.ts declares them and page_content stores the URL),
// so none of that section/frame machinery is left: uploading a file and
// getting its URL back is the whole job.

export const MEDIA_MESSAGES = {
  UPLOADED: "Image uploaded.",
  FETCHED: "Media fetched.",
  DELETED: "Image deleted.",
  NO_FILE: "No image file was received.",
  NOT_FOUND: "Image not found.",
} as const;
