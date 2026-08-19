import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const meetings = await prisma.meeting.findMany({
    orderBy: [{ date: 'asc' }, { time: 'asc' }],
  })
  return NextResponse.json(meetings)
}

export async function POST(request: Request) {
  const body = await request.json()
  if (!body.name?.trim() || !body.reason?.trim() || !body.date || !body.time) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }
  const meeting = await prisma.meeting.create({
    data: {
      name: body.name,
      reason: body.reason,
      date: body.date,
      time: body.time,
    },
  })
  return NextResponse.json(meeting, { status: 201 })
}
