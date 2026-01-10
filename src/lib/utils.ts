import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Firestore Timestamp can be an object with seconds and nanoseconds
type FirestoreTimestamp = {
  seconds: number;
  nanoseconds: number;
};

// Type guard to check if a value is a Firestore Timestamp
function isFirestoreTimestamp(value: any): value is FirestoreTimestamp {
  return value && typeof value.seconds === 'number' && typeof value.nanoseconds === 'number';
}

/**
 * Safely converts various date representations (string, Date, Firestore Timestamp) to a JS Date object.
 * Returns the current date as a fallback if the input is invalid.
 * @param dateValue The value to convert.
 * @returns A valid Date object.
 */
export function safeToDate(dateValue: any): Date {
  if (!dateValue) {
    return new Date(); // Fallback for null/undefined
  }
  if (dateValue instanceof Date) {
    return dateValue; // Already a Date
  }
  if (isFirestoreTimestamp(dateValue)) {
    // Convert from Firestore Timestamp object
    return new Date(dateValue.seconds * 1000);
  }
  // Try parsing from string (ISO, etc.)
  const parsedDate = new Date(dateValue);
  if (!isNaN(parsedDate.getTime())) {
    return parsedDate;
  }
  return new Date(); // Final fallback
}
