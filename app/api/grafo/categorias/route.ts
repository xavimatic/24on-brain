import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const rows = await prisma.enlaces.findMany({
      select: { categoria: true },
      distinct: ['categoria'],
      orderBy: { categoria: 'asc' },
    });
    return NextResponse.json(rows.map((r) => r.categoria));
  } catch (error: any) {
    console.error('Error fetching categories:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
