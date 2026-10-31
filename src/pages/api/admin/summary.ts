import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '@/lib/requireAdmin';
import { CountUpcomingBookings, ListBookings } from '@/lib/query/bookings.query';
import { CountOpenWork } from '@/lib/query/clients.query';
import { ListCaseStudies } from '@/lib/query/caseStudies.query';
import { GetContent } from '@/lib/query/content.query';
import { sendApiError } from '@/lib/validate';
import { buildWorkBoard } from '@/lib/portal';
import { dashboardData } from '@/lib/dashboard';

// Counts for the admin dashboard
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await requireAdmin(req, res))) return;
  if (req.method !== 'GET') return res.status(405).end();

  try {
    const caseStudies = ListCaseStudies();
    const services = GetContent('services', true);
    const testimonials = GetContent('testimonials', true);
    return res.status(200).json({
      ok: true,
      data: {
        upcomingBookings: CountUpcomingBookings(),
        ...CountOpenWork(),
        caseStudies: { published: caseStudies.filter((c) => c.status === 'published').length, total: caseStudies.length },
        services: { visible: services.filter((s) => !s.isHidden).length, total: services.length },
        testimonials: { visible: testimonials.filter((t) => !t.isHidden).length, total: testimonials.length },
        board: buildWorkBoard(),
        nextCalls: ListBookings('upcoming').filter((b) => b.status === 'confirmed').slice(0, 5),
        ...dashboardData(),
      },
    });
  } catch (err) {
    return sendApiError(res, err);
  }
}
