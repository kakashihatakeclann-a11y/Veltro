import * as admin from "firebase-admin"

function getServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!raw) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT environment variable is not set")
  }
  try {
    return JSON.parse(raw)
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT environment variable is not valid JSON")
  }
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(getServiceAccount()),
  })
}

export const adminDb = admin.firestore()
