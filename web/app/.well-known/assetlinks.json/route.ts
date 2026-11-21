// Digital Asset Links — lets the Android app (Trusted Web Activity) open collegeolo.com full-screen
// without the browser bar. Set in web/.env:
//   ANDROID_PACKAGE_NAME=com.collegeolo.app
//   ANDROID_SHA256_CERT_FINGERPRINTS=AA:BB:…   (Play Console → App integrity → App signing key; comma-separate several)
export const dynamic = 'force-dynamic';   // reads env at runtime

export function GET() {
  const pkg = process.env.ANDROID_PACKAGE_NAME;
  const prints = (process.env.ANDROID_SHA256_CERT_FINGERPRINTS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const body = pkg && prints.length
    ? [{ relation: ['delegate_permission/common.handle_all_urls'], target: { namespace: 'android_app', package_name: pkg, sha256_cert_fingerprints: prints } }]
    : [];
  return Response.json(body, { headers: { 'Cache-Control': 'public, max-age=3600' } });
}
