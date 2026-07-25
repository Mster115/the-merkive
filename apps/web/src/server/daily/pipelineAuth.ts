/**
 * Shared auth gate for the daily content-pipeline admin routes.
 *
 * These routes submit, review, and approve puzzle packs, so an unauthenticated
 * caller can queue whatever content it likes into the daily games. The check
 * lived as an identical copy in each route; keeping one copy means the
 * fail-closed rule below cannot drift between them as routes are added.
 */

/** Header a pipeline caller may present instead of `Authorization: Bearer`. */
export const PIPELINE_SECRET_HEADER = "x-mb-pipeline-secret";

export function isPipelineAuthorized(req: Request): boolean {
  const secret = process.env.DAILY_PIPELINE_SECRET;

  if (!secret) {
    // Unset is treated as "local development", where requiring a secret would
    // make the pipeline unusable without extra setup. In production an unset
    // secret is a misconfiguration, not permission: fail closed so a forgotten
    // env var can never leave these write routes open to anyone who finds them.
    if (process.env.NODE_ENV === "production") {
      console.error(
        "[daily] DAILY_PIPELINE_SECRET is not set — refusing admin pipeline request. " +
          "Set it on the deployment to enable the content pipeline."
      );
      return false;
    }
    return true;
  }

  const headerVal = req.headers.get(PIPELINE_SECRET_HEADER);
  const authHeader = req.headers.get("authorization");
  return headerVal === secret || authHeader === `Bearer ${secret}`;
}
