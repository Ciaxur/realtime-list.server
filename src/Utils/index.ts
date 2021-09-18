import { createHash } from 'crypto';


// Helper Function for Generating Hashes
export function generateHash() {
  const current_date = (new Date()).valueOf().toString();
  const random = Math.random().toString();
  return createHash('sha1').update(current_date + random).digest('hex');
}