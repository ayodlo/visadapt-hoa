'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/context/session';

export default function AnnouncementsRedirect() {
  const session = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session.role === 'ADMIN' || session.role === 'BOARD_MEMBER') {
      router.replace('/admin/announcements');
    } else {
      router.replace('/resident/announcements');
    }
  }, [session.role, router]);

  return null;
}
