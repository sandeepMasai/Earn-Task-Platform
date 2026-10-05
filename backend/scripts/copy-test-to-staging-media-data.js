require('dotenv').config();

const mongoose = require('mongoose');

const COLLECTIONS = [
  'users',
  'posts',
  'stories',
  'tasks',
  'tasksubmissions',
  'creatorcoinrequests'
];

async function connect(uri, label) {
  const client = await mongoose.createConnection(uri).asPromise();
  console.log(`${label}: ${client.db.databaseName}`);
  return client;
}

(async () => {
  let source;
  let destination;

  try {
    const stagingUri = process.env.MONGODB_URI;

    if (!stagingUri) {
      throw new Error('MONGODB_URI is missing');
    }

    const stagingUrl = new URL(stagingUri);

    if (stagingUrl.pathname.slice(1) !== 'earn_task_platform_staging') {
      throw new Error(
        `SAFETY STOP: destination DB is ${stagingUrl.pathname.slice(1)}, expected earn_task_platform_staging`
      );
    }

    // Source = same MongoDB cluster, test database.
    const sourceUrl = new URL(stagingUri);
    sourceUrl.pathname = '/test';

    console.log('\nSOURCE:', sourceUrl.pathname.slice(1));
    console.log('DESTINATION:', stagingUrl.pathname.slice(1));

    source = await connect(sourceUrl.toString(), 'SOURCE');
    destination = await connect(stagingUri, 'DESTINATION');

    console.log('\n=== PRE-COPY ===');

    for (const name of COLLECTIONS) {
      const sourceCount =
        await source.db.collection(name).countDocuments({});

      const destinationCount =
        await destination.db.collection(name).countDocuments({});

      console.log(
        `${name}: source=${sourceCount}, staging=${destinationCount}`
      );

      if (destinationCount > 0) {
        throw new Error(
          `SAFETY STOP: staging collection "${name}" is not empty`
        );
      }
    }

    console.log('\n=== COPYING ===');

    for (const name of COLLECTIONS) {
      const docs =
        await source.db.collection(name).find({}).toArray();

      if (docs.length === 0) {
        console.log(`${name}: 0 documents, skipped`);
        continue;
      }

      await destination.db.collection(name).insertMany(docs, {
        ordered: true
      });

      console.log(`${name}: copied ${docs.length}`);
    }

    console.log('\n=== POST-COPY VERIFICATION ===');

    let failed = false;

    for (const name of COLLECTIONS) {
      const sourceCount =
        await source.db.collection(name).countDocuments({});

      const destinationCount =
        await destination.db.collection(name).countDocuments({});

      console.log(
        `${name}: source=${sourceCount}, staging=${destinationCount}`
      );

      if (sourceCount !== destinationCount) {
        failed = true;
      }
    }

    if (failed) {
      throw new Error('VERIFICATION_FAILED');
    }

    console.log('\nCOPY COMPLETE');
    console.log('Only media/application collections were copied.');
    console.log('Financial collections were NOT touched.');

  } catch (error) {
    console.error('\nERROR:', error.message);
    process.exitCode = 1;
  } finally {
    if (source) await source.close();
    if (destination) await destination.close();
  }
})();
