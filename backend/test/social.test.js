const { test } = require('node:test');
const assert = require('node:assert/strict');
const service = require('../src/services/social');
for (const provider of ['youtube', 'instagram', 'unsupported']) {
  test(`${provider} never trusts a client claim and falls back to proof`, async () => {
    const result = await service.verify(provider, provider === 'youtube' ? 'youtube_subscribe' : 'instagram_follow');
    assert.equal(result.verified, false); assert.equal(result.requiresProof, true);
    assert.equal(result.verificationMethod, 'manual_proof'); assert.ok(Date.parse(result.checkedAt));
  });
}
test('YouTube unsupported actions remain unverified', async () => {
  assert.equal((await new service.YouTubeVerificationProvider().verify({ action: 'watch_video' })).reason, 'unsupported_action');
});
for (const scenario of ['official verified action', 'official unverified action', 'revoked OAuth', 'provider API failure', 'provider rate limit']) {
  test(`live social verification: ${scenario}`, { skip: 'No official OAuth integration/authorized identity is configured; successful evidence is not fabricated' }, () => {});
}
