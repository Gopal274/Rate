
'use client';

// This file exports client-side Firebase utilities and hooks.
// It is marked 'use client' to ensure it's treated as a client module.

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';

// We explicitly DO NOT export server-only files like server.ts from here.
// We also DO NOT export client.ts directly, as its functionality is exposed
// via client-provider.tsx.
