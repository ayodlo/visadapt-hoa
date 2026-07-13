'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/context/session';
import { isStaff } from '@/lib/roles';

export default function AnnouncementsRedirect() {
  const session = useSession();
  const router = useRouter();

  useEffect(() => {
    if (isStaff(session.role)) {
      router.replace('/admin/announcements');
    } else {
      router.replace('/resident/announcements');
    }
  }, [session.role, router]);

  return null;
}
