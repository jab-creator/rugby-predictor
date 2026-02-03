import { NextResponse } from 'next/server';
import { collection, addDoc, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function GET() {
  try {
    // Try to write a test document
    const testRef = collection(db, 'test');
    const docRef = await addDoc(testRef, {
      message: 'Test from API',
      timestamp: new Date().toISOString(),
    });

    // Try to read it back
    const snapshot = await getDocs(testRef);
    const docs = snapshot.docs.map(doc => ({ id: doc.id, data: doc.data() }));

    return NextResponse.json({
      success: true,
      message: 'Firestore is working',
      testDocId: docRef.id,
      docsCount: docs.length,
      docs,
    });
  } catch (error: any) {
    console.error('Firestore test error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      code: error.code,
      stack: error.stack,
    }, { status: 500 });
  }
}
