// Test script for referral system
const axios = require('axios');

const API_URL = 'http://localhost:3000/api';

async function testReferral() {
  try {
    console.log('🧪 Testing Referral System...\n');

    // Step 1: Create referrer user
    console.log('1️⃣ Creating referrer user...');
    const referrerResponse = await axios.post(`${API_URL}/auth/signup`, {
      email: `referrer${Date.now()}@test.com`,
      password: 'test123',
      name: 'Referrer User',
      username: `referrer${Date.now()}`,
    });
    const referrerCode = referrerResponse.data.data.user.referralCode;
    const referrerToken = referrerResponse.data.data.token;
    console.log('✅ Referrer created:', referrerResponse.data.data.user.username);
    console.log('📝 Referral Code:', referrerCode);
    console.log('💰 Initial Coins:', referrerResponse.data.data.user.coins, '\n');

    // Step 2: Get referrer's initial balance
    const referrerMe = await axios.get(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${referrerToken}` },
    });
    const initialCoins = referrerMe.data.data.user.coins;
    console.log('💰 Referrer initial coins:', initialCoins, '\n');

    // Step 3: Create new user with referral code
    console.log('2️⃣ Creating new user with referral code...');
    const newUserResponse = await axios.post(`${API_URL}/auth/signup`, {
      email: `newuser${Date.now()}@test.com`,
      password: 'test123',
      name: 'New User',
      username: `newuser${Date.now()}`,
      referralCode: referrerCode,
    });
    console.log('✅ New user created:', newUserResponse.data.data.user.username, '\n');

    // Step 4: Check referrer's coins after referral
    console.log('3️⃣ Checking referrer coins after referral...');
    // Wait a bit for the database to update
    await new Promise(resolve => setTimeout(resolve, 1000));
    const referrerAfter = await axios.get(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${referrerToken}` },
    });
    const newCoins = referrerAfter.data.data.user.coins;
    console.log('💰 Referrer coins after referral:', newCoins);
    console.log('💰 Expected coins:', initialCoins + 500);
    console.log('✅ Bonus added:', newCoins === initialCoins + 500 ? 'YES ✅' : 'NO ❌', '\n');

    // Step 5: Check referral stats
    console.log('4️⃣ Checking referral stats...');
    const statsResponse = await axios.get(`${API_URL}/referrals/stats`, {
      headers: { Authorization: `Bearer ${referrerToken}` },
    });
    console.log('📊 Referral Stats:', JSON.stringify(statsResponse.data.data, null, 2), '\n');

    // Step 6: Check transactions
    console.log('5️⃣ Checking wallet transactions...');
    const walletResponse = await axios.get(`${API_URL}/wallet/transactions`, {
      headers: { Authorization: `Bearer ${referrerToken}` },
    });
    const referralTransactions = walletResponse.data.data.filter(
      (t) => t.type === 'referral'
    );
    console.log('💳 Referral transactions:', referralTransactions.length);
    if (referralTransactions.length > 0) {
      console.log('✅ Latest referral transaction:', JSON.stringify(referralTransactions[0], null, 2));
    }

    console.log('\n✅ Referral system test completed!');
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

testReferral();

