import url from "url";

export function getCurrentUrl(req) {
  return req.protocol + "://" + req.get("host") + req.originalUrl;
}

export function getAbsoluteUrl(req, relativeUrl) {
  const baseUrl = getCurrentUrl(req);
  return url.resolve(baseUrl, relativeUrl);
}
