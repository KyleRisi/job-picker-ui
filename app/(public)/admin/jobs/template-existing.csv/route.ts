import { NextResponse } from 'next/server';

export async function GET() {
  const csv = 'title,description,full_name,email,q1,q2,q3,day_to_day,incidents,kpi_assessment,consent_read_on_show\nPopcorn Quality Control Specialist,Tests popcorn quality before every show.,Casey Performer,casey@example.com,Steady under pressure,Team first,Host A,Manage popcorn standards and stock.,No major incidents this quarter.,On target and improving,Y';
  return new NextResponse(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="jobs-existing-template.csv"'
    }
  });
}
