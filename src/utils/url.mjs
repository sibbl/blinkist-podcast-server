import url from "url";

export function getCurrentUrl(req) {
  return req.protocol + "://" + req.get("host") + req.originalUrl;
}

export function getAbsoluteUrl(reqOrBaseUrl, relativeUrl) {
  let baseUrl = reqOrBaseUrl;
  if (typeof reqOrBaseUrl !== "string") {
    // possibly express request
    baseUrl = getCurrentUrl(reqOrBaseUrl);
  }
  return url.resolve(baseUrl, relativeUrl);
}
