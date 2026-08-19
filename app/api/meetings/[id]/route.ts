import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await prisma.meeting.delete({ where: { id } })
  return new Response(null, { status: 204 })
}
