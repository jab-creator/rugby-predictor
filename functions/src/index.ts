import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK
admin.initializeApp();

// Export Firestore instance for use in functions
export const db = admin.firestore();

// Placeholder for future functions
// Scoring engine will be implemented in Milestone 6

// Example health check function (optional)
export const health = functions.https.onRequest((request, response) => {
  response.json({ status: 'ok', timestamp: Date.now() });
});
