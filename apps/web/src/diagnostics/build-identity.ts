/** App-internal display identity, not a producer contract or public identifier. */
export interface BuildIdentity {
  appVersion: string;
  pinDigestAlgorithm: "sha256";
  pinDigest: string;
  pins: {
    contractOnlyOpenApiSha256: string;
    integrationGateOpenApiSha256: string;
    sdk0ManifestSha256: string;
    sdk0CatalogueSha256: string;
  };
}
export const buildIdentity: Readonly<BuildIdentity> = __KIX_BUILD_IDENTITY__;
