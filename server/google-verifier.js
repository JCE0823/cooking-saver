import { OAuth2Client } from "google-auth-library";

function invalidCredential() {
  return Object.assign(new Error("Invalid Google credential"), {
    code: "invalid_google_credential"
  });
}

export function createGoogleVerifier({ clientId, client = new OAuth2Client(clientId) } = {}) {
  return {
    async verify(credential) {
      try {
        if (typeof credential !== "string" || credential.trim() === "") {
          throw invalidCredential();
        }

        const ticket = await client.verifyIdToken({
          idToken: credential,
          audience: clientId
        });
        const payload = ticket?.getPayload?.();
        if (
          typeof payload?.sub !== "string" || payload.sub.trim() === "" ||
          typeof payload.email !== "string" || payload.email.trim() === "" ||
          payload.email_verified !== true ||
          typeof payload.name !== "string" || payload.name.trim() === ""
        ) {
          throw invalidCredential();
        }

        return {
          googleSubject: payload.sub,
          email: payload.email.trim().toLowerCase(),
          displayName: payload.name.trim(),
          pictureUrl: typeof payload.picture === "string" ? payload.picture : null
        };
      } catch (_error) {
        throw invalidCredential();
      }
    }
  };
}
