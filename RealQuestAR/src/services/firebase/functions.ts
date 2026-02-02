import { getFunctions, httpsCallable } from "firebase/functions";
import { firebaseApp } from "./app";

export const functions = getFunctions(firebaseApp, "asia-northeast1");
export const helloCallable = httpsCallable(functions, "hello");
// The Cloud Functions for Firebase SDK to create Cloud Functions and triggers.
const {logger} = require("firebase-functions");
const {onRequest} = require("firebase-functions/https");
const {onDocumentCreated} = require("firebase-functions/firestore");

// The Firebase Admin SDK to access Firestore.
const {initializeApp} = require("firebase-admin/app");
const {getFirestore} = require("firebase-admin/firestore");

initializeApp();