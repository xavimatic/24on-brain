import { NextResponse } from 'next/server';
import { obtenerGrafo } from './helper';

export async function GET() {
  try {
    const data = await obtenerGrafo();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error al obtener datos del grafo:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

