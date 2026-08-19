import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const task = await prisma.task.update({
    where: { id },
    data: {
      name: body.name,
      startDate: body.startDate,
      duration: Number(body.duration),
      notes: body.notes ?? '',
      completed: Boolean(body.completed),
      completedAt: body.completed ? (body.completedAt || null) : null,
    },
  })
  return NextResponse.json(task)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await prisma.task.delete({ where: { id } })
  return new Response(null, { status: 204 })
}
