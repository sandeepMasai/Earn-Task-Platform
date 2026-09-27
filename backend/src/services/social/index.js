class ManualProofVerificationProvider {
  async verify({ reason = 'manual_review_required' } = {}) {
    return { verified: false, requiresProof: true, verificationMethod: 'manual_proof', provider: 'manual_proof', reason, checkedAt: new Date().toISOString() };
  }
}
class YouTubeVerificationProvider extends ManualProofVerificationProvider {
  async verify({ action } = {}) {
    // No server-bound Google OAuth identity exists in this application. A URL,
    // channel ID, API key or client-supplied bearer token cannot establish it.
    return super.verify({ reason: action === 'youtube_subscribe' ? 'official_oauth_not_configured' : 'unsupported_action' });
  }
}
class InstagramVerificationProvider extends ManualProofVerificationProvider {
  async verify() {
    return super.verify({ reason: 'official_action_verification_unavailable' });
  }
}
const providers = { youtube: new YouTubeVerificationProvider(), instagram: new InstagramVerificationProvider() };
exports.verify = (provider, action) => (providers[provider] || new ManualProofVerificationProvider()).verify({ action });
exports.ManualProofVerificationProvider = ManualProofVerificationProvider;
exports.YouTubeVerificationProvider = YouTubeVerificationProvider;
exports.InstagramVerificationProvider = InstagramVerificationProvider;
