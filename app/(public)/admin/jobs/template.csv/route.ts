import { NextResponse } from 'next/server';

export async function GET() {
  const csv = 'title,description\nExample Role,Example description';
  return new NextResponse(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="jobs-template.csv"'
    }
  });
}
