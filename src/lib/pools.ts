import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs,
  query, 
  where, 
  increment,
  serverTimestamp,
  Timestamp 
} from 'firebase/firestore';
import { db } from './firebase';
import { Pool, PoolMember } from './types';

/**
 * Generate a random 6-character alphanumeric joinCode
 */
export function generateJoinCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude similar-looking chars
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Check if a joinCode is already in use
 */
async function isJoinCodeUnique(joinCode: string): Promise<boolean> {
  const poolsRef = collection(db, 'pools');
  const q = query(poolsRef, where('joinCode', '==', joinCode));
  const snapshot = await getDocs(q);
  return snapshot.empty;
}

/**
 * Generate a unique joinCode
 */
async function generateUniqueJoinCode(): Promise<string> {
  let joinCode = generateJoinCode();
  let attempts = 0;
  
  while (!(await isJoinCodeUnique(joinCode)) && attempts < 10) {
    joinCode = generateJoinCode();
    attempts++;
  }
  
  if (attempts >= 10) {
    throw new Error('Failed to generate unique join code');
  }
  
  return joinCode;
}

/**
 * Create a new pool
 */
export async function createPool(
  userId: string,
  displayName: string,
  poolName: string,
  seasonId: string,
  photoURL?: string
): Promise<string> {
  const joinCode = await generateUniqueJoinCode();
  const poolId = doc(collection(db, 'pools')).id;
  
  const poolData: Omit<Pool, 'createdAt'> & { createdAt: any } = {
    seasonId,
    name: poolName,
    joinCode,
    createdBy: userId,
    createdAt: serverTimestamp(),
    membersCount: 1,
    scoringVersion: 'v1',
    maxMargin: 99,
  };
  
  // Create pool document
  await setDoc(doc(db, 'pools', poolId), poolData);
  
  // Add creator as first member
  const memberData: Omit<PoolMember, 'joinedAt'> & { joinedAt: any } = {
    displayName,
    photoURL,
    joinedAt: serverTimestamp(),
  };
  
  await setDoc(doc(db, 'pools', poolId, 'members', userId), memberData);
  
  return poolId;
}

/**
 * Find pool by joinCode
 */
export async function findPoolByJoinCode(joinCode: string): Promise<{ id: string; pool: Pool } | null> {
  const poolsRef = collection(db, 'pools');
  const q = query(poolsRef, where('joinCode', '==', joinCode.toUpperCase()));
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) {
    return null;
  }
  
  const poolDoc = snapshot.docs[0];
  return {
    id: poolDoc.id,
    pool: poolDoc.data() as Pool,
  };
}

/**
 * Join an existing pool
 */
export async function joinPool(
  poolId: string,
  userId: string,
  displayName: string,
  photoURL?: string
): Promise<void> {
  // Check if user is already a member
  const memberRef = doc(db, 'pools', poolId, 'members', userId);
  const memberSnap = await getDoc(memberRef);
  
  if (memberSnap.exists()) {
    throw new Error('You are already a member of this pool');
  }
  
  // Add user as member
  const memberData: Omit<PoolMember, 'joinedAt'> & { joinedAt: any } = {
    displayName,
    photoURL,
    joinedAt: serverTimestamp(),
  };
  
  await setDoc(memberRef, memberData);
  
  // Increment members count
  const poolRef = doc(db, 'pools', poolId);
  await setDoc(poolRef, { membersCount: increment(1) }, { merge: true });
}

/**
 * Get all pools where user is a member
 */
export async function getUserPools(userId: string): Promise<Array<{ id: string; pool: Pool; member: PoolMember }>> {
  const poolsRef = collection(db, 'pools');
  const poolsSnapshot = await getDocs(poolsRef);
  
  const userPools: Array<{ id: string; pool: Pool; member: PoolMember }> = [];
  
  for (const poolDoc of poolsSnapshot.docs) {
    const memberRef = doc(db, 'pools', poolDoc.id, 'members', userId);
    const memberSnap = await getDoc(memberRef);
    
    if (memberSnap.exists()) {
      userPools.push({
        id: poolDoc.id,
        pool: poolDoc.data() as Pool,
        member: memberSnap.data() as PoolMember,
      });
    }
  }
  
  return userPools;
}

/**
 * Get all members of a pool
 */
export async function getPoolMembers(poolId: string): Promise<Array<{ id: string; member: PoolMember }>> {
  const membersRef = collection(db, 'pools', poolId, 'members');
  const snapshot = await getDocs(membersRef);
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    member: doc.data() as PoolMember,
  }));
}

/**
 * Get pool details
 */
export async function getPool(poolId: string): Promise<Pool | null> {
  const poolRef = doc(db, 'pools', poolId);
  const poolSnap = await getDoc(poolRef);
  
  if (!poolSnap.exists()) {
    return null;
  }
  
  return poolSnap.data() as Pool;
}

/**
 * Get matches for a specific season and round
 */
export async function getMatchesForRound(seasonId: string, round: number): Promise<Array<{ id: string; match: any }>> {
  const matchesRef = collection(db, 'seasons', seasonId, 'matches');
  const q = query(matchesRef, where('round', '==', round));
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    match: doc.data(),
  }));
}
