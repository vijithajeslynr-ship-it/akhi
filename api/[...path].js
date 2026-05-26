const { handleApi } = require("../lib/api");

module.exports = async (req, res) => {
  const segments = req.query.path || [];
  const pathParts = Array.isArray(segments) ? segments : [segments];
  const pathname = "/api/" + pathParts.join("/");
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  return handleApi(req, res, pathname, url.searchParams);
};
